/**
 * FileGenerationManager tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { FileGenerationManager } from "../managers/generation-manager.js";

describe("FileGenerationManager", () => {
  let tempDir: string;
  let manager: FileGenerationManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "storage-gen-"));
    manager = new FileGenerationManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("ensureGenerationDir()", () => {
    it("creates generation and expansions directories", async () => {
      const dir = await manager.ensureGenerationDir("pack-1");
      expect(dir).toContain("pack-1");
      // Should not throw on second call
      await manager.ensureGenerationDir("pack-1");
    });
  });

  describe("writeStepFile() + readStepFile()", () => {
    it("writes and reads a step file", async () => {
      const data = { archetypes: [{ id: "warrior", name: "Warrior" }] };
      await manager.writeStepFile("pack-1", "archetypes.json", data);
      const loaded = await manager.readStepFile("pack-1", "archetypes.json");
      expect(loaded).toEqual(data);
    });

    it("returns null for nonexistent file", async () => {
      const result = await manager.readStepFile("pack-1", "nope.json");
      expect(result).toBeNull();
    });
  });

  describe("manifest operations", () => {
    it("creates, writes, and reads a manifest", async () => {
      const manifest = manager.createManifest("session-1", "A dark world", "medium");
      expect(manifest.status).toBe("seeding");
      expect(manifest.steps).toEqual([]);

      await manager.writeManifest("pack-1", manifest);
      const loaded = await manager.readManifest("pack-1");
      expect(loaded).not.toBeNull();
      expect(loaded!.campaignSeed).toBe("A dark world");
      expect(loaded!.tier).toBe("medium");
    });

    it("returns null when no manifest exists", async () => {
      const result = await manager.readManifest("nonexistent");
      expect(result).toBeNull();
    });

    it("addManifestStep adds a step", () => {
      const manifest = manager.createManifest("s1", "seed", "small");
      const step = manager.addManifestStep(manifest, "archetypes", "archetypes.json");
      expect(step.type).toBe("archetypes");
      expect(step.status).toBe("in_progress");
      expect(manifest.steps).toHaveLength(1);
    });

    it("findManifestStep finds by type", () => {
      const manifest = manager.createManifest("s1", "seed", "small");
      manager.addManifestStep(manifest, "archetypes");
      manager.addManifestStep(manifest, "monsters");
      expect(manager.findManifestStep(manifest, "monsters")?.type).toBe("monsters");
      expect(manager.findManifestStep(manifest, "nope")).toBeUndefined();
    });

    it("updateManifestStep updates a step", () => {
      const manifest = manager.createManifest("s1", "seed", "small");
      manager.addManifestStep(manifest, "archetypes");
      const updated = manager.updateManifestStep(manifest, "archetypes", {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      expect(updated).toBe(true);
      expect(manifest.steps[0].status).toBe("completed");

      // Non-existent type returns false
      expect(manager.updateManifestStep(manifest, "nope", { status: "failed" })).toBe(false);
    });
  });

  describe("listStepFiles()", () => {
    it("lists step files excluding manifest", async () => {
      await manager.writeStepFile("pack-1", "archetypes.json", {});
      await manager.writeStepFile("pack-1", "monsters.json", {});
      await manager.writeManifest("pack-1", manager.createManifest("s1", "seed", "small"));
      const files = await manager.listStepFiles("pack-1");
      expect(files).toContain("archetypes.json");
      expect(files).toContain("monsters.json");
      expect(files).not.toContain("manifest.json");
    });

    it("returns empty for nonexistent pack", async () => {
      expect(await manager.listStepFiles("nope")).toEqual([]);
    });
  });

  describe("listExpansionFiles()", () => {
    it("returns empty for nonexistent pack", async () => {
      expect(await manager.listExpansionFiles("nope")).toEqual([]);
    });
  });
});
