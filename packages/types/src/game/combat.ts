/**
 * Combat types
 */

import type { DiceResult, RollAdvantageState, ClockTickResult } from "./dice.js";
import type { OutcomeType, EffectLevel, Position } from "./outcome.js";

/**
 * Combat state when combat is active
 */
export interface CombatState {
  active: boolean;
  round: number;
  /** Character/enemy IDs in initiative order */
  turnOrder: string[];
  /** ID of current actor */
  currentTurnId: string;
  /** Index in turn order */
  turnIndex: number;
}

/**
 * Result of an initiative roll
 */
export interface InitiativeResult {
  characterId: string;
  roll: DiceResult;
  total: number;
}

/**
 * Damage modification due to resistance/vulnerability
 */
export interface DamageModification {
  originalDamage: number;
  finalDamage: number;
  reason: "resistance" | "vulnerability";
  damageType: string;
}

/**
 * Result of an attack
 */
export interface AttackResult {
  /** @deprecated Use outcome instead. Kept for backwards compatibility. */
  hit: boolean;
  roll: DiceResult;
  damage?: number;
  critical?: "hit" | "miss";
  defenderHpRemaining?: number;
  /** The advantage state used for this attack */
  advantageState: RollAdvantageState;
  /** Damage modification info if resistance/vulnerability applied */
  damageModification?: DamageModification;

  // Three-tier outcome fields (FitD/PbtA style)
  /** Primary outcome - use this instead of hit boolean */
  outcome: OutcomeType;
  /** Graze damage for partial hits (50% of full damage) */
  grazeDamage?: number;
  /** Clocks that were ticked automatically */
  clocksTicked?: ClockTickResult[];
  /** Position (risk level) used for this attack */
  position?: Position;
  /**
   * Effect level (impact) used for this attack. Engine multiplies the
   * post-armor / post-resistance damage by `effectLevelToMultiplier`
   * (limited 0.5×, standard 1×, great 1.5×) before returning. The same
   * multiplier is applied to grazeDamage on partial hits so a "great"
   * graze still lands meaningfully and a "limited" full hit still
   * registers but doesn't truck through the defender.
   */
  effectLevel?: EffectLevel;
}

/**
 * Result of a defense action
 */
export interface DefenseResult {
  bonus: number;
  duration: number;
}
