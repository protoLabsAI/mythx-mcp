/**
 * World Pack Manager Contract Tests
 *
 * Parameterized test suite encoding the behavioral contract of IWorldPackManager.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { IWorldPackManager } from "@mythxengine/types";
import { createTestWorldPack } from "../fixtures.js";

export interface WorldPackManagerFactory {
  create(): Promise<IWorldPackManager>;
  cleanup(): Promise<void>;
}

export function worldPackManagerContractTests(factory: WorldPackManagerFactory): void {
  let manager: IWorldPackManager;

  beforeEach(async () => {
    manager = await factory.create();
  });

  describe("get()", () => {
    it("returns null for nonexistent pack", async () => {
      const result = await manager.get("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("save() + get()", () => {
    it("round-trips correctly", async () => {
      const pack = createTestWorldPack("save-test", "Test World");
      await manager.save("save-test", pack);
      const loaded = await manager.get("save-test");
      expect(loaded).not.toBeNull();
      expect((loaded as Record<string, unknown>).meta).toEqual(pack.meta);
    });

    it("overwrites existing pack", async () => {
      const v1 = createTestWorldPack("overwrite", "Version 1");
      await manager.save("overwrite", v1);

      const v2 = createTestWorldPack("overwrite", "Version 2");
      await manager.save("overwrite", v2);

      const loaded = await manager.get("overwrite");
      expect((loaded as Record<string, unknown>).meta).toEqual(v2.meta);
    });
  });

  describe("delete()", () => {
    it("removes pack", async () => {
      const pack = createTestWorldPack("delete-me");
      await manager.save("delete-me", pack);
      await manager.delete("delete-me");
      const result = await manager.get("delete-me");
      expect(result).toBeNull();
    });

    it("is idempotent", async () => {
      await expect(manager.delete("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("list()", () => {
    it("returns all pack IDs", async () => {
      await manager.save("pack-a", createTestWorldPack("pack-a"));
      await manager.save("pack-b", createTestWorldPack("pack-b"));
      const ids = await manager.list();
      expect(ids).toContain("pack-a");
      expect(ids).toContain("pack-b");
    });

    it("returns empty array when empty", async () => {
      const ids = await manager.list();
      expect(ids).toEqual([]);
    });

    it("does not include deleted packs", async () => {
      await manager.save("keep", createTestWorldPack("keep"));
      await manager.save("remove", createTestWorldPack("remove"));
      await manager.delete("remove");
      const ids = await manager.list();
      expect(ids).toContain("keep");
      expect(ids).not.toContain("remove");
    });
  });

  describe("round-trip integrity", () => {
    it("full WorldContentPack with all fields survives save/load", async () => {
      const pack = createTestWorldPack("roundtrip", "Full Pack");
      await manager.save("roundtrip", pack);
      const loaded = await manager.get("roundtrip");
      expect(loaded).not.toBeNull();

      const loadedPack = loaded as Record<string, unknown>;
      expect(loadedPack.meta).toEqual(pack.meta);
      expect(loadedPack.archetypes).toEqual(pack.archetypes);
      expect(loadedPack.items).toEqual(pack.items);
      expect(loadedPack.monsters).toEqual(pack.monsters);
      expect(loadedPack.encounters).toEqual(pack.encounters);
      expect(loadedPack.conditions).toEqual(pack.conditions);
      expect(loadedPack.locations).toEqual(pack.locations);
      expect(loadedPack.npcs).toEqual(pack.npcs);
      expect(loadedPack.narrativeGuidance).toEqual(pack.narrativeGuidance);
    });
  });
}
