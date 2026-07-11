/**
 * Get Relationship Tool (Shared)
 *
 * Get an NPC's current attitude and interaction history with the party.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { type Attitude, getAttitudeSummary, formatGameTime } from "./helpers.js";

/**
 * Input schema for get_relationship
 */
export const GetRelationshipInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  npcId: z.string().describe("NPC ID"),
});

export type GetRelationshipInput = z.infer<typeof GetRelationshipInputSchema>;

/**
 * Output type for get_relationship
 */
export interface GetRelationshipOutput {
  exists: boolean;
  npcId?: string;
  npcName?: string;
  attitude?: Attitude;
  attitudeSummary?: string;
  history?: Array<{
    timestamp: string;
    interaction: string;
    impact: string;
  }>;
  knows?: string[];
  owes?: string[];
  fears?: string[];
  wants?: string[];
  characterAttitudes?: Record<string, Attitude>;
  message?: string;
  hint?: string;
}

/**
 * Get relationship tool definition
 */
export const getRelationshipTool = defineSharedTool({
  name: "get_relationship",
  description: "Get an NPC's current attitude and interaction history with the party.",
  inputSchema: GetRelationshipInputSchema,

  handler: async (input, ctx): Promise<GetRelationshipOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.relationships || !session.relationships[input.npcId]) {
      return {
        exists: false,
        message: `No relationship tracked for NPC: ${input.npcId}`,
        hint: "Use initialize_relationship or update_relationship to start tracking",
      };
    }

    const rel = session.relationships[input.npcId];

    return {
      exists: true,
      npcId: rel.npcId,
      npcName: rel.npcName,
      attitude: rel.attitude,
      attitudeSummary: getAttitudeSummary(rel.attitude),
      history: rel.history.map((h) => ({
        timestamp: formatGameTime(h.timestamp),
        interaction: h.interaction,
        impact: h.impact,
      })),
      knows: rel.knows,
      owes: rel.owes,
      fears: rel.fears,
      wants: rel.wants,
      characterAttitudes: rel.characterAttitudes,
    };
  },
});
