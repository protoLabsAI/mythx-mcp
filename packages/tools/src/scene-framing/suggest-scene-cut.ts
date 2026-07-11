/**
 * Suggest Scene Cut Tool (Shared)
 *
 * Recommend how to transition to the next meaningful moment.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for suggest_scene_cut
 */
export const SuggestSceneCutInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  currentLocation: z.string().describe("Where the scene is taking place"),
  partyIntention: z.string().describe("What the party is trying to do"),
  includeInterruptions: z.boolean().default(true).describe("Whether to suggest interruptions"),
});

export type SuggestSceneCutInput = z.infer<typeof SuggestSceneCutInputSchema>;

/**
 * Output type for suggest_scene_cut
 */
export interface SuggestSceneCutOutput {
  currentLocation: string;
  partyIntention: string;
  suggestion: {
    cutTo: string;
    transition: string;
    meaningfulChoice: string;
  };
  interruptions?: Array<{ type: string; description: string }>;
  availableHooks?: string[];
  tip: string;
}

/**
 * Suggest scene cut tool definition
 */
export const suggestSceneCutTool = defineSharedTool({
  name: "suggest_scene_cut",
  description:
    "Recommend how to transition to the next meaningful moment. Based on the Alexandrian principle: 'Cut to the next meaningful choice.'",
  inputSchema: SuggestSceneCutInputSchema,

  handler: async (input, ctx): Promise<SuggestSceneCutOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const intentionLower = input.partyIntention.toLowerCase();

    // Determine likely destination/outcome
    let cutTo: string;
    let transition: string;
    let meaningfulChoice: string;

    if (
      intentionLower.includes("travel") ||
      intentionLower.includes("go to") ||
      intentionLower.includes("head to")
    ) {
      // Travel intention - cut to arrival
      const destination =
        input.partyIntention.replace(/.*(?:travel|go|head) (?:to|toward) /i, "").trim() ||
        "destination";
      cutTo = `Arrival at ${destination}`;
      transition = `After an uneventful journey, you arrive at ${destination}...`;
      meaningfulChoice = "How do you approach? What's the first thing you do?";
    } else if (
      intentionLower.includes("rest") ||
      intentionLower.includes("sleep") ||
      intentionLower.includes("camp")
    ) {
      // Rest intention - cut to morning or interruption
      cutTo = "End of rest period";
      transition = "The night passes. As dawn breaks...";
      meaningfulChoice = "A new day begins. What's your first priority?";
    } else if (
      intentionLower.includes("wait") ||
      intentionLower.includes("watch") ||
      intentionLower.includes("stake out")
    ) {
      // Waiting intention - cut to the event or confirm nothing happens
      cutTo = "Result of the watch";
      transition = "Time passes. Eventually...";
      meaningfulChoice = "Something approaches / Nothing happens - what's your next move?";
    } else if (
      intentionLower.includes("search") ||
      intentionLower.includes("look for") ||
      intentionLower.includes("investigate")
    ) {
      // Search intention - cut to finding or exhausting options
      cutTo = "Search complete";
      transition = "After thorough searching...";
      meaningfulChoice = "You find [X] / You've searched everywhere. What now?";
    } else {
      // Generic intention - identify the obstacle or outcome
      cutTo = "Next obstacle or decision point";
      transition = "Moving forward...";
      meaningfulChoice = "You encounter [obstacle/choice]. How do you proceed?";
    }

    // Generate interruption options if requested
    const interruptions: Array<{ type: string; description: string }> = [];

    if (input.includeInterruptions) {
      // Check for active clocks
      if (session.activeClocks && session.activeClocks.length > 0) {
        const clock = session.activeClocks[0];
        interruptions.push({
          type: "clock_event",
          description: `Clock '${clock.name}' advances - signs of ${clock.doom} become visible`,
        });
      }

      // Generic interruption options
      interruptions.push({
        type: "arrival",
        description: "Someone arrives with urgent news or a demand",
      });
      interruptions.push({
        type: "discovery",
        description: "They notice something unexpected in the environment",
      });
      interruptions.push({
        type: "complication",
        description: "An obstacle or enemy appears",
      });
    }

    // Check discovered leads for potential hooks
    const leadHooks: string[] = [];
    if (session.discoveredLeads && session.discoveredLeads.length > 0) {
      const recentLeads = session.discoveredLeads.slice(-3);
      for (const lead of recentLeads) {
        leadHooks.push(`Follow up on: "${lead.information}"`);
      }
    }

    return {
      currentLocation: input.currentLocation,
      partyIntention: input.partyIntention,
      suggestion: {
        cutTo,
        transition,
        meaningfulChoice,
      },
      interruptions: input.includeInterruptions ? interruptions : undefined,
      availableHooks: leadHooks.length > 0 ? leadHooks : undefined,
      tip: "The best cuts skip empty time while landing on moments where player choice matters.",
    };
  },
});
