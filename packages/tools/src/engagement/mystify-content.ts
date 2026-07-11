/**
 * Mystify Content Tool (Shared)
 *
 * Break complete information into mysterious fragments, creating revelatory discovery.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for mystify_content
 */
export const MystifyContentInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  fullRevelation: z.string().describe("Complete information to fragment"),
  fragmentCount: z.number().min(2).max(6).describe("How many pieces (2-6)"),
});

export type MystifyContentInput = z.infer<typeof MystifyContentInputSchema>;

/**
 * Output type for mystify_content
 */
export interface MystifyContentOutput {
  fullRevelation: string;
  fragmentCount: number;
  fragments: Array<{
    index: number;
    guidance: string;
    reveals: string;
    obscures: string;
    suggestedDiscovery: string;
  }>;
  suggestedOrder: number[];
  dramaTip: string;
  threeClueTip: string;
}

/**
 * Fragment pattern type
 */
interface FragmentPattern {
  pattern: string;
  reveals: string;
  hides: string;
}

/**
 * Mystify content tool definition
 */
export const mystifyContentTool = defineSharedTool({
  name: "mystify_content",
  description:
    "Break complete information into mysterious fragments, creating revelatory discovery.",
  inputSchema: MystifyContentInputSchema,

  handler: async (input, ctx): Promise<MystifyContentOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Parse the revelation into semantic components
    const revelation = input.fullRevelation;
    const sentences = revelation.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Generate fragments based on count
    const fragments: Array<{
      fragment: string;
      whatItReveals: string;
      whatItHides: string;
    }> = [];

    // Strategy: Each fragment reveals some truth but obscures others
    const numFragments = Math.min(input.fragmentCount, Math.max(2, sentences.length));

    // Define fragment patterns
    const fragmentPatterns: FragmentPattern[] = [
      {
        pattern: "WHO",
        reveals: "identity of actor",
        hides: "motivation and method",
      },
      {
        pattern: "WHAT",
        reveals: "the action or event",
        hides: "who did it and why",
      },
      {
        pattern: "WHERE",
        reveals: "location of importance",
        hides: "what happens there",
      },
      {
        pattern: "WHEN",
        reveals: "timing or deadline",
        hides: "what will happen",
      },
      {
        pattern: "WHY",
        reveals: "motivation",
        hides: "identity and method",
      },
      {
        pattern: "HOW",
        reveals: "method or means",
        hides: "who and why",
      },
    ];

    // Select patterns based on fragment count
    const selectedPatterns = fragmentPatterns.slice(0, numFragments);

    for (let i = 0; i < numFragments; i++) {
      const patternInfo = selectedPatterns[i] || fragmentPatterns[i % fragmentPatterns.length];

      fragments.push({
        fragment: `[Fragment ${i + 1}: ${patternInfo.pattern}] - Partial truth about "${revelation.substring(0, 50)}..."`,
        whatItReveals: patternInfo.reveals,
        whatItHides: patternInfo.hides,
      });
    }

    // Generate discovery methods for each fragment
    const discoveryMethods = [
      "Found on a document or letter",
      "Overheard from an NPC conversation",
      "Discovered through investigation",
      "Revealed by an ally or contact",
      "Witnessed firsthand",
      "Extracted from an enemy",
    ].slice(0, numFragments);

    // Suggested order based on dramatic structure
    const suggestedOrder = Array.from({ length: numFragments }, (_, i) => i);
    // Put "WHO" or "WHY" last for maximum reveal impact
    const lastIndex = fragments.findIndex(
      (f) => f.whatItReveals.includes("identity") || f.whatItReveals.includes("motivation")
    );
    if (lastIndex !== -1 && lastIndex !== numFragments - 1) {
      suggestedOrder.splice(suggestedOrder.indexOf(lastIndex), 1);
      suggestedOrder.push(lastIndex);
    }

    return {
      fullRevelation: input.fullRevelation,
      fragmentCount: numFragments,
      fragments: fragments.map((f, i) => ({
        index: i,
        guidance: f.fragment,
        reveals: f.whatItReveals,
        obscures: f.whatItHides,
        suggestedDiscovery: discoveryMethods[i],
      })),
      suggestedOrder,
      dramaTip:
        "Reveal identity or motivation last for maximum impact. Let players piece it together themselves.",
      threeClueTip: "For each critical fragment, create at least 3 ways it can be discovered.",
    };
  },
});
