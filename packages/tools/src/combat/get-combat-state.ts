/**
 * Get Combat State Tool (Shared)
 *
 * Get the current combat state.
 */

import { z } from "zod";
import { defineSharedTool, type Character, type Enemy } from "@mythxengine/types";

/**
 * Input schema for get_combat_state
 */
export const GetCombatStateInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type GetCombatStateInput = z.infer<typeof GetCombatStateInputSchema>;

/**
 * Output type for get_combat_state
 */
export interface GetCombatStateOutput {
  active: boolean;
  message?: string;
  round?: number;
  turnIndex?: number;
  currentTurn?: string;
  combatants?: Array<{
    id: string;
    name: string;
    hp: { current: number; max: number };
    conditions: string[];
    current: boolean;
  }>;
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
 * Get combat state tool definition
 */
export const getCombatStateTool = defineSharedTool({
  name: "get_combat_state",
  description: "Get the current combat state",
  inputSchema: GetCombatStateInputSchema,

  handler: async (input, ctx): Promise<GetCombatStateOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.combat) {
      return { active: false, message: "No combat in progress" };
    }

    return {
      active: session.combat.active,
      round: session.combat.round,
      turnIndex: session.combat.turnIndex,
      currentTurn: session.combat.currentTurnId,
      combatants: session.combat.turnOrder.map((id, idx) => {
        const c = getCombatant(session, id);
        return {
          id,
          name: c?.name ?? id,
          hp: c?.hp ?? { current: 0, max: 0 },
          conditions: c?.conditions.map((cond) => cond.name) ?? [],
          current: idx === session.combat!.turnIndex,
        };
      }),
    };
  },
});
