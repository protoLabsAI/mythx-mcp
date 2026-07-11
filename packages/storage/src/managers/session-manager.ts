/**
 * File-based session manager
 *
 * Directory layout:
 *   sessions/<session-id>/state.json
 *   sessions/index.json (manifest for fast listing)
 */

import { readFile, readdir, rm } from "fs/promises";
import { join } from "path";
import type { SessionState, ISessionManager } from "@mythxengine/types";
import { createEmptySession } from "@mythxengine/types";
import { atomicWriteJSON } from "../utils/atomic-write.js";
import { ensureDir } from "../utils/ensure-dir.js";

export class FileSessionManager implements ISessionManager {
  private cache = new Map<string, SessionState>();
  private sessionsDir: string;

  constructor(rootDir: string) {
    this.sessionsDir = join(rootDir, "sessions");
  }

  private sessionDir(sessionId: string): string {
    return join(this.sessionsDir, sessionId);
  }

  private statePath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "state.json");
  }

  async get(sessionId: string): Promise<SessionState | null> {
    const cached = this.cache.get(sessionId);
    if (cached) return cached;

    try {
      const content = await readFile(this.statePath(sessionId), "utf-8");
      const session = JSON.parse(content) as SessionState;
      this.cache.set(sessionId, session);
      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
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

    await ensureDir(this.sessionDir(state.metadata.id));
    await atomicWriteJSON(this.statePath(state.metadata.id), updated);
    this.cache.set(state.metadata.id, updated);
  }

  async delete(sessionId: string): Promise<void> {
    this.cache.delete(sessionId);
    try {
      await rm(this.sessionDir(sessionId), { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  async list(): Promise<string[]> {
    try {
      await ensureDir(this.sessionsDir);
      const entries = await readdir(this.sessionsDir, { withFileTypes: true });
      const ids: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Verify state.json exists
          try {
            await readFile(join(this.sessionsDir, entry.name, "state.json"), "utf-8");
            ids.push(entry.name);
          } catch {
            // Skip directories without state.json
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
