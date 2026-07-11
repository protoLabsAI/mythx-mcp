/**
 * Take Rest Tool
 *
 * Initiates a rest sequence: recovers HP/stress, advances time,
 * clears conditions, and sets the stage to "rest" for the UI.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { advanceGameTime, recoverStress, type RulesContext } from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";
import { emitCharacterUpdatedFor } from "../events/character-state.js";
import { requireSkill } from "../skills/load-skill.js";

export const TakeRestInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  restType: z
    .enum(["short", "long", "camp"])
    .describe(
      "Type of rest: short (1h, 25% HP, 1 stress), long (8h, 50% HP, 2 stress), camp (12h, full recovery)"
    ),
  location: z.string().optional().describe("Where the party is resting"),
  flavor: z.string().optional().describe("Flavor text for the rest scene"),
});

export type TakeRestInput = z.infer<typeof TakeRestInputSchema>;

interface CharacterRestResult {
  characterId: string;
  characterName: string;
  hpRecovered: number;
  hpBefore: number;
  hpAfter: number;
  hpMax: number;
  stressRecovered: number;
  stressBefore: number;
  stressAfter: number;
  conditionsCleared: string[];
}

/** Categorical outcome — drives narration tone. */
export type TakeRestOutcome = "short_rest" | "long_rest" | "camp_rest";

export interface TakeRestResult {
  message: string;
  restType: "short" | "long" | "camp";
  durationHours: number;
  results: CharacterRestResult[];
}

export interface TakeRestStateDelta {
  time_advanced_minutes: number;
  total_hp_recovered: number;
  total_stress_recovered: number;
  total_conditions_cleared: number;
}

export interface TakeRestEnvelope {
  status: "ok";
  outcome: TakeRestOutcome;
  summary: string;
  result: TakeRestResult;
  state_delta: TakeRestStateDelta;
  suggested_next: Record<string, never>;
}

/** @deprecated Use TakeRestEnvelope. Kept as alias to ease migration. */
export type TakeRestOutput = TakeRestEnvelope;

/**
 * Per-rest-type policy that lives in the tool layer (HP %, duration,
 * whether to clear conditions, which engine rest semantics to apply).
 * Stress recovery is *not* set here — it comes from the world's
 * `MechanicsConfig.stressConfig` via the engine's `recoverStress`.
 *
 * `engineRestType` maps tool-level rest names to the engine's two-tier
 * rest model: a `"camp"` is mechanically a long rest with the bonus
 * that it always recovers all stress (per the engine's
 * `recoveryPerLongRest: "all"` default).
 */
const REST_CONFIG = {
  short: {
    durationHours: 1,
    hpPercent: 0.25,
    clearConditions: false,
    engineRestType: "short" as const,
  },
  long: {
    durationHours: 8,
    hpPercent: 0.5,
    clearConditions: true,
    engineRestType: "long" as const,
  },
  camp: {
    durationHours: 12,
    hpPercent: 1.0,
    clearConditions: true,
    engineRestType: "long" as const,
  },
} as const;

export const takeRestTool = defineSharedTool({
  name: "take_rest",
  description:
    "Initiate a rest sequence for the party. Recovers HP and stress, advances game time, and optionally clears conditions. Sets the UI stage to 'rest'. Returns an envelope with `outcome` ('short_rest', 'long_rest', or 'camp_rest') and a one-line `summary` as the headline; per-character mechanics in `result.results`, totals in `state_delta`.",
  inputSchema: TakeRestInputSchema,
  emits: [EventTypes.PARTY_RESTED, EventTypes.CHARACTER_UPDATED],

  // Gate: composed — engine-flows skill prerequisite first, then the
  // mid-combat check. Order matters: the skill body documents the
  // rest mechanics (durations, recovery percentages, when each rest
  // type fits), so the model gets that context BEFORE being told
  // about the combat-active situational rule. cc-2.18 pattern: make
  // skill loading load-bearing; let the existing situational gate
  // enforce game-mechanic invariants.
  gate: async (input, ctx) => {
    const skillCheck = requireSkill("engine-flows")(input, ctx);
    if (!skillCheck.allow) return skillCheck;

    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      return { allow: false, reason: `Session not found: ${input.sessionId}.` };
    }
    if (session.combat && session.combat.active) {
      return {
        allow: false,
        reason:
          "Combat is still active — resting mid-fight is not allowed. Call `end_combat` if the encounter is resolved, then try again.",
      };
    }
    return { allow: true };
  },

  handler: async (input, ctx): Promise<TakeRestEnvelope> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const config = REST_CONFIG[input.restType];
    const results: CharacterRestResult[] = [];

    // Resolve world rules so stress recovery honors `MechanicsConfig.stressConfig`.
    const rules = (await ctx.getRules(session)) as RulesContext;
    const stressConfig = rules.rules.mechanics.stressConfig;

    // Process each character
    for (const character of Object.values(session.characters)) {
      const hpBefore = character.hp.current;
      const hpMax = character.hp.max;
      const hpRecovery = Math.floor(hpMax * config.hpPercent);
      const hpAfter = Math.min(hpMax, hpBefore + hpRecovery);

      // Apply HP recovery
      character.hp.current = hpAfter;

      // Apply stress recovery via engine — pulls amount from world's
      // StressConfig.recoveryPerShortRest / recoveryPerLongRest.
      let stressBefore = 0;
      let stressAfter = 0;
      let stressRecovered = 0;
      if (character.stress) {
        stressBefore = character.stress.current;
        const recovery = recoverStress({
          character,
          restType: config.engineRestType,
          config: stressConfig,
        });
        stressRecovered = recovery.recovered;
        stressAfter = recovery.newStress;
        character.stress.current = stressAfter;
      }

      // Clear non-permanent conditions on long/camp rest
      const conditionsCleared: string[] = [];
      if (config.clearConditions && character.conditions) {
        const remaining = character.conditions.filter((c) => {
          // Keep permanent conditions, clear temporary and until_rest
          if (c.duration === "permanent") return true;
          conditionsCleared.push(c.name);
          return false;
        });
        character.conditions = remaining;
      }

      results.push({
        characterId: character.id,
        characterName: character.name,
        hpRecovered: hpAfter - hpBefore,
        hpBefore,
        hpAfter,
        hpMax,
        stressRecovered,
        stressBefore,
        stressAfter,
        conditionsCleared,
      });
    }

    // Advance game time using the canonical helper.
    const minutesToAdvance = config.durationHours * 60;
    if (session.gameTime) {
      session.gameTime = advanceGameTime(session.gameTime, minutesToAdvance);
    }

    await ctx.sessions.save(session);

    // Emit rest event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.PARTY_RESTED,
      {
        restType: input.restType,
        durationHours: config.durationHours,
        results,
      },
      "take_rest",
      ctx.currentTurnId
    );

    // Sync each character into the party sidebar — rest changes hp,
    // stress, AND conditions all in one tool call, and the GM-level
    // PARTY_RESTED event the sidebar's sync hook ignores. Without
    // these per-character emits the sidebar shows pre-rest state
    // until the next page load. See docs/audits/chat-flow-audit.md §2.1.
    for (const character of Object.values(session.characters)) {
      emitCharacterUpdatedFor(
        ctx.eventBus,
        input.sessionId,
        character,
        session,
        { restType: input.restType },
        "take_rest",
        ctx.currentTurnId
      );
    }

    const totalHp = results.reduce((s, r) => s + r.hpRecovered, 0);
    const totalStress = results.reduce((s, r) => s + r.stressRecovered, 0);
    const totalConditions = results.reduce((s, r) => s + r.conditionsCleared.length, 0);

    const outcome: TakeRestOutcome =
      input.restType === "camp"
        ? "camp_rest"
        : input.restType === "long"
          ? "long_rest"
          : "short_rest";

    // Diegetic summary — describes the rest narratively, not "{n} HP recovered".
    const summary =
      input.restType === "camp"
        ? `Party made camp for the night`
        : input.restType === "long"
          ? `Party took a long rest`
          : `Party paused for a short rest`;

    return {
      status: "ok",
      outcome,
      summary,
      result: {
        message: `${input.restType} rest (${config.durationHours}h): ${totalHp} HP and ${totalStress} stress recovered across ${results.length} characters`,
        restType: input.restType,
        durationHours: config.durationHours,
        results,
      },
      state_delta: {
        time_advanced_minutes: minutesToAdvance,
        total_hp_recovered: totalHp,
        total_stress_recovered: totalStress,
        total_conditions_cleared: totalConditions,
      },
      suggested_next: {},
    };
  },
});
