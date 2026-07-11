/**
 * Centralized path configuration for the MCP server.
 *
 * Resolves the data directory reliably regardless of how the server is launched:
 * 1. RPG_MCP_DATA_DIR env var (explicit override, set by plugin.json or user)
 * 2. Derived from the server's own location (packages/mcp-server/dist/index.js → repo/data/)
 * 3. Fallback to ~/.mythxengine/data — a stable per-user location for
 *    installed copies (npx / npm global), where a cwd-relative default
 *    would scatter databases across whatever directory launched the
 *    server. Created lazily, like every other data dir: getDb() mkdirs
 *    on first database open.
 *
 * This ensures the web app and MCP server always find the same mythx.db.
 */

import { join, dirname, resolve, sep } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

/**
 * Derive the monorepo root from this file's location.
 * This file lives at: <repo>/packages/mcp-server/src/config/paths.ts
 * Built to:           <repo>/packages/mcp-server/dist/config/paths.js
 * So repo root is:    ../../../../ (from src) or ../../../../ (from dist)
 *
 * We try multiple strategies to handle both dev and dist paths.
 */
function findRepoRoot(): string | null {
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url));

    // The dev-checkout heuristic only applies when running from a repo
    // checkout. An installed copy (npx cache, a consumer's node_modules)
    // must never latch onto the *consumer's* workspace markers — walking
    // up from node_modules/@mythxengine/mcp-server/dist would otherwise
    // find their turbo.json/pnpm-workspace.yaml and scatter mythx.db into
    // their repo instead of ~/.mythxengine/data. (Workspace links are
    // unaffected: node resolves the pnpm symlink to the real
    // packages/mcp-server path, which has no node_modules segment.)
    if (thisDir.split(sep).includes("node_modules")) return null;

    // Try 4 levels up (dist/config/paths.js → packages/mcp-server/dist/config → repo root)
    const candidate1 = resolve(thisDir, "../../../..");

    // Try 3 levels up (in case the build flattens the path)
    const candidate2 = resolve(thisDir, "../../..");

    for (const candidate of [candidate1, candidate2]) {
      // Verify it's the repo root by checking for pnpm-workspace.yaml or turbo.json
      if (
        existsSync(join(candidate, "pnpm-workspace.yaml")) ||
        existsSync(join(candidate, "turbo.json"))
      ) {
        return candidate;
      }
    }
  } catch {
    // import.meta.url not available or path resolution failed
  }
  return null;
}

const repoRoot = findRepoRoot();

/**
 * The data directory where mythx.db and other persistent data lives.
 */
export const DATA_DIR =
  process.env.RPG_MCP_DATA_DIR ||
  (repoRoot ? join(repoRoot, "data") : join(homedir(), ".mythxengine", "data"));

/**
 * Path to the SQLite database.
 */
export const DB_PATH = process.env.MYTHX_DB_PATH || join(DATA_DIR, "mythx.db");

/**
 * Directory for generated books.
 */
export const BOOKS_DIR = join(DATA_DIR, "books");

/**
 * Directory for shared rules.
 */
export const RULES_DIR = join(DATA_DIR, "rules");

/**
 * Directory for world pack exports.
 */
export const EXPORT_DIR = join(DATA_DIR, "exports");
