/**
 * Roll Initiative Tool (Shared)
 *
 * Roll initiative for all combatants and set turn order.
 */

import { z } from "zod";
import { defineSharedTool, type Character, type Enemy } from "@mythxengine/types";
import {
  createRNG,
  rollInitiativeDetailed,
  getInitiativeAbility,
  type RulesContext,
} from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { requireSkill } from "../skills/load-skill.js";

/**
 * Input schema for roll_initiative
 */
export const RollInitiativeInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type RollInitiativeInput = z.infer<typeof RollInitiativeInputSchema>;

/**
 * Output type for roll_initiative
 */
export interface RollInitiativeOutput {
  message: string;
  round: number;
  turnOrder: Array<{
    id: string;
    name: string;
    roll: number;
    modifier: number;
    total: number;
  }>;
  currentTurn: string;
}

/**
 * Helper to get a combatant by ID
 */
function getCombatant(
  session: {
    characters: Record<string, Character>;
    enemies: Record<string, Enemy>;
  },
  id: string
): Character | Enemy | null {
  return session.characters[id] || session.enemies[id] || null;
}

/**
 * Roll initiative tool definition
 */
export const rollInitiativeTool = defineSharedTool({
  name: "roll_initiative",
  description: "Roll initiative for all combatants and set turn order",
  inputSchema: RollInitiativeInputSchema,
  emits: [EventTypes.DICE_ROLLED],

  // Gate: combat-runner skill required. Initiative is the second beat
  // of the combat flow (start_combat → roll_initiative → attack); the
  // skill body documents the full sequence so loading it once covers
  // the rest of the encounter.
  gate: requireSkill("combat-runner"),

  handler: async (input, ctx): Promise<RollInitiativeOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.combat?.active) {
      throw new Error("No active combat. Use start_combat first.");
    }

    // Get all combatants
    const combatants = session.combat.turnOrder
      .map((id) => getCombatant(session, id))
      .filter((c): c is Character | Enemy => c !== null);

    const rng = createRNG(session.rng);
    const rules = (await ctx.getRules(session)) as RulesContext;
    const initiativeAbility = getInitiativeAbility(rules);
    const results = rollInitiativeDetailed(combatants, rng, rules);

    // Update turn order
    session.combat.turnOrder = results.map((r) => r.characterId);
    session.combat.round = 1;
    session.combat.turnIndex = 0;
    session.combat.currentTurnId = session.combat.turnOrder[0];

    // Update RNG state
    session.rng = rng.getState();
    await ctx.sessions.save(session);

    return {
      message: "Initiative rolled",
      round: 1,
      turnOrder: results.map((r) => {
        const combatant = getCombatant(session, r.characterId);
        return {
          id: r.characterId,
          name: combatant?.name ?? r.characterId,
          roll: r.roll.natural,
          modifier: combatant?.abilities[initiativeAbility] ?? 0,
          total: r.total,
        };
      }),
      currentTurn: session.combat.currentTurnId,
    };
  },
});
