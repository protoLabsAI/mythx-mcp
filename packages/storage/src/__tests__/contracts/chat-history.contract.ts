/**
 * Chat History Manager Contract Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { ChatMessage } from "../../schemas/chat.js";
import { createTestChatMessage } from "../fixtures.js";

export interface IChatHistoryManager {
  append(sessionId: string, message: ChatMessage): Promise<void>;
  getAll(sessionId: string): Promise<ChatMessage[]>;
  getRecent(sessionId: string, count: number): Promise<ChatMessage[]>;
  count(sessionId: string): Promise<number>;
  clear(sessionId: string): Promise<void>;
}

export interface ChatHistoryManagerFactory {
  create(): Promise<IChatHistoryManager>;
  cleanup(): Promise<void>;
}

export function chatHistoryContractTests(factory: ChatHistoryManagerFactory): void {
  let manager: IChatHistoryManager;

  beforeEach(async () => {
    manager = await factory.create();
  });

  describe("append() + getAll()", () => {
    it("appends and retrieves a message", async () => {
      const msg = createTestChatMessage({ id: "msg-1", content: "Hello" });
      await manager.append("session-1", msg);
      const all = await manager.getAll("session-1");
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("msg-1");
      expect(all[0].content).toBe("Hello");
    });

    it("returns chronological order", async () => {
      const msg1 = createTestChatMessage({ id: "first", timestamp: "2024-01-01T00:00:00Z" });
      const msg2 = createTestChatMessage({ id: "second", timestamp: "2024-01-01T00:01:00Z" });
      const msg3 = createTestChatMessage({ id: "third", timestamp: "2024-01-01T00:02:00Z" });
      await manager.append("session-1", msg1);
      await manager.append("session-1", msg2);
      await manager.append("session-1", msg3);
      const all = await manager.getAll("session-1");
      expect(all.map((m) => m.id)).toEqual(["first", "second", "third"]);
    });

    it("returns empty for new session", async () => {
      const all = await manager.getAll("nonexistent");
      expect(all).toEqual([]);
    });

    it("isolates sessions", async () => {
      await manager.append("s1", createTestChatMessage({ id: "m1" }));
      await manager.append("s2", createTestChatMessage({ id: "m2" }));
      const s1 = await manager.getAll("s1");
      const s2 = await manager.getAll("s2");
      expect(s1).toHaveLength(1);
      expect(s1[0].id).toBe("m1");
      expect(s2).toHaveLength(1);
      expect(s2[0].id).toBe("m2");
    });
  });

  describe("getRecent()", () => {
    it("returns last N messages", async () => {
      for (let i = 1; i <= 5; i++) {
        await manager.append("session-1", createTestChatMessage({ id: `msg-${i}` }));
      }
      const recent = await manager.getRecent("session-1", 2);
      expect(recent).toHaveLength(2);
      expect(recent[0].id).toBe("msg-4");
      expect(recent[1].id).toBe("msg-5");
    });

    it("returns all if fewer than N exist", async () => {
      await manager.append("session-1", createTestChatMessage({ id: "only" }));
      const recent = await manager.getRecent("session-1", 10);
      expect(recent).toHaveLength(1);
    });
  });

  describe("count()", () => {
    it("returns total message count", async () => {
      await manager.append("session-1", createTestChatMessage());
      await manager.append("session-1", createTestChatMessage());
      await manager.append("session-1", createTestChatMessage());
      expect(await manager.count("session-1")).toBe(3);
    });

    it("returns 0 for empty session", async () => {
      expect(await manager.count("nonexistent")).toBe(0);
    });
  });

  describe("clear()", () => {
    it("removes all messages", async () => {
      await manager.append("session-1", createTestChatMessage());
      await manager.append("session-1", createTestChatMessage());
      await manager.clear("session-1");
      expect(await manager.getAll("session-1")).toEqual([]);
      expect(await manager.count("session-1")).toBe(0);
    });

    it("does not affect other sessions", async () => {
      await manager.append("s1", createTestChatMessage({ id: "keep" }));
      await manager.append("s2", createTestChatMessage({ id: "clear" }));
      await manager.clear("s2");
      expect(await manager.getAll("s1")).toHaveLength(1);
      expect(await manager.getAll("s2")).toHaveLength(0);
    });
  });
}
