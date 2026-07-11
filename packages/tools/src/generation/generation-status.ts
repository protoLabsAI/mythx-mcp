/**
 * Generation Status Tool (Shared)
 *
 * Lightweight status check for world generation progress.
 * Shows what's been saved, what's pending, and what failed.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { tierContentCounts, type WorldTier } from "./manifest-helpers.js";

export const GetGenerationStatusInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type GetGenerationStatusInput = z.infer<typeof GetGenerationStatusInputSchema>;

/** All content phases in generation order */
const ALL_PHASES = [
  "seed",
  "archetypes",
  "monsters",
  "items",
  "encounters",
  "locations",
  "npcs",
  "conditions",
  "factions",
  "narrative",
  "situations",
  "arcs",
] as const;

interface PhaseStatus {
  phase: string;
  status: "completed" | "in_progress" | "failed" | "not_started";
  entityCount?: number;
  error?: string;
}

export interface GetGenerationStatusOutput {
  sessionId: string;
  overallStatus: string;
  tier?: string;
  phases: PhaseStatus[];
  completedCount: number;
  totalPhases: number;
  readyToAssemble: boolean;
  recommendedCounts?: Record<string, number>;
  message: string;
}

export const getGenerationStatusTool = defineSharedTool({
  name: "get_generation_status",
  description:
    "Check world generation progress. Shows completed, in-progress, and pending phases with entity counts.",
  inputSchema: GetGenerationStatusInputSchema,

  handler: async (input, ctx): Promise<GetGenerationStatusOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation) {
      return {
        sessionId: input.sessionId,
        overallStatus: "idle",
        phases: [],
        completedCount: 0,
        totalPhases: ALL_PHASES.length,
        readyToAssemble: false,
        message: "No generation session found. Start with generate_world_seed.",
      };
    }

    const gen = session.generation;
    const tier = (gen.tier || "medium") as WorldTier;

    // Build phase status from history
    const historyByType = new Map<
      string,
      { status: string; error?: string; generatedIds: string[] }
    >();
    for (const step of gen.history) {
      // Keep the latest status for each type
      historyByType.set(step.type, {
        status: step.status,
        error: step.error,
        generatedIds: step.generatedIds,
      });
    }

    // Get content counts from generated content
    const gc = gen.generatedContent;
    const contentCounts: Record<string, number> = {
      archetypes: (gc.archetypes as unknown[]).length,
      monsters: (gc.monsters as unknown[]).length,
      items: (gc.items as unknown[]).length,
      encounters: (gc.encounters as unknown[]).length,
      locations: (gc.locations as unknown[]).length,
      npcs: (gc.npcs as unknown[]).length,
      conditions: (gc.conditions as unknown[]).length,
      factions: (gc.factions as unknown[]).length,
      narrative: gc.narrative ? 1 : 0,
      situations: (gc.situations as unknown[]).length,
      arcs: (gc.arcs as unknown[]).length,
    };

    const phases: PhaseStatus[] = ALL_PHASES.map((phase) => {
      const history = historyByType.get(phase);
      if (!history) {
        return { phase, status: "not_started" as const };
      }
      return {
        phase,
        status: history.status as PhaseStatus["status"],
        entityCount: phase === "seed" ? (gen.worldSeed ? 1 : 0) : (contentCounts[phase] ?? 0),
        error: history.error,
      };
    });

    const completedCount = phases.filter((p) => p.status === "completed").length;
    const failedCount = phases.filter((p) => p.status === "failed").length;
    const inProgressCount = phases.filter((p) => p.status === "in_progress").length;

    // Ready to assemble: seed + at least archetypes, monsters, items, locations
    const requiredPhases = ["seed", "archetypes", "monsters", "items", "locations"];
    const readyToAssemble = requiredPhases.every(
      (p) => phases.find((ph) => ph.phase === p)?.status === "completed"
    );

    let message: string;
    if (completedCount === 0) {
      message = "Generation not started.";
    } else if (inProgressCount > 0) {
      const inProgress = phases.filter((p) => p.status === "in_progress").map((p) => p.phase);
      message = `${completedCount}/${ALL_PHASES.length} phases complete. In progress: ${inProgress.join(", ")}.`;
    } else if (failedCount > 0) {
      const failed = phases.filter((p) => p.status === "failed").map((p) => p.phase);
      message = `${completedCount}/${ALL_PHASES.length} phases complete. Failed: ${failed.join(", ")}. Use resume_generation with reconstruct=true to retry.`;
    } else if (readyToAssemble) {
      message = `${completedCount}/${ALL_PHASES.length} phases complete. Ready for assemble_world_pack.`;
    } else {
      message = `${completedCount}/${ALL_PHASES.length} phases complete.`;
    }

    return {
      sessionId: input.sessionId,
      overallStatus: gen.status,
      tier,
      phases,
      completedCount,
      totalPhases: ALL_PHASES.length,
      readyToAssemble,
      recommendedCounts: tierContentCounts[tier],
      message,
    };
  },
});
