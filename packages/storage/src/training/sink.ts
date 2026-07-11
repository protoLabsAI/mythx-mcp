/**
 * Gameplay event sink — subscribes to a BusEvent stream and persists
 * matching events into the `gameplay_events` table for fine-tuning data.
 *
 * Stays decoupled from the web app's eventBus singleton: the caller
 * passes a `subscribe(channel, handler)` function (so the storage
 * package doesn't depend on apps/web) and a `Database` handle. The web
 * server bootstraps both at startup.
 *
 * Privacy filter (Anonymous level — see spec §6) runs at WRITE time:
 *   - Free-text player input is hashed
 *   - Character names embedded in payloads are hashed
 *   - Long tool-result payloads are truncated at TRUNCATE_LIMIT
 *
 * Spec: docs/finetuning-data-pipeline.md §3, §5.1, §6
 */

import type { Database } from "../sqlite/connection.js";
import { createHash } from "crypto";
import {
  insertGameplayEvent,
  type GameplayActor,
  type GameplayEventInput,
  type GameplayEventType,
} from "./queries.js";

/**
 * The minimal shape we need from a BusEvent — keeps this module free
 * of an apps/web import.
 */
export interface SinkBusEvent<T = unknown> {
  id: string;
  type: string;
  channel: string;
  timestamp: number;
  sessionId?: string;
  payload: T;
  source?: { type: string; role?: string; actorId?: string };
  meta?: { causedBy?: string; sequence?: number; version?: number };
}

export type SinkSubscribe = (
  pattern: string,
  handler: (event: SinkBusEvent) => void | Promise<void>
) => () => void;

export interface SinkOptions {
  db: Database;
  /**
   * Bus subscriber — typically `psubscribe` from the eventBus module.
   * Pass a wildcard pattern (e.g. `session:*:state`) and the sink
   * filters by `event.type` against the type-mapper below.
   */
  psubscribe: SinkSubscribe;
  /**
   * Privacy level. `anonymous` (default) hashes free-text and
   * character names. `full` writes everything verbatim — only for
   * users who opt into the training program. `off` no-ops the sink.
   */
  privacy?: "off" | "anonymous" | "full";
  /**
   * Tool-result payloads larger than this many bytes get truncated
   * with a marker. Spec §3.3 picks 10 KB as the default.
   */
  truncateLimit?: number;
  /**
   * Optional logger — defaults to console.warn. The sink should never
   * crash the bus subscriber, so failures land here instead of
   * propagating.
   */
  log?: (level: "warn" | "error", msg: string, err?: unknown) => void;
  /**
   * Optional hook fired AFTER a successful insert. The web server uses
   * this to wake up the reward reconciler — without it, reward signals
   * (`was_undone`, `was_thumbed`) would only land on `flush()` at
   * shutdown. The hook receives the sessionId of the just-inserted
   * event; consumers typically call
   * `rewardReconciler.scheduleSession(sessionId)` here to debounce a
   * follow-up reconcile pass.
   *
   * Errors thrown from this hook are swallowed and logged — same
   * data-loss-over-crash policy as the insert itself.
   */
  onEventInserted?: (sessionId: string, event: SinkBusEvent) => void;
}

/**
 * Map BusEvent.type → gameplay_events.event_type. The mapper IS the
 * filter: anything not in this table is ignored. Keep this list in
 * lockstep with packages/tools/src/events/channels.ts EventTypes.
 */
const TYPE_MAP: Record<string, { eventType: GameplayEventType; actor: GameplayActor }> = {
  // dice / tests
  DICE_ROLLED: { eventType: "dice_rolled", actor: "system" },
  TEST_RESOLVED: { eventType: "dice_rolled", actor: "system" },
  CUSTOM_TEST_RESOLVED: { eventType: "dice_rolled", actor: "system" },
  // combat
  COMBAT_STARTED: { eventType: "combat_event", actor: "system" },
  COMBAT_ENDED: { eventType: "combat_event", actor: "system" },
  TURN_ADVANCED: { eventType: "combat_event", actor: "system" },
  DAMAGE_DEALT: { eventType: "combat_event", actor: "system" },
  DAMAGE_TAKEN: { eventType: "combat_event", actor: "system" },
  CONDITION_APPLIED: { eventType: "combat_event", actor: "system" },
  CONDITION_REMOVED: { eventType: "combat_event", actor: "system" },
  // clocks
  CLOCK_TICKED: { eventType: "clock_ticked", actor: "system" },
  // Clock priming from the onSessionStart hook (no tool call). Map
  // into the same `clock_ticked` bucket as advance events so the
  // training export sees a complete clock lifecycle (start → tick →
  // tick → ...) for each situation clock the deterministic engine
  // primed.
  CLOCK_STARTED: { eventType: "clock_ticked", actor: "system" },
  // time
  TIME_ADVANCED: { eventType: "time_advanced", actor: "system" },
  // player
  PLAYER_ACTION_SUBMITTED: { eventType: "player_action", actor: "player" },
  // chat / narrator (emitted from /api/chat at turn start + onFinish)
  CHAT_TURN_STARTED: { eventType: "chat_turn_started", actor: "gm" },
  NARRATOR_GENERATED: { eventType: "narrator_generated", actor: "narrator" },
  // tool calls (emitted from /api/chat onChunk for every server-side tool result).
  // Mapping `CHAT_STREAM_TOOL_RESULT` (NOT `CHAT_STREAM_TOOL_CALL`) because the
  // result event carries args + result + toolName in one payload — matches the
  // doc's `tool_call` shape `{ tool_name, args, result, duration_ms }` without
  // forcing the export pipeline to stitch two separate rows.
  CHAT_STREAM_TOOL_RESULT: { eventType: "tool_call", actor: "gm" },
  // scene framing (emitted from frame_scene tool OR from the
  // synthetic scene-card the chat route writes on turn 1 — same
  // shape, same export shape).
  SCENE_FRAMED: { eventType: "scene_framed", actor: "gm" },
  // onSessionStart hook's deterministic framing signal. Marks the
  // session-start milestone in the training corpus so analysis can
  // distinguish "agent improvised a scene" from "engine pre-loaded
  // framing context".
  FRAMING_CONTEXT_READY: { eventType: "session_milestone", actor: "system" },
  // session
  SESSION_DELETED: { eventType: "session_ended", actor: "system" },
  SESSION_ENDED: { eventType: "session_ended", actor: "system" },
  // explicit feedback signals (Phase 4) — from /api/training/rate and /api/training/regenerate
  PLAYER_RATED: { eventType: "player_rated", actor: "player" },
  PLAYER_REGENERATED: { eventType: "player_regenerated", actor: "player" },
};

const DEFAULT_TRUNCATE_LIMIT = 10 * 1024;
const TRUNCATION_MARKER = "...[truncated]";

export interface GameplayEventSink {
  /** Stop the sink. Idempotent. */
  stop: () => void;
  /** True while the sink is actively subscribed. */
  isRunning: () => boolean;
}

/**
 * Start the sink. Returns a handle whose `.stop()` unsubscribes from
 * the bus. Idempotent: starting twice with the same options is a
 * no-op (the second call returns the prior handle's stop fn) — but we
 * don't enforce that across processes; that's the caller's job.
 */
export function startGameplayEventSink(opts: SinkOptions): GameplayEventSink {
  const {
    db,
    psubscribe,
    privacy = "anonymous",
    truncateLimit = DEFAULT_TRUNCATE_LIMIT,
    log = (level, msg, err) =>
      console[level === "error" ? "error" : "warn"](`[gameplay-sink] ${msg}`, err ?? ""),
    onEventInserted,
  } = opts;

  if (privacy === "off") {
    return { stop: () => {}, isRunning: () => false };
  }

  let running = true;

  const handler = (event: SinkBusEvent) => {
    if (!running) return;
    if (!event.sessionId) return; // event-bus events without a sessionId aren't trainable
    const map = TYPE_MAP[event.type];
    if (!map) return; // unmapped types silently ignored — see TYPE_MAP comment

    try {
      const sanitized = sanitizePayload(event.payload, privacy);
      const serialized = truncate(JSON.stringify(sanitized ?? null), truncateLimit);

      const input: GameplayEventInput = {
        sessionId: event.sessionId,
        turnId: event.meta?.causedBy,
        eventType: map.eventType,
        actor: deriveActor(event, map.actor),
        actorId: event.source?.actorId,
        payload: serialized,
        createdAt: event.timestamp,
      };
      insertGameplayEvent(db, input);
      // Fire post-insert hook AFTER the row is durably written so a
      // failed insert can't trigger a phantom reconcile. Hook errors
      // are swallowed — same policy as the insert itself.
      if (onEventInserted) {
        try {
          onEventInserted(event.sessionId, event);
        } catch (hookErr) {
          log(
            "warn",
            `onEventInserted hook threw for ${event.type}: ${describeError(hookErr)}`,
            hookErr
          );
        }
      }
    } catch (err) {
      // Never crash the bus subscriber — capture logging at the layer
      // boundary. Spec calls this out: data loss is preferable to a
      // crashed game session.
      log("warn", `failed to persist event ${event.type}: ${describeError(err)}`, err);
    }
  };

  // Subscribe to every session-scoped channel that carries a TYPE_MAP-mapped
  // event. The mapper is the filter: any unmapped event is silently dropped at
  // the handler, so subscribing broadly is cheap. Channels:
  //   - `state`   — CHAT_TURN_STARTED, NARRATOR_GENERATED, SCENE_FRAMED,
  //                 TIME_ADVANCED, IMAGE_GENERATION_STARTED, etc.
  //   - `combat`  — COMBAT_STARTED, TURN_ADVANCED, DAMAGE_DEALT, etc.
  //   - `chat`    — CHAT_STREAM_TOOL_RESULT (server-side tool-call corpus)
  //   - `dice`    — DICE_ROLLED, TEST_RESOLVED, CUSTOM_TEST_RESOLVED
  //   - `gm`      — CLOCK_TICKED, LEAD_REVEALED, RELATIONSHIP_UPDATED
  //   - `character` (future) — CHARACTER_UPDATED, STRESS_CHANGED, etc.
  //   - `inventory` (future) — ITEM_PURCHASED, ITEM_SOLD, INVENTORY_UPGRADED
  //
  // dice + gm specifically were missing pre-#418/#421 — DICE_ROLLED and
  // CLOCK_TICKED were in TYPE_MAP but never reached the sink because the
  // emitters fire on `:dice` / `:gm` channels respectively, not state.
  const subscriptions = [
    psubscribe("session:*:state", handler),
    psubscribe("session:*:combat", handler),
    psubscribe("session:*:chat", handler),
    psubscribe("session:*:dice", handler),
    psubscribe("session:*:gm", handler),
    psubscribe("session:*:training", handler),
  ];

  return {
    stop: () => {
      if (!running) return;
      running = false;
      for (const u of subscriptions) {
        try {
          u();
        } catch {
          /* ignore */
        }
      }
    },
    isRunning: () => running,
  };
}

/**
 * Per-privacy-level sanitization. Anonymous mode redacts free-text
 * player input and character names; Full mode passes through.
 */
function sanitizePayload(payload: unknown, privacy: "anonymous" | "full"): unknown {
  if (privacy === "full") return payload;
  if (payload == null || typeof payload !== "object") return payload;
  return walk(payload, new WeakSet<object>());
}

const FREE_TEXT_KEYS = new Set([
  "playerInput",
  "playerText",
  "freeText",
  "input",
  "userMessage",
  "userInput",
]);
const CHARACTER_NAME_KEYS = new Set([
  "characterName",
  "playerName",
  "actorName",
  "name", // hashed only when nested under a character/player object
]);

function walk(node: unknown, seen: WeakSet<object>): unknown {
  if (node == null) return node;
  if (typeof node !== "object") return node;
  if (seen.has(node as object)) return null; // break cycles defensively
  seen.add(node as object);

  if (Array.isArray(node)) {
    return node.map((v) => walk(v, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (FREE_TEXT_KEYS.has(k) && typeof v === "string") {
      out[k] = `sha256:${shortHash(v)}`;
      continue;
    }
    if (CHARACTER_NAME_KEYS.has(k) && typeof v === "string") {
      out[k] = `hash:${shortHash(v)}`;
      continue;
    }
    out[k] = walk(v, seen);
  }
  return out;
}

function shortHash(s: string): string {
  // 8-char prefix is enough to disambiguate within a session without
  // bloating payloads. Full hash isn't needed for training-time joins
  // — we never reconstruct the original text.
  return createHash("sha256").update(s).digest("hex").slice(0, 8);
}

function truncate(s: string, limit: number): string {
  if (s.length <= limit) return s;
  return s.slice(0, limit - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;
}

function deriveActor(event: SinkBusEvent, fallback: GameplayActor): GameplayActor {
  const role = event.source?.role;
  if (role === "gm") return "gm";
  if (role === "player") return "player";
  return fallback;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
