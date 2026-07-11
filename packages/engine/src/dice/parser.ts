/**
 * Dice expression parser
 *
 * Supports formats:
 * - "d20" -> 1d20+0
 * - "2d6" -> 2d6+0
 * - "1d8+3" -> 1d8+3
 * - "d6-1" -> 1d6-1
 * - "d20+STR" -> 1d20+0 with ability: "STR"
 */

import type { ParsedDice, AbilityName } from "@mythxengine/types";

const DICE_REGEX = /^(\d*)d(\d+)(?:([+-])(\d+|STR|AGI|WIT|CON))?$/i;

const ABILITY_NAMES = new Set(["STR", "AGI", "WIT", "CON"]);

/**
 * Parse a dice expression string
 * @throws Error if expression is invalid
 */
export function parseDice(expression: string): ParsedDice {
  const trimmed = expression.trim();
  const match = trimmed.match(DICE_REGEX);

  if (!match) {
    throw new Error(`Invalid dice expression: ${expression}`);
  }

  const [, countStr, sidesStr, sign, modifierStr] = match;

  const count = countStr ? parseInt(countStr, 10) : 1;
  const sides = parseInt(sidesStr, 10);

  if (count < 1 || count > 100) {
    throw new Error(`Invalid dice count: ${count}`);
  }

  if (sides < 1 || sides > 100) {
    throw new Error(`Invalid dice sides: ${sides}`);
  }

  // Parse modifier
  let modifier = 0;
  let ability: AbilityName | undefined;

  if (modifierStr) {
    const upperMod = modifierStr.toUpperCase();
    if (ABILITY_NAMES.has(upperMod)) {
      ability = upperMod as AbilityName;
    } else {
      modifier = parseInt(modifierStr, 10);
      if (sign === "-") {
        modifier = -modifier;
      }
    }
  }

  return { count, sides, modifier, ability };
}

/**
 * Check if a string is a valid dice expression
 */
export function isValidDiceExpression(expression: string): boolean {
  try {
    parseDice(expression);
    return true;
  } catch {
    return false;
  }
}
