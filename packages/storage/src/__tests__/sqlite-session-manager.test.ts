/**
 * Run session manager contract tests against SqliteSessionManager.
 */
import { describe, afterEach } from "vitest";
import { createDatabase, type Database } from "../sqlite/connection.js";
import {
  sessionManagerContractTests,
  type SessionManagerFactory,
} from "./contracts/session-manager.contract.js";
import { SqliteSessionManager } from "../managers/sqlite-session-manager.js";
import { initializeSchema } from "../sqlite/schema.js";

describe("SqliteSessionManager", () => {
  let db: Database;

  const factory: SessionManagerFactory = {
    async create() {
      db = createDatabase(":memory:");
      initializeSchema(db);
      return new SqliteSessionManager(db);
    },
    async cleanup() {
      db.close();
    },
  };

  afterEach(async () => {
    await factory.cleanup();
  });

  sessionManagerContractTests(factory);
});
