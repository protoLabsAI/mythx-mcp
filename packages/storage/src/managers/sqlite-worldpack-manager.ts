/**
 * SQLite-backed world pack manager
 *
 * Implements IWorldPackManager using a shared SQLite database.
 * Same in-memory cache pattern as FileWorldPackManager.
 */

import type { Database, Statement } from "../sqlite/connection.js";
import type { IWorldPackManager } from "@mythxengine/types";
import type { WorldContentPack } from "@mythxengine/worlds";

export class SqliteWorldPackManager implements IWorldPackManager {
  private cache = new Map<string, WorldContentPack>();
  private stmts: {
    get: Statement;
    getSummary: Statement;
    upsert: Statement;
    del: Statement;
    list: Statement;
  };

  constructor(db: Database) {
    this.stmts = {
      get: db.prepare("SELECT compiled FROM world_packs WHERE id = ?"),
      getSummary: db.prepare(
        "SELECT id, name, tagline, tier, status, created_at, updated_at FROM world_packs WHERE id = ?"
      ),
      upsert: db.prepare(`
        INSERT OR REPLACE INTO world_packs (id, name, tagline, tier, status, compiled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      del: db.prepare("DELETE FROM world_packs WHERE id = ?"),
      list: db.prepare("SELECT id FROM world_packs ORDER BY updated_at DESC"),
    };
  }

  async get(packId: string): Promise<WorldContentPack | null> {
    const cached = this.cache.get(packId);
    if (cached) return cached;

    const row = this.stmts.get.get(packId) as { compiled: string } | undefined;
    if (!row || !row.compiled) return null;

    const pack = JSON.parse(row.compiled) as WorldContentPack;
    this.cache.set(packId, pack);
    return pack;
  }

  async getSummary(packId: string): Promise<WorldContentPack | null> {
    // For now, returns the full pack (same as file-based impl).
    // The lightweight metadata query is available via queries.ts for API routes.
    return this.get(packId);
  }

  async save(packId: string, pack: unknown): Promise<void> {
    const now = new Date().toISOString();
    const wcp = pack as WorldContentPack;

    // Extract metadata from pack for indexed columns
    const name = wcp?.meta?.name ?? packId;
    const tagline = wcp?.meta?.tagline ?? null;
    const tier = ((wcp?.meta as Record<string, unknown>)?.tier as string) ?? "medium";

    // Check if row exists for created_at preservation
    const existing = this.stmts.getSummary.get(packId) as { created_at: string } | undefined;
    const createdAt = existing?.created_at ?? now;

    this.stmts.upsert.run(
      packId,
      name,
      tagline,
      tier,
      "draft",
      JSON.stringify(pack),
      createdAt,
      now
    );

    this.cache.set(packId, wcp);
  }

  async delete(packId: string): Promise<void> {
    this.cache.delete(packId);
    this.stmts.del.run(packId);
  }

  async list(): Promise<string[]> {
    const rows = this.stmts.list.all() as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
