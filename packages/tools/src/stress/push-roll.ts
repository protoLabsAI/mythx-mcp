/**
 * Push Roll Tool (Shared)
 *
 * Spend stress for a bonus die after a failed or partial roll.
 *
 * Returns the v2 structured envelope. Mirrors `roll_test` / `attack`:
 * agent reads `outcome` + `summary` first, drills into `result` /
 * `state_delta` for mechanical detail. See
 * docs/context-compaction-architecture.md.
 */

import { z } from "zod";
import { defineSharedTool, type OutcomeType, type Trauma } from "@mythxengine/types";
import {
  createRNG,
  determineOutcome,
  pushRoll as enginePushRoll,
  ensureStressTracker,
  type RulesContext,
} from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitStressChanged, emitTraumaGained } from "../events/emitters.js";

/**
 * Input schema for push_roll
 */
export const PushRollInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character spending stress to push"),
  originalRoll: z.number().describe("The original roll total to add bonus to"),
  originalMargin: z.number().describe("The original margin (roll - difficulty)"),
});

export type PushRollInput = z.infer<typeof PushRollInputSchema>;

/** Categorical outcome — drives narration tone. */
export type PushRollOutcome = "pushed" | "trauma_gained";

/**
 * Mechanical detail block — the inner `result` of the envelope.
 */
export interface PushRollResult {
  characterId: string;
  characterName: string;
  bonus: number;
  bonusRoll: {
    expression: string;
    total: number;
    rolls: number[];
  };
  newTotal: number;
  newMargin: number;
  /**
   * Outcome tier the original margin sat in (margin-only — criticals
   * were decided on the original natural die and a push can't create
   * or undo them).
   */
  previousOutcome: OutcomeType;
  /** Outcome tier the pushed margin lands in. The player-facing answer. */
  newOutcome: OutcomeType;
  /** Did the push change the tier? */
  outcomeImproved: boolean;
}

/**
 * State changes the push caused — RNG advances, stress goes up, may
 * cross the trauma threshold.
 */
export interface PushRollStateDelta {
  rng_advanced: true;
  stress: {
    previous: number;
    current: number;
    max: number;
    cost: number;
  };
  trauma_gained?: { name: string };
}

export interface PushRollSuggestedNext {
  consequence_guidance?: string;
}

export interface PushRollEnvelope {
  status: "ok";
  outcome: PushRollOutcome;
  summary: string;
  result: PushRollResult;
  state_delta: PushRollStateDelta;
  suggested_next: PushRollSuggestedNext;
}

/** @deprecated Use PushRollEnvelope. Kept as alias to ease migration. */
export type PushRollOutput = PushRollEnvelope;

/**
 * Diegetic one-liner. Examples:
 *   "Tester pushed past their limit — trauma 'Pushed Too Far'"
 *   "Tester pushed harder"
 *
 * Pronoun is gender-neutral ("their"). Per-character pronouns aren't
 * threaded through Character today; if/when they are, this can use
 * the character's configured pronoun.
 */
function buildSummary(
  characterName: string,
  traumaName: string | undefined,
  previousOutcome: OutcomeType,
  newOutcome: OutcomeType
): string {
  const shift =
    previousOutcome === newOutcome
      ? `still ${newOutcome}`
      : `${previousOutcome} upgraded to ${newOutcome}`;
  return traumaName
    ? `${characterName} pushed past their limit — trauma '${traumaName}' — ${shift}`
    : `${characterName} pushed harder — ${shift}`;
}

export const pushRollTool = defineSharedTool({
  name: "push_roll",
  description:
    "Spend 2 stress to add +1d6 bonus to a failed or partial roll. Can trigger trauma if stress exceeds max. Returns an envelope with `outcome` ('pushed' or 'trauma_gained') and a one-line `summary` as the headline; mechanical detail is in `result` (including `previousOutcome` → `newOutcome`, the re-derived outcome tier for the pushed margin), stress/trauma changes in `state_delta`.",
  inputSchema: PushRollInputSchema,
  emits: [EventTypes.STRESS_CHANGED, EventTypes.TRAUMA_GAINED],

  handler: async (input, ctx): Promise<PushRollEnvelope> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    const stress = ensureStressTracker(character);
    const previousStress = stress.current;

    const rng = createRNG(session.rng);

    const result = enginePushRoll({
      rng,
      currentStress: stress.current,
      maxStress: stress.max,
    });

    if (!character.stress) {
      character.stress = { current: 0, max: stress.max };
    }
    character.stress.current = result.newStress;

    let traumaName: string | undefined;
    if (result.traumaTriggered) {
      traumaName = "Pushed Too Far";
      if (!character.trauma) {
        character.trauma = [];
      }
      const newTrauma: Trauma = {
        id: `trauma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: traumaName,
        description: `Trauma from pushing too hard: ${traumaName}`,
        acquiredAt: new Date().toISOString(),
      };
      character.trauma.push(newTrauma);
    }

    session.rng = rng.getState();
    await ctx.sessions.save(session);

    // Re-derive the outcome tier so the player gets "failure upgraded
    // to partial", not a bare margin to map themselves. Margin-only:
    // criticals were decided on the original natural die, so no crit
    // lists are passed.
    const rules = (await ctx.getRules(session)) as RulesContext;
    const { outcomeThresholds } = rules.rules.mechanics;
    const noCrits = { success: [], failure: [] };
    const newMargin = input.originalMargin + result.bonus;
    const previousOutcome = determineOutcome(input.originalMargin, 0, outcomeThresholds, noCrits);
    const newOutcome = determineOutcome(newMargin, 0, outcomeThresholds, noCrits);

    emitStressChanged(
      ctx.eventBus,
      input.sessionId,
      {
        characterId: input.characterId,
        characterName: character.name,
        previousStress,
        newStress: result.newStress,
        maxStress: stress.max,
        reason: "push",
        cost: result.stressCost,
      },
      "push_roll"
    );

    if (result.traumaTriggered && traumaName) {
      emitTraumaGained(
        ctx.eventBus,
        input.sessionId,
        {
          characterId: input.characterId,
          characterName: character.name,
          trauma: traumaName,
          totalTraumas: character.trauma?.length ?? 1,
          triggerReason: "push",
        },
        "push_roll"
      );
    }

    const stateDelta: PushRollStateDelta = {
      rng_advanced: true,
      stress: {
        previous: previousStress,
        current: result.newStress,
        max: stress.max,
        cost: result.stressCost,
      },
    };
    if (traumaName) stateDelta.trauma_gained = { name: traumaName };

    // Why hardcoded guidance instead of getGMMoves / buildConsequenceGuidance:
    // those helpers are keyed on the 5-tier outcome + position model used by
    // resolution tools (roll_test, attack) — partial/failure/critical_failure ×
    // controlled/risky/desperate. push_roll has its own categorical outcome
    // enum ('pushed' / 'trauma_gained') that doesn't map onto that grid.
    // Trauma in particular is a scene-warping beat, not a categorical GM
    // move — narrative guidance fits where a move suggestion wouldn't.
    // resist_consequence handles the same situation identically; if you
    // change one, change both.
    const suggestedNext: PushRollSuggestedNext = {};
    if (traumaName) {
      suggestedNext.consequence_guidance =
        "Trauma is a scene-warping event — narrate the breakdown, then leave the trauma's flavor visible in subsequent beats.";
    }

    return {
      status: "ok",
      outcome: traumaName ? "trauma_gained" : "pushed",
      summary: buildSummary(character.name, traumaName, previousOutcome, newOutcome),
      result: {
        characterId: input.characterId,
        characterName: character.name,
        bonus: result.bonus,
        bonusRoll: result.bonusRoll,
        newTotal: input.originalRoll + result.bonus,
        newMargin,
        previousOutcome,
        newOutcome,
        outcomeImproved: newOutcome !== previousOutcome,
      },
      state_delta: stateDelta,
      suggested_next: suggestedNext,
    };
  },
});
