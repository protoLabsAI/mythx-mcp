/**
 * Heal Character Tool (Shared)
 *
 * Restore HP to a character. Capped at the character's max HP.
 *
 * One of four intent-named character-state tools that replaced the
 * kitchen-sink `update_character`. The split makes the AI's job
 * easier: the tool name encodes the verb, and the input shape is the
 * minimum the verb requires (a character + an amount). See
 * docs/audits/chat-flow-audit.md §3 + §5 P1.2.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitCharacterUpdatedFor } from "../events/character-state.js";

export const HealCharacterInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character to heal"),
  amount: z.coerce
    .number()
    .int()
    .positive()
    .describe("Amount of HP to restore. Capped at the character's max HP."),
  reason: z.string().optional().describe("Optional narrative reason (e.g. 'rest', 'spell')"),
});

export type HealCharacterInput = z.infer<typeof HealCharacterInputSchema>;

export interface HealCharacterOutput {
  character: string;
  amountRequested: number;
  amountHealed: number;
  hp: { previous: number; current: number; max: number };
}

export const healCharacterTool = defineSharedTool({
  name: "heal_character",
  description:
    "Restore HP to a character. Capped at max HP. Use for any HP recovery (rest, spell, potion narration, GM fiat).",
  inputSchema: HealCharacterInputSchema,
  emits: [EventTypes.CHARACTER_UPDATED],

  handler: async (input, ctx): Promise<HealCharacterOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    const previous = character.hp.current;
    character.hp.current = Math.min(character.hp.max, previous + input.amount);
    const amountHealed = character.hp.current - previous;

    await ctx.sessions.save(session);

    if (amountHealed > 0) {
      emitCharacterUpdatedFor(
        ctx.eventBus,
        input.sessionId,
        character,
        session,
        { hpDelta: amountHealed, reason: input.reason ?? null },
        "heal_character"
      );
    }

    return {
      character: character.name,
      amountRequested: input.amount,
      amountHealed,
      hp: { previous, current: character.hp.current, max: character.hp.max },
    };
  },
});
