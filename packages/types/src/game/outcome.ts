/**
 * Three-tier outcome types for FitD/PbtA-style resolution
 */

/**
 * Five-tier outcome system inspired by Forged in the Dark.
 *
 * @remarks
 * Every `roll_test` and `attack` resolves to one of five outcomes based on the roll margin:
 * - **critical_success**: Margin ≥10 or natural 20 - Full success + bonus effect
 * - **success**: Margin ≥0 - Full intended effect
 * - **partial**: Margin -4 to -1 - "Yes, but..." effect + complication
 * - **failure**: Margin <-4 - No success + GM move
 * - **critical_failure**: Natural 1 - Disaster, severe consequences
 *
 * @example
 * ```typescript
 * const result = await rollTest({ skill: "combat", difficulty: 12 });
 * switch (result.outcome) {
 *   case "critical_success":
 *     // Grant extra benefit
 *     break;
 *   case "success":
 *     // Full success as stated
 *     break;
 *   case "partial":
 *     // Success with complication (use suggestedMoves)
 *     break;
 *   case "failure":
 *   case "critical_failure":
 *     // Apply consequence (use suggestedMoves)
 *     break;
 * }
 * ```
 */
export type OutcomeType =
  | "critical_success"
  | "success"
  | "partial"
  | "failure"
  | "critical_failure";

/**
 * Risk level for an action, determines consequences on failure.
 *
 * @remarks
 * Position is set before rolling to calibrate consequence severity:
 * - **controlled**: Safe approach, minor consequences on failure (e.g., "extra time", "drain resources")
 * - **risky**: Standard stakes, moderate consequences (default for most rolls)
 * - **desperate**: High danger, severe consequences (e.g., "serious harm", "turn move against them")
 *
 * Position combines with outcome to determine which GM moves are suggested.
 * See {@link getGMMoves} for the full matrix.
 *
 * @example
 * ```typescript
 * // Sneaking past guards with good cover
 * position: "controlled"
 *
 * // Standard combat attack
 * position: "risky"
 *
 * // Jumping between rooftops while pursued
 * position: "desperate"
 * ```
 */
export type Position = "controlled" | "risky" | "desperate";

/**
 * Impact level for an action, determines the scope of success.
 *
 * @remarks
 * Effect level is set before rolling to communicate expected impact:
 * - **limited**: Minimal impact, partial progress even on success
 * - **standard**: Normal impact, expected result (default)
 * - **great**: Significant impact, exceptional result beyond normal
 *
 * Effect level helps frame expectations and can be influenced by approach,
 * tools, abilities, or circumstances.
 *
 * @example
 * ```typescript
 * // Lockpicking with improvised tools
 * effectLevel: "limited"
 *
 * // Standard attack with proper weapon
 * effectLevel: "standard"
 *
 * // Flanking attack with advantage
 * effectLevel: "great"
 * ```
 */
export type EffectLevel = "limited" | "standard" | "great";

/**
 * Effect-level → damage/clock multiplier.
 *
 * Engine-side helper used by `resolveAttack` and (via the tools layer)
 * by `autoTickClocks` to scale magnitude. The numbers are deliberately
 * symmetric — half / full / one-and-a-half — so a "great" effect feels
 * meaningfully better than "standard" without breaking encounter math.
 *
 * Not a static map: callers want to multiply integers (damage, clock
 * stages) and `Math.floor` after, so returning a number keeps the
 * arithmetic in one place.
 */
export function effectLevelToMultiplier(level: EffectLevel | undefined): number {
  switch (level) {
    case "limited":
      return 0.5;
    case "great":
      return 1.5;
    case "standard":
    case undefined:
      return 1;
  }
}

/**
 * Thresholds for determining outcomes based on margin
 */
export interface OutcomeThresholds {
  /** Margin >= this is critical success (default: 10) */
  criticalSuccess: number;
  /** Margin >= this is success (default: 0) */
  success: number;
  /** Margin >= this is partial success (default: -4) */
  partial: number;
  // Below partial is failure
  // Critical rolls override margin-based calculation
}

/**
 * Default outcome thresholds
 * Partial range of -4 to -1 means ~20% of failures become partial
 */
export const DEFAULT_OUTCOME_THRESHOLDS: OutcomeThresholds = {
  criticalSuccess: 10,
  success: 0,
  partial: -4,
};

/**
 * Check if an outcome represents success (full or critical)
 */
export function isSuccessful(outcome: OutcomeType): boolean {
  return outcome === "critical_success" || outcome === "success";
}

/**
 * Check if an outcome is partial or worse (not full success)
 */
export function isPartialOrWorse(outcome: OutcomeType): boolean {
  return !isSuccessful(outcome);
}

/**
 * Check if an outcome allows some effect (partial or better)
 */
export function outcomeAllowsEffect(outcome: OutcomeType): boolean {
  return outcome !== "failure" && outcome !== "critical_failure";
}

/**
 * Get numeric severity of an outcome (for comparison)
 * Higher is better
 */
export function outcomeSeverity(outcome: OutcomeType): number {
  const severityMap: Record<OutcomeType, number> = {
    critical_success: 4,
    success: 3,
    partial: 2,
    failure: 1,
    critical_failure: 0,
  };
  return severityMap[outcome];
}

/**
 * Derive the critical-roll discriminator (`"success" | "failure" | undefined`)
 * from a five-tier outcome. The dice layer no longer carries a critical flag —
 * critical status is a function of the world's {@link CriticalsConfig} and
 * the resolved outcome.
 */
export function criticalFromOutcome(outcome: OutcomeType): "success" | "failure" | undefined {
  if (outcome === "critical_success") return "success";
  if (outcome === "critical_failure") return "failure";
  return undefined;
}
