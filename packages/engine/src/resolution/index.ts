/**
 * Resolution exports
 */

export { resolveTest, type TestOptions } from "./test.js";
export { resolveAttack, type AttackOptions } from "./combat.js";
export { calculateDamage, calculateHealing, type DamageResult } from "./damage.js";
export { rollInitiative, rollInitiativeDetailed } from "./initiative.js";

// Three-tier outcome system
export {
  determineOutcome,
  determineOutcomeFromConfig,
  outcomeToSuccess,
  outcomeToHit,
  outcomeShouldTickClock,
  isSuccessful,
  isPartialOrWorse,
  outcomeAllowsEffect,
  outcomeSeverity,
  DEFAULT_OUTCOME_THRESHOLDS,
} from "./outcome.js";

// Stress mechanics
export {
  pushRoll,
  resistConsequence,
  recoverStress,
  executeFlashback,
  ensureStressTracker,
  canAffordStress,
  type PushResult,
  type ResistResult,
  type RecoveryResult,
  type FlashbackResult,
  type PushOptions,
  type ResistOptions,
  type RecoveryOptions,
  type FlashbackOptions,
  type ConsequenceSeverity,
} from "./stress.js";
