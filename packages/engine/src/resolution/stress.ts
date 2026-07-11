/**
 * Stress mechanics for FitD-style push/resist
 */

import type {
  Character,
  AbilityName,
  StressConfig,
  StressTracker,
  ConsequenceSeverity,
} from "@mythxengine/types";
import { BASE_STRESS } from "@mythxengine/types";
import type { RNG } from "../rng/rng.js";
import { rollDice } from "../dice/roller.js";

export type { ConsequenceSeverity };

/**
 * Result of pushing a roll
 */
export interface PushResult {
  /** Bonus to add to the roll */
  bonus: number;
  /** The bonus roll details */
  bonusRoll: {
    expression: string;
    total: number;
    rolls: number[];
  };
  /** Updated stress value */
  newStress: number;
  /** Whether trauma was triggered (exceeded max) */
  traumaTriggered: boolean;
  /** Cost paid */
  stressCost: number;
}

/**
 * Result of resisting a consequence
 */
export interface ResistResult {
  /** Whether the resistance roll reduced the cost */
  reduced: boolean;
  /** The resistance roll */
  resistRoll?: {
    total: number;
    abilityMod: number;
  };
  /** Base cost from severity table (before reduction) */
  baseCost: number;
  /** Actual stress cost paid */
  stressCost: number;
  /** Updated stress value */
  newStress: number;
  /** Whether trauma was triggered */
  traumaTriggered: boolean;
}

/**
 * Result of stress recovery
 */
export interface RecoveryResult {
  /** Amount of stress recovered */
  recovered: number;
  /** Updated stress value */
  newStress: number;
}

/**
 * Options for pushing a roll
 */
export interface PushOptions {
  rng: RNG;
  currentStress: number;
  maxStress: number;
  config?: Partial<StressConfig>;
}

/**
 * Push a roll by spending stress for bonus dice
 *
 * @param options - Push options
 * @returns Push result with bonus and new stress
 */
export function pushRoll(options: PushOptions): PushResult {
  const config = { ...BASE_STRESS, ...options.config };
  const bonusRoll = rollDice(config.pushBonus, options.rng);
  const newStress = options.currentStress + config.pushCost;
  const traumaTriggered = newStress > options.maxStress;

  return {
    bonus: bonusRoll.total,
    bonusRoll: {
      expression: config.pushBonus,
      total: bonusRoll.total,
      rolls: bonusRoll.rolls,
    },
    newStress: Math.min(newStress, options.maxStress),
    traumaTriggered,
    stressCost: config.pushCost,
  };
}

/**
 * Options for resisting a consequence
 */
export interface ResistOptions {
  character: Character;
  resistAbility: AbilityName;
  severity: ConsequenceSeverity;
  rng: RNG;
  config?: Partial<StressConfig>;
}

/**
 * Resist a consequence by spending stress.
 *
 * Roll d6 + ability to potentially reduce stress cost. The base cost,
 * threshold, and reduction floor all come from {@link StressConfig}.
 */
export function resistConsequence(options: ResistOptions): ResistResult {
  const config = { ...BASE_STRESS, ...options.config };

  const baseCost = config.resistSeverityCosts[options.severity];

  const currentStress = options.character.stress?.current ?? 0;
  const maxStress = options.character.stress?.max ?? config.maxStress;

  const abilityMod = options.character.abilities[options.resistAbility] ?? 0;
  const rollResult = rollDice("d6", options.rng);
  const resistTotal = rollResult.total + abilityMod;

  const reduced = resistTotal >= config.resistThreshold;
  const finalCost = reduced ? Math.max(1, baseCost - 1) : baseCost;

  const newStress = currentStress + finalCost;
  const traumaTriggered = newStress > maxStress;

  return {
    reduced,
    resistRoll: {
      total: resistTotal,
      abilityMod,
    },
    baseCost,
    stressCost: finalCost,
    newStress: Math.min(newStress, maxStress),
    traumaTriggered,
  };
}

/**
 * Options for stress recovery
 */
export interface RecoveryOptions {
  character: Character;
  restType: "short" | "long";
  bonuses?: number;
  config?: Partial<StressConfig>;
}

/**
 * Recover stress during rest
 *
 * @param options - Recovery options
 * @returns Recovery result with amount recovered and new stress
 */
export function recoverStress(options: RecoveryOptions): RecoveryResult {
  const config = { ...BASE_STRESS, ...options.config };
  const currentStress = options.character.stress?.current ?? 0;

  // Determine recovery amount
  let recovery: number;
  if (options.restType === "long") {
    recovery = config.recoveryPerLongRest === "all" ? currentStress : config.recoveryPerLongRest;
  } else {
    recovery = config.recoveryPerShortRest;
  }

  // Add any bonuses (from abilities, conditions, etc.)
  recovery += options.bonuses ?? 0;

  // Can't recover more than current stress
  const actualRecovered = Math.min(recovery, currentStress);

  return {
    recovered: actualRecovered,
    newStress: currentStress - actualRecovered,
  };
}

/**
 * Result of a flashback
 */
export interface FlashbackResult {
  /** Stress cost paid */
  stressCost: number;
  /** Updated stress value */
  newStress: number;
  /** Whether trauma was triggered */
  traumaTriggered: boolean;
}

/**
 * Options for flashback
 */
export interface FlashbackOptions {
  character: Character;
  config?: Partial<StressConfig>;
}

/**
 * Execute a flashback (retroactive preparation).
 *
 * Cost comes from {@link StressConfig.flashbackCost} (default 2).
 */
export function executeFlashback(options: FlashbackOptions): FlashbackResult {
  const config = { ...BASE_STRESS, ...options.config };
  const currentStress = options.character.stress?.current ?? 0;
  const maxStress = options.character.stress?.max ?? config.maxStress;

  const newStress = currentStress + config.flashbackCost;
  const traumaTriggered = newStress > maxStress;

  return {
    stressCost: config.flashbackCost,
    newStress: Math.min(newStress, maxStress),
    traumaTriggered,
  };
}

/**
 * Initialize stress tracker with defaults if not present
 */
export function ensureStressTracker(
  character: Character,
  config?: Partial<StressConfig>
): StressTracker {
  if (character.stress) {
    return character.stress;
  }
  const resolved = { ...BASE_STRESS, ...config };
  return {
    current: 0,
    max: resolved.maxStress,
  };
}

/**
 * Check if character can afford stress cost without triggering trauma
 *
 * Returns true if spending the given stress would remain at or below max.
 */
export function canAffordStress(character: Character, cost: number): boolean {
  const current = character.stress?.current ?? 0;
  const max = character.stress?.max ?? BASE_STRESS.maxStress;
  return current + cost <= max;
}
