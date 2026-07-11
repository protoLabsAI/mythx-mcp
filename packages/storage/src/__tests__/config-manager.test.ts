/**
 * Run config manager contract tests against FileConfigManager.
 */
import { describe, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  configManagerContractTests,
  type ConfigManagerFactory,
} from "./contracts/config-manager.contract.js";
import { FileConfigManager } from "../managers/config-manager.js";

describe("FileConfigManager", () => {
  let tempDir: string;

  const factory: ConfigManagerFactory = {
    async create() {
      tempDir = await mkdtemp(join(tmpdir(), "storage-config-"));
      return new FileConfigManager(tempDir);
    },
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };

  afterEach(async () => {
    await factory.cleanup();
  });

  configManagerContractTests(factory);
});
