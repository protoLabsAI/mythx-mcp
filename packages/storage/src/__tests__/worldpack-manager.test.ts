/**
 * Run world pack manager contract tests against FileWorldPackManager.
 */
import { describe, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  worldPackManagerContractTests,
  type WorldPackManagerFactory,
} from "./contracts/worldpack-manager.contract.js";
import { FileWorldPackManager } from "../managers/worldpack-manager.js";

describe("FileWorldPackManager", () => {
  let tempDir: string;

  const factory: WorldPackManagerFactory = {
    async create() {
      tempDir = await mkdtemp(join(tmpdir(), "storage-worldpack-"));
      return new FileWorldPackManager(tempDir);
    },
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };

  afterEach(async () => {
    await factory.cleanup();
  });

  worldPackManagerContractTests(factory);
});
