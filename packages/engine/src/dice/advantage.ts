/**
 * Advantage/disadvantage rolling mechanics
 *
 * Implements D&D 5e-style advantage/disadvantage:
 * - Advantage: Roll 2d20, take the higher
 * - Disadvantage: Roll 2d20, take the lower
 * - Any advantage + any disadvantage = normal roll (they cancel)
 * - Multiple advantages don't stack (still just 1 advantage)
 */

import type { DiceResult, RollAdvantageState, AdvantageInfo, Abilities } from "@mythxengine/types";
import type { RNG } from "../rng/rng.js";
import { parseDice } from "./parser.js";

/**
 * Calculate the net advantage state from sources
 *
 * D&D 5e rules:
 * - Any number of advantages + any number of disadvantages = normal
 * - Multiple advantages = just advantage (no stacking)
 * - Multiple disadvantages = just disadvantage (no stacking)
 */
export function calculateNetAdvantage(
  advantageSources: string[],
  disadvantageSources: string[]
): RollAdvantageState {
  const hasAdvantage = advantageSources.length > 0;
  const hasDisadvantage = disadvantageSources.length > 0;

  if (hasAdvantage && hasDisadvantage) {
    // They cancel out
    return "normal";
  }

  if (hasAdvantage) {
    return "advantage";
  }

  if (hasDisadvantage) {
    return "disadvantage";
  }

  return "normal";
}

/**
 * Roll a d20 with advantage or disadvantage
 *
 * @param rng - Random number generator
 * @param advantageState - Whether to roll with advantage, disadvantage, or normal
 * @returns Object with the selected roll and advantage info
 */
export function rollD20WithAdvantage(
  rng: RNG,
  advantageState: RollAdvantageState
): { natural: number; advantageInfo?: AdvantageInfo } {
  if (advantageState === "normal") {
    return { natural: rng.nextInt(1, 20) };
  }

  // Roll two d20s
  const roll1 = rng.nextInt(1, 20);
  const roll2 = rng.nextInt(1, 20);

  const isAdvantage = advantageState === "advantage";
  const selected = isAdvantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2);

  return {
    natural: selected,
    advantageInfo: {
      type: advantageState,
      bothRolls: [roll1, roll2],
      selected: isAdvantage ? "higher" : "lower",
    },
  };
}

/**
 * Roll a dice expression with advantage/disadvantage support
 *
 * Note: Advantage/disadvantage only applies to d20 rolls.
 * For non-d20 rolls, the advantageState is ignored.
 *
 * @param expression - Dice expression (e.g., "d20", "2d6+3")
 * @param rng - Random number generator
 * @param advantageState - Whether to roll with advantage, disadvantage, or normal
 * @param abilities - Optional abilities for ability modifiers
 * @returns Dice result with advantage info if applicable
 */
export function rollWithAdvantage(
  expression: string,
  rng: RNG,
  advantageState: RollAdvantageState,
  abilities?: Abilities
): DiceResult {
  const parsed = parseDice(expression);

  // Advantage/disadvantage only applies to single d20 rolls
  const isD20Roll = parsed.count === 1 && parsed.sides === 20;

  let rolls: number[];
  let natural: number;
  let advantageInfo: AdvantageInfo | undefined;

  if (isD20Roll && advantageState !== "normal") {
    // Roll with advantage/disadvantage
    const result = rollD20WithAdvantage(rng, advantageState);
    natural = result.natural;
    advantageInfo = result.advantageInfo;
    rolls = [natural];
  } else {
    // Normal roll
    rolls = [];
    for (let i = 0; i < parsed.count; i++) {
      rolls.push(rng.nextInt(1, parsed.sides));
    }
    natural = rolls.reduce((sum, roll) => sum + roll, 0);
  }

  // Calculate modifier (including ability if specified)
  let modifier = parsed.modifier;
  if (parsed.ability && abilities) {
    modifier += abilities[parsed.ability];
  }

  // Calculate total
  const total = natural + modifier;

  return {
    expression,
    rolls,
    modifier,
    total,
    natural,
    advantage: advantageInfo,
  };
}
