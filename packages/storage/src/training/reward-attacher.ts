/**
 * Reward reconciler — back-fills the (was_undone, was_thumbed,
 * caused_crash) columns on prior events based on what happened next.
 *
 * Reward signals land on rows AFTER the events they reward. The sink
 * writes events with all three columns NULL; this reconciler reads
 * recent events and fills the columns based on the rules in spec §4.1:
 *
 *   - `player_regenerated` payload references a prior `chat_turn_started`
 *     or `narrator_generated` row → mark that row's `was_undone = 1`.
 *   - `player_rated` payload references a prior row + score
 *     → set `was_thumbed` on that row.
 *   - A row immediately followed by an unrecoverable crash signal
 *     → mark `caused_crash = 1`. (Crash event types are still TBD;
 *     the reconciler tolerates absence and just no-ops for now.)
 *
 * The reconciler is idempotent and cheap. Run it on a debounced timer
 * during play (default 30s) and once at session-end.
 *
 * Spec: docs/finetuning-data-pipeline.md §4.3
 */

import type { Database } from "../sqlite/connection.js";
import { listGameplayEventsBySession, markEventThumbed, markEventUndone } from "./queries.js";

export interface ReconcileResult {
  scanned: number;
  marked_undone: number;
  marked_thumbed: number;
  marked_crash: number;
}

/**
 * Walk a session's events once and back-fill reward columns. Safe to
 * call repeatedly — UPDATEs are idempotent (setting a column to the
 * same value is a no-op for our purposes).
 */
export function reconcileSessionRewards(db: Database, sessionId: string): ReconcileResult {
  const events = listGameplayEventsBySession(db, sessionId);
  let markedUndone = 0;
  let markedThumbed = 0;
  const markedCrash = 0;

  for (const ev of events) {
    if (ev.event_type === "player_regenerated") {
      // Payload shape (per spec §3.2): `{ regenerated_event_id }`.
      // The id can be a row id (number) or a turn_id (string) — the
      // reconciler tolerates both. Spec leaves the choice to the
      // emitter; future work may pin the shape via a Zod parser.
      const targetRowId = parsePositiveInt(getField(ev.payload, "regenerated_event_id"));
      if (targetRowId != null && targetRowId !== ev.id) {
        markEventUndone(db, targetRowId);
        markedUndone++;
        continue;
      }
      const targetTurn = getField(ev.payload, "regenerated_turn_id");
      if (typeof targetTurn === "string") {
        // Mark every event in the regenerated turn — the whole turn
        // is the unit the player rejected.
        for (const row of events) {
          if (row.turn_id === targetTurn && row.id !== ev.id) {
            markEventUndone(db, row.id);
            markedUndone++;
          }
        }
      }
    }
    if (ev.event_type === "player_rated") {
      const targetRowId = parsePositiveInt(getField(ev.payload, "rated_event_id"));
      const score = parseRatingScore(getField(ev.payload, "score"));
      if (targetRowId != null && score != null) {
        markEventThumbed(db, targetRowId, score);
        markedThumbed++;
      }
    }
  }

  return {
    scanned: events.length,
    marked_undone: markedUndone,
    marked_thumbed: markedThumbed,
    marked_crash: markedCrash,
  };
}

/**
 * Debounced reconciler runner. Track sessions that have new events
 * and reconcile each at most once per `intervalMs`. Returns a handle
 * with `.scheduleSession(sessionId)` and `.flush()` (immediate run for
 * session-end).
 */
export interface ReconcilerRunner {
  scheduleSession: (sessionId: string) => void;
  flush: () => void;
  /**
   * Run the reconciler synchronously on a single session and return
   * the result. Mostly for tests + the session-end hook.
   */
  reconcileNow: (sessionId: string) => ReconcileResult;
  /** Stop all timers. Idempotent. */
  stop: () => void;
}

export interface RunnerOptions {
  db: Database;
  /**
   * Debounce window in ms. The session reconciler runs at most once
   * per window per session — frequent gameplay events coalesce into
   * a single pass. Spec picks 30s as the default.
   */
  intervalMs?: number;
  /** Optional logger; defaults to console.warn for failures. */
  log?: (level: "warn" | "error", msg: string, err?: unknown) => void;
}

const DEFAULT_INTERVAL_MS = 30_000;

export function createRewardReconciler(opts: RunnerOptions): ReconcilerRunner {
  const {
    db,
    intervalMs = DEFAULT_INTERVAL_MS,
    log = (level, msg, err) =>
      console[level === "error" ? "error" : "warn"](`[reward-attacher] ${msg}`, err ?? ""),
  } = opts;

  // Per-session debounce timers. Map keyed by sessionId so concurrent
  // sessions don't starve each other.
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let stopped = false;

  const runFor = (sessionId: string): ReconcileResult => {
    try {
      return reconcileSessionRewards(db, sessionId);
    } catch (err) {
      log("warn", `reconcile failed for ${sessionId}: ${describeError(err)}`, err);
      return { scanned: 0, marked_undone: 0, marked_thumbed: 0, marked_crash: 0 };
    }
  };

  return {
    scheduleSession(sessionId: string) {
      if (stopped) return;
      const existing = timers.get(sessionId);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        timers.delete(sessionId);
        runFor(sessionId);
      }, intervalMs);
      timers.set(sessionId, t);
    },
    flush() {
      if (stopped) return;
      // Run all pending sessions synchronously. Used at session-end /
      // process shutdown so we don't lose the last 30s of reward
      // signals.
      const pending = Array.from(timers.entries());
      for (const [sessionId, t] of pending) {
        clearTimeout(t);
        timers.delete(sessionId);
        runFor(sessionId);
      }
    },
    reconcileNow(sessionId: string) {
      const t = timers.get(sessionId);
      if (t) {
        clearTimeout(t);
        timers.delete(sessionId);
      }
      return runFor(sessionId);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getField(payloadJson: string, key: string): unknown {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (parsed && typeof parsed === "object" && key in (parsed as Record<string, unknown>)) {
      return (parsed as Record<string, unknown>)[key];
    }
  } catch {
    /* malformed payload — ignore, reconciler tolerates */
  }
  return undefined;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function parseRatingScore(value: unknown): -1 | 0 | 1 | null {
  if (value === -1 || value === 0 || value === 1) return value;
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    if (n === -1 || n === 0 || n === 1) return n as -1 | 0 | 1;
  }
  return null;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
