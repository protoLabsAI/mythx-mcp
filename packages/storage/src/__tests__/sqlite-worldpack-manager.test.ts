/**
 * Run world pack manager contract tests against SqliteWorldPackManager.
 */
import { describe, afterEach } from "vitest";
import { createDatabase, type Database } from "../sqlite/connection.js";
import {
  worldPackManagerContractTests,
  type WorldPackManagerFactory,
} from "./contracts/worldpack-manager.contract.js";
import { SqliteWorldPackManager } from "../managers/sqlite-worldpack-manager.js";
import { initializeSchema } from "../sqlite/schema.js";

describe("SqliteWorldPackManager", () => {
  let db: Database;

  const factory: WorldPackManagerFactory = {
    async create() {
      db = createDatabase(":memory:");
      initializeSchema(db);
      return new SqliteWorldPackManager(db);
    },
    async cleanup() {
      db.close();
    },
  };

  afterEach(async () => {
    await factory.cleanup();
  });

  worldPackManagerContractTests(factory);
});
