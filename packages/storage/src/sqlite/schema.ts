/**
 * SQLite Schema
 *
 * DDL for the shared MythxEngine database.
 * Called once on first connection via initializeSchema().
 */

import type { Database } from "./connection.js";

const SCHEMA_SQL = `
-- Sessions: game session state
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  world_pack_id TEXT,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_world_pack_id ON sessions(world_pack_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);

-- World Packs: generated world content.
-- compiled_version: monotonically incremented on every compiled-blob
-- write. Drives optimistic concurrency on entity CRUD: clients capture
-- the version when they read, send it back as If-Match on PATCH/DELETE,
-- and a mismatch returns 412 Precondition Failed instead of silently
-- overwriting concurrent edits (eg. from the generation pipeline).
CREATE TABLE IF NOT EXISTS world_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT,
  tier TEXT DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  compiled TEXT,
  compiled_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_world_packs_status ON world_packs(status);

-- Push Subscriptions: Web Push API
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  endpoint_hash TEXT NOT NULL UNIQUE,
  auth_key TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id);

-- Messages: chat history
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- Acts: chat history chunked by narrative act
CREATE TABLE IF NOT EXISTS acts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  act_number INTEGER NOT NULL,
  title TEXT,
  summary TEXT,
  summary_status TEXT NOT NULL DEFAULT 'none',
  key_events TEXT,
  messages TEXT NOT NULL DEFAULT '[]',
  message_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  UNIQUE(session_id, act_number)
);
CREATE INDEX IF NOT EXISTS idx_acts_session ON acts(session_id, act_number);
CREATE INDEX IF NOT EXISTS idx_acts_session_status ON acts(session_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acts_one_active ON acts(session_id) WHERE status = 'active';

-- Gameplay events: append-only training-data log.
-- Every domain-level event (dice rolls, combat, narrator output, player
-- actions, ...) lands here as one row. Reward signals (was_undone,
-- was_thumbed, caused_crash) are NULLable and back-filled by the
-- reward reconciler — payload itself is never mutated.
--
-- See docs/finetuning-data-pipeline.md §3 for schema rationale.
-- The table is the canonical training corpus; Langfuse stays for
-- observability and post-hoc QA.
CREATE TABLE IF NOT EXISTS gameplay_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  trace_id TEXT,
  span_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_id TEXT,
  payload TEXT NOT NULL,
  -- Reward signals — NULL until reward-attacher.ts back-fills them
  was_undone INTEGER,         -- 0/1, NULL = not yet evaluated
  was_thumbed INTEGER,        -- -1 / 0 / +1, NULL = not rated
  caused_crash INTEGER,       -- 0/1, NULL = not yet evaluated
  created_at INTEGER NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_session ON gameplay_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_turn ON gameplay_events(turn_id);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_trace ON gameplay_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_type ON gameplay_events(event_type);

-- Story pages: compressed turn-window summaries within an act.
-- Phase B of the context-compaction rollout (#70). Each page summarizes
-- ~8 turns of narrative; the runtime injects pages instead of the raw
-- transcript once Phase C (#71) ships.
--
-- One row per page; pages are scoped to a session and ordered by
-- page_number (1-indexed within the session, monotonic across acts).
-- A page may belong to a closed or active act — page generation can
-- run without waiting for act-close.
--
-- See docs/context-compaction-architecture.md §3 for design.
CREATE TABLE IF NOT EXISTS story_pages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  act_number INTEGER NOT NULL CHECK (act_number > 0),
  title TEXT,
  text TEXT NOT NULL DEFAULT '',
  key_events TEXT,                      -- JSON array of strings
  trigger_turn_id TEXT,                 -- gameplay_events.turn_id that fired generation
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'complete', 'failed')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(session_id, page_number)
);
CREATE INDEX IF NOT EXISTS idx_story_pages_session ON story_pages(session_id, page_number);
CREATE INDEX IF NOT EXISTS idx_story_pages_act ON story_pages(session_id, act_number);
`;

/**
 * Idempotent migrations applied after the base schema. Each entry is
 * an ALTER (or other change) that may have been added after the table
 * was first created. We catch "duplicate column" / "already exists"
 * errors so re-running on a current DB is a no-op.
 *
 * SQLite has no `ADD COLUMN IF NOT EXISTS`, so this catch-and-swallow
 * pattern is the standard workaround.
 */
const MIGRATIONS: ReadonlyArray<{ description: string; sql: string }> = [
  {
    description: "world_packs.compiled_version (audit #19 — optimistic concurrency)",
    sql: "ALTER TABLE world_packs ADD COLUMN compiled_version INTEGER NOT NULL DEFAULT 0",
  },
];

/**
 * Initialize all tables and indexes.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export function initializeSchema(db: Database): void {
  db.exec(SCHEMA_SQL);
  for (const m of MIGRATIONS) {
    try {
      db.exec(m.sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // SQLite throws "duplicate column name" on ADD COLUMN when the
      // column already exists. Anything else is a real failure and
      // should propagate so deploys catch it.
      if (!/duplicate column|already exists/i.test(msg)) {
        throw err;
      }
    }
  }
}
