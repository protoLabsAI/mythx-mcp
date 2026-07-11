/**
 * Get NPC Disposition Tool (Shared)
 *
 * Quick check: How does this NPC feel about the party?
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Attitude type
 */
type Attitude = "hostile" | "unfriendly" | "neutral" | "friendly" | "allied";

/**
 * Input schema for get_npc_disposition
 */
export const GetNpcDispositionInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  npcId: z.string().describe("NPC ID"),
  forCharacterId: z
    .string()
    .optional()
    .describe("Get attitude toward a specific PC (uses per-character tracking if available)"),
});

export type GetNpcDispositionInput = z.infer<typeof GetNpcDispositionInputSchema>;

/**
 * Get relationship summary text
 */
function getAttitudeSummary(attitude: Attitude): string {
  switch (attitude) {
    case "hostile":
      return "Actively antagonistic, may attack or sabotage";
    case "unfriendly":
      return "Distrustful, uncooperative, may withhold help";
    case "neutral":
      return "No strong feelings, will deal fairly";
    case "friendly":
      return "Positive disposition, inclined to help";
    case "allied":
      return "Strong bond, will go out of their way to assist";
  }
}

/**
 * Output type for get_npc_disposition
 */
export interface GetNpcDispositionOutput {
  npcId: string;
  npcName?: string;
  attitude: Attitude | "unknown";
  summary: string;
  suggestion?: string;
  recentInteractions?: Array<{
    interaction: string;
    impact: string;
  }>;
  keyContext?: {
    knows: string[];
    owes: string[];
    fears: string[];
    wants: string[];
  };
}

/**
 * Get NPC disposition tool definition
 */
export const getNpcDispositionTool = defineSharedTool({
  name: "get_npc_disposition",
  description: "Quick check: How does this NPC feel about the party?",
  inputSchema: GetNpcDispositionInputSchema,

  handler: async (input, ctx): Promise<GetNpcDispositionOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.relationships || !session.relationships[input.npcId]) {
      // Check if NPC exists in session
      const npc = session.npcs?.[input.npcId];
      if (npc) {
        return {
          npcId: input.npcId,
          npcName: npc.name,
          attitude: "unknown",
          summary: "No interactions recorded yet",
          suggestion: "Consider initializing relationship when first meaningful interaction occurs",
        };
      }
      return {
        npcId: input.npcId,
        attitude: "unknown",
        summary: "NPC not found in session",
      };
    }

    const rel = session.relationships[input.npcId];

    // Use per-character attitude if available and requested
    const attitude: Attitude =
      input.forCharacterId && rel.characterAttitudes?.[input.forCharacterId]
        ? rel.characterAttitudes[input.forCharacterId]
        : rel.attitude;

    // Filter history to this character's interactions if requested
    const relevantHistory = input.forCharacterId
      ? rel.history.filter(
          (h) => !h.actingCharacterId || h.actingCharacterId === input.forCharacterId
        )
      : rel.history;
    const recentHistory = relevantHistory.slice(-3);

    return {
      npcId: rel.npcId,
      npcName: rel.npcName,
      attitude,
      summary: getAttitudeSummary(attitude),
      recentInteractions: recentHistory.map((h) => ({
        interaction: h.interaction,
        impact: h.impact,
      })),
      keyContext: {
        knows: rel.knows.slice(0, 3),
        owes: rel.owes.slice(0, 2),
        fears: rel.fears.slice(0, 2),
        wants: rel.wants.slice(0, 2),
      },
    };
  },
});
