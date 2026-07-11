/**
 * Damage Character Tool (Shared)
 *
 * Deal damage to a character outside of combat resolution. Floors at
 * 0 HP and reports defeat.
 *
 * Distinct from `apply_damage` (combat-focused, takes a combatant id
 * which can resolve to either a character or an enemy). This tool is
 * the player-character-only entrypoint for narrative damage —
 * environmental effects, traps, GM fiat — and is part of the
 * intent-named character-state tools that replaced `update_character`.
 *
 * See docs/audits/chat-flow-audit.md §3 + §5 P1.2.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitCharacterUpdatedFor } from "../events/character-state.js";
import { requireSkill } from "../skills/load-skill.js";

export const DamageCharacterInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character to damage"),
  amount: z.coerce.number().int().positive().describe("Amount of HP to subtract. Floored at 0."),
  reason: z.string().optional().describe("Optional narrative reason (e.g. 'trap', 'falling')"),
});

export type DamageCharacterInput = z.infer<typeof DamageCharacterInputSchema>;

export interface DamageCharacterOutput {
  character: string;
  amount: number;
  hp: { previous: number; current: number; max: number };
  defeated: boolean;
}

export const damageCharacterTool = defineSharedTool({
  name: "damage_character",
  description:
    "Deal damage to a character (narrative/environmental, not from combat resolution). Floors HP at 0 and reports defeat. For combat attacks, use `attack`. For combat-target damage, use `apply_damage`.",
  inputSchema: DamageCharacterInputSchema,
  emits: [EventTypes.CHARACTER_UPDATED],

  // Gate: combat-runner skill required. Was the bypass route the
  // model reached for instead of `start_combat → attack` — applying
  // HP damage IS combat resolution whether or not the encounter is
  // formally open. The skill body covers both combat (use `attack`)
  // and non-combat (trap/fall/poison/GM fiat) damage paths so loading
  // it gives the model the right tool for each case.
  gate: requireSkill("combat-runner"),

  handler: async (input, ctx): Promise<DamageCharacterOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    const previous = character.hp.current;
    character.hp.current = Math.max(0, previous - input.amount);
    const damageDealt = previous - character.hp.current;

    await ctx.sessions.save(session);

    if (damageDealt > 0) {
      emitCharacterUpdatedFor(
        ctx.eventBus,
        input.sessionId,
        character,
        session,
        { hpDelta: -damageDealt, reason: input.reason ?? null },
        "damage_character"
      );
    }

    return {
      character: character.name,
      amount: damageDealt,
      hp: { previous, current: character.hp.current, max: character.hp.max },
      defeated: character.hp.current <= 0,
    };
  },
});
