/**
 * Update Pacing State Tool (Shared)
 *
 * Called by the AI GM after each narrative beat to track tension,
 * phase transitions, and per-player spotlight for balanced storytelling.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for update_pacing_state
 */
export const UpdatePacingStateInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  phase: z
    .enum(["setup", "rising", "peak", "resolution", "decompression"])
    .optional()
    .describe("Shift the narrative phase (omit to keep current phase)"),
  tensionDelta: z
    .number()
    .min(-100)
    .max(100)
    .optional()
    .describe("Adjust tension level by this amount (positive = more tension, negative = less)"),
  spotlightPlayerId: z
    .string()
    .optional()
    .describe("Record that this player received spotlight this beat"),
  incrementBeat: z
    .boolean()
    .optional()
    .describe("Increment the scene beat count (call after each narrative beat)"),
});

export type UpdatePacingStateInput = z.infer<typeof UpdatePacingStateInputSchema>;

/**
 * Output type for update_pacing_state
 */
export interface UpdatePacingStateOutput {
  phase: string;
  tensionLevel: number;
  sceneBeatCount: number;
  changes: string[];
}

/** Clamp a number to [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Update pacing state tool definition
 */
export const updatePacingStateTool = defineSharedTool({
  name: "update_pacing_state",
  description:
    "Update narrative pacing state after each beat. Track tension level, phase transitions, and spotlight rotation to maintain balanced storytelling.",
  inputSchema: UpdatePacingStateInputSchema,
  emits: [],

  handler: async (input, ctx): Promise<UpdatePacingStateOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Initialise pacingState if missing
    if (!session.pacingState) {
      session.pacingState = {
        currentPhase: "setup",
        tensionLevel: 50,
        perPlayerSpotlight: {},
        sceneBeatCount: 0,
      };
    }

    const pacing = session.pacingState;
    const changes: string[] = [];

    // Phase shift
    if (input.phase !== undefined && input.phase !== pacing.currentPhase) {
      const prevPhase = pacing.currentPhase;
      pacing.currentPhase = input.phase;
      changes.push(`Phase: ${prevPhase} → ${input.phase}`);
    }

    // Tension adjustment
    if (input.tensionDelta !== undefined) {
      const before = pacing.tensionLevel;
      pacing.tensionLevel = clamp(before + input.tensionDelta, 0, 100);
      const sign = input.tensionDelta >= 0 ? "+" : "";
      changes.push(`Tension: ${before} ${sign}${input.tensionDelta} → ${pacing.tensionLevel}`);
    }

    // Spotlight recording
    if (input.spotlightPlayerId) {
      const now = new Date().toISOString();
      const existing = pacing.perPlayerSpotlight[input.spotlightPlayerId] ?? {
        lastSpotlightAt: now,
        totalBeats: 0,
      };
      existing.lastSpotlightAt = now;
      existing.totalBeats += 1;
      pacing.perPlayerSpotlight[input.spotlightPlayerId] = existing;
      changes.push(
        `Spotlight: player '${input.spotlightPlayerId}' (total beats: ${existing.totalBeats})`
      );
    }

    // Beat increment
    if (input.incrementBeat) {
      pacing.sceneBeatCount += 1;
      changes.push(`Scene beat: ${pacing.sceneBeatCount}`);
    }

    session.metadata.updatedAt = new Date().toISOString();
    await ctx.sessions.save(session);

    return {
      phase: pacing.currentPhase,
      tensionLevel: pacing.tensionLevel,
      sceneBeatCount: pacing.sceneBeatCount,
      changes,
    };
  },
});
