/**
 * Condition Stacking
 *
 * Pure functions for managing conditions on characters/enemies.
 */

import type {
  AbilityName,
  AdvantageScope,
  Condition,
  Effect,
  EffectType,
  GameTime,
} from "@mythxengine/types";
import { compareGameTime } from "../time/expiration.js";

/**
 * Options for adding a condition
 */
export interface AddConditionOptions {
  /** Existing conditions array */
  conditions: Condition[];
  /** Condition to add */
  condition: Condition;
  /** Current game time (for expiration check) */
  currentTime?: GameTime;
}

/**
 * Options for removing a condition
 */
export interface RemoveConditionOptions {
  /** Existing conditions array */
  conditions: Condition[];
  /** Condition ID to remove */
  conditionId: string;
}

/**
 * Result of adding a condition
 */
export interface AddConditionResult {
  /** Updated conditions array */
  conditions: Condition[];
  /** Whether the condition was added (false if duplicate non-stackable) */
  added: boolean;
  /** Message explaining what happened */
  message: string;
}

/**
 * Result of removing a condition
 */
export interface RemoveConditionResult {
  /** Updated conditions array */
  conditions: Condition[];
  /** Whether a condition was removed */
  removed: boolean;
  /** Message explaining what happened */
  message: string;
}

/**
 * Add a condition to a conditions array, respecting stacking rules
 *
 * - Stackable conditions: Always added
 * - Non-stackable conditions: Only added if not already present (by id)
 * - Expired conditions are filtered out if currentTime is provided
 *
 * @param options - Add options
 * @returns Result with updated conditions array
 */
export function addCondition(options: AddConditionOptions): AddConditionResult {
  const { conditions, condition, currentTime } = options;

  // Filter out expired conditions if currentTime is provided
  const activeConditions = currentTime
    ? conditions.filter((c) => !isConditionExpired(c, currentTime))
    : conditions;

  // Check if condition already exists among active conditions
  const existing = activeConditions.find((c) => c.id === condition.id);

  if (existing && !condition.stackable) {
    return {
      conditions: activeConditions, // Return filtered list
      added: false,
      message: `${condition.name} is already active (non-stackable)`,
    };
  }

  // Add the condition
  return {
    conditions: [...activeConditions, condition],
    added: true,
    message: `Added ${condition.name}${existing ? " (stacked)" : ""}`,
  };
}

/**
 * Remove a condition by ID
 *
 * @param options - Remove options
 * @returns Result with updated conditions array
 */
export function removeCondition(options: RemoveConditionOptions): RemoveConditionResult {
  const { conditions, conditionId } = options;

  const index = conditions.findIndex((c) => c.id === conditionId);

  if (index === -1) {
    return {
      conditions,
      removed: false,
      message: `Condition ${conditionId} not found`,
    };
  }

  const removedCondition = conditions[index];
  const newConditions = [...conditions];
  newConditions.splice(index, 1);

  return {
    conditions: newConditions,
    removed: true,
    message: `Removed ${removedCondition.name}`,
  };
}

/**
 * Remove all instances of a condition by ID (for stackable conditions)
 *
 * @param conditions - Existing conditions array
 * @param conditionId - Condition ID to remove
 * @returns Updated conditions array
 */
export function removeAllConditionsById(conditions: Condition[], conditionId: string): Condition[] {
  return conditions.filter((c) => c.id !== conditionId);
}

/**
 * Check if a condition is expired at the given game time
 *
 * @param condition - Condition to check
 * @param currentTime - Current game time
 * @returns true if the condition has expired
 */
export function isConditionExpired(condition: Condition, currentTime: GameTime): boolean {
  // Permanent conditions never expire
  if (condition.duration === "permanent") {
    return false;
  }

  // "until_rest" conditions are handled elsewhere (on rest)
  if (condition.duration === "until_rest") {
    return false;
  }

  // Time-based expiration
  if (condition.expiresAtGameTime) {
    return compareGameTime(currentTime, condition.expiresAtGameTime) >= 0;
  }

  // Round-based duration - not expired by time alone
  return false;
}

/**
 * Get all active (non-expired) conditions
 *
 * @param conditions - All conditions
 * @param currentTime - Current game time
 * @returns Only conditions that haven't expired
 */
export function getActiveConditions(conditions: Condition[], currentTime: GameTime): Condition[] {
  return conditions.filter((c) => !isConditionExpired(c, currentTime));
}

/**
 * Get all conditions that have a specific effect type
 *
 * @param conditions - Conditions to search
 * @param effectType - Effect type to look for
 * @returns Conditions that have the specified effect type
 */
export function getConditionsWithEffect(
  conditions: Condition[],
  effectType: EffectType
): Condition[] {
  return conditions.filter((c) => c.effects.some((e) => e.type === effectType));
}

/**
 * Extract all effects of a specific type from conditions
 *
 * @param conditions - Conditions to search
 * @param effectType - Effect type to extract
 * @returns All effects of the specified type
 */
export function getEffectsOfType<T extends EffectType>(
  conditions: Condition[],
  effectType: T
): Extract<Effect, { type: T }>[] {
  const effects: Extract<Effect, { type: T }>[] = [];

  for (const condition of conditions) {
    for (const effect of condition.effects) {
      if (effect.type === effectType) {
        effects.push(effect as Extract<Effect, { type: T }>);
      }
    }
  }

  return effects;
}

/**
 * Calculate total modifier from MODIFY_ABILITY effects for a specific ability
 *
 * @param conditions - Conditions to check
 * @param ability - Ability name to sum modifiers for
 * @returns Total modifier (can be negative)
 */
export function getTotalAbilityModifier(conditions: Condition[], ability: AbilityName): number {
  const effects = getEffectsOfType(conditions, "MODIFY_ABILITY");
  return effects.filter((e) => e.ability === ability).reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Calculate total modifier from MODIFY_SKILL effects for a specific skill
 *
 * @param conditions - Conditions to check
 * @param skillId - Skill ID to sum modifiers for
 * @returns Total modifier (can be negative)
 */
export function getTotalSkillModifier(conditions: Condition[], skillId: string): number {
  const effects = getEffectsOfType(conditions, "MODIFY_SKILL");
  return effects.filter((e) => e.skillId === skillId).reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Check if conditions grant advantage for a specific scope
 *
 * @param conditions - Conditions to check
 * @param scope - Scope to check for
 * @returns true if any condition grants advantage for the scope
 */
export function hasAdvantage(conditions: Condition[], scope: AdvantageScope): boolean {
  const effects = getEffectsOfType(conditions, "GRANT_ADVANTAGE");
  return effects.some((e) => e.scope === "all" || e.scope === scope);
}

/**
 * Check if conditions grant disadvantage for a specific scope
 *
 * @param conditions - Conditions to check
 * @param scope - Scope to check for
 * @returns true if any condition grants disadvantage for the scope
 */
export function hasDisadvantage(conditions: Condition[], scope: AdvantageScope): boolean {
  const effects = getEffectsOfType(conditions, "GRANT_DISADVANTAGE");
  return effects.some((e) => e.scope === "all" || e.scope === scope);
}

/**
 * Check if conditions provide resistance to a damage type
 *
 * @param conditions - Conditions to check
 * @param damageType - Damage type to check
 * @returns Resistance info or null if no resistance
 */
export function getResistance(
  conditions: Condition[],
  damageType: string
): { multiplier: number; source: string } | null {
  const damageTypeLower = damageType.toLowerCase();

  // Single-pass: find both the matching effect and its source condition
  for (const condition of conditions) {
    for (const effect of condition.effects) {
      if (effect.type === "RESISTANCE" && effect.damageType.toLowerCase() === damageTypeLower) {
        return {
          multiplier: effect.multiplier ?? 0.5,
          source: condition.name,
        };
      }
    }
  }

  return null;
}

/**
 * Check if conditions provide vulnerability to a damage type
 *
 * @param conditions - Conditions to check
 * @param damageType - Damage type to check
 * @returns Vulnerability info or null if no vulnerability
 */
export function getVulnerability(
  conditions: Condition[],
  damageType: string
): { multiplier: number; source: string } | null {
  const damageTypeLower = damageType.toLowerCase();

  // Single-pass: find both the matching effect and its source condition
  for (const condition of conditions) {
    for (const effect of condition.effects) {
      if (effect.type === "VULNERABILITY" && effect.damageType.toLowerCase() === damageTypeLower) {
        return {
          multiplier: effect.multiplier ?? 2,
          source: condition.name,
        };
      }
    }
  }

  return null;
}

/**
 * Decrement round-based durations on all conditions
 * Used at end of turn or round
 *
 * @param conditions - Conditions to update
 * @returns Updated conditions (expired conditions are removed)
 */
export function tickConditionDurations(conditions: Condition[]): {
  conditions: Condition[];
  expired: Condition[];
} {
  const updated: Condition[] = [];
  const expired: Condition[] = [];

  for (const condition of conditions) {
    // Permanent or until_rest don't tick
    if (condition.duration === "permanent" || condition.duration === "until_rest") {
      updated.push(condition);
      continue;
    }

    // Decrement numeric duration
    const newDuration = condition.duration - 1;

    if (newDuration <= 0) {
      expired.push(condition);
    } else {
      updated.push({
        ...condition,
        duration: newDuration,
      });
    }
  }

  return { conditions: updated, expired };
}

/**
 * Remove all "until_rest" conditions (called when resting)
 *
 * @param conditions - Conditions to update
 * @returns Updated conditions and removed conditions
 */
export function clearRestConditions(conditions: Condition[]): {
  conditions: Condition[];
  cleared: Condition[];
} {
  const cleared: Condition[] = [];
  const remaining: Condition[] = [];

  for (const condition of conditions) {
    if (condition.duration === "until_rest") {
      cleared.push(condition);
    } else {
      remaining.push(condition);
    }
  }

  return { conditions: remaining, cleared };
}
