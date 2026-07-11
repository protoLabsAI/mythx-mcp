/**
 * Get Unrevealed Clues Tool (Shared)
 *
 * List clues that haven't been discovered yet.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { SIGNIFICANCE_LEVELS, getClues, checkPrerequisites } from "./types.js";

/**
 * Input schema for get_unrevealed_clues
 */
export const GetUnrevealedCluesInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  significance: z.enum(SIGNIFICANCE_LEVELS).optional().describe("Filter by significance"),
  locationId: z.string().optional().describe("Filter by location as suggested source"),
  npcId: z.string().optional().describe("Filter by NPC as suggested source"),
});

export type GetUnrevealedCluesInput = z.infer<typeof GetUnrevealedCluesInputSchema>;

/**
 * Output type for get_unrevealed_clues
 */
export interface GetUnrevealedCluesOutput {
  message: string;
  clues: Array<{
    id: string;
    information: string;
    significance: string;
    suggestedSources: Array<{
      type: string;
      description: string;
    }>;
    revealsLeadTo?: string;
  }>;
  filters: {
    significance?: string;
    locationId?: string;
    npcId?: string;
  };
}

/**
 * get_unrevealed_clues tool definition
 */
export const getUnrevealedCluesTool = defineSharedTool({
  name: "get_unrevealed_clues",
  description:
    "List clues that haven't been discovered yet. Filter by significance, location, or NPC.",
  inputSchema: GetUnrevealedCluesInputSchema,

  handler: async (input, ctx): Promise<GetUnrevealedCluesOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const clues = getClues(session);
    const investigations =
      (session.worldState.investigations as Array<{ evidence: Array<{ id: string }> }>) || [];

    // Filter unrevealed clues
    let filtered = clues.filter((c) => !c.revealed);

    // Check prerequisites
    filtered = filtered.filter((c) => {
      const check = checkPrerequisites(c, session.flags, session.gameTime, investigations);
      return check.available;
    });

    // Apply filters
    if (input.significance) {
      filtered = filtered.filter((c) => c.significance === input.significance);
    }

    if (input.locationId) {
      filtered = filtered.filter((c) =>
        c.suggestedSources.some((s) => s.type === "location" && s.id === input.locationId)
      );
    }

    if (input.npcId) {
      filtered = filtered.filter((c) =>
        c.suggestedSources.some((s) => s.type === "npc" && s.id === input.npcId)
      );
    }

    // Sort by significance (critical first)
    const order = { critical: 0, major: 1, moderate: 2, minor: 3 };
    filtered.sort((a, b) => order[a.significance] - order[b.significance]);

    return {
      message: `${filtered.length} unrevealed clue(s) available`,
      clues: filtered.map((c) => ({
        id: c.id,
        information: c.information,
        significance: c.significance,
        suggestedSources: c.suggestedSources.map((s) => ({
          type: s.type,
          description: s.description,
        })),
        revealsLeadTo: c.revealsLeadTo,
      })),
      filters: {
        significance: input.significance,
        locationId: input.locationId,
        npcId: input.npcId,
      },
    };
  },
});
