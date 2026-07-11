/**
 * Migration: v0 flat layout → v1 directory layout
 *
 * v0 layout (mcp-server):
 *   data/<id>.session.json
 *   data/worlds/<id>.world.json
 *   data/generation/<sessionId>/
 *
 * v1 layout (storage package):
 *   data/sessions/<id>/state.json
 *   data/worlds/<id>/pack.json
 *   data/worlds/<id>/generation/  (moved from data/generation/<id>/)
 *   data/config.json              (new, not migrated)
 *
 * Files/dirs not migrated (kept as-is):
 *   data/books/<packId>/
 *   data/rules/
 */

import { readdir, readFile, rename, rm, stat } from "fs/promises";
import { join } from "path";
import { ensureDir } from "./utils/ensure-dir.js";

export interface MigrationResult {
  sessionsmigrated: string[];
  worldPacksMigrated: string[];
  generationDirsMigrated: string[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Check if a data directory needs migration (has v0-style files).
 */
export async function needsMigration(rootDir: string): Promise<boolean> {
  try {
    const entries = await readdir(rootDir);
    // v0 has *.session.json files at the root
    return entries.some((f) => f.endsWith(".session.json"));
  } catch {
    return false;
  }
}

/**
 * Migrate a v0 data directory to v1 layout.
 * Non-destructive: creates new structure, then removes old files only on success.
 */
export async function migrateV0ToV1(rootDir: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    sessionsmigrated: [],
    worldPacksMigrated: [],
    generationDirsMigrated: [],
    errors: [],
  };

  // 1. Migrate sessions: <id>.session.json → sessions/<id>/state.json
  try {
    const rootEntries = await readdir(rootDir);
    const sessionFiles = rootEntries.filter((f) => f.endsWith(".session.json"));

    for (const file of sessionFiles) {
      const sessionId = file.replace(".session.json", "");
      const oldPath = join(rootDir, file);
      const newDir = join(rootDir, "sessions", sessionId);
      const newPath = join(newDir, "state.json");

      try {
        await ensureDir(newDir);
        // Read and re-write rather than rename to handle cross-device moves
        const content = await readFile(oldPath, "utf-8");
        const { writeFile } = await import("fs/promises");
        await writeFile(newPath, content, "utf-8");
        await rm(oldPath);
        result.sessionsmigrated.push(sessionId);
      } catch (error) {
        result.errors.push({ file, error: String(error) });
      }
    }
  } catch {
    // No root dir = nothing to migrate
  }

  // 2. Migrate world packs: worlds/<id>.world.json → worlds/<id>/pack.json
  const worldsDir = join(rootDir, "worlds");
  try {
    const worldEntries = await readdir(worldsDir);
    const worldFiles = worldEntries.filter((f) => f.endsWith(".world.json"));

    for (const file of worldFiles) {
      const packId = file.replace(".world.json", "");
      const oldPath = join(worldsDir, file);
      const newDir = join(worldsDir, packId);
      const newPath = join(newDir, "pack.json");

      try {
        await ensureDir(newDir);
        const content = await readFile(oldPath, "utf-8");
        const { writeFile } = await import("fs/promises");
        await writeFile(newPath, content, "utf-8");
        await rm(oldPath);
        result.worldPacksMigrated.push(packId);
      } catch (error) {
        result.errors.push({ file, error: String(error) });
      }
    }
  } catch {
    // No worlds dir = nothing to migrate
  }

  // 3. Migrate generation dirs: generation/<sessionId>/ → worlds/<packId>/generation/
  // The old layout keys generation dirs by sessionId. We need the session's
  // worldPackId to know where to move it. If no worldPackId, we key by sessionId.
  const generationDir = join(rootDir, "generation");
  try {
    const genStat = await stat(generationDir);
    if (genStat.isDirectory()) {
      const genEntries = await readdir(generationDir, { withFileTypes: true });

      for (const entry of genEntries) {
        if (!entry.isDirectory()) continue;
        const sessionId = entry.name;
        const oldGenDir = join(generationDir, sessionId);

        // Try to find the pack ID from the session or use sessionId as fallback
        let packId = sessionId;
        try {
          // Check new location first (session may already be migrated)
          const sessionPath = join(rootDir, "sessions", sessionId, "state.json");
          const sessionContent = await readFile(sessionPath, "utf-8");
          const session = JSON.parse(sessionContent);
          if (session.worldPackId) {
            packId = session.worldPackId;
          }
        } catch {
          // Try old location
          try {
            const oldSessionPath = join(rootDir, `${sessionId}.session.json`);
            const sessionContent = await readFile(oldSessionPath, "utf-8");
            const session = JSON.parse(sessionContent);
            if (session.worldPackId) {
              packId = session.worldPackId;
            }
          } catch {
            // Use sessionId as fallback
          }
        }

        const newGenDir = join(worldsDir, packId, "generation");
        try {
          await ensureDir(join(worldsDir, packId));
          await rename(oldGenDir, newGenDir);
          result.generationDirsMigrated.push(sessionId);
        } catch (error) {
          result.errors.push({ file: `generation/${sessionId}`, error: String(error) });
        }
      }

      // Remove empty generation dir
      try {
        const remaining = await readdir(generationDir);
        if (remaining.length === 0) {
          await rm(generationDir, { recursive: true });
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // No generation dir = nothing to migrate
  }

  return result;
}
