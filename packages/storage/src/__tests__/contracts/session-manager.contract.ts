/**
 * Session Manager Contract Tests
 *
 * Parameterized test suite encoding the behavioral contract of ISessionManager.
 * Pass a factory function to run against any implementation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { ISessionManager } from "@mythxengine/types";
import { createTestSession, createComplexSession } from "../fixtures.js";

export interface SessionManagerFactory {
  create(): Promise<ISessionManager>;
  cleanup(): Promise<void>;
}

export function sessionManagerContractTests(factory: SessionManagerFactory): void {
  let manager: ISessionManager;

  beforeEach(async () => {
    manager = await factory.create();
  });

  // afterEach handled by caller via factory.cleanup()

  describe("get()", () => {
    it("returns null for nonexistent session", async () => {
      const result = await manager.get("nonexistent-id");
      expect(result).toBeNull();
    });
  });

  describe("getOrCreate()", () => {
    it("creates new session with default state", async () => {
      const session = await manager.getOrCreate("new-session");
      expect(session).toBeDefined();
      expect(session.metadata.id).toBe("new-session");
      expect(session.characters).toEqual({});
      expect(session.combat).toBeNull();
      expect(session.notes).toEqual([]);
    });

    it("returns existing session if present", async () => {
      const first = await manager.getOrCreate("existing-session", "My Game");
      const second = await manager.getOrCreate("existing-session", "Different Name");
      expect(second.metadata.id).toBe(first.metadata.id);
      expect(second.metadata.name).toBe(first.metadata.name);
    });

    it("uses provided name", async () => {
      const session = await manager.getOrCreate("named-session", "Epic Quest");
      expect(session.metadata.name).toBe("Epic Quest");
    });
  });

  describe("save() + get()", () => {
    it("persists state verifiable via get()", async () => {
      const session = createTestSession({ metadata: { id: "save-test" } });
      await manager.save(session);
      const loaded = await manager.get("save-test");
      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.id).toBe("save-test");
    });

    it("updates metadata.updatedAt on save", async () => {
      const session = createTestSession({
        metadata: { id: "timestamp-test", updatedAt: "2020-01-01T00:00:00.000Z" },
      });
      await manager.save(session);
      const loaded = await manager.get("timestamp-test");
      expect(loaded).not.toBeNull();
      // updatedAt should be more recent than the original
      expect(new Date(loaded!.metadata.updatedAt).getTime()).toBeGreaterThan(
        new Date("2020-01-01T00:00:00.000Z").getTime()
      );
    });

    it("preserves all fields (characters, combat, time, etc.)", async () => {
      const session = createComplexSession("full-roundtrip");
      await manager.save(session);
      const loaded = await manager.get("full-roundtrip");
      expect(loaded).not.toBeNull();

      // Core fields
      expect(loaded!.characters).toEqual(session.characters);
      expect(loaded!.notes).toEqual(session.notes);
      expect(loaded!.flags).toEqual(session.flags);
      expect(loaded!.worldState).toEqual(session.worldState);
      expect(loaded!.gameTime).toEqual(session.gameTime);
      expect(loaded!.deadlines).toEqual(session.deadlines);

      // Optional fields
      expect(loaded!.activeClocks).toEqual(session.activeClocks);
    });

    it("overwrites existing session", async () => {
      const v1 = createTestSession({
        metadata: { id: "overwrite-test" },
        flags: ["flag-v1"],
      });
      await manager.save(v1);

      const v2 = createTestSession({
        metadata: { id: "overwrite-test" },
        flags: ["flag-v2"],
      });
      await manager.save(v2);

      const loaded = await manager.get("overwrite-test");
      expect(loaded!.flags).toEqual(["flag-v2"]);
    });
  });

  describe("delete()", () => {
    it("removes session, get() returns null after", async () => {
      const session = createTestSession({ metadata: { id: "delete-me" } });
      await manager.save(session);
      await manager.delete("delete-me");
      const result = await manager.get("delete-me");
      expect(result).toBeNull();
    });

    it("is idempotent (no error on missing)", async () => {
      await expect(manager.delete("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("list()", () => {
    it("returns all session IDs", async () => {
      await manager.save(createTestSession({ metadata: { id: "list-a" } }));
      await manager.save(createTestSession({ metadata: { id: "list-b" } }));
      const ids = await manager.list();
      expect(ids).toContain("list-a");
      expect(ids).toContain("list-b");
    });

    it("returns empty array when no sessions", async () => {
      const ids = await manager.list();
      expect(ids).toEqual([]);
    });

    it("does not include deleted sessions", async () => {
      await manager.save(createTestSession({ metadata: { id: "keep" } }));
      await manager.save(createTestSession({ metadata: { id: "remove" } }));
      await manager.delete("remove");
      const ids = await manager.list();
      expect(ids).toContain("keep");
      expect(ids).not.toContain("remove");
    });
  });

  describe("round-trip integrity", () => {
    it("complex state with characters, clocks survives save/load", async () => {
      const session = createComplexSession("roundtrip-complex");
      await manager.save(session);
      const loaded = await manager.get("roundtrip-complex");
      expect(loaded).not.toBeNull();

      // Verify character
      const char = loaded!.characters["char-1"];
      expect(char).toBeDefined();
      expect(char.name).toBe("Thorn");
      expect(char.archetypeId).toBe("warrior");
      expect(char.skills).toHaveLength(1);
      expect(char.skills[0].name).toBe("Athletics");

      // Verify clock
      expect(loaded!.activeClocks).toHaveLength(1);
      expect(loaded!.activeClocks![0].name).toBe("Alarm");
    });
  });
}
