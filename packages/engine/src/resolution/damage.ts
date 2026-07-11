/**
 * Damage calculation
 */

import type { Weapon, DiceResult } from "@mythxengine/types";
import type { RNG } from "../rng/rng.js";
import { rollDice } from "../dice/roller.js";
import type { RulesContext } from "../rules/context.js";
import { getDefaultRulesContext, getDamageConfig } from "../rules/context.js";

export interface DamageResult {
  damage: number;
  roll: DiceResult;
  rawDamage: number;
  armorReduction: number;
}

/**
 * Calculate damage from an attack
 *
 * Default: Damage = weapon die + ability mod - armor (minimum 0)
 * Respects rules context for addAbility, subtractArmor, minimumDamage
 */
export function calculateDamage(
  weapon: Weapon,
  abilityMod: number,
  armor: number,
  rng: RNG,
  rules: RulesContext = getDefaultRulesContext()
): DamageResult {
  const damageConfig = getDamageConfig(rules);

  // Roll weapon damage
  const roll = rollDice(weapon.damage, rng);

  // Raw damage = roll + ability mod (if configured)
  const abilityBonus = damageConfig.addAbility ? abilityMod : 0;
  const rawDamage = roll.total + abilityBonus;

  // Apply armor reduction (if configured)
  let damage = rawDamage;
  let armorReduction = 0;
  if (damageConfig.subtractArmor) {
    armorReduction = Math.min(armor, rawDamage);
    damage = rawDamage - armorReduction;
  }

  // Apply minimum damage
  damage = Math.max(damageConfig.minimumDamage, damage);

  return {
    damage,
    roll,
    rawDamage,
    armorReduction,
  };
}

/**
 * Calculate healing amount
 */
export function calculateHealing(
  expression: string,
  rng: RNG,
  maxHp: number,
  currentHp: number
): { healing: number; roll: DiceResult } {
  const roll = rollDice(expression, rng);
  const potential = roll.total;
  const healing = Math.min(potential, maxHp - currentHp);

  return { healing, roll };
}
