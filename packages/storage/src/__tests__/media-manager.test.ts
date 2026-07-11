/**
 * Run media manager contract tests against FileMediaManager.
 */
import { describe, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  mediaManagerContractTests,
  type MediaManagerFactory,
} from "./contracts/media-manager.contract.js";
import { FileMediaManager } from "../managers/media-manager.js";

describe("FileMediaManager", () => {
  let tempDir: string;

  const factory: MediaManagerFactory = {
    async create() {
      tempDir = await mkdtemp(join(tmpdir(), "storage-media-"));
      return new FileMediaManager(tempDir);
    },
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };

  afterEach(async () => {
    await factory.cleanup();
  });

  mediaManagerContractTests(factory);
});
