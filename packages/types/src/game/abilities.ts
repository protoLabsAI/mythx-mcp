/**
 * Core ability system
 */

import { z } from "zod";

/**
 * The four core ability names
 */
export const CORE_ABILITY_NAMES = ["STR", "AGI", "WIT", "CON"] as const;

/**
 * Core ability name type - the four standard abilities
 */
export type CoreAbilityName = (typeof CORE_ABILITY_NAMES)[number];

/**
 * Zod schema for core ability names
 */
export const CoreAbilityNameSchema = z.enum(CORE_ABILITY_NAMES);

/**
 * The four core abilities - modifiers range from -5 to +5
 *
 * NOTE: The index signature is included for compatibility with custom abilities
 * in extensible rules configurations. For type-safe access to core abilities,
 * prefer using CoreAbilityName and explicit property access.
 */
export interface Abilities {
  /** Physical power, melee damage, carrying */
  STR: number;
  /** Speed, reflexes, ranged attacks, defense */
  AGI: number;
  /** Intelligence, perception, social, magic */
  WIT: number;
  /** Toughness, HP, endurance, resistance */
  CON: number;
  /** Index signature for custom abilities - prefer explicit access for core abilities */
  [key: string]: number;
}

/**
 * Zod schema for validating Abilities object
 */
export const AbilitiesSchema = z.object({
  STR: z.number().int().min(-5).max(5),
  AGI: z.number().int().min(-5).max(5),
  WIT: z.number().int().min(-5).max(5),
  CON: z.number().int().min(-5).max(5),
});

/**
 * Dynamic abilities map - use when custom abilities are supported
 * or when dynamic string access is needed
 */
export type DynamicAbilities = Record<string, number>;

/**
 * Ability name type - use CoreAbilityName for type-safe access
 * @deprecated Use CoreAbilityName for new code
 */
export type AbilityName = CoreAbilityName;

/** Minimum ability modifier */
export const ABILITY_MIN = -5;

/** Maximum ability modifier */
export const ABILITY_MAX = 5;

/**
 * Create default abilities (all zero)
 */
export function createDefaultAbilities(): Abilities {
  return { STR: 0, AGI: 0, WIT: 0, CON: 0 };
}

/**
 * Validate ability value is within range
 */
export function isValidAbilityValue(value: number): boolean {
  return Number.isInteger(value) && value >= ABILITY_MIN && value <= ABILITY_MAX;
}
