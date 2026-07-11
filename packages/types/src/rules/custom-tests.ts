/**
 * Custom Test Configuration
 *
 * Allows world packs to define genre-specific test types like
 * panic rolls, sanity checks, corruption tests, etc.
 */

import type { Effect } from "../game/conditions.js";

/**
 * Roll configuration for a custom test
 */
export interface CustomTestRoll {
  /** Dice expression to roll (e.g., "d20", "2d10", "d100") */
  dice: string;

  /** Ability modifier to add to the roll (roll-over systems) */
  ability?: string;

  /** For roll-under systems: ability to roll under */
  underAbility?: string;

  /** Fixed difficulty target (for roll-over) */
  difficulty?: number;

  /**
   * Formula for dynamic difficulty.
   * Variables: any ability ID in braces (e.g., "{STRESS}", "{SAN}")
   * Operators: +, -, *, /
   * Example: "{STRESS} * 2" or "20 - {WIT}"
   */
  difficultyFormula?: string;

  /** Skill to add bonus from (if applicable) */
  skill?: string;
}

/**
 * A single entry in an outcome table
 */
export interface TableEntry {
  /** Roll range that triggers this entry [min, max] inclusive */
  range: [number, number];
  /** Description of what happens */
  description: string;
  /** Effects to apply */
  effects?: Effect[];
}

/**
 * A table of outcomes rolled on after the test
 */
export interface OutcomeTable {
  /** Dice to roll on the table */
  dice: string;
  /** Ability to add to table roll (optional) */
  addAbility?: string;
  /** Table entries */
  entries: TableEntry[];
}

/**
 * Outcome definition for a test result
 */
export interface CustomTestOutcome {
  /** Description of what happens */
  description: string;
  /** Effects to apply immediately */
  effects?: Effect[];
  /** Table to roll on (for complex outcomes like panic tables) */
  table?: OutcomeTable;
}

/**
 * When this custom test should be triggered
 */
export type CustomTestTrigger =
  | "manual" // GM or player explicitly calls for it
  | "combat_start" // At the start of combat
  | "combat_end" // At the end of combat
  | "take_damage" // When taking damage
  | "critical_failure" // On any critical failure
  | "witness_death" // When witnessing a death
  | "witness_horror" // When encountering horror
  | "ability_threshold" // When an ability crosses a threshold
  | "rest" // During rest
  | "scene_start" // At the start of a scene
  | string; // Custom trigger ID

/**
 * Threshold trigger configuration
 */
export interface ThresholdTrigger {
  /** Ability to monitor */
  ability: string;
  /** Threshold value */
  threshold: number;
  /** Trigger when going above or below */
  direction: "above" | "below" | "equals";
}

/**
 * Full definition of a custom test type
 */
export interface CustomTestDefinition {
  /** Unique identifier (e.g., "panic", "sanity_check") */
  id: string;
  /** Display name (e.g., "Panic Check") */
  name: string;
  /** Description of when and why this test is used */
  description: string;

  /** What triggers this test (can be multiple) */
  triggers: CustomTestTrigger[];

  /** Threshold trigger configuration (if using ability_threshold trigger) */
  thresholdTrigger?: ThresholdTrigger;

  /** The roll mechanics */
  roll: CustomTestRoll;

  /** Results by outcome type */
  outcomes: {
    /** What happens on critical success (optional) */
    criticalSuccess?: CustomTestOutcome;
    /** What happens on success */
    success?: CustomTestOutcome;
    /** What happens on failure */
    failure?: CustomTestOutcome;
    /** What happens on critical failure (optional) */
    criticalFailure?: CustomTestOutcome;
  };

  /** Whether this test can be retried (default: false) */
  retryable?: boolean;

  /** Cooldown in game minutes before this test can trigger again */
  cooldownMinutes?: number;
}

/**
 * Configuration for custom tests in a world pack
 */
export interface CustomTestsConfig {
  /** Custom test definitions */
  tests: CustomTestDefinition[];
}

/**
 * Result of resolving a custom test
 */
export interface CustomTestResult {
  /** The test definition that was used */
  testId: string;
  /** The roll result */
  roll: {
    dice: string;
    natural: number;
    modifier: number;
    total: number;
  };
  /** Target to beat (for roll-over) or stay under (for roll-under) */
  target: number;
  /** Whether the test succeeded */
  success: boolean;
  /** Whether this was a critical */
  critical: boolean;
  /** The outcome that applies */
  outcome: CustomTestOutcome;
  /** If a table was rolled, the table result */
  tableRoll?: {
    dice: string;
    roll: number;
    entry: TableEntry;
  };
  /** Effects to apply */
  effects: Effect[];
}

/**
 * Find a custom test by ID
 */
export function findCustomTest(
  tests: CustomTestDefinition[],
  id: string
): CustomTestDefinition | undefined {
  return tests.find((t) => t.id === id);
}

/**
 * Find custom tests that match a trigger
 */
export function findTestsByTrigger(
  tests: CustomTestDefinition[],
  trigger: CustomTestTrigger
): CustomTestDefinition[] {
  return tests.filter((t) => t.triggers.includes(trigger));
}

/**
 * Parse a simple formula with ability substitutions
 * Returns a function that takes ability values and returns the result
 *
 * Supported: addition, subtraction, multiplication, division, parentheses
 * Variables: {ABILITY_ID} format
 */
export function parseFormula(
  formula: string
): (abilities: Record<string, number>) => number {
  return (abilities: Record<string, number>): number => {
    // Replace ability references with values using split/join for safety
    // (avoids RegExp construction from ability IDs which could cause ReDoS)
    let expr = formula;
    for (const [id, value] of Object.entries(abilities)) {
      expr = expr.split(`{${id}}`).join(String(value));
    }

    // Basic safety check - only allow numbers, operators, parentheses, spaces
    if (!/^[\d+\-*/().\s]+$/.test(expr)) {
      throw new Error(`Invalid formula expression: ${expr}`);
    }

    // Evaluate (safe because we validated the expression)
    return Function(`"use strict"; return (${expr})`)() as number;
  };
}
