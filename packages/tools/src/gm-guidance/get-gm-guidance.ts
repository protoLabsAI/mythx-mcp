/**
 * Get GM Guidance Tool (Shared)
 *
 * Provides context-aware GM advice during gameplay across 5 modes:
 * - stuck: Players unsure what to do next
 * - resolution: How to resolve an action
 * - pacing: Scene timing and rhythm
 * - tone: Maintaining aesthetic consistency
 * - npc: NPC portrayal guidance
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import {
  generateStuckGuidance,
  generateResolutionGuidance,
  generatePacingGuidance,
  generateToneGuidance,
  generateNpcGuidance,
  formatGameTime,
  type GuidanceResult,
} from "./helpers.js";

/**
 * Guidance types
 */
const GUIDANCE_TYPES = ["stuck", "resolution", "pacing", "tone", "npc"] as const;

/**
 * Input schema for get_gm_guidance
 */
export const GetGmGuidanceInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  type: z.enum(GUIDANCE_TYPES).describe("Type of guidance: stuck, resolution, pacing, tone, npc"),
  context: z
    .object({
      action: z.string().optional().describe("For resolution: the action being attempted"),
      npcId: z.string().optional().describe("For npc: which NPC to get guidance for"),
      sceneDescription: z.string().optional().describe("For pacing: current scene description"),
      locationId: z.string().optional().describe("Current location ID"),
      currentActivity: z.string().optional().describe("What's happening now"),
    })
    .optional()
    .describe("Additional context for guidance"),
});

export type GetGmGuidanceInput = z.infer<typeof GetGmGuidanceInputSchema>;

/**
 * Output type for get_gm_guidance
 */
export interface GetGmGuidanceOutput extends GuidanceResult {
  type: string;
  currentTime: string;
}

/**
 * Get GM guidance tool definition
 */
export const getGmGuidanceTool = defineSharedTool({
  name: "get_gm_guidance",
  description:
    "Get context-aware GM advice for common situations: stuck players, action resolution, pacing, tone, or NPC portrayal. Provides principles, suggestions, and relevant tool recommendations based on current session state.",
  inputSchema: GetGmGuidanceInputSchema,
  emits: [], // No events - this is a read-only advisory tool

  handler: async (input, ctx): Promise<GetGmGuidanceOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    let result: GuidanceResult;

    switch (input.type) {
      case "stuck":
        result = await generateStuckGuidance(ctx, session, input.context);
        break;
      case "resolution":
        result = generateResolutionGuidance(input.context?.action);
        break;
      case "pacing":
        result = generatePacingGuidance(session, input.context?.sceneDescription);
        break;
      case "tone":
        result = generateToneGuidance(session);
        break;
      case "npc":
        result = generateNpcGuidance(session, input.context?.npcId);
        break;
      default:
        throw new Error(`Unknown guidance type: ${input.type}`);
    }

    return {
      type: input.type,
      currentTime: formatGameTime(session.gameTime),
      ...result,
    };
  },
});
