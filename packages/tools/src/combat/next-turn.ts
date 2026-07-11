/**
 * Next Turn Tool (Shared)
 *
 * Advance to the next turn in combat.
 */

import { z } from "zod";
import { defineSharedTool, type Character, type Enemy } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitCombatEvent } from "../events/emitters.js";
import { requireSkill } from "../skills/load-skill.js";

/**
 * Input schema for next_turn
 */
export const NextTurnInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type NextTurnInput = z.infer<typeof NextTurnInputSchema>;

/**
 * Output type for next_turn
 */
export interface NextTurnOutput {
  round: number;
  turnIndex: number;
  currentTurn: {
    id: string;
    name: string;
  };
  turnOrder: Array<{
    id: string;
    name: string;
    current: boolean;
    hp: { current: number; max: number };
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
 * Next turn tool definition
 */
export const nextTurnTool = defineSharedTool({
  name: "next_turn",
  description: "Advance to the next turn in combat",
  inputSchema: NextTurnInputSchema,
  emits: [EventTypes.TURN_ADVANCED],

  // Gate: composed — combat-runner skill prerequisite first, then the
  // active-combat invariant. The skill body documents the round-loop
  // (attack → next_turn → attack until end_combat), so loading it
  // covers the rest of the encounter; the situational check still
  // enforces that combat is actually open.
  gate: async (input, ctx) => {
    const skillCheck = requireSkill("combat-runner")(input, ctx);
    if (!skillCheck.allow) return skillCheck;

    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      return { allow: false, reason: `Session not found: ${input.sessionId}.` };
    }
    if (!session.combat || !session.combat.active) {
      return {
        allow: false,
        reason: "No active combat to advance. Call `start_combat` first.",
      };
    }
    return { allow: true };
  },

  handler: async (input, ctx): Promise<NextTurnOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.combat?.active) {
      throw new Error("No active combat");
    }

    // Advance turn
    session.combat.turnIndex++;

    // Check for new round
    if (session.combat.turnIndex >= session.combat.turnOrder.length) {
      session.combat.turnIndex = 0;
      session.combat.round++;

      // Decrement condition durations
      for (const id of session.combat.turnOrder) {
        const combatant = getCombatant(session, id);
        if (combatant) {
          combatant.conditions = combatant.conditions.filter((c) => {
            if (typeof c.duration === "number") {
              c.duration--;
              return c.duration > 0;
            }
            return true;
          });
        }
      }
    }

    session.combat.currentTurnId = session.combat.turnOrder[session.combat.turnIndex];
    await ctx.sessions.save(session);

    const currentCombatant = getCombatant(session, session.combat.currentTurnId);

    // Emit turn advanced event
    emitCombatEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.TURN_ADVANCED,
      {
        round: session.combat.round,
        turnIndex: session.combat.turnIndex,
        currentTurnId: session.combat.currentTurnId,
        currentTurnName: currentCombatant?.name ?? session.combat.currentTurnId,
      },
      "next_turn",
      ctx.currentTurnId
    );

    return {
      round: session.combat.round,
      turnIndex: session.combat.turnIndex,
      currentTurn: {
        id: session.combat.currentTurnId,
        name: currentCombatant?.name ?? session.combat.currentTurnId,
      },
      turnOrder: session.combat.turnOrder.map((id, idx) => {
        const c = getCombatant(session, id);
        return {
          id,
          name: c?.name ?? id,
          current: idx === session.combat!.turnIndex,
          hp: c?.hp ?? { current: 0, max: 0 },
        };
      }),
    };
  },
});
