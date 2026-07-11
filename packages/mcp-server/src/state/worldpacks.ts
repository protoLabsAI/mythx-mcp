/**
 * World pack persistence
 *
 * Delegates to @mythxengine/storage SQLite manager for world pack management.
 * Helper functions (getWorldBooksDir, getRulesDir) remain local.
 */

import { join } from "path";
import type { WorldContentPack } from "@mythxengine/worlds";
import { getDb, SqliteWorldPackManager } from "@mythxengine/storage";
import { DB_PATH, BOOKS_DIR, RULES_DIR } from "../config/paths.js";

// ============================================================================
// World Pack Manager (SQLite-backed via @mythxengine/storage)
// ============================================================================

const _sqliteWorldPackManager = new SqliteWorldPackManager(getDb(DB_PATH));

/**
 * Get the directory for a world's generated books
 */
export function getWorldBooksDir(packId: string): string {
  return join(BOOKS_DIR, packId);
}

/**
 * Get the directory for shared rules
 */
export function getRulesDir(): string {
  return RULES_DIR;
}

/**
 * Save a world pack
 */
export async function saveWorldPack(packId: string, worldPack: WorldContentPack): Promise<void> {
  return _sqliteWorldPackManager.save(packId, worldPack);
}

/**
 * Load a world pack
 */
export async function loadWorldPack(packId: string): Promise<WorldContentPack | null> {
  return _sqliteWorldPackManager.get(packId);
}

/**
 * Delete a world pack
 */
export async function deleteWorldPack(packId: string): Promise<void> {
  return _sqliteWorldPackManager.delete(packId);
}

/**
 * List all world packs
 */
export async function listWorldPacks(): Promise<string[]> {
  return _sqliteWorldPackManager.list();
}

/**
 * World pack manager class for convenient access
 */
export class WorldPackManager {
  async get(packId: string): Promise<WorldContentPack | null> {
    return _sqliteWorldPackManager.get(packId);
  }

  async getSummary(packId: string): Promise<WorldContentPack | null> {
    return _sqliteWorldPackManager.getSummary(packId);
  }

  async save(packId: string, pack: WorldContentPack): Promise<void> {
    return _sqliteWorldPackManager.save(packId, pack);
  }

  async delete(packId: string): Promise<void> {
    return _sqliteWorldPackManager.delete(packId);
  }

  async list(): Promise<string[]> {
    return _sqliteWorldPackManager.list();
  }

  clearCache(): void {
    _sqliteWorldPackManager.clearCache();
  }
}

// Singleton instance
export const worldPackManager = new WorldPackManager();
