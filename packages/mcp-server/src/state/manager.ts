/**
 * Session state persistence
 *
 * Delegates to @mythxengine/storage SQLite manager for session management.
 */

import type { SessionState, ISessionManager } from "@mythxengine/types";
import { getDb, SqliteSessionManager } from "@mythxengine/storage";
import { DB_PATH } from "../config/paths.js";

// ============================================================================
// Session Manager (SQLite-backed via @mythxengine/storage)
// ============================================================================

const _sqliteSessionManager = new SqliteSessionManager(getDb(DB_PATH));

/**
 * Validate session ID format
 */
function validateSessionId(sessionId: string): void {
  if (!/^[a-z0-9-_]+$/i.test(sessionId)) {
    throw new Error(
      `Invalid session ID: ${sessionId}. Must contain only alphanumeric characters, hyphens, and underscores`
    );
  }
}

/**
 * Load a session
 */
export async function loadSession(sessionId: string): Promise<SessionState | null> {
  validateSessionId(sessionId);
  return _sqliteSessionManager.get(sessionId);
}

/**
 * Save a session
 */
export async function saveSession(state: SessionState): Promise<void> {
  return _sqliteSessionManager.save(state);
}

/**
 * Get or create a session
 */
export async function getOrCreateSession(sessionId: string, name?: string): Promise<SessionState> {
  validateSessionId(sessionId);
  return _sqliteSessionManager.getOrCreate(sessionId, name);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  validateSessionId(sessionId);
  return _sqliteSessionManager.delete(sessionId);
}

/**
 * List all sessions
 */
export async function listSessions(): Promise<string[]> {
  return _sqliteSessionManager.list();
}

/**
 * Session state manager class for convenient access
 * Wraps SqliteSessionManager with validation
 */
export class SessionManager implements ISessionManager {
  private delegate = _sqliteSessionManager;

  async get(sessionId: string): Promise<SessionState | null> {
    return this.delegate.get(sessionId);
  }

  async getOrCreate(sessionId: string, name?: string): Promise<SessionState> {
    return this.delegate.getOrCreate(sessionId, name);
  }

  async save(state: SessionState): Promise<void> {
    return this.delegate.save(state);
  }

  async delete(sessionId: string): Promise<void> {
    return this.delegate.delete(sessionId);
  }

  async list(): Promise<string[]> {
    return this.delegate.list();
  }

  clearCache(): void {
    this.delegate.clearCache();
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
