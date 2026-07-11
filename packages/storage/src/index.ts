/**
 * @mythxengine/storage
 *
 * Storage layer for MythxEngine.
 * Provides file-based and SQLite-backed managers for sessions, world packs,
 * config, chat history, and media.
 */

// Schemas
export * from "./schemas/index.js";

// File-based managers
export { FileSessionManager } from "./managers/session-manager.js";
export { FileWorldPackManager } from "./managers/worldpack-manager.js";
export { FileGenerationManager } from "./managers/generation-manager.js";
export { FileConfigManager } from "./managers/config-manager.js";
export { FileChatHistoryManager } from "./managers/chat-history-manager.js";
export { FileMediaManager } from "./managers/media-manager.js";
export { WorldMediaManager } from "./managers/world-media-manager.js";
export type { MediaEntry, MediaManifest } from "./schemas/media.js";

// SQLite-backed managers
export { SqliteSessionManager } from "./managers/sqlite-session-manager.js";
export { SqliteWorldPackManager } from "./managers/sqlite-worldpack-manager.js";
export { ActManager } from "./managers/act-manager.js";
export type { Act, ActSummary, CloseActOptions, SummaryStatus } from "./managers/act-manager.js";
export { StoryPageManager } from "./managers/story-page-manager.js";
export type { StoryPage, StoryPageStatus } from "./managers/story-page-manager.js";

// SQLite connection and queries
export { getDb, createDatabase, closeAll as closeSqliteConnections } from "./sqlite/connection.js";
export type { Database, Statement, SqlParameter, SqlRunResult } from "./sqlite/connection.js";
export { initializeSchema } from "./sqlite/schema.js";
export * from "./sqlite/queries.js";

// Training-data capture (gameplay_events sink + reward reconciler).
// See docs/finetuning-data-pipeline.md.
export * from "./training/index.js";

// StorageRoot
export { createStorageRoot, createSqliteStorageRoot, type StorageRoot } from "./storage-root.js";

// Migration
export { needsMigration, migrateV0ToV1, type MigrationResult } from "./migrate-v0-to-v1.js";

// Utilities
export {
  atomicWriteFile,
  atomicWriteJSON,
  appendJSONL,
  readJSONL,
  readRecentJSONL,
  countJSONL,
  clearJSONL,
  ensureDir,
} from "./utils/index.js";
