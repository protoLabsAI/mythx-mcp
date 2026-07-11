/**
 * State management exports
 *
 * SQLite-backed persistence for sessions and world packs.
 */

export {
  SessionManager,
  sessionManager,
  loadSession,
  saveSession,
  getOrCreateSession,
  deleteSession,
  listSessions,
} from "./manager.js";

export {
  WorldPackManager,
  worldPackManager,
  loadWorldPack,
  saveWorldPack,
  deleteWorldPack,
  listWorldPacks,
  getWorldBooksDir,
  getRulesDir,
} from "./worldpacks.js";
