/**
 * Dice and RNG types
 */

import type { AbilityName } from "./abilities.js";
import type { OutcomeType, Position, EffectLevel } from "./outcome.js";

/**
 * RNG state for deterministic randomness
 */
export interface RNGState {
  seed: number;
  cursor: number;
}

/**
 * Advantage state for a roll
 */
export type RollAdvantageState = "advantage" | "disadvantage" | "normal";

/**
 * Information about an advantage/disadvantage roll
 */
export interface AdvantageInfo {
  type: "advantage" | "disadvantage";
  bothRolls: [number, number];
  selected: "higher" | "lower";
}

/**
 * Result of a dice roll.
 *
 * Note: this is the raw mechanical dice result. It deliberately does **not**
 * carry a critical-success/failure flag — that determination requires a
 * world's `CriticalsConfig` and is made at the resolution layer. Use the
 * `outcome` field on {@link TestResult} / {@link AttackResult} (or its
 * helpers) to derive critical status.
 */
export interface DiceResult {
  /** Original expression, e.g., "2d6+3" */
  expression: string;
  /** Individual die results, e.g., [4, 2] */
  rolls: number[];
  /** Flat modifier */
  modifier: number;
  /** Final total */
  total: number;
  /** Sum before modifier */
  natural: number;
  /** Advantage/disadvantage info if applicable */
  advantage?: AdvantageInfo;
}

/**
 * Parsed dice expression
 */
export interface ParsedDice {
  count: number;
  sides: number;
  modifier: number;
  ability?: AbilityName;
}

/**
 * A modifier to a roll
 */
export interface Modifier {
  source: string;
  amount: number;
}

/**
 * Result of a clock tick
 */
export interface ClockTickResult {
  clockId: string;
  newStage: number;
}

/**
 * Result of a skill/ability test
 */
export interface TestResult {
  skill: string;
  ability: AbilityName;
  abilityMod: number;
  skillBonus: number;
  otherMods: number;
  totalMod: number;
  difficulty: number;
  roll: DiceResult;
  /** @deprecated Use outcome instead. Kept for backwards compatibility. */
  success: boolean;
  margin: number;
  critical: boolean;
  /** The advantage state used for this test */
  advantageState: RollAdvantageState;

  // Three-tier outcome fields (FitD/PbtA style)
  /** Primary outcome - use this instead of success boolean */
  outcome: OutcomeType;
  /** Position (risk level) used for this test */
  position?: Position;
  /** Effect level (impact) for this test */
  effectLevel?: EffectLevel;
}

/**
 * Standard difficulty levels
 */
export const DIFFICULTY = {
  EASY: 8,
  STANDARD: 12,
  HARD: 16,
  EXTREME: 20,
} as const;

export type DifficultyLevel = keyof typeof DIFFICULTY;
