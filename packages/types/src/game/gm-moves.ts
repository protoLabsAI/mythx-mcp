/**
 * GM Moves - Structured guidance for AI GM on partial/failure outcomes
 *
 * Inspired by PbtA "moves" that the GM makes when players fail.
 */

import type { OutcomeType, Position } from "./outcome.js";

/**
 * Types of GM moves that can be made on partial/failure outcomes.
 *
 * @remarks
 * GM moves are structured consequences suggested by the system based on
 * outcome + position. Inspired by PbtA "moves" that keep the narrative
 * moving forward even on failure.
 *
 * The system automatically suggests 2-3 moves based on the combination of
 * {@link OutcomeType} and {@link Position}. The GM selects the one that
 * best fits the current fiction.
 *
 * @example
 * ```typescript
 * // Partial hit at risky position
 * suggestedMoves: ["inflict_harm", "drain_resources", "offer_hard_bargain"]
 *
 * // Failure at desperate position
 * suggestedMoves: ["inflict_harm", "use_their_flaw", "show_signs_of_doom"]
 * ```
 *
 * @see {@link getGMMoves} to get moves for a specific outcome/position
 * @see {@link GM_MOVE_DESCRIPTIONS} for detailed descriptions of each move
 */
export type GMMove =
  | "reveal_unwelcome_truth" // Share information that complicates things
  | "show_signs_of_doom" // Foreshadow coming threat
  | "offer_hard_bargain" // Success at a cost (choice)
  | "tick_clock" // Advance a threat/progress clock
  | "separate_party" // Split the group physically
  | "put_someone_in_spot" // Endanger an NPC or PC
  | "use_their_flaw" // Leverage character weakness/psychology
  | "drain_resources" // Consume supplies, stress, HP, or time
  | "turn_move_against_them" // Action backfires
  | "inflict_harm"; // Deal damage directly

/**
 * Descriptions of each GM move for reference
 */
export const GM_MOVE_DESCRIPTIONS: Record<GMMove, string> = {
  reveal_unwelcome_truth: "Share information that changes the situation or complicates things",
  show_signs_of_doom: "Hint at coming danger, foreshadow threats",
  offer_hard_bargain: "Give a choice with meaningful cost attached",
  tick_clock: "Advance a countdown clock (threat or progress)",
  separate_party: "Physically split the group or isolate someone",
  put_someone_in_spot: "Endanger an NPC or put another PC at risk",
  use_their_flaw: "Leverage character psychology, fears, or flaws",
  drain_resources: "Deplete equipment, supplies, stress, or time",
  turn_move_against_them: "The action backfires or has unintended consequences",
  inflict_harm: "Deal direct damage (scaled by position)",
};

/**
 * Matrix mapping Position + Outcome to suggested GM moves
 *
 * - Controlled: Minor setbacks
 * - Risky: Moderate complications + some harm
 * - Desperate: Severe harm guaranteed
 */
export const GM_MOVE_MATRIX: Record<Position, Partial<Record<OutcomeType, GMMove[]>>> = {
  controlled: {
    partial: ["drain_resources", "reveal_unwelcome_truth"],
    failure: ["show_signs_of_doom", "offer_hard_bargain"],
    critical_failure: ["tick_clock", "separate_party"],
  },
  risky: {
    partial: ["inflict_harm", "drain_resources", "offer_hard_bargain"],
    failure: ["inflict_harm", "put_someone_in_spot", "tick_clock"],
    critical_failure: ["inflict_harm", "use_their_flaw", "separate_party"],
  },
  desperate: {
    partial: ["inflict_harm", "tick_clock"],
    failure: ["inflict_harm", "use_their_flaw", "show_signs_of_doom"],
    critical_failure: ["inflict_harm", "turn_move_against_them", "tick_clock"],
  },
};

/**
 * Context provided to the GM for making moves
 */
export interface GMMoveContext {
  /** The outcome that triggered the move */
  outcome: OutcomeType;
  /** The position (risk level) of the action */
  position: Position;
  /** Suggested moves based on outcome and position */
  suggestedMoves: GMMove[];
  /** Narrative guidance for the GM */
  narrativeGuidance: string;
}

/**
 * Outcomes that warrant GM moves (partial/failure/critical_failure).
 * Full and critical successes do not — there's no consequence to suggest.
 */
function outcomeWarrantsMove(outcome: OutcomeType): boolean {
  return outcome === "partial" || outcome === "failure" || outcome === "critical_failure";
}

/**
 * Get suggested GM moves for an outcome and position.
 *
 * Returns `undefined` when the outcome does not warrant a move
 * (success / critical_success). This is the single gate — callers
 * should not branch on outcome themselves.
 */
export function getGMMoves(
  outcome: OutcomeType,
  position: Position = "risky"
): GMMove[] | undefined {
  if (!outcomeWarrantsMove(outcome)) return undefined;
  return GM_MOVE_MATRIX[position]?.[outcome] ?? [];
}

/**
 * Map a position to a consequence-severity word for guidance text.
 */
export function getConsequenceSeverity(position: Position): "minor" | "moderate" | "severe" {
  if (position === "controlled") return "minor";
  if (position === "desperate") return "severe";
  return "moderate";
}

/**
 * Build a one-line consequence-guidance sentence for the given outcome,
 * position, and domain label. Returns `undefined` when the outcome doesn't
 * warrant guidance.
 *
 * @param outcomeLabel - Domain-specific descriptor for the outcome — e.g.
 *   "Partial success" / "Failure" for tests, "Partial hit (graze)" / "Miss"
 *   for attacks.
 */
export function buildConsequenceGuidance(
  outcome: OutcomeType,
  position: Position,
  outcomeLabel: string
): string | undefined {
  const moves = getGMMoves(outcome, position);
  if (!moves || moves.length === 0) return undefined;
  const severity = getConsequenceSeverity(position);
  return `${outcomeLabel} at ${position} position. Apply a ${severity} consequence: ${moves
    .slice(0, 2)
    .join(" or ")}.`;
}

/**
 * Generate narrative guidance based on outcome and position.
 * Returns `undefined` for outcomes that don't warrant a move.
 */
export function getNarrativeGuidance(outcome: OutcomeType, position: Position): string | undefined {
  if (!outcomeWarrantsMove(outcome)) return undefined;
  const templates: Record<Position, Partial<Record<OutcomeType, string>>> = {
    controlled: {
      partial: "Minor setback - something goes slightly wrong but no real danger",
      failure: "Complication arises - the situation changes but no immediate harm",
      critical_failure: "Unexpected problem - something significant goes wrong",
    },
    risky: {
      partial: "Success with a cost - they achieve their goal but something bad also happens",
      failure: "Things go wrong - harm or serious complication follows",
      critical_failure: "Disaster - severe consequences, possibly multiple",
    },
    desperate: {
      partial: "Barely scrape through - harm is certain, but they survive",
      failure: "Heavy price - severe harm and things get worse",
      critical_failure: "Catastrophe - the worst possible outcome",
    },
  };

  return templates[position]?.[outcome];
}

/**
 * Build full GM move context for an outcome.
 *
 * Note: returns a context with `suggestedMoves: []` and empty guidance
 * when the outcome doesn't warrant moves — this preserves the eager
 * shape for callers that want a stable struct, while {@link getGMMoves}
 * returns `undefined` for the same case to keep call sites terse.
 */
export function buildGMMoveContext(
  outcome: OutcomeType,
  position: Position = "risky"
): GMMoveContext {
  return {
    outcome,
    position,
    suggestedMoves: getGMMoves(outcome, position) ?? [],
    narrativeGuidance: getNarrativeGuidance(outcome, position) ?? "",
  };
}
