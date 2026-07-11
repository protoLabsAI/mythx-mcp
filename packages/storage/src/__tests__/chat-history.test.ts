/**
 * Run chat history contract tests against FileChatHistoryManager.
 */
import { describe, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  chatHistoryContractTests,
  type ChatHistoryManagerFactory,
} from "./contracts/chat-history.contract.js";
import { FileChatHistoryManager } from "../managers/chat-history-manager.js";

describe("FileChatHistoryManager", () => {
  let tempDir: string;

  const factory: ChatHistoryManagerFactory = {
    async create() {
      tempDir = await mkdtemp(join(tmpdir(), "storage-chat-"));
      return new FileChatHistoryManager(tempDir);
    },
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };

  afterEach(async () => {
    await factory.cleanup();
  });

  chatHistoryContractTests(factory);
});
