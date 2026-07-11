/**
 * Resist Consequence Tool (Shared)
 *
 * Spend stress to reduce or avoid a consequence.
 *
 * Returns the v2 structured envelope. Mirrors `roll_test` / `attack` /
 * `push_roll`: agent reads `outcome` + `summary` first, drills into
 * `result` / `state_delta` for mechanical detail.
 */

import { z } from "zod";
import { defineSharedTool, type Trauma } from "@mythxengine/types";
import {
  createRNG,
  resistConsequence as engineResist,
  ensureStressTracker,
} from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitStressChanged, emitTraumaGained } from "../events/emitters.js";
import { emitCharacterUpdatedFor } from "../events/character-state.js";

/**
 * Input schema for resist_consequence
 */
export const ResistConsequenceInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character resisting the consequence"),
  severity: z
    .enum(["minor", "moderate", "severe"])
    .describe("Severity of consequence to resist (affects stress cost)"),
  resistAbility: z
    .enum(["STR", "AGI", "WIT", "CON"])
    .describe("Ability to roll for potential cost reduction"),
  consequence: z.string().optional().describe("Description of the consequence being resisted"),
  damage: z
    .object({
      amount: z.coerce
        .number()
        .int()
        .min(1)
        .describe("HP damage of the consequence being resisted"),
      alreadyApplied: z
        .boolean()
        .default(false)
        .describe(
          "True when the damage already hit the character's HP (e.g. a preceding attack envelope applied it) — the tool then refunds the reduction instead of applying the remainder."
        ),
    })
    .optional()
    .describe(
      "Mechanical damage consequence. When provided the tool applies the resist result to HP itself: a successful resist halves the damage (rounded down — 1 becomes 0), a failed resist lets it land in full. Without this, the resist is stress-only and any mechanical effect is the GM's to apply."
    ),
});

export type ResistConsequenceInput = z.infer<typeof ResistConsequenceInputSchema>;

/** Categorical outcome — drives narration tone. */
export type ResistConsequenceOutcome = "reduced" | "absorbed" | "trauma_gained";

/**
 * Mechanical detail block — the inner `result` of the envelope.
 */
export interface ResistConsequenceResult {
  character: string;
  consequence?: string;
  resistAbility: string;
  abilityMod: number;
  resistRoll: number;
  reduced: boolean;
  severity: "minor" | "moderate" | "severe";
}

export interface ResistConsequenceStateDelta {
  rng_advanced: true;
  stress: {
    previous: number;
    current: number;
    max: number;
    cost: number;
  };
  trauma_gained?: { name: string };
  /** Present when the input carried a mechanical `damage` consequence. */
  consequence_damage?: {
    /** Damage the consequence threatened. */
    original: number;
    /** Damage that actually stands after the resist. */
    final: number;
    /** HP refunded (alreadyApplied) or subtracted (not yet applied) by this call. */
    hp_delta: number;
  };
  hp?: {
    previous: number;
    current: number;
    max: number;
  };
}

export interface ResistConsequenceSuggestedNext {
  consequence_guidance?: string;
}

export interface ResistConsequenceEnvelope {
  status: "ok";
  outcome: ResistConsequenceOutcome;
  summary: string;
  result: ResistConsequenceResult;
  state_delta: ResistConsequenceStateDelta;
  suggested_next: ResistConsequenceSuggestedNext;
}

/** @deprecated Use ResistConsequenceEnvelope. Kept as alias to ease migration. */
export type ResistConsequenceOutput = ResistConsequenceEnvelope;

/**
 * Diegetic one-liner. Examples:
 *   "Tester pushed past their limit — trauma 'Breaking Point'"
 *   "Tester shrugged off the moderate hit"
 *   "Tester absorbed the moderate consequence"
 *
 * Pronoun is gender-neutral ("their"). Per-character pronouns aren't
 * threaded through Character today; if/when they are, this can use
 * the character's configured pronoun.
 */
function buildSummary(
  characterName: string,
  severity: "minor" | "moderate" | "severe",
  reduced: boolean,
  traumaName: string | undefined,
  damageNote: string | undefined
): string {
  const note = damageNote ? ` — ${damageNote}` : "";
  if (traumaName) {
    return `${characterName} pushed past their limit — trauma '${traumaName}'${note}`;
  }
  return reduced
    ? `${characterName} shrugged off the ${severity} hit${note}`
    : `${characterName} absorbed the ${severity} consequence${note}`;
}

export const resistConsequenceTool = defineSharedTool({
  name: "resist_consequence",
  description:
    "Spend stress to reduce a consequence. Roll ability to potentially reduce cost. Minor=1, Moderate=2, Severe=3 base cost. Pass `damage` when the consequence is HP damage — the tool then applies the mechanical effect itself (successful resist halves it, failed resist lands in full; set `alreadyApplied` if the damage already hit HP so it refunds the reduction). Returns an envelope with `outcome` ('reduced', 'absorbed', or 'trauma_gained') and a one-line `summary` as the headline; stress/trauma/HP changes in `state_delta`.",
  inputSchema: ResistConsequenceInputSchema,
  emits: [EventTypes.STRESS_CHANGED, EventTypes.TRAUMA_GAINED, EventTypes.CHARACTER_UPDATED],

  handler: async (input, ctx): Promise<ResistConsequenceEnvelope> => {
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

    const result = engineResist({
      character,
      resistAbility: input.resistAbility,
      severity: input.severity,
      rng,
    });

    if (!character.stress) {
      character.stress = { current: 0, max: stress.max };
    }
    character.stress.current = result.newStress;

    let traumaName: string | undefined;
    if (result.traumaTriggered) {
      traumaName = "Breaking Point";
      if (!character.trauma) {
        character.trauma = [];
      }
      const newTrauma: Trauma = {
        id: `trauma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: traumaName,
        description: `Trauma from resisting consequences: ${traumaName}`,
        acquiredAt: new Date().toISOString(),
      };
      character.trauma.push(newTrauma);
    }

    // Apply the mechanical consequence when one was given (feel-report
    // gap #4: a resist's effect must not be invisible GM bookkeeping).
    // Reduction follows result.reduced — trauma can land on the same
    // call without changing whether the resist itself worked.
    let consequenceDamage: ResistConsequenceStateDelta["consequence_damage"];
    let hpAfter: ResistConsequenceStateDelta["hp"];
    let damageNote: string | undefined;
    if (input.damage) {
      const original = input.damage.amount;
      const final = result.reduced ? Math.floor(original / 2) : original;
      const previousHp = character.hp.current;
      if (input.damage.alreadyApplied) {
        // Damage already hit HP — refund the part the resist negated.
        character.hp.current = Math.min(character.hp.max, previousHp + (original - final));
      } else {
        character.hp.current = Math.max(0, previousHp - final);
      }
      consequenceDamage = {
        original,
        final,
        hp_delta: character.hp.current - previousHp,
      };
      hpAfter = { previous: previousHp, current: character.hp.current, max: character.hp.max };
      damageNote = result.reduced
        ? final === 0
          ? `${original} damage negated entirely`
          : `${original} damage reduced to ${final}`
        : `${original} damage lands in full`;
    }

    session.rng = rng.getState();
    await ctx.sessions.save(session);

    if (consequenceDamage && consequenceDamage.hp_delta !== 0) {
      emitCharacterUpdatedFor(
        ctx.eventBus,
        input.sessionId,
        character,
        session,
        {
          hpDelta: consequenceDamage.hp_delta,
          reason: input.consequence ?? "resisted consequence",
        },
        "resist_consequence"
      );
    }

    emitStressChanged(
      ctx.eventBus,
      input.sessionId,
      {
        characterId: input.characterId,
        characterName: character.name,
        previousStress,
        newStress: result.newStress,
        maxStress: stress.max,
        reason: "resist",
        cost: result.stressCost,
      },
      "resist_consequence"
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
          triggerReason: "resist",
        },
        "resist_consequence"
      );
    }

    const outcome: ResistConsequenceOutcome = traumaName
      ? "trauma_gained"
      : result.reduced
        ? "reduced"
        : "absorbed";

    const stateDelta: ResistConsequenceStateDelta = {
      rng_advanced: true,
      stress: {
        previous: previousStress,
        current: result.newStress,
        max: stress.max,
        cost: result.stressCost,
      },
    };
    if (traumaName) stateDelta.trauma_gained = { name: traumaName };
    if (consequenceDamage) {
      stateDelta.consequence_damage = consequenceDamage;
      stateDelta.hp = hpAfter;
    }

    // Why hardcoded guidance instead of getGMMoves / buildConsequenceGuidance:
    // those helpers are keyed on the 5-tier outcome + position model used by
    // resolution tools (roll_test, attack) — partial/failure/critical_failure ×
    // controlled/risky/desperate. resist_consequence has its own categorical
    // outcome enum ('reduced' / 'absorbed' / 'trauma_gained') that doesn't
    // map onto that grid. Trauma in particular is a scene-warping beat, not
    // a categorical GM move — narrative guidance fits where a move suggestion
    // wouldn't. push_roll handles the same situation identically; if you
    // change one, change both.
    const suggestedNext: ResistConsequenceSuggestedNext = {};
    if (traumaName) {
      suggestedNext.consequence_guidance =
        "Trauma is a scene-warping event — narrate the breakdown, then leave the trauma's flavor visible in subsequent beats.";
    }

    return {
      status: "ok",
      outcome,
      summary: buildSummary(character.name, input.severity, result.reduced, traumaName, damageNote),
      result: {
        character: character.name,
        consequence: input.consequence,
        resistAbility: input.resistAbility,
        abilityMod: result.resistRoll?.abilityMod ?? 0,
        resistRoll: result.resistRoll?.total ?? 0,
        reduced: result.reduced,
        severity: input.severity,
      },
      state_delta: stateDelta,
      suggested_next: suggestedNext,
    };
  },
});
