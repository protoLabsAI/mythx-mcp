/**
 * File-based generation manager
 *
 * Extracted from mcp-server/src/state/manager.ts.
 * Manages world generation workspace co-located with the world pack:
 *   worlds/<pack-id>/generation/manifest.json
 *   worlds/<pack-id>/generation/<step>.json
 *   worlds/<pack-id>/generation/expansions/<step>.json
 */

import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import type { GenerationManifest, ManifestStep } from "@mythxengine/types";
import { atomicWriteJSON } from "../utils/atomic-write.js";
import { ensureDir } from "../utils/ensure-dir.js";

const ManifestStepSchema = z.object({
  type: z.string(),
  stepId: z.string().optional(),
  status: z.enum(["in_progress", "completed", "failed"]),
  file: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
  generatedIds: z.array(z.string()).optional(),
});

const GenerationManifestSchema = z.object({
  sessionId: z.string(),
  campaignSeed: z.string(),
  tier: z.enum(["small", "medium", "large"]),
  rulesConfig: z.unknown().optional(),
  settings: z
    .object({
      lethality: z.enum(["low", "medium", "high", "brutal"]).optional(),
      magicLevel: z.enum(["none", "rare", "common", "high"]).optional(),
      technologyLevel: z
        .enum(["primitive", "medieval", "renaissance", "industrial", "modern", "futuristic"])
        .optional(),
      supernaturalPresence: z.enum(["subtle", "common", "pervasive"]).optional(),
    })
    .optional(),
  createdAt: z.string(),
  status: z.enum(["seeding", "generating", "expanding", "assembling", "complete"]),
  steps: z.array(ManifestStepSchema),
});

export class FileGenerationManager {
  private worldsDir: string;

  constructor(rootDir: string) {
    this.worldsDir = join(rootDir, "worlds");
  }

  private generationDir(packId: string): string {
    return join(this.worldsDir, packId, "generation");
  }

  private expansionsDir(packId: string): string {
    return join(this.generationDir(packId), "expansions");
  }

  /**
   * Ensure generation directories exist
   */
  async ensureGenerationDir(packId: string): Promise<string> {
    const dir = this.generationDir(packId);
    await ensureDir(dir);
    await ensureDir(this.expansionsDir(packId));
    return dir;
  }

  /**
   * Write a step file atomically
   */
  async writeStepFile(packId: string, filename: string, data: unknown): Promise<void> {
    await this.ensureGenerationDir(packId);
    await atomicWriteJSON(join(this.generationDir(packId), filename), data);
  }

  /**
   * Read a step file
   */
  async readStepFile(packId: string, filename: string): Promise<unknown | null> {
    try {
      const content = await readFile(join(this.generationDir(packId), filename), "utf-8");
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  /**
   * Read the generation manifest with validation
   */
  async readManifest(packId: string): Promise<GenerationManifest | null> {
    const result = await this.readStepFile(packId, "manifest.json");
    if (result === null) return null;

    const parsed = GenerationManifestSchema.safeParse(result);
    if (!parsed.success) {
      throw new Error(`Invalid manifest format: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  /**
   * Write the generation manifest atomically
   */
  async writeManifest(packId: string, manifest: GenerationManifest): Promise<void> {
    await this.writeStepFile(packId, "manifest.json", manifest);
  }

  /**
   * Create initial manifest for a new generation
   */
  createManifest(
    sessionId: string,
    campaignSeed: string,
    tier: "small" | "medium" | "large",
    settings?: GenerationManifest["settings"],
    rulesConfig?: unknown
  ): GenerationManifest {
    return {
      sessionId,
      campaignSeed,
      tier,
      rulesConfig,
      settings,
      createdAt: new Date().toISOString(),
      status: "seeding",
      steps: [],
    };
  }

  /**
   * Add a step to the manifest
   */
  addManifestStep(manifest: GenerationManifest, type: string, file?: string): ManifestStep {
    const step: ManifestStep = { type, status: "in_progress", file };
    manifest.steps.push(step);
    return step;
  }

  /**
   * Find a step in the manifest by type
   */
  findManifestStep(manifest: GenerationManifest, type: string): ManifestStep | undefined {
    return manifest.steps.find((s) => s.type === type);
  }

  /**
   * Update a step's status in the manifest
   */
  updateManifestStep(
    manifest: GenerationManifest,
    type: string,
    updates: Partial<ManifestStep>
  ): boolean {
    const step = manifest.steps.find((s) => s.type === type);
    if (step) {
      Object.assign(step, updates);
      return true;
    }
    return false;
  }

  /**
   * List all step files (excluding manifest)
   */
  async listStepFiles(packId: string): Promise<string[]> {
    try {
      const files = await readdir(this.generationDir(packId));
      return files.filter((f) => f.endsWith(".json") && f !== "manifest.json");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  /**
   * List all expansion files
   */
  async listExpansionFiles(packId: string): Promise<string[]> {
    try {
      const files = await readdir(this.expansionsDir(packId));
      return files.filter((f) => f.endsWith(".json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
