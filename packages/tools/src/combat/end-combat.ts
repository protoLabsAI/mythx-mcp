/**
 * End Combat Tool (Shared)
 *
 * End the current combat.
 */

import { z } from "zod";
import { defineSharedTool, type Character, type Enemy } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitCombatEvent } from "../events/emitters.js";
import { requireSkill } from "../skills/load-skill.js";
import { getCombatant } from "./helpers.js";

/**
 * Input schema for end_combat
 */
export const EndCombatInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  outcome: z.enum(["victory", "defeat", "fled"]).describe("Combat outcome"),
});

export type EndCombatInput = z.infer<typeof EndCombatInputSchema>;

/**
 * Output type for end_combat
 */
export interface EndCombatOutput {
  message: string;
  rounds: number;
  outcome: "victory" | "defeat" | "fled";
  survivors: Array<{
    id: string;
    name: string;
    hp: { current: number; max: number };
  }>;
}

/**
 * End combat tool definition
 */
export const endCombatTool = defineSharedTool({
  name: "end_combat",
  description: "End the current combat",
  inputSchema: EndCombatInputSchema,
  emits: [EventTypes.COMBAT_ENDED],

  // Gate: combat-runner skill required. By the time end_combat is
  // called the skill should already be loaded (start_combat is the
  // entry point), but gating here closes the back-door where a model
  // tries to call end_combat for state cleanup without going through
  // the documented flow.
  gate: requireSkill("combat-runner"),

  handler: async (input, ctx): Promise<EndCombatOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.combat?.active) {
      throw new Error("No active combat to end");
    }

    const summary = {
      rounds: session.combat.round,
      outcome: input.outcome,
      survivors: session.combat.turnOrder
        .map((id) => getCombatant(session, id))
        .filter((c): c is Character | Enemy => c !== null && c.hp.current > 0)
        .map((c) => ({ id: c.id, name: c.name, hp: c.hp })),
    };

    session.combat = null;
    await ctx.sessions.save(session);

    // Emit combat ended event
    emitCombatEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.COMBAT_ENDED,
      {
        rounds: summary.rounds,
        outcome: input.outcome,
        survivorIds: summary.survivors.map((s) => s.id),
      },
      "end_combat",
      ctx.currentTurnId
    );

    return {
      message: `Combat ended: ${input.outcome}`,
      ...summary,
    };
  },
});
