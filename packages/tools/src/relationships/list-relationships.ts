/**
 * List Relationships Tool (Shared)
 *
 * List all tracked NPC relationships.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { ATTITUDES, type Attitude, getAttitudeSummary, formatGameTime } from "./helpers.js";

/**
 * Input schema for list_relationships
 */
export const ListRelationshipsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  attitudeFilter: z.enum(ATTITUDES).optional().describe("Filter by attitude level"),
});

export type ListRelationshipsInput = z.infer<typeof ListRelationshipsInputSchema>;

/**
 * Output type for list_relationships
 */
export interface ListRelationshipsOutput {
  message: string;
  relationships: Array<{
    npcId: string;
    npcName: string;
    attitude: Attitude;
    attitudeSummary: string;
    interactionCount: number;
    lastInteraction: {
      when: string;
      what: string;
      impact: string;
    } | null;
    hasDebts: boolean;
    hasFears: boolean;
    hasWants: boolean;
  }>;
}

/**
 * List relationships tool definition
 */
export const listRelationshipsTool = defineSharedTool({
  name: "list_relationships",
  description: "List all tracked NPC relationships.",
  inputSchema: ListRelationshipsInputSchema,

  handler: async (input, ctx): Promise<ListRelationshipsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.relationships || Object.keys(session.relationships).length === 0) {
      return {
        message: "No relationships tracked",
        relationships: [],
      };
    }

    let relationships = Object.values(session.relationships);

    if (input.attitudeFilter) {
      relationships = relationships.filter((r) => r.attitude === input.attitudeFilter);
    }

    // Sort by attitude (hostile first, then by interaction count)
    relationships.sort((a, b) => {
      const attitudeOrder = ATTITUDES.indexOf(a.attitude) - ATTITUDES.indexOf(b.attitude);
      if (attitudeOrder !== 0) return attitudeOrder;
      return b.history.length - a.history.length;
    });

    const result = relationships.map((rel) => ({
      npcId: rel.npcId,
      npcName: rel.npcName,
      attitude: rel.attitude,
      attitudeSummary: getAttitudeSummary(rel.attitude),
      interactionCount: rel.history.length,
      lastInteraction:
        rel.history.length > 0
          ? {
              when: formatGameTime(rel.history[rel.history.length - 1].timestamp),
              what: rel.history[rel.history.length - 1].interaction,
              impact: rel.history[rel.history.length - 1].impact,
            }
          : null,
      hasDebts: rel.owes.length > 0,
      hasFears: rel.fears.length > 0,
      hasWants: rel.wants.length > 0,
    }));

    return {
      message: `${result.length} relationship(s) tracked`,
      relationships: result,
    };
  },
});
