/**
 * Custom Test Resolution
 *
 * Resolves custom tests defined in world pack rules (panic checks, sanity rolls, etc.)
 */

import type {
  CustomTestDefinition,
  CustomTestOutcome,
  TableEntry,
  Effect,
  CustomTestResult,
} from "@mythxengine/types";
import { parseFormula } from "@mythxengine/types";
import type { RNG } from "../rng/rng.js";
import { rollDice } from "../dice/roller.js";
import type { RulesContext } from "./context.js";
import { checkCriticalSuccess, checkCriticalFailure } from "./context.js";

export interface CustomTestOptions {
  /** The custom test definition to use */
  test: CustomTestDefinition;
  /** Character's ability values */
  abilities: Record<string, number>;
  /** RNG instance */
  rng: RNG;
  /** Rules context */
  ctx: RulesContext;
  /** Optional additional modifiers */
  modifiers?: number;
}

/**
 * Calculate the difficulty target for a custom test
 */
function calculateDifficulty(
  test: CustomTestDefinition,
  abilities: Record<string, number>
): number {
  const { roll } = test;

  // Fixed difficulty
  if (roll.difficulty !== undefined) {
    return roll.difficulty;
  }

  // Dynamic difficulty from formula
  if (roll.difficultyFormula) {
    const formula = parseFormula(roll.difficultyFormula);
    return Math.floor(formula(abilities));
  }

  // Roll-under: target is the ability value
  if (roll.underAbility) {
    return abilities[roll.underAbility] ?? 10;
  }

  // Default to standard difficulty
  return 12;
}

/**
 * Determine success for a custom test
 */
function determineSuccess(
  test: CustomTestDefinition,
  roll: number,
  total: number,
  target: number,
  isCritSuccess: boolean,
  isCritFail: boolean,
  ctx: RulesContext
): boolean {
  const isRollUnder = test.roll.underAbility !== undefined;
  const mechanics = ctx.rules.mechanics;

  // Critical success always succeeds (unless rules say otherwise)
  if (isCritSuccess && mechanics.criticals.autoSuccess) {
    return true;
  }

  // Critical failure always fails (unless rules say otherwise)
  if (isCritFail && mechanics.criticals.autoFailure) {
    return false;
  }

  // Roll-under: succeed if roll is <= target
  if (isRollUnder) {
    return roll <= target;
  }

  // Roll-over: succeed if total >= target
  return total >= target;
}

/**
 * Get the appropriate outcome based on result
 */
function getOutcome(
  test: CustomTestDefinition,
  success: boolean,
  isCritical: boolean
): CustomTestOutcome | undefined {
  const { outcomes } = test;

  if (success) {
    if (isCritical && outcomes.criticalSuccess) {
      return outcomes.criticalSuccess;
    }
    return outcomes.success;
  } else {
    if (isCritical && outcomes.criticalFailure) {
      return outcomes.criticalFailure;
    }
    return outcomes.failure;
  }
}

/**
 * Roll on an outcome table
 */
function rollOnTable(
  table: { dice: string; addAbility?: string; entries: TableEntry[] },
  abilities: Record<string, number>,
  rng: RNG
): { roll: number; entry: TableEntry } | undefined {
  const diceResult = rollDice(table.dice, rng);
  let roll = diceResult.total;

  // Add ability modifier if specified
  if (table.addAbility && abilities[table.addAbility] !== undefined) {
    roll += abilities[table.addAbility];
  }

  // Find matching entry
  const entry = table.entries.find((e) => roll >= e.range[0] && roll <= e.range[1]);

  if (!entry) {
    return undefined;
  }

  return { roll, entry };
}

/**
 * Resolve a custom test
 */
export function resolveCustomTest(options: CustomTestOptions): CustomTestResult {
  const { test, abilities, rng, ctx, modifiers = 0 } = options;
  const { roll: rollConfig } = test;

  // Roll the dice
  const diceResult = rollDice(rollConfig.dice, rng);
  const natural = diceResult.total;

  // Calculate modifier from ability
  let abilityMod = 0;
  if (rollConfig.ability) {
    abilityMod = abilities[rollConfig.ability] ?? 0;
  }

  const totalMod = abilityMod + modifiers;
  const total = natural + totalMod;

  // Calculate target
  const target = calculateDifficulty(test, abilities);

  // Check for criticals
  const isCritSuccess = checkCriticalSuccess(ctx, natural);
  const isCritFail = checkCriticalFailure(ctx, natural);
  const isCritical = isCritSuccess || isCritFail;

  // Determine success
  const success = determineSuccess(test, natural, total, target, isCritSuccess, isCritFail, ctx);

  // Get the outcome
  const outcome = getOutcome(test, success, isCritical);

  // Collect effects
  const effects: Effect[] = [];

  // Table roll result
  let tableRoll: CustomTestResult["tableRoll"];

  if (outcome) {
    // Add direct effects
    if (outcome.effects) {
      effects.push(...outcome.effects);
    }

    // Roll on table if present
    if (outcome.table) {
      const tableResult = rollOnTable(outcome.table, abilities, rng);
      if (tableResult) {
        tableRoll = {
          dice: outcome.table.dice,
          roll: tableResult.roll,
          entry: tableResult.entry,
        };
        if (tableResult.entry.effects) {
          effects.push(...tableResult.entry.effects);
        }
      }
    }
  }

  return {
    testId: test.id,
    roll: {
      dice: rollConfig.dice,
      natural,
      modifier: totalMod,
      total,
    },
    target,
    success,
    critical: isCritical,
    outcome: outcome ?? { description: "No outcome defined" },
    tableRoll,
    effects,
  };
}

/**
 * Find a custom test by ID in rules context
 */
export function findCustomTest(
  ctx: RulesContext,
  testId: string
): CustomTestDefinition | undefined {
  return ctx.rules.customTestMap.get(testId);
}

/**
 * Find custom tests that match a trigger
 */
export function findCustomTestsByTrigger(
  ctx: RulesContext,
  trigger: string
): CustomTestDefinition[] {
  return ctx.rules.customTests.filter((t) => t.triggers.includes(trigger));
}
