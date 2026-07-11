/**
 * Run session manager contract tests against FileSessionManager.
 */
import { describe, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  sessionManagerContractTests,
  type SessionManagerFactory,
} from "./contracts/session-manager.contract.js";
import { FileSessionManager } from "../managers/session-manager.js";

describe("FileSessionManager", () => {
  let tempDir: string;

  const factory: SessionManagerFactory = {
    async create() {
      tempDir = await mkdtemp(join(tmpdir(), "storage-session-"));
      return new FileSessionManager(tempDir);
    },
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };

  afterEach(async () => {
    await factory.cleanup();
  });

  sessionManagerContractTests(factory);
});
