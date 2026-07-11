/**
 * Advance Dialogue Tool
 *
 * Continue an NPC dialogue by providing the NPC's next line
 * and new response choices. Updates the dialogue stage.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";

export const AdvanceDialogueInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  npcId: z.string().describe("NPC ID (must match current dialogue)"),
  npcName: z.string().describe("NPC display name"),
  text: z.string().describe("NPC's next dialogue line"),
  portrait: z.string().optional().describe("Portrait URL or emoji (optional override)"),
  responses: z.array(z.string()).optional().describe("New response choices for the player"),
  endDialogue: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, end the dialogue and return to narrative stage"),
});

export type AdvanceDialogueInput = z.infer<typeof AdvanceDialogueInputSchema>;

export interface AdvanceDialogueOutput {
  message: string;
  npcName: string;
  text: string;
  responses: string[];
  ended: boolean;
}

export const advanceDialogueTool = defineSharedTool({
  name: "advance_dialogue",
  description:
    "Continue an NPC dialogue with the next line and response choices. Set endDialogue=true to end the conversation and return to narrative.",
  inputSchema: AdvanceDialogueInputSchema,
  emits: [EventTypes.DIALOGUE_ADVANCED],

  handler: async (input, ctx): Promise<AdvanceDialogueOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Emit dialogue advanced event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.DIALOGUE_ADVANCED,
      {
        npcId: input.npcId,
        npcName: input.npcName,
        text: input.text,
        ended: input.endDialogue,
      },
      "advance_dialogue",
      ctx.currentTurnId
    );

    return {
      message: input.endDialogue
        ? `Ended dialogue with ${input.npcName}`
        : `${input.npcName}: "${input.text.slice(0, 60)}${input.text.length > 60 ? "..." : ""}"`,
      npcName: input.npcName,
      text: input.text,
      responses: input.responses ?? [],
      ended: input.endDialogue ?? false,
    };
  },
});
