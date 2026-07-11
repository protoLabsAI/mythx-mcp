/**
 * Remove Condition Tool (Shared)
 *
 * Strip a condition from a character by id (or name). Returns 200 +
 * a "no-op" flag rather than throwing if the condition isn't present
 * — the LLM frequently asks to remove a condition that already
 * expired, and a hard error would feel like a bug.
 *
 * Part of the intent-named character-state tools that replaced
 * `update_character`. See docs/audits/chat-flow-audit.md §3 + §5 P1.2.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitCharacterUpdatedFor } from "../events/character-state.js";

export const RemoveConditionInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character losing the condition"),
  condition: z
    .string()
    .describe("Condition to remove — accepts the condition id OR display name (case-insensitive)."),
});

export type RemoveConditionInput = z.infer<typeof RemoveConditionInputSchema>;

export interface RemoveConditionOutput {
  character: string;
  removed: string | null;
  remainingConditions: string[];
}

export const removeConditionTool = defineSharedTool({
  name: "remove_condition",
  description:
    "Remove a condition from a character. Accepts the condition id OR its display name (case-insensitive). No-op if the condition isn't on the character.",
  inputSchema: RemoveConditionInputSchema,
  emits: [EventTypes.CHARACTER_UPDATED],

  handler: async (input, ctx): Promise<RemoveConditionOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    const target = input.condition.trim().toLowerCase();
    const idx = character.conditions.findIndex(
      (c) => c.id.toLowerCase() === target || c.name.toLowerCase() === target
    );

    if (idx === -1) {
      return {
        character: character.name,
        removed: null,
        remainingConditions: character.conditions.map((c) => c.name),
      };
    }

    const [removed] = character.conditions.splice(idx, 1);
    await ctx.sessions.save(session);

    emitCharacterUpdatedFor(
      ctx.eventBus,
      input.sessionId,
      character,
      session,
      { removedCondition: removed.name },
      "remove_condition"
    );

    return {
      character: character.name,
      removed: removed.name,
      remainingConditions: character.conditions.map((c) => c.name),
    };
  },
});
