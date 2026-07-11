/**
 * Rules Configuration System
 *
 * Allows world packs to extend or override base game rules,
 * enabling genre-specific mechanics while keeping a generic base.
 *
 * @example Basic usage - keep defaults
 * ```ts
 * // No rules config = use all defaults
 * const worldPack = { meta: {...}, archetypes: {...} };
 * ```
 *
 * @example Add stress tracking
 * ```ts
 * const worldPack = {
 *   rules: {
 *     abilities: {
 *       add: [{ id: "STRESS", name: "Stress", minValue: 0, maxValue: 20, defaultValue: 2 }]
 *     }
 *   }
 * };
 * ```
 *
 * @example Full Mothership-style system
 * ```ts
 * const worldPack = {
 *   rules: {
 *     abilities: {
 *       replace: [
 *         { id: "STR", name: "Strength", minValue: 10, maxValue: 80, defaultValue: 30 },
 *         { id: "SPD", name: "Speed", minValue: 10, maxValue: 80, defaultValue: 30 },
 *         // ... etc
 *       ]
 *     },
 *     mechanics: {
 *       rollUnder: { enabled: true, dice: "d100" }
 *     },
 *     customTests: {
 *       tests: [{ id: "panic", name: "Panic Check", ... }]
 *     }
 *   }
 * };
 * ```
 */

// Re-export all rule types
export * from "./abilities.js";
export * from "./difficulties.js";
export * from "./mechanics.js";
export * from "./custom-tests.js";

// Import for the main config type
import type { AbilitiesConfig, AbilityDefinition } from "./abilities.js";
import type { DifficultiesConfig, DifficultyDefinition } from "./difficulties.js";
import type { MechanicsConfig, ResolvedMechanics } from "./mechanics.js";
import type { CustomTestsConfig, CustomTestDefinition } from "./custom-tests.js";

import { resolveAbilities, BASE_ABILITIES } from "./abilities.js";
import { resolveDifficulties } from "./difficulties.js";
import { resolveMechanics } from "./mechanics.js";

/**
 * Complete rules configuration for a world pack
 */
export interface WorldRulesConfig {
  /**
   * Override or extend ability definitions.
   * Use to add stress/sanity tracking or replace the base 4 abilities entirely.
   */
  abilities?: AbilitiesConfig;

  /**
   * Override or extend difficulty levels.
   * Use to add intermediate difficulties or change the scale.
   */
  difficulties?: DifficultiesConfig;

  /**
   * Override core mechanics like defense formula, criticals, etc.
   * Use for d100 systems, different crit ranges, etc.
   */
  mechanics?: MechanicsConfig;

  /**
   * Define custom test types like panic checks, sanity rolls, etc.
   * These can be triggered automatically or called manually.
   */
  customTests?: CustomTestsConfig;
}

/**
 * Fully resolved rules with all defaults applied
 */
export interface ResolvedRules {
  /** All ability definitions */
  abilities: AbilityDefinition[];
  /** Ability lookup by ID */
  abilityMap: Map<string, AbilityDefinition>;
  /** All difficulty definitions */
  difficulties: DifficultyDefinition[];
  /** Difficulty lookup by ID */
  difficultyMap: Map<string, DifficultyDefinition>;
  /** Resolved mechanics */
  mechanics: ResolvedMechanics;
  /** Custom test definitions */
  customTests: CustomTestDefinition[];
  /** Custom test lookup by ID */
  customTestMap: Map<string, CustomTestDefinition>;
}

/**
 * Resolve a world's rules configuration into fully resolved rules
 *
 * @param config - The world's rules configuration (or undefined for defaults)
 * @returns Fully resolved rules with all defaults applied
 */
export function resolveRules(config?: WorldRulesConfig): ResolvedRules {
  const abilities = resolveAbilities(config?.abilities);
  const difficulties = resolveDifficulties(config?.difficulties);
  const mechanics = resolveMechanics(config?.mechanics);
  const customTests = config?.customTests?.tests ?? [];

  return {
    abilities,
    abilityMap: new Map(abilities.map((a) => [a.id, a])),
    difficulties,
    difficultyMap: new Map(difficulties.map((d) => [d.id, d])),
    mechanics,
    customTests,
    customTestMap: new Map(customTests.map((t) => [t.id, t])),
  };
}

/**
 * Get the default rules (no configuration)
 */
export function getDefaultRules(): ResolvedRules {
  return resolveRules(undefined);
}

/**
 * Validate that a rules configuration is valid
 *
 * @param config - The configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateRulesConfig(config: WorldRulesConfig): string[] {
  const errors: string[] = [];

  // Validate abilities
  if (config.abilities?.replace) {
    if (config.abilities.replace.length === 0) {
      errors.push("abilities.replace cannot be empty");
    }
    const ids = new Set<string>();
    for (const ability of config.abilities.replace) {
      if (ids.has(ability.id)) {
        errors.push(`Duplicate ability ID: ${ability.id}`);
      }
      ids.add(ability.id);
      if (ability.minValue >= ability.maxValue) {
        errors.push(
          `Ability ${ability.id}: minValue must be less than maxValue`
        );
      }
      if (
        ability.defaultValue < ability.minValue ||
        ability.defaultValue > ability.maxValue
      ) {
        errors.push(
          `Ability ${ability.id}: defaultValue must be between minValue and maxValue`
        );
      }
    }
  }

  if (config.abilities?.add) {
    const baseIds = new Set(BASE_ABILITIES.map((a) => a.id));
    for (const ability of config.abilities.add) {
      if (baseIds.has(ability.id)) {
        errors.push(
          `Cannot add ability ${ability.id}: conflicts with base ability`
        );
      }
    }
  }

  // Validate difficulties
  if (config.difficulties?.replace) {
    if (config.difficulties.replace.length === 0) {
      errors.push("difficulties.replace cannot be empty");
    }
    const ids = new Set<string>();
    for (const diff of config.difficulties.replace) {
      if (ids.has(diff.id)) {
        errors.push(`Duplicate difficulty ID: ${diff.id}`);
      }
      ids.add(diff.id);
    }
  }

  // Validate mechanics
  if (config.mechanics?.criticals) {
    const { successOn, failureOn } = config.mechanics.criticals;
    if (successOn && failureOn) {
      const overlap = successOn.filter((n) => failureOn.includes(n));
      if (overlap.length > 0) {
        errors.push(
          `Critical success and failure ranges overlap: ${overlap.join(", ")}`
        );
      }
    }
  }

  // Validate custom tests
  if (config.customTests?.tests) {
    const ids = new Set<string>();
    for (const test of config.customTests.tests) {
      if (ids.has(test.id)) {
        errors.push(`Duplicate custom test ID: ${test.id}`);
      }
      ids.add(test.id);

      if (!test.roll.dice) {
        errors.push(`Custom test ${test.id}: roll.dice is required`);
      }

      if (!test.outcomes.success && !test.outcomes.failure) {
        errors.push(
          `Custom test ${test.id}: at least success or failure outcome is required`
        );
      }
    }
  }

  return errors;
}

/**
 * Check if a rules config uses roll-under mechanics
 */
export function isRollUnderSystem(config?: WorldRulesConfig): boolean {
  return config?.mechanics?.rollUnder?.enabled ?? false;
}

/**
 * Get ability IDs from a rules config
 */
export function getAbilityIds(config?: WorldRulesConfig): string[] {
  const abilities = resolveAbilities(config?.abilities);
  return abilities.map((a) => a.id);
}
