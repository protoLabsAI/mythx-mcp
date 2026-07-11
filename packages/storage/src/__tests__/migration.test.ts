/**
 * Migration tests: v0 flat layout → v1 directory layout
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { needsMigration, migrateV0ToV1 } from "../migrate-v0-to-v1.js";
import { FileSessionManager } from "../managers/session-manager.js";
import { FileWorldPackManager } from "../managers/worldpack-manager.js";

describe("v0 → v1 migration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "storage-migrate-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("needsMigration()", () => {
    it("returns false for empty directory", async () => {
      expect(await needsMigration(tempDir)).toBe(false);
    });

    it("returns true when .session.json files exist at root", async () => {
      await writeFile(join(tempDir, "test.session.json"), "{}", "utf-8");
      expect(await needsMigration(tempDir)).toBe(true);
    });

    it("returns false for v1 layout (no root session files)", async () => {
      await mkdir(join(tempDir, "sessions", "test"), { recursive: true });
      await writeFile(join(tempDir, "sessions", "test", "state.json"), "{}", "utf-8");
      expect(await needsMigration(tempDir)).toBe(false);
    });
  });

  describe("migrateV0ToV1()", () => {
    it("migrates session files", async () => {
      const session = {
        metadata: { id: "sess-1", name: "Test", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
        rng: { seed: 1, cursor: 0 },
        seq: 0,
        characters: {},
        npcs: {},
        enemies: {},
        combat: null,
        notes: [],
        flags: [],
        worldState: {},
        gameTime: { day: 1, hour: 6, minute: 0 },
        deadlines: [],
      };
      await writeFile(join(tempDir, "sess-1.session.json"), JSON.stringify(session), "utf-8");

      const result = await migrateV0ToV1(tempDir);
      expect(result.sessionsmigrated).toEqual(["sess-1"]);
      expect(result.errors).toEqual([]);

      // Old file should be gone
      const rootFiles = await readdir(tempDir);
      expect(rootFiles).not.toContain("sess-1.session.json");

      // New file should exist and be readable by FileSessionManager
      const mgr = new FileSessionManager(tempDir);
      const loaded = await mgr.get("sess-1");
      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.name).toBe("Test");
    });

    it("migrates world pack files", async () => {
      const pack = {
        meta: { id: "world-1", name: "Test World" },
        archetypes: {},
        items: {},
      };
      await mkdir(join(tempDir, "worlds"), { recursive: true });
      await writeFile(join(tempDir, "worlds", "world-1.world.json"), JSON.stringify(pack), "utf-8");

      const result = await migrateV0ToV1(tempDir);
      expect(result.worldPacksMigrated).toEqual(["world-1"]);
      expect(result.errors).toEqual([]);

      // New file should exist and be readable by FileWorldPackManager
      const mgr = new FileWorldPackManager(tempDir);
      const loaded = await mgr.get("world-1");
      expect(loaded).not.toBeNull();
    });

    it("migrates generation directories", async () => {
      // Create a session with worldPackId
      const session = {
        metadata: { id: "sess-1", name: "Test", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
        rng: { seed: 1, cursor: 0 },
        seq: 0,
        characters: {},
        npcs: {},
        enemies: {},
        combat: null,
        notes: [],
        flags: [],
        worldState: {},
        gameTime: { day: 1, hour: 6, minute: 0 },
        deadlines: [],
        worldPackId: "world-1",
      };
      await writeFile(join(tempDir, "sess-1.session.json"), JSON.stringify(session), "utf-8");

      // Create generation dir with manifest
      await mkdir(join(tempDir, "generation", "sess-1"), { recursive: true });
      await writeFile(
        join(tempDir, "generation", "sess-1", "manifest.json"),
        JSON.stringify({ sessionId: "sess-1", status: "complete" }),
        "utf-8"
      );

      // Also create the world pack dir
      await mkdir(join(tempDir, "worlds"), { recursive: true });

      const result = await migrateV0ToV1(tempDir);
      expect(result.generationDirsMigrated).toEqual(["sess-1"]);

      // Generation should now be under worlds/world-1/generation/
      const manifest = await readFile(
        join(tempDir, "worlds", "world-1", "generation", "manifest.json"),
        "utf-8"
      );
      expect(JSON.parse(manifest).sessionId).toBe("sess-1");
    });

    it("handles empty directory gracefully", async () => {
      const result = await migrateV0ToV1(tempDir);
      expect(result.sessionsmigrated).toEqual([]);
      expect(result.worldPacksMigrated).toEqual([]);
      expect(result.generationDirsMigrated).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("migrates multiple sessions and packs", async () => {
      // Two sessions
      for (const id of ["s1", "s2"]) {
        await writeFile(
          join(tempDir, `${id}.session.json`),
          JSON.stringify({
            metadata: { id, name: id, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
            rng: { seed: 1, cursor: 0 },
            seq: 0,
            characters: {},
            npcs: {},
            enemies: {},
            combat: null,
            notes: [],
            flags: [],
            worldState: {},
            gameTime: { day: 1, hour: 6, minute: 0 },
            deadlines: [],
          }),
          "utf-8"
        );
      }

      // Two world packs
      await mkdir(join(tempDir, "worlds"), { recursive: true });
      for (const id of ["w1", "w2"]) {
        await writeFile(
          join(tempDir, "worlds", `${id}.world.json`),
          JSON.stringify({ meta: { id, name: id } }),
          "utf-8"
        );
      }

      const result = await migrateV0ToV1(tempDir);
      expect(result.sessionsmigrated.sort()).toEqual(["s1", "s2"]);
      expect(result.worldPacksMigrated.sort()).toEqual(["w1", "w2"]);
      expect(result.errors).toEqual([]);

      // Verify with managers
      const sessions = new FileSessionManager(tempDir);
      expect(await sessions.get("s1")).not.toBeNull();
      expect(await sessions.get("s2")).not.toBeNull();

      const worlds = new FileWorldPackManager(tempDir);
      expect(await worlds.get("w1")).not.toBeNull();
      expect(await worlds.get("w2")).not.toBeNull();
    });
  });
});
