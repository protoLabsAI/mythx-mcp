/**
 * Suggest Clue Delivery Tool (Shared)
 *
 * Get suggestions for how to naturally deliver a clue in the current context.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { getClues } from "./types.js";

/**
 * Input schema for suggest_clue_delivery
 */
export const SuggestClueDeliveryInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  clueId: z.string().describe("Clue ID"),
  currentLocationId: z.string().optional().describe("Current location"),
  presentNpcIds: z.array(z.string()).optional().describe("NPCs present"),
  currentActivity: z.string().optional().describe("What's happening now"),
});

export type SuggestClueDeliveryInput = z.infer<typeof SuggestClueDeliveryInputSchema>;

/**
 * Output type for suggest_clue_delivery
 */
export interface SuggestClueDeliveryOutput {
  clue: {
    id: string;
    information: string;
    significance: string;
  };
  suggestions: Array<{
    method: string;
    description: string;
    matchesContext: boolean;
  }>;
  context: {
    currentLocationId?: string;
    presentNpcIds?: string[];
    currentActivity?: string;
  };
  tip: string;
}

/**
 * suggest_clue_delivery tool definition
 */
export const suggestClueDeliveryTool = defineSharedTool({
  name: "suggest_clue_delivery",
  description: "Get suggestions for how to naturally deliver a clue in the current context.",
  inputSchema: SuggestClueDeliveryInputSchema,

  handler: async (input, ctx): Promise<SuggestClueDeliveryOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const clues = getClues(session);
    const clue = clues.find((c) => c.id === input.clueId);

    if (!clue) {
      throw new Error(`Clue not found: ${input.clueId}`);
    }

    const suggestions: Array<{
      method: string;
      description: string;
      matchesContext: boolean;
    }> = [];

    // Check each suggested source against current context
    for (const source of clue.suggestedSources) {
      let matchesContext = false;

      if (
        source.type === "location" &&
        input.currentLocationId &&
        source.id === input.currentLocationId
      ) {
        matchesContext = true;
      }
      if (source.type === "npc" && input.presentNpcIds?.includes(source.id || "")) {
        matchesContext = true;
      }
      if (source.type === "observation") {
        matchesContext = true; // Can always observe
      }

      suggestions.push({
        method: source.type,
        description: source.description,
        matchesContext,
      });
    }

    // Add improvised suggestions based on activity
    if (input.currentActivity) {
      const activityLower = input.currentActivity.toLowerCase();

      if (activityLower.includes("search") || activityLower.includes("investigate")) {
        suggestions.push({
          method: "discovery",
          description: `During the search, they find evidence: "${clue.information}"`,
          matchesContext: true,
        });
      }

      if (activityLower.includes("conversation") || activityLower.includes("talk")) {
        suggestions.push({
          method: "dialogue",
          description: `The NPC mentions: "${clue.information}"`,
          matchesContext: true,
        });
      }
    }

    // Sort by context match
    suggestions.sort((a, b) => (b.matchesContext ? 1 : 0) - (a.matchesContext ? 1 : 0));

    return {
      clue: {
        id: clue.id,
        information: clue.information,
        significance: clue.significance,
      },
      suggestions,
      context: {
        currentLocationId: input.currentLocationId,
        presentNpcIds: input.presentNpcIds,
        currentActivity: input.currentActivity,
      },
      tip: "Choose a delivery method that feels natural to the current scene.",
    };
  },
});
