/**
 * SQLite Metadata Queries
 *
 * Web-app-specific queries that operate on metadata columns
 * without loading full JSON blobs. Used by API routes for
 * list views and filtering.
 */

import type { Database } from "./connection.js";

// ============================================================================
// Session Queries
// ============================================================================

export interface SessionListItem {
  id: string;
  name: string;
  world_pack_id: string | null;
  created_at: string;
  updated_at: string;
}

export function listSessionsMeta(
  db: Database,
  opts?: { worldPackId?: string; limit?: number }
): SessionListItem[] {
  const limit = opts?.limit ?? 100;

  if (opts?.worldPackId) {
    const stmt = db.prepare(
      "SELECT id, name, world_pack_id, created_at, updated_at FROM sessions WHERE world_pack_id = ? ORDER BY updated_at DESC LIMIT ?"
    );
    return stmt.all(opts.worldPackId, limit) as SessionListItem[];
  }

  const stmt = db.prepare(
    "SELECT id, name, world_pack_id, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?"
  );
  return stmt.all(limit) as SessionListItem[];
}

export function getSessionMeta(db: Database, sessionId: string): SessionListItem | null {
  const stmt = db.prepare(
    "SELECT id, name, world_pack_id, created_at, updated_at FROM sessions WHERE id = ?"
  );
  return (stmt.get(sessionId) as SessionListItem) ?? null;
}

export function getSessionState(db: Database, sessionId: string): string | null {
  const stmt = db.prepare("SELECT state FROM sessions WHERE id = ?");
  const row = stmt.get(sessionId) as { state: string } | undefined;
  return row?.state ?? null;
}

export function sessionExists(db: Database, sessionId: string): boolean {
  const stmt = db.prepare("SELECT 1 FROM sessions WHERE id = ?");
  // bun:sqlite returns `null` for "no row" (node:sqlite returns
  // `undefined`). Match both to keep the check correct.
  return stmt.get(sessionId) != null;
}

// ============================================================================
// World Pack Queries
// ============================================================================

export interface WorldListItem {
  id: string;
  name: string;
  tagline: string | null;
  tier: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function listWorldsMeta(
  db: Database,
  opts?: { status?: string[]; limit?: number }
): WorldListItem[] {
  const limit = opts?.limit ?? 100;

  if (opts?.status && opts.status.length > 0) {
    const placeholders = opts.status.map(() => "?").join(", ");
    const stmt = db.prepare(
      `SELECT id, name, tagline, tier, status, created_at, updated_at FROM world_packs WHERE status IN (${placeholders}) ORDER BY updated_at DESC LIMIT ?`
    );
    return stmt.all(...opts.status, limit) as WorldListItem[];
  }

  const stmt = db.prepare(
    "SELECT id, name, tagline, tier, status, created_at, updated_at FROM world_packs ORDER BY updated_at DESC LIMIT ?"
  );
  return stmt.all(limit) as WorldListItem[];
}

export function getWorldMeta(db: Database, packId: string): WorldListItem | null {
  const stmt = db.prepare(
    "SELECT id, name, tagline, tier, status, created_at, updated_at FROM world_packs WHERE id = ?"
  );
  return (stmt.get(packId) as WorldListItem) ?? null;
}

export function getWorldCompiled(db: Database, packId: string): string | null {
  const stmt = db.prepare("SELECT compiled FROM world_packs WHERE id = ?");
  const row = stmt.get(packId) as { compiled: string } | undefined;
  return row?.compiled ?? null;
}

export function worldExists(db: Database, packId: string): boolean {
  const stmt = db.prepare("SELECT 1 FROM world_packs WHERE id = ?");
  // bun:sqlite returns `null` for "no row"; node:sqlite returns `undefined`; match both.
  return stmt.get(packId) != null;
}

export function createWorldStub(
  db: Database,
  packId: string,
  name: string,
  opts?: { tier?: string; status?: string; tagline?: string }
): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO world_packs (id, name, tagline, tier, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    packId,
    name,
    opts?.tagline ?? null,
    opts?.tier ?? "medium",
    opts?.status ?? "generating",
    now,
    now
  );
}

export function updateWorldGeneration(
  db: Database,
  packId: string,
  updates: { status?: string; compiled?: string }
): void {
  const now = new Date().toISOString();
  if (updates.compiled !== undefined) {
    // Increment compiled_version atomically with the write so optimistic
    // concurrency consumers (entity PATCH) can detect a race that
    // happened between their read and write. Versioning is monotonic per
    // pack — never reset. NULL/missing → starts at 0, becomes 1 here.
    const stmt = db.prepare(
      `UPDATE world_packs
       SET status = ?, compiled = ?, updated_at = ?,
           compiled_version = COALESCE(compiled_version, 0) + 1
       WHERE id = ?`
    );
    stmt.run(updates.status ?? "draft", updates.compiled, now, packId);
  } else if (updates.status !== undefined) {
    const stmt = db.prepare("UPDATE world_packs SET status = ?, updated_at = ? WHERE id = ?");
    stmt.run(updates.status, now, packId);
  }
}

/**
 * Read just the compiled_version + status — cheap probe used by the
 * entity routes to gate on status="generating" and to capture the
 * If-Match value clients send back.
 */
export function getWorldVersionInfo(
  db: Database,
  packId: string
): { version: number; status: string } | null {
  const stmt = db.prepare(
    "SELECT compiled_version as version, status FROM world_packs WHERE id = ?"
  );
  const row = stmt.get(packId) as { version: number | null; status: string } | undefined;
  if (!row) return null;
  return { version: row.version ?? 0, status: row.status };
}

/**
 * Conditional compiled-blob update. Returns true if the version matched
 * and the row was updated, false if the version drifted (concurrent
 * write happened — the caller should re-fetch and retry or surface a
 * 412 to the client).
 *
 * Implementation: WHERE compiled_version = ? guards the UPDATE so a
 * mismatched version simply changes 0 rows and we report failure. No
 * race window between SELECT and UPDATE.
 */
export function updateWorldGenerationIfVersion(
  db: Database,
  packId: string,
  expectedVersion: number,
  updates: { status?: string; compiled: string }
): boolean {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `UPDATE world_packs
     SET status = ?, compiled = ?, updated_at = ?,
         compiled_version = COALESCE(compiled_version, 0) + 1
     WHERE id = ? AND COALESCE(compiled_version, 0) = ?`
  );
  const result = stmt.run(
    updates.status ?? "draft",
    updates.compiled,
    now,
    packId,
    expectedVersion
  );
  return Number(result.changes) === 1;
}

// ============================================================================
// Push Subscription Queries
// ============================================================================

export interface PushSubscriptionRow {
  id: number;
  user_id: string;
  endpoint: string;
  endpoint_hash: string;
  auth_key: string;
  p256dh_key: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function findPushSubscription(
  db: Database,
  endpointHash: string
): PushSubscriptionRow | null {
  const stmt = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint_hash = ?");
  return (stmt.get(endpointHash) as PushSubscriptionRow) ?? null;
}

export function findPushSubscriptionsByUser(db: Database, userId: string): PushSubscriptionRow[] {
  const stmt = db.prepare(
    "SELECT * FROM push_subscriptions WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)"
  );
  return stmt.all(userId, new Date().toISOString()) as PushSubscriptionRow[];
}

export function createPushSubscription(
  db: Database,
  sub: {
    userId: string;
    endpoint: string;
    endpointHash: string;
    authKey: string;
    p256dhKey: string;
    expiresAt?: string;
  }
): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, endpoint_hash, auth_key, p256dh_key, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    sub.userId,
    sub.endpoint,
    sub.endpointHash,
    sub.authKey,
    sub.p256dhKey,
    sub.expiresAt ?? null,
    now,
    now
  );
}

export function updatePushSubscriptionAccess(db: Database, endpointHash: string): void {
  const now = new Date().toISOString();
  const stmt = db.prepare("UPDATE push_subscriptions SET updated_at = ? WHERE endpoint_hash = ?");
  stmt.run(now, endpointHash);
}

export function deletePushSubscription(db: Database, endpointHash: string): void {
  const stmt = db.prepare("DELETE FROM push_subscriptions WHERE endpoint_hash = ?");
  stmt.run(endpointHash);
}

export function deletePushSubscriptionById(db: Database, id: number): void {
  const stmt = db.prepare("DELETE FROM push_subscriptions WHERE id = ?");
  stmt.run(id);
}

// ============================================================================
// Message Queries
// ============================================================================

export interface MessageRow {
  id: number;
  session_id: string;
  actor_id: string;
  text: string;
  type: string;
  metadata: string | null;
  created_at: string;
}

export function listMessages(
  db: Database,
  sessionId: string,
  opts?: { limit?: number; offset?: number }
): MessageRow[] {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const stmt = db.prepare(
    "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  );
  return stmt.all(sessionId, limit, offset) as MessageRow[];
}

export function createMessage(
  db: Database,
  msg: {
    sessionId: string;
    actorId: string;
    text: string;
    type?: string;
    metadata?: unknown;
  }
): number {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO messages (session_id, actor_id, text, type, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    msg.sessionId,
    msg.actorId,
    msg.text,
    msg.type ?? "system",
    msg.metadata ? JSON.stringify(msg.metadata) : null,
    now
  );
  return Number(result.lastInsertRowid);
}
