/**
 * File-based world pack manager
 *
 * Directory layout:
 *   worlds/<pack-id>/pack.json
 *   worlds/<pack-id>/summary.json (cached compact GM reference)
 */

import { readFile, readdir, rm } from "fs/promises";
import { join } from "path";
import type { IWorldPackManager } from "@mythxengine/types";
import type { WorldContentPack } from "@mythxengine/worlds";
import { atomicWriteJSON } from "../utils/atomic-write.js";
import { ensureDir } from "../utils/ensure-dir.js";

export class FileWorldPackManager implements IWorldPackManager {
  private cache = new Map<string, WorldContentPack>();
  private worldsDir: string;

  constructor(rootDir: string) {
    this.worldsDir = join(rootDir, "worlds");
  }

  private packDir(packId: string): string {
    return join(this.worldsDir, packId);
  }

  private packPath(packId: string): string {
    return join(this.packDir(packId), "pack.json");
  }

  async get(packId: string): Promise<WorldContentPack | null> {
    const cached = this.cache.get(packId);
    if (cached) return cached;

    try {
      const content = await readFile(this.packPath(packId), "utf-8");
      const pack = JSON.parse(content) as WorldContentPack;
      this.cache.set(packId, pack);
      return pack;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async getSummary(packId: string): Promise<WorldContentPack | null> {
    // For now, returns the full pack. A proper summary cache can
    // be added later (the summary generation logic lives in tools).
    return this.get(packId);
  }

  async save(packId: string, pack: unknown): Promise<void> {
    await ensureDir(this.packDir(packId));
    await atomicWriteJSON(this.packPath(packId), pack);
    this.cache.set(packId, pack as WorldContentPack);
  }

  async delete(packId: string): Promise<void> {
    this.cache.delete(packId);
    try {
      await rm(this.packDir(packId), { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  async list(): Promise<string[]> {
    try {
      await ensureDir(this.worldsDir);
      const entries = await readdir(this.worldsDir, { withFileTypes: true });
      const ids: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            await readFile(join(this.worldsDir, entry.name, "pack.json"), "utf-8");
            ids.push(entry.name);
          } catch {
            // Skip directories without pack.json
          }
        }
      }
      return ids;
    } catch {
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
