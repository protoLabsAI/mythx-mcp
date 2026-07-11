/**
 * SQLite Connection Factory — runtime-adaptive driver.
 *
 * - Under Bun: `bun:sqlite` (fast native driver, used in dev and the
 *   desktop sidecar).
 * - Under Node ≥22.13: the builtin `node:sqlite` (`DatabaseSync`) behind
 *   a thin adapter that normalizes the API to the same surface.
 *
 * Both drivers are loaded lazily via createRequire, guarded by a runtime
 * check, so neither runtime ever tries to resolve the other's module —
 * Node never sees `bun:sqlite` and Bun never sees `node:sqlite` (Bun's
 * own node:sqlite polyfill is partial; we stay on its native driver).
 *
 * The exported `Database`/`Statement` types are our own minimal
 * interfaces — the only SQLite surface the codebase is allowed to use:
 * prepare/run/get/all, exec, transaction, close.
 *
 * getDb() is a singleton per resolved file path. Enables WAL mode for
 * safe multi-process access (MCP server + web app).
 */

import { createRequire } from "node:module";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { initializeSchema } from "./schema.js";

/** Values that can be bound to a statement parameter. */
export type SqlParameter = null | number | bigint | string | Uint8Array;

/** Result of a statement that mutates rows. */
export interface SqlRunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

/**
 * A prepared statement. `get()` returns `undefined` (node:sqlite) or
 * `null` (bun:sqlite) when no row matches — callers must use `!= null`
 * style checks, never strict comparison against one of the two.
 */
export interface Statement {
  run(...params: SqlParameter[]): SqlRunResult;
  get(...params: SqlParameter[]): unknown;
  all(...params: SqlParameter[]): unknown[];
}

/** The minimal database surface shared by both drivers. */
export interface Database {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  /**
   * Wrap `fn` so that invoking the returned function runs it inside a
   * transaction (committed on return, rolled back on throw).
   */
  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
  ): (...args: TArgs) => TResult;
  close(): void;
}

// ---------------------------------------------------------------------------
// Node adapter: node:sqlite's DatabaseSync covers prepare/run/get/all/exec
// but has no transaction(); we add one via BEGIN IMMEDIATE/COMMIT/ROLLBACK.
// ---------------------------------------------------------------------------

interface NodeSqliteDatabase {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => NodeSqliteDatabase;
}

class NodeDatabase implements Database {
  readonly #db: NodeSqliteDatabase;

  constructor(db: NodeSqliteDatabase) {
    this.#db = db;
  }

  prepare(sql: string): Statement {
    return this.#db.prepare(sql);
  }

  exec(sql: string): void {
    this.#db.exec(sql);
  }

  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => {
      this.#db.exec("BEGIN IMMEDIATE");
      try {
        const result = fn(...args);
        this.#db.exec("COMMIT");
        return result;
      } catch (err) {
        this.#db.exec("ROLLBACK");
        throw err;
      }
    };
  }

  close(): void {
    this.#db.close();
  }
}

// ---------------------------------------------------------------------------
// Runtime-adaptive factory
// ---------------------------------------------------------------------------

let _factory: ((path: string) => Database) | undefined;

function getFactory(): (path: string) => Database {
  if (_factory) return _factory;

  const req = createRequire(import.meta.url);

  if (process.versions.bun) {
    // bun:sqlite's Database natively satisfies our surface (including
    // transaction()).
    const { Database: BunDatabase } = req("bun:sqlite") as {
      Database: new (path: string) => Database;
    };
    _factory = (path) => new BunDatabase(path);
    return _factory;
  }

  let mod: NodeSqliteModule;
  try {
    mod = req("node:sqlite") as NodeSqliteModule;
  } catch (err) {
    throw new Error(
      "@mythxengine/storage requires Bun, or Node.js >= 22.13 " +
        "(for the builtin node:sqlite module). " +
        `Current runtime: node ${process.versions.node}. ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  _factory = (path) => new NodeDatabase(new mod.DatabaseSync(path));
  return _factory;
}

/**
 * Open a database at `path` (":memory:" supported) with the driver for
 * the current runtime. No schema init, no caching — see getDb() for the
 * managed singleton. Exposed for tests and ad-hoc tooling.
 */
export function createDatabase(path: string): Database {
  return getFactory()(path);
}

// ---------------------------------------------------------------------------
// Connection cache
// ---------------------------------------------------------------------------

const connections = new Map<string, Database>();

/**
 * Get or create a SQLite database connection.
 *
 * - Opens the database file (creates if missing)
 * - Enables WAL mode for concurrent read/write across processes
 * - Sets busy timeout to 5s for write contention
 * - Initializes schema on first open
 *
 * Returns the same instance for the same resolved path.
 */
export function getDb(dbPath: string): Database {
  const resolved = resolve(dbPath);
  const existing = connections.get(resolved);
  if (existing) return existing;

  mkdirSync(dirname(resolved), { recursive: true });
  const db = createDatabase(resolved);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");

  initializeSchema(db);

  connections.set(resolved, db);
  return db;
}

/**
 * Close all cached connections. Used in tests.
 */
export function closeAll(): void {
  for (const db of connections.values()) {
    db.close();
  }
  connections.clear();
}
