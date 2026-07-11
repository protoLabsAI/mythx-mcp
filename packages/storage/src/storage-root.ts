/**
 * StorageRoot — single entry point for all file-based storage.
 *
 * Usage:
 *   const storage = createStorageRoot('/path/to/data');
 *   const session = await storage.sessions.get('my-session');
 *   const ctx = storage.toToolContext(getRules, eventBus);
 */

import type {
  ToolContext,
  IEventBus,
  GetRulesFunction,
  ISessionManager,
  IWorldPackManager,
} from "@mythxengine/types";
import { nullEventBus } from "@mythxengine/types";
import { FileSessionManager } from "./managers/session-manager.js";
import { FileWorldPackManager } from "./managers/worldpack-manager.js";
import { FileGenerationManager } from "./managers/generation-manager.js";
import { FileConfigManager } from "./managers/config-manager.js";
import { FileChatHistoryManager } from "./managers/chat-history-manager.js";
import { FileMediaManager } from "./managers/media-manager.js";
import { SqliteSessionManager } from "./managers/sqlite-session-manager.js";
import { SqliteWorldPackManager } from "./managers/sqlite-worldpack-manager.js";
import { getDb } from "./sqlite/connection.js";

export interface StorageRoot {
  /** Root data directory */
  readonly rootDir: string;

  /** Session state manager */
  readonly sessions: ISessionManager;

  /** World pack manager */
  readonly worldPacks: IWorldPackManager;

  /** World generation manager */
  readonly generation: FileGenerationManager;

  /** Application config manager */
  readonly config: FileConfigManager;

  /** Chat history manager (per-session JSONL) */
  readonly chatHistory: FileChatHistoryManager;

  /** Media file manager (per-session) */
  readonly media: FileMediaManager;

  /**
   * Create a ToolContext for shared tools.
   * @param getRules - Function to resolve rules for a session
   * @param eventBus - Optional event bus (defaults to nullEventBus)
   */
  toToolContext(getRules: GetRulesFunction, eventBus?: IEventBus): ToolContext;
}

/**
 * Create a file-based StorageRoot from a data directory path.
 */
export function createStorageRoot(rootDir: string): StorageRoot {
  const sessions = new FileSessionManager(rootDir);
  const worldPacks = new FileWorldPackManager(rootDir);
  const generation = new FileGenerationManager(rootDir);
  const config = new FileConfigManager(rootDir);
  const chatHistory = new FileChatHistoryManager(rootDir);
  const media = new FileMediaManager(rootDir);

  return {
    rootDir,
    sessions,
    worldPacks,
    generation,
    config,
    chatHistory,
    media,

    toToolContext(getRules: GetRulesFunction, eventBus?: IEventBus): ToolContext {
      return {
        sessions,
        worldPacks,
        getRules,
        eventBus: eventBus ?? nullEventBus,
      };
    },
  };
}

/**
 * Create a SQLite-backed StorageRoot.
 *
 * Sessions and world packs are stored in the SQLite database.
 * Generation, config, chat history, and media remain file-based.
 *
 * @param dbPath - Path to the SQLite database file
 * @param rootDir - Root directory for file-based managers (generation, config, etc.)
 */
export function createSqliteStorageRoot(dbPath: string, rootDir: string): StorageRoot {
  const db = getDb(dbPath);
  const sessions = new SqliteSessionManager(db);
  const worldPacks = new SqliteWorldPackManager(db);
  const generation = new FileGenerationManager(rootDir);
  const config = new FileConfigManager(rootDir);
  const chatHistory = new FileChatHistoryManager(rootDir);
  const media = new FileMediaManager(rootDir);

  return {
    rootDir,
    sessions,
    worldPacks,
    generation,
    config,
    chatHistory,
    media,

    toToolContext(getRules: GetRulesFunction, eventBus?: IEventBus): ToolContext {
      return {
        sessions,
        worldPacks,
        getRules,
        eventBus: eventBus ?? nullEventBus,
      };
    },
  };
}
