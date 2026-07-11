/**
 * Apply Damage Tool (Shared)
 *
 * Apply damage directly to a combatant (bypassing attack roll).
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitCombatEvent } from "../events/emitters.js";
import { emitCharacterUpdatedFor, isPlayerCharacter } from "../events/character-state.js";
import { getCombatant } from "./helpers.js";

/**
 * Input schema for apply_damage
 */
export const ApplyDamageInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  targetId: z.string().describe("Target combatant ID"),
  amount: z.coerce.number().nonnegative().describe("Damage amount (must be >= 0)"),
});

export type ApplyDamageInput = z.infer<typeof ApplyDamageInputSchema>;

/**
 * Output type for apply_damage
 */
export interface ApplyDamageOutput {
  target: string;
  damage: number;
  hp: {
    previous: number;
    current: number;
    max: number;
  };
  defeated: boolean;
}

/**
 * Apply damage tool definition
 */
export const applyDamageTool = defineSharedTool({
  name: "apply_damage",
  description: "Apply damage directly to a combatant (bypassing attack roll)",
  inputSchema: ApplyDamageInputSchema,
  emits: [EventTypes.DAMAGE_TAKEN, EventTypes.CHARACTER_UPDATED],

  // Gate: combat must be active and target must be in turnOrder.
  // Mirrors `attack`'s gate (cc-2.18 pattern #1) so the LLM can't
  // mutate combatant HP outside an active encounter — same RPG
  // invariant, same denial shape so the model can self-correct.
  gate: async (input, ctx) => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      return { allow: false, reason: `Session not found: ${input.sessionId}.` };
    }
    if (!session.combat || !session.combat.active) {
      return {
        allow: false,
        reason:
          "No active combat. apply_damage only mutates combatants in a running encounter — call `start_combat` first if combat just began.",
      };
    }
    if (!new Set(session.combat.turnOrder).has(input.targetId)) {
      return {
        allow: false,
        reason: `Target "${input.targetId}" is not in the active combat's turn order.`,
      };
    }
    return { allow: true };
  },

  handler: async (input, ctx): Promise<ApplyDamageOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const target = getCombatant(session, input.targetId);
    if (!target) {
      throw new Error(`Target not found: ${input.targetId}`);
    }

    const previousHp = target.hp.current;
    target.hp.current = Math.max(0, target.hp.current - input.amount);
    await ctx.sessions.save(session);

    // Emit damage taken event
    emitCombatEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.DAMAGE_TAKEN,
      {
        targetId: input.targetId,
        targetName: target.name,
        damage: input.amount,
        previousHp,
        currentHp: target.hp.current,
        defeated: target.hp.current <= 0,
      },
      "apply_damage",
      ctx.currentTurnId
    );

    // Also emit CHARACTER_UPDATED with the full snapshot so the web
    // sync hook can update the party sidebar — DAMAGE_TAKEN alone
    // only updates `state.combat`. Skip for enemies (sidebar only
    // shows player party). See docs/audits/chat-flow-audit.md §2.1.
    if (isPlayerCharacter(session, input.targetId)) {
      emitCharacterUpdatedFor(
        ctx.eventBus,
        input.sessionId,
        target,
        session,
        { hpDelta: -input.amount },
        "apply_damage",
        ctx.currentTurnId
      );
    }

    return {
      target: target.name,
      damage: input.amount,
      hp: {
        previous: previousHp,
        current: target.hp.current,
        max: target.hp.max,
      },
      defeated: target.hp.current <= 0,
    };
  },
});
