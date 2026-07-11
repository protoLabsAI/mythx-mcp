/**
 * Roll Test Tool (Shared)
 *
 * Perform skill/ability tests against difficulty.
 *
 * Returns a structured envelope rather than a flat result blob: the
 * agent reads `outcome` + `summary` to decide what to do next, and
 * only drills into `result` / `state_delta` / `suggested_next` when
 * it needs the mechanical detail. See docs/context-compaction-architecture.md
 * for the v2 envelope rationale.
 */

import { z } from "zod";
import {
  defineSharedTool,
  DIFFICULTY,
  type Character,
  type Modifier,
  type Position,
  type EffectLevel,
  type OutcomeType,
  type GMMove,
  getGMMoves,
  buildConsequenceGuidance,
  criticalFromOutcome,
} from "@mythxengine/types";
import { createRNG, resolveTest, type RulesContext } from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitTestResolved } from "../events/emitters.js";
import { autoTickClocks, type ClockTickResult } from "../clocks/index.js";

/**
 * Input schema for roll_test
 */
export const RollTestInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character performing the test"),
  skill: z.string().optional().describe("Skill to use (optional)"),
  ability: z
    .enum(["STR", "AGI", "WIT", "CON"])
    .optional()
    .describe("Ability to use (optional, defaults to skill's ability or WIT)"),
  difficulty: z
    .enum(["easy", "standard", "hard", "extreme"])
    .default("standard")
    .describe(
      "Difficulty level: easy (DC 8), standard (DC 12, default), hard (DC 16), extreme (DC 20). For an exact custom DC, use roll_custom_test instead."
    ),
  modifiers: z
    .array(
      z.object({
        source: z.string(),
        amount: z.number(),
      })
    )
    .optional()
    .describe("Additional modifiers"),
  advantageSources: z
    .array(z.string())
    .optional()
    .describe("Sources granting advantage (e.g., 'flanking', 'high ground')"),
  disadvantageSources: z
    .array(z.string())
    .optional()
    .describe("Sources granting disadvantage (e.g., 'darkness', 'wounded')"),
  position: z
    .enum(["controlled", "risky", "desperate"])
    .optional()
    .default("risky")
    .describe("Position (risk level): controlled, risky (default), desperate"),
  effectLevel: z
    .enum(["limited", "standard", "great"])
    .optional()
    .default("standard")
    .describe("Effect level (impact): limited, standard (default), great"),
  autoTickClockIds: z
    .array(z.string())
    .optional()
    .describe("Clock IDs to automatically tick on partial/failure outcomes"),
});

export type RollTestInput = z.infer<typeof RollTestInputSchema>;

/**
 * Mechanical detail block — the inner `result` of the envelope.
 */
export interface RollTestResult {
  character: string;
  /** Resolved character id — lets consumers (e.g. the frame's push interrupt) act on the roller without name matching. */
  characterId: string;
  skill: string | null;
  ability: string;
  difficulty: number;
  advantageState: "advantage" | "disadvantage" | "normal";
  roll: {
    natural: number;
    total: number;
    critical?: "success" | "failure";
    advantage?: {
      bothRolls: [number, number];
      selected: "higher" | "lower";
    };
  };
  modifiers: {
    ability: number;
    skill: number;
    other: number;
    total: number;
  };
  margin: number;
  critical: boolean;
  position: Position;
  effectLevel: EffectLevel;
}

/**
 * State changes the resolution caused — RNG always advances, clocks
 * may tick, and push availability tracks the FitD meta-currency gate.
 */
export interface RollTestStateDelta {
  rng_advanced: true;
  clocks_ticked?: ClockTickResult[];
  push_available: boolean;
}

/**
 * GM-facing follow-up suggestions — only populated on partial/failure.
 */
export interface RollTestSuggestedNext {
  gm_moves?: GMMove[];
  consequence_guidance?: string;
}

/**
 * Structured envelope returned by roll_test. The headline fields
 * (`status`, `outcome`, `summary`) are sufficient for the agent to
 * narrate; deeper consumers read `result` / `state_delta` /
 * `suggested_next` when they need mechanical detail.
 */
export interface RollTestEnvelope {
  status: "ok";
  outcome: OutcomeType;
  summary: string;
  result: RollTestResult;
  state_delta: RollTestStateDelta;
  suggested_next: RollTestSuggestedNext;
}

/** @deprecated Use RollTestEnvelope. Kept as alias to ease migration of any external readers. */
export type RollTestOutput = RollTestEnvelope;

/**
 * One-line headline the agent (and humans) read first.
 *
 * Deliberately diegetic / outcome-tier driven — no DC, modifier, or
 * raw d20. The agent has the full mechanical block in `result` for
 * its own decision-making; pulling numbers out of `summary` only
 * trains the model toward stat-blocky narration. Format examples:
 *   "Test Hero succeeded at STR (standard, risky)"
 *   "Test Hero partially succeeded at athletics (hard, desperate)"
 *   "Test Hero critically failed at stealth (standard, risky)"
 */
function buildSummary(
  characterName: string,
  testTarget: string,
  difficultyLevel: string,
  position: Position,
  outcome: OutcomeType
): string {
  const verb =
    outcome === "critical_success"
      ? "critically succeeded"
      : outcome === "success"
        ? "succeeded"
        : outcome === "partial"
          ? "partially succeeded"
          : outcome === "critical_failure"
            ? "critically failed"
            : "failed";
  return `${characterName} ${verb} at ${testTarget} (${difficultyLevel}, ${position})`;
}

/**
 * Roll test tool definition
 */
export const rollTestTool = defineSharedTool({
  name: "roll_test",
  description:
    "Perform a skill or ability test for a character. Rolls d20 + ability + skill + modifiers vs difficulty. Supports advantage/disadvantage. Returns an envelope with `outcome` (five-tier) and a one-line `summary` as the headline; mechanical detail is in `result`, follow-up moves in `suggested_next`.",
  inputSchema: RollTestInputSchema,
  emits: [EventTypes.TEST_RESOLVED],

  // Gate: session must exist + the character must be addressable
  // (by UUID or — same fallback the handler does — by case-insensitive
  // name match, with ambiguity rejected). The handler can still
  // resolve the character but a denial here gives the LLM a list of
  // available character names so it can fix the call on the next
  // turn instead of bouncing through a thrown error.
  gate: async (input, ctx) => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      return { allow: false, reason: `Session not found: ${input.sessionId}.` };
    }
    const characters = session.characters ?? {};
    if (characters[input.characterId]) return { allow: true };
    const lookup = input.characterId.trim().toLowerCase();
    const matches = Object.values(characters).filter((c) => c.name.toLowerCase() === lookup);
    if (matches.length === 1) return { allow: true };
    if (matches.length > 1) {
      return {
        allow: false,
        reason: `Ambiguous character "${input.characterId}" — matches ${matches.length} characters. Pass the UUID instead.`,
      };
    }
    const available = Object.values(characters)
      .map((c) => `"${c.name}"`)
      .join(", ");
    return {
      allow: false,
      reason: `Character not found: "${input.characterId}". Available: ${available || "(none)"}.`,
    };
  },

  handler: async (input, ctx): Promise<RollTestEnvelope> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Resolve characterId: the schema asks for the UUID, but agents
    // routinely pass the character's display name instead. Fall back
    // to a case-insensitive name match before throwing — the mistake
    // is consistent enough that hard-failing wastes a turn round-trip
    // and the agent keeps re-trying with the same wrong arg.
    const characters = session.characters ?? {};
    let character: Character | undefined = characters[input.characterId];
    if (!character) {
      const lookup = input.characterId.trim().toLowerCase();
      const matches = Object.values(characters).filter((c) => c.name.toLowerCase() === lookup);
      if (matches.length > 1) {
        throw new Error(
          `Ambiguous character name "${input.characterId}" matches ${matches.length} characters; pass the character UUID instead.`
        );
      }
      character = matches[0];
    }
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    // Load rules context for the session — needed both to resolve the
    // difficulty target (worlds may replace/override the EASY/STANDARD/…
    // table) and by resolveTest itself.
    const rules = (await ctx.getRules(session)) as RulesContext;

    // Resolve difficulty against the world's difficulty table. Falls
    // back to the hard-coded DIFFICULTY enum only when the world
    // doesn't define the requested level. `roll_custom_test` is the
    // escape hatch for an exact numeric DC.
    const difficultyId = input.difficulty.toUpperCase();
    const difficulty =
      rules.rules.difficultyMap.get(difficultyId)?.target ??
      DIFFICULTY[difficultyId as keyof typeof DIFFICULTY] ??
      DIFFICULTY.STANDARD;

    const rng = createRNG(session.rng);

    const result = resolveTest({
      character,
      skill: input.skill,
      ability: input.ability,
      difficulty,
      modifiers: input.modifiers as Modifier[],
      rng,
      advantageSources: input.advantageSources,
      disadvantageSources: input.disadvantageSources,
      rules,
      position: input.position,
      effectLevel: input.effectLevel,
    });

    // Update session RNG
    session.rng = rng.getState();
    await ctx.sessions.save(session);

    // Critical status is derived from the rules-aware outcome, not the
    // raw dice roll (a world's CriticalsConfig may differ from nat 20/1).
    const criticalDiscriminator = criticalFromOutcome(result.outcome);

    // Build roll info with advantage details
    const rollInfo: RollTestResult["roll"] = {
      natural: result.roll.natural,
      total: result.roll.total,
      critical: criticalDiscriminator,
    };
    if (result.roll.advantage) {
      rollInfo.advantage = {
        bothRolls: result.roll.advantage.bothRolls,
        selected: result.roll.advantage.selected,
      };
    }

    // Emit event for real-time sync — `ctx.currentTurnId` groups
    // this row under the parent chat turn in gameplay_events.
    // Use `character.id` (canonical UUID) rather than `input.characterId`,
    // which the name-fallback path above may have resolved from a display
    // name. Consumers expect a stable ID.
    emitTestResolved(
      ctx.eventBus,
      input.sessionId,
      {
        characterId: character.id,
        characterName: character.name,
        skill: result.skill || undefined,
        ability: result.ability,
        success: result.success,
        margin: result.margin,
        roll: result.roll.natural,
        critical: criticalDiscriminator,
      },
      "roll_test",
      ctx.currentTurnId
    );

    // GM moves + consequence-guidance composition lives in @mythxengine/types
    // (single source of truth — the gate is inside getGMMoves itself).
    const position = result.position ?? "risky";
    const effectLevel = result.effectLevel ?? "standard";
    const suggestedMoves = getGMMoves(result.outcome, position);
    const outcomeLabel =
      result.outcome === "partial"
        ? "Partial success"
        : result.outcome === "critical_failure"
          ? "Critical failure"
          : "Failure";
    const consequenceGuidance = buildConsequenceGuidance(result.outcome, position, outcomeLabel);

    // Push is available for failure and partial outcomes
    const pushAvailable = result.outcome === "failure" || result.outcome === "partial";

    // Auto-tick clocks on partial/failure if specified
    const clocksTicked = autoTickClocks(
      session,
      result.outcome,
      input.autoTickClockIds,
      ctx.eventBus,
      input.sessionId,
      "roll_test",
      ctx.currentTurnId
    );

    // Save session again if clocks were ticked
    if (clocksTicked) {
      await ctx.sessions.save(session);
    }

    const innerResult: RollTestResult = {
      character: character.name,
      characterId: character.id,
      skill: result.skill || null,
      ability: result.ability,
      difficulty: result.difficulty,
      advantageState: result.advantageState,
      roll: rollInfo,
      modifiers: {
        ability: result.abilityMod,
        skill: result.skillBonus,
        other: result.otherMods,
        total: result.totalMod,
      },
      margin: result.margin,
      critical: result.critical,
      position,
      effectLevel,
    };

    const stateDelta: RollTestStateDelta = {
      rng_advanced: true,
      push_available: pushAvailable,
    };
    if (clocksTicked) {
      stateDelta.clocks_ticked = clocksTicked;
    }

    const suggestedNext: RollTestSuggestedNext = {};
    if (suggestedMoves) {
      suggestedNext.gm_moves = suggestedMoves;
    }
    if (consequenceGuidance) {
      suggestedNext.consequence_guidance = consequenceGuidance;
    }

    return {
      status: "ok",
      outcome: result.outcome,
      summary: buildSummary(
        character.name,
        result.skill || result.ability,
        input.difficulty,
        position,
        result.outcome
      ),
      result: innerResult,
      state_delta: stateDelta,
      suggested_next: suggestedNext,
    };
  },
});
