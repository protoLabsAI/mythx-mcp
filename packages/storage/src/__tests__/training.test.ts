/**
 * Tests for the gameplay-events training capture: schema migration,
 * insert/select query helpers, sink mapper, and reward reconciler.
 *
 * Uses :memory: SQLite for isolation via the runtime-adaptive driver
 * (node:sqlite under vitest/Node, bun:sqlite under Bun).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createDatabase, type Database } from "../sqlite/connection.js";
import { initializeSchema } from "../sqlite/schema.js";
import {
  insertGameplayEvent,
  listGameplayEventsBySession,
  listGameplayEventsByType,
  markEventThumbed,
} from "../training/queries.js";
import { startGameplayEventSink, type SinkBusEvent } from "../training/sink.js";
import { createRewardReconciler, reconcileSessionRewards } from "../training/reward-attacher.js";

const SESSION_ID = "session-training-001";

function makeDb(): Database {
  const db = createDatabase(":memory:");
  initializeSchema(db);
  return db;
}

describe("gameplay_events schema + queries", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("creates the table with the expected columns", () => {
    const cols = db.prepare("PRAGMA table_info(gameplay_events)").all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        "id",
        "session_id",
        "turn_id",
        "trace_id",
        "span_id",
        "event_type",
        "actor",
        "actor_id",
        "payload",
        "was_undone",
        "was_thumbed",
        "caused_crash",
        "created_at",
      ].sort()
    );
  });

  it("inserts events and returns them in id order", () => {
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "dice_rolled",
      actor: "system",
      payload: JSON.stringify({ expression: "2d6+3", total: 9 }),
      createdAt: 1000,
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "combat_event",
      actor: "system",
      payload: JSON.stringify({ subtype: "DAMAGE_DEALT", hp_after: 5 }),
      createdAt: 2000,
    });

    const rows = listGameplayEventsBySession(db, SESSION_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0].event_type).toBe("dice_rolled");
    expect(rows[1].event_type).toBe("combat_event");
    // Reward columns start NULL so the reconciler can populate them later.
    expect(rows[0].was_undone).toBeNull();
    expect(rows[0].was_thumbed).toBeNull();
    expect(rows[0].caused_crash).toBeNull();
  });

  it("filters by event_type", () => {
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "dice_rolled",
      actor: "system",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "combat_event",
      actor: "system",
      payload: "{}",
    });
    const rolls = listGameplayEventsByType(db, SESSION_ID, "dice_rolled");
    expect(rolls).toHaveLength(1);
  });

  it("paginates via sinceId", () => {
    const id1 = insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "dice_rolled",
      actor: "system",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "dice_rolled",
      actor: "system",
      payload: "{}",
    });
    const after = listGameplayEventsBySession(db, SESSION_ID, { sinceId: id1 });
    expect(after).toHaveLength(1);
    expect(after[0].id).toBeGreaterThan(id1);
  });

  it("markEventThumbed sets the column without touching payload", () => {
    const id = insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "dice_rolled",
      actor: "system",
      payload: JSON.stringify({ original: "value" }),
    });
    markEventThumbed(db, id, 1);
    const [row] = listGameplayEventsBySession(db, SESSION_ID);
    expect(row.was_thumbed).toBe(1);
    expect(JSON.parse(row.payload)).toEqual({ original: "value" });
  });
});

describe("startGameplayEventSink", () => {
  let db: Database;
  // Keep a registry of (pattern → handlers) so each test can drive its
  // own fake bus without standing up the real EventBus.
  let handlers: Map<string, Array<(e: SinkBusEvent) => void>>;

  function makeSubscribe() {
    return (pattern: string, handler: (e: SinkBusEvent) => void) => {
      const list = handlers.get(pattern) ?? [];
      list.push(handler);
      handlers.set(pattern, list);
      return () => {
        const cur = handlers.get(pattern) ?? [];
        handlers.set(
          pattern,
          cur.filter((h) => h !== handler)
        );
      };
    };
  }

  function emit(channel: string, event: SinkBusEvent) {
    // Match channel against any pattern subscriber. Real EventBus does
    // glob matching; for tests we approximate with a wildcard split on
    // `*`.
    for (const [pattern, list] of handlers.entries()) {
      const re = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      if (re.test(channel)) {
        for (const h of list) h(event);
      }
    }
  }

  beforeEach(() => {
    db = makeDb();
    handlers = new Map();
  });

  it("persists known event types to gameplay_events", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
    });
    emit(`session:${SESSION_ID}:state`, {
      id: "ev1",
      type: "DICE_ROLLED",
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload: { expression: "1d20", total: 14 },
      source: { type: "system" },
    });
    const rows = listGameplayEventsBySession(db, SESSION_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe("dice_rolled");
    expect(rows[0].actor).toBe("system");
    expect(JSON.parse(rows[0].payload)).toEqual({ expression: "1d20", total: 14 });
    sink.stop();
  });

  it.each([
    [
      "CHAT_TURN_STARTED",
      "chat_turn_started",
      "gm",
      { turnId: "abc", systemPromptHash: "sha256:x", messageCount: 5 },
    ],
    [
      "NARRATOR_GENERATED",
      "narrator_generated",
      "narrator",
      { turnId: "abc", trigger: "chat", text: "the world stirs" },
    ],
    ["SCENE_FRAMED", "scene_framed", "gm", { locationId: "loc-1", description: "ash drifts down" }],
    ["SESSION_ENDED", "session_ended", "system", { reason: "explicit" }],
  ])("maps the new training-corpus event %s → %s", (busType, expectedType, _actor, payload) => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      privacy: "full",
    });
    emit(`session:${SESSION_ID}:state`, {
      id: "ev1",
      type: busType,
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload,
      source: { type: "system" },
    });
    const rows = listGameplayEventsBySession(db, SESSION_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe(expectedType);
    sink.stop();
  });

  it.each([
    [
      "PLAYER_RATED",
      "player_rated",
      "player",
      `session:${SESSION_ID}:training`,
      { rated_event_id: "42", score: 1 },
    ],
    [
      "PLAYER_REGENERATED",
      "player_regenerated",
      "player",
      `session:${SESSION_ID}:training`,
      { regenerated_turn_id: "turn-abc" },
    ],
  ])(
    "maps explicit-feedback event %s → %s on the training channel",
    (busType, expectedType, expectedActor, channel, payload) => {
      const sink = startGameplayEventSink({
        db,
        psubscribe: makeSubscribe(),
        privacy: "full",
      });
      emit(channel, {
        id: "ev1",
        type: busType,
        channel,
        timestamp: 1000,
        sessionId: SESSION_ID,
        payload,
        source: { type: "server" },
      });
      const rows = listGameplayEventsBySession(db, SESSION_ID);
      expect(rows).toHaveLength(1);
      expect(rows[0].event_type).toBe(expectedType);
      expect(rows[0].actor).toBe(expectedActor);
      expect(JSON.parse(rows[0].payload)).toEqual(payload);
      sink.stop();
    }
  );

  it("ignores event types not in the mapper", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
    });
    emit(`session:${SESSION_ID}:state`, {
      id: "ev1",
      type: "SOME_UNMAPPED_EVENT",
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload: {},
      source: { type: "system" },
    });
    expect(listGameplayEventsBySession(db, SESSION_ID)).toHaveLength(0);
    sink.stop();
  });

  it("ignores events with no sessionId (not trainable)", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
    });
    emit(`session:other:state`, {
      id: "ev1",
      type: "DICE_ROLLED",
      channel: `session:other:state`,
      timestamp: 1000,
      // sessionId intentionally missing
      payload: {},
      source: { type: "system" },
    } as SinkBusEvent);
    expect(listGameplayEventsBySession(db, SESSION_ID)).toHaveLength(0);
    sink.stop();
  });

  it("hashes free-text and character names in anonymous mode", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      privacy: "anonymous",
    });
    emit(`session:${SESSION_ID}:state`, {
      id: "ev1",
      type: "PLAYER_ACTION_SUBMITTED",
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload: { playerInput: "I attack the orc", characterName: "Lyra" },
      source: { type: "client", role: "player", actorId: "player-1" },
    });
    const [row] = listGameplayEventsBySession(db, SESSION_ID);
    const payload = JSON.parse(row.payload);
    expect(payload.playerInput).toMatch(/^sha256:[0-9a-f]{8}$/);
    expect(payload.characterName).toMatch(/^hash:[0-9a-f]{8}$/);
    expect(row.actor).toBe("player");
    sink.stop();
  });

  it("passes everything through verbatim in full mode", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      privacy: "full",
    });
    emit(`session:${SESSION_ID}:state`, {
      id: "ev1",
      type: "PLAYER_ACTION_SUBMITTED",
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload: { playerInput: "I attack the orc", characterName: "Lyra" },
      source: { type: "client", role: "player" },
    });
    const [row] = listGameplayEventsBySession(db, SESSION_ID);
    expect(JSON.parse(row.payload)).toEqual({
      playerInput: "I attack the orc",
      characterName: "Lyra",
    });
    sink.stop();
  });

  it("fires onEventInserted after a successful insert with the sessionId", () => {
    const seen: Array<{ sessionId: string; type: string }> = [];
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      onEventInserted: (sid, ev) => seen.push({ sessionId: sid, type: ev.type }),
    });
    emit(`session:${SESSION_ID}:state`, {
      id: "ev1",
      type: "DICE_ROLLED",
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload: { expression: "1d20", total: 7 },
      source: { type: "system" },
    });
    expect(seen).toEqual([{ sessionId: SESSION_ID, type: "DICE_ROLLED" }]);
    sink.stop();
  });

  it("does not fire onEventInserted for unmapped or no-sessionId events", () => {
    const seen: string[] = [];
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      onEventInserted: (sid) => seen.push(sid),
    });
    emit(`session:${SESSION_ID}:state`, {
      id: "u1",
      type: "SOME_UNMAPPED_EVENT",
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload: {},
      source: { type: "system" },
    });
    emit(`session:other:state`, {
      id: "u2",
      type: "DICE_ROLLED",
      channel: `session:other:state`,
      timestamp: 1000,
      payload: {},
      source: { type: "system" },
    } as SinkBusEvent);
    expect(seen).toEqual([]);
    sink.stop();
  });

  it("swallows errors from onEventInserted and still persists the row", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      onEventInserted: () => {
        throw new Error("boom");
      },
      log: () => {},
    });
    expect(() => {
      emit(`session:${SESSION_ID}:state`, {
        id: "ev1",
        type: "DICE_ROLLED",
        channel: `session:${SESSION_ID}:state`,
        timestamp: 1000,
        sessionId: SESSION_ID,
        payload: {},
        source: { type: "system" },
      });
    }).not.toThrow();
    expect(listGameplayEventsBySession(db, SESSION_ID)).toHaveLength(1);
    sink.stop();
  });

  it("becomes a no-op when privacy is off", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      privacy: "off",
    });
    expect(sink.isRunning()).toBe(false);
    emit(`session:${SESSION_ID}:state`, {
      id: "ev1",
      type: "DICE_ROLLED",
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload: {},
      source: { type: "system" },
    });
    expect(listGameplayEventsBySession(db, SESSION_ID)).toHaveLength(0);
  });

  it("truncates payloads larger than the limit", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      truncateLimit: 64,
    });
    const huge = "x".repeat(500);
    emit(`session:${SESSION_ID}:state`, {
      id: "ev1",
      type: "DICE_ROLLED",
      channel: `session:${SESSION_ID}:state`,
      timestamp: 1000,
      sessionId: SESSION_ID,
      payload: { detail: huge },
      source: { type: "system" },
    });
    const [row] = listGameplayEventsBySession(db, SESSION_ID);
    expect(row.payload.length).toBeLessThanOrEqual(64);
    expect(row.payload.endsWith("...[truncated]")).toBe(true);
    sink.stop();
  });

  it("survives an insert error without crashing the subscriber", () => {
    const sink = startGameplayEventSink({
      db,
      psubscribe: makeSubscribe(),
      // Custom log to swallow expected warnings.
      log: () => {},
    });
    // Force a constraint violation by closing the db (insert throws).
    db.close();
    expect(() => {
      emit(`session:${SESSION_ID}:state`, {
        id: "ev1",
        type: "DICE_ROLLED",
        channel: `session:${SESSION_ID}:state`,
        timestamp: 1000,
        sessionId: SESSION_ID,
        payload: {},
        source: { type: "system" },
      });
    }).not.toThrow();
    sink.stop();
  });
});

describe("reconcileSessionRewards", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("marks the targeted row was_undone when player_regenerated points at it by id", () => {
    const targetId = insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "narrator_generated",
      actor: "narrator",
      payload: JSON.stringify({ text: "the original line" }),
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "player_regenerated",
      actor: "player",
      payload: JSON.stringify({ regenerated_event_id: targetId }),
    });

    const result = reconcileSessionRewards(db, SESSION_ID);
    expect(result.marked_undone).toBe(1);

    const rows = listGameplayEventsBySession(db, SESSION_ID);
    const target = rows.find((r) => r.id === targetId);
    expect(target?.was_undone).toBe(1);
  });

  it("marks every event in a turn was_undone when regen points at the turn_id", () => {
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      turnId: "turn-1",
      eventType: "narrator_generated",
      actor: "narrator",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      turnId: "turn-1",
      eventType: "tool_call",
      actor: "gm",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "player_regenerated",
      actor: "player",
      payload: JSON.stringify({ regenerated_turn_id: "turn-1" }),
    });

    const result = reconcileSessionRewards(db, SESSION_ID);
    expect(result.marked_undone).toBe(2);
    const rows = listGameplayEventsBySession(db, SESSION_ID);
    const turn1 = rows.filter((r) => r.turn_id === "turn-1");
    expect(turn1.every((r) => r.was_undone === 1)).toBe(true);
  });

  it("sets was_thumbed from player_rated", () => {
    const targetId = insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "narrator_generated",
      actor: "narrator",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "player_rated",
      actor: "player",
      payload: JSON.stringify({ rated_event_id: targetId, score: 1 }),
    });

    reconcileSessionRewards(db, SESSION_ID);
    const target = listGameplayEventsBySession(db, SESSION_ID).find((r) => r.id === targetId);
    expect(target?.was_thumbed).toBe(1);
  });

  it("is idempotent — repeat calls produce the same result", () => {
    const targetId = insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "narrator_generated",
      actor: "narrator",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "player_regenerated",
      actor: "player",
      payload: JSON.stringify({ regenerated_event_id: targetId }),
    });

    const first = reconcileSessionRewards(db, SESSION_ID);
    const second = reconcileSessionRewards(db, SESSION_ID);
    expect(first.marked_undone).toBe(1);
    expect(second.marked_undone).toBe(1);
    const target = listGameplayEventsBySession(db, SESSION_ID).find((r) => r.id === targetId);
    expect(target?.was_undone).toBe(1);
  });

  it("tolerates malformed payload JSON", () => {
    const targetId = insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "narrator_generated",
      actor: "narrator",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "player_regenerated",
      actor: "player",
      payload: "not json {", // intentionally broken
    });
    const result = reconcileSessionRewards(db, SESSION_ID);
    // No row marked, no crash.
    expect(result.marked_undone).toBe(0);
    const target = listGameplayEventsBySession(db, SESSION_ID).find((r) => r.id === targetId);
    expect(target?.was_undone).toBeNull();
  });
});

describe("createRewardReconciler runner", () => {
  it("debounces scheduled sessions and reconciles on flush", () => {
    const db = makeDb();
    const targetId = insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "narrator_generated",
      actor: "narrator",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "player_regenerated",
      actor: "player",
      payload: JSON.stringify({ regenerated_event_id: targetId }),
    });

    const runner = createRewardReconciler({ db, intervalMs: 5_000 });
    runner.scheduleSession(SESSION_ID);
    // Pre-flush: nothing has run yet.
    let target = listGameplayEventsBySession(db, SESSION_ID).find((r) => r.id === targetId);
    expect(target?.was_undone).toBeNull();

    runner.flush();
    target = listGameplayEventsBySession(db, SESSION_ID).find((r) => r.id === targetId);
    expect(target?.was_undone).toBe(1);

    runner.stop();
  });

  it("reconcileNow runs synchronously and clears any pending timer", () => {
    const db = makeDb();
    const targetId = insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "narrator_generated",
      actor: "narrator",
      payload: "{}",
    });
    insertGameplayEvent(db, {
      sessionId: SESSION_ID,
      eventType: "player_regenerated",
      actor: "player",
      payload: JSON.stringify({ regenerated_event_id: targetId }),
    });

    const runner = createRewardReconciler({ db });
    runner.scheduleSession(SESSION_ID);
    const result = runner.reconcileNow(SESSION_ID);
    expect(result.marked_undone).toBe(1);

    runner.stop();
  });
});
