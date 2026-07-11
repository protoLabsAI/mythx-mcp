/**
 * Dice roller
 */

import type { DiceResult, Abilities } from "@mythxengine/types";
import type { RNG } from "../rng/rng.js";
import { parseDice } from "./parser.js";

/**
 * Roll a dice expression
 *
 * @param expression - Dice expression (e.g., "2d6+3")
 * @param rng - Random number generator
 * @param abilities - Optional abilities for ability modifiers
 * @returns Dice result with all roll details
 */
export function rollDice(expression: string, rng: RNG, abilities?: Abilities): DiceResult {
  const parsed = parseDice(expression);

  // Roll each die
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(rng.nextInt(1, parsed.sides));
  }

  // Calculate natural total (sum of dice)
  const natural = rolls.reduce((sum, roll) => sum + roll, 0);

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
  };
}

/**
 * Roll a simple die (e.g., d20, d6)
 */
export function rollDie(sides: number, rng: RNG): number {
  return rng.nextInt(1, sides);
}

/**
 * Roll multiple dice and sum
 */
export function rollNd(count: number, sides: number, rng: RNG): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rng.nextInt(1, sides);
  }
  return total;
}
