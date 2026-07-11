/**
 * Outcome determination for three-tier resolution
 */

import type { OutcomeType, OutcomeThresholdsConfig, CriticalsConfig } from "@mythxengine/types";
import {
  isSuccessful as isSuccessfulType,
  isPartialOrWorse as isPartialOrWorseType,
  outcomeAllowsEffect as outcomeAllowsEffectType,
  outcomeSeverity as outcomeSeverityType,
  DEFAULT_OUTCOME_THRESHOLDS,
} from "@mythxengine/types";

// Re-export type utilities for convenience
export const isSuccessful = isSuccessfulType;
export const isPartialOrWorse = isPartialOrWorseType;
export const outcomeAllowsEffect = outcomeAllowsEffectType;
export const outcomeSeverity = outcomeSeverityType;
export { DEFAULT_OUTCOME_THRESHOLDS };

/**
 * Determine the outcome based on margin and critical rolls
 *
 * @param margin - The roll total minus difficulty (positive = beat DC)
 * @param natural - The natural die roll (for critical detection)
 * @param thresholds - Margin thresholds for each outcome tier
 * @param criticalRolls - Which natural rolls are critical success/failure
 * @returns The determined outcome type
 */
export function determineOutcome(
  margin: number,
  natural: number,
  thresholds: OutcomeThresholdsConfig,
  criticalRolls: { success: number[]; failure: number[] }
): OutcomeType {
  // Critical rolls override margin-based determination
  if (criticalRolls.success.includes(natural)) {
    return "critical_success";
  }
  if (criticalRolls.failure.includes(natural)) {
    return "critical_failure";
  }

  // Margin-based determination
  if (margin >= thresholds.criticalSuccess) {
    return "critical_success";
  }
  if (margin >= thresholds.success) {
    return "success";
  }
  if (margin >= thresholds.partial) {
    return "partial";
  }
  return "failure";
}

/**
 * Determine outcome from mechanics config
 *
 * Respects autoSuccess/autoFailure flags - if false, critical rolls
 * are not passed through and only margin-based determination is used.
 */
export function determineOutcomeFromConfig(
  margin: number,
  natural: number,
  thresholds: OutcomeThresholdsConfig,
  criticals: CriticalsConfig
): OutcomeType {
  return determineOutcome(margin, natural, thresholds, {
    success: criticals.autoSuccess ? criticals.successOn : [],
    failure: criticals.autoFailure ? criticals.failureOn : [],
  });
}

/**
 * Convert outcome to legacy success boolean (for backwards compatibility)
 */
export function outcomeToSuccess(outcome: OutcomeType): boolean {
  return isSuccessful(outcome);
}

/**
 * Convert outcome to legacy hit boolean (for combat backwards compatibility)
 * Note: partial is NOT a hit in legacy terms
 */
export function outcomeToHit(outcome: OutcomeType): boolean {
  return isSuccessful(outcome);
}

/**
 * Check if outcome should tick a clock (partial or worse)
 * Per design decision: partial success also ticks threat clocks
 */
export function outcomeShouldTickClock(outcome: OutcomeType): boolean {
  return isPartialOrWorse(outcome);
}
