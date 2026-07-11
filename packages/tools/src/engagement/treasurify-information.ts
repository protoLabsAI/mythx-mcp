/**
 * Treasurify Information Tool (Shared)
 *
 * Package information as a valuable discovery - a physical item, document, or reward.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for treasurify_information
 */
export const TreasurifyInformationInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  information: z.string().describe("The lore or plot point to make valuable"),
  context: z.string().describe("Current situation for context"),
});

export type TreasurifyInformationInput = z.infer<typeof TreasurifyInformationInputSchema>;

/**
 * Output type for treasurify_information
 */
export interface TreasurifyInformationOutput {
  information: string;
  context: string;
  asItem: string[];
  asDocument: string[];
  asReward: string[];
  specificToContext: string[];
  tip: string;
}

/**
 * Treasurify information tool definition
 */
export const treasurifyInformationTool = defineSharedTool({
  name: "treasurify_information",
  description:
    "Package information as a valuable discovery - a physical item, document, or reward.",
  inputSchema: TreasurifyInformationInputSchema,

  handler: async (input, ctx): Promise<TreasurifyInformationOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Get world tone for appropriate suggestions
    const tone =
      (session.worldState?.worldSeed as { settings?: { tone?: string } })?.settings?.tone ||
      "neutral";
    const toneIsDark = tone === "dark" || tone === "gritty" || tone === "horror";

    const asItem: string[] = [];
    const asDocument: string[] = [];
    const asReward: string[] = [];

    // Generate item suggestions
    if (toneIsDark) {
      asItem.push(
        "A worn locket containing a portrait with this name scratched into the back",
        "A bloodstained token inscribed with this information",
        "A piece of jewelry with this secret engraved inside",
        "A key with markings that reveal this when examined closely"
      );
    } else {
      asItem.push(
        "A finely crafted pendant with this information encoded in its design",
        "A commemorative medallion bearing this knowledge",
        "An heirloom ring with this message hidden inside",
        "A curious compass that points toward this truth when held"
      );
    }

    // Generate document suggestions
    if (toneIsDark) {
      asDocument.push(
        "A torn page from a journal, the handwriting shaky with fear",
        "A letter never sent, hidden in a dead messenger's boot",
        "A confession written in blood, or something like it",
        "A merchant's ledger with damning entries hidden in the margins"
      );
    } else {
      asDocument.push(
        "An old letter from a grateful citizen",
        "A scholarly treatise with this insight highlighted",
        "A map with annotations revealing this information",
        "An official decree or proclamation mentioning this"
      );
    }

    // Generate reward suggestions
    asReward.push(
      "A grateful NPC shares this as payment for help rendered",
      "A dying person's last words reveal this to those who stayed with them",
      "A merchant offers this valuable tip instead of gold",
      "Success at a challenge reveals this information as a natural consequence"
    );

    // Context-specific suggestions
    const contextLower = input.context.toLowerCase();
    const specificSuggestions: string[] = [];

    if (contextLower.includes("combat") || contextLower.includes("battle")) {
      specificSuggestions.push(
        "Found on the body of a defeated enemy",
        "Revealed by a dying foe as their last words",
        "Discovered in the aftermath, as the party catches their breath"
      );
    }

    if (contextLower.includes("tavern") || contextLower.includes("inn")) {
      specificSuggestions.push(
        "Overheard from a drunk patron who quickly passes out",
        "Left behind by a previous occupant of their room",
        "Slipped to them by a mysterious stranger who vanishes"
      );
    }

    if (contextLower.includes("search") || contextLower.includes("investigate")) {
      specificSuggestions.push(
        "Hidden in a false bottom of a container",
        "Scratched into the underside of furniture",
        "Sewn into the lining of discarded clothing"
      );
    }

    return {
      information: input.information,
      context: input.context,
      asItem: asItem.slice(0, 3),
      asDocument: asDocument.slice(0, 3),
      asReward: asReward.slice(0, 3),
      specificToContext: specificSuggestions,
      tip: "Physical items players can keep create lasting reminders. Documents can be referenced later. Rewards feel earned.",
    };
  },
});
