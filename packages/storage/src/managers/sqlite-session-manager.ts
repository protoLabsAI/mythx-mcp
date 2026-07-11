/**
 * SQLite-backed session manager
 *
 * Implements ISessionManager using a shared SQLite database.
 * Same in-memory cache pattern as FileSessionManager.
 */

import type { Database, Statement } from "../sqlite/connection.js";
import type { SessionState, ISessionManager } from "@mythxengine/types";
import { createEmptySession } from "@mythxengine/types";

export class SqliteSessionManager implements ISessionManager {
  private cache = new Map<string, SessionState>();
  private stmts: {
    get: Statement;
    upsert: Statement;
    del: Statement;
    list: Statement;
  };

  constructor(db: Database) {
    this.stmts = {
      get: db.prepare("SELECT state FROM sessions WHERE id = ?"),
      upsert: db.prepare(`
        INSERT OR REPLACE INTO sessions (id, name, world_pack_id, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      del: db.prepare("DELETE FROM sessions WHERE id = ?"),
      list: db.prepare("SELECT id FROM sessions ORDER BY updated_at DESC"),
    };
  }

  async get(sessionId: string): Promise<SessionState | null> {
    const cached = this.cache.get(sessionId);
    if (cached) return cached;

    const row = this.stmts.get.get(sessionId) as { state: string } | undefined;
    if (!row) return null;

    const session = JSON.parse(row.state) as SessionState;
    this.cache.set(sessionId, session);
    return session;
  }

  async getOrCreate(sessionId: string, name?: string): Promise<SessionState> {
    const existing = await this.get(sessionId);
    if (existing) return existing;

    const session = createEmptySession(sessionId, name ?? sessionId);
    await this.save(session);
    return session;
  }

  async save(state: SessionState): Promise<void> {
    const updated: SessionState = {
      ...state,
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    this.stmts.upsert.run(
      updated.metadata.id,
      updated.metadata.name,
      updated.worldPackId ?? null,
      JSON.stringify(updated),
      updated.metadata.createdAt,
      updated.metadata.updatedAt
    );

    this.cache.set(updated.metadata.id, updated);
  }

  async delete(sessionId: string): Promise<void> {
    this.cache.delete(sessionId);
    this.stmts.del.run(sessionId);
  }

  async list(): Promise<string[]> {
    const rows = this.stmts.list.all() as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
