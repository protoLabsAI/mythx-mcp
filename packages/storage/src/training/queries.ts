/**
 * Gameplay-events query helpers.
 *
 * The training corpus lives in `gameplay_events` — append-only inserts
 * via `insertGameplayEvent`, reward signals back-filled later via the
 * dedicated UPDATE helpers. Payload itself is never mutated.
 *
 * Schema: see packages/storage/src/sqlite/schema.ts
 * Spec: docs/finetuning-data-pipeline.md §3
 */

import type { Database } from "../sqlite/connection.js";

/**
 * Closed enum mirroring the spec's §3.2 event-type catalog. Anything
 * that isn't one of these is filtered out at the sink layer rather
 * than landing as free-form text — keeps the corpus shape stable
 * across schema-prompt iterations.
 */
export type GameplayEventType =
  | "chat_turn_started"
  | "tool_call"
  | "narrator_generated"
  | "dice_rolled"
  | "combat_event"
  | "clock_ticked"
  | "time_advanced"
  | "scene_framed"
  | "player_action"
  | "player_regenerated"
  | "player_rated"
  | "session_milestone"
  | "session_ended";

export type GameplayActor = "gm" | "player" | "ai_companion" | "narrator" | "system";

export interface GameplayEventInput {
  sessionId: string;
  turnId?: string;
  traceId?: string;
  spanId?: string;
  eventType: GameplayEventType;
  actor: GameplayActor;
  actorId?: string;
  /** Already-stringified JSON payload — caller decides shape per event_type. */
  payload: string;
  /** Defaults to Date.now() — pass explicitly for deterministic tests. */
  createdAt?: number;
}

export interface GameplayEventRow {
  id: number;
  session_id: string;
  turn_id: string | null;
  trace_id: string | null;
  span_id: string | null;
  event_type: GameplayEventType;
  actor: GameplayActor;
  actor_id: string | null;
  payload: string;
  was_undone: number | null;
  was_thumbed: number | null;
  caused_crash: number | null;
  created_at: number;
}

export function insertGameplayEvent(db: Database, input: GameplayEventInput): number {
  const stmt = db.prepare(
    `INSERT INTO gameplay_events (
       session_id, turn_id, trace_id, span_id,
       event_type, actor, actor_id, payload, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    input.sessionId,
    input.turnId ?? null,
    input.traceId ?? null,
    input.spanId ?? null,
    input.eventType,
    input.actor,
    input.actorId ?? null,
    input.payload,
    input.createdAt ?? Date.now()
  );
  // bun:sqlite + node:sqlite both expose lastInsertRowid as bigint or
  // number depending on backend; coerce to number for the JS callers.
  return Number(result.lastInsertRowid);
}

/**
 * Fetch events for a session in insertion order. Used by the reward
 * reconciler and the export tooling.
 */
export function listGameplayEventsBySession(
  db: Database,
  sessionId: string,
  opts: { limit?: number; sinceId?: number } = {}
): GameplayEventRow[] {
  const { limit, sinceId } = opts;
  if (sinceId != null && limit != null) {
    return db
      .prepare(
        "SELECT * FROM gameplay_events WHERE session_id = ? AND id > ? ORDER BY id ASC LIMIT ?"
      )
      .all(sessionId, sinceId, limit) as GameplayEventRow[];
  }
  if (sinceId != null) {
    return db
      .prepare("SELECT * FROM gameplay_events WHERE session_id = ? AND id > ? ORDER BY id ASC")
      .all(sessionId, sinceId) as GameplayEventRow[];
  }
  if (limit != null) {
    return db
      .prepare("SELECT * FROM gameplay_events WHERE session_id = ? ORDER BY id ASC LIMIT ?")
      .all(sessionId, limit) as GameplayEventRow[];
  }
  return db
    .prepare("SELECT * FROM gameplay_events WHERE session_id = ? ORDER BY id ASC")
    .all(sessionId) as GameplayEventRow[];
}

/**
 * Fetch events of a specific type within a session. Used by the
 * reconciler's regen back-fill (find all `narrator_generated` /
 * `chat_turn_started` events and check if a later `player_regenerated`
 * pointed at one of them).
 */
export function listGameplayEventsByType(
  db: Database,
  sessionId: string,
  eventType: GameplayEventType
): GameplayEventRow[] {
  return db
    .prepare(
      "SELECT * FROM gameplay_events WHERE session_id = ? AND event_type = ? ORDER BY id ASC"
    )
    .all(sessionId, eventType) as GameplayEventRow[];
}

/**
 * Find the latest event row in a given turn — used by
 * `/api/training/rate` to resolve a `rated_turn_id` (which the
 * harness / a future "thumb the whole turn" UI knows) into a
 * specific `rated_event_id` (which the reward reconciler needs).
 *
 * Pass `eventType` to narrow the search (e.g. only narrator_generated
 * rows when rating narrator output). With no type, returns the
 * latest row of any type in that turn.
 */
export function getLatestEventByTurn(
  db: Database,
  turnId: string,
  eventType?: GameplayEventType
): GameplayEventRow | null {
  if (eventType) {
    const row = db
      .prepare(
        "SELECT * FROM gameplay_events WHERE turn_id = ? AND event_type = ? ORDER BY id DESC LIMIT 1"
      )
      .get(turnId, eventType) as GameplayEventRow | undefined;
    return row ?? null;
  }
  const row = db
    .prepare("SELECT * FROM gameplay_events WHERE turn_id = ? ORDER BY id DESC LIMIT 1")
    .get(turnId) as GameplayEventRow | undefined;
  return row ?? null;
}

/**
 * Set `was_undone = 1` on the rows preceding a `player_regenerated`
 * event. Idempotent — re-running on a row that's already marked is a
 * no-op.
 */
export function markEventUndone(db: Database, eventId: number): void {
  db.prepare("UPDATE gameplay_events SET was_undone = 1 WHERE id = ?").run(eventId);
}

/** Set `caused_crash = 1` on the row that immediately preceded a crash. */
export function markEventCausedCrash(db: Database, eventId: number): void {
  db.prepare("UPDATE gameplay_events SET caused_crash = 1 WHERE id = ?").run(eventId);
}

/** Set `was_thumbed` on the row a `player_rated` event pointed at. */
export function markEventThumbed(db: Database, eventId: number, score: -1 | 0 | 1): void {
  db.prepare("UPDATE gameplay_events SET was_thumbed = ? WHERE id = ?").run(score, eventId);
}

/**
 * Test/admin helper: drop all gameplay events. Not exported to the
 * web app — only the per-session export CLI and the test suite need
 * this.
 */
export function deleteAllGameplayEvents(db: Database): void {
  db.exec("DELETE FROM gameplay_events");
}
