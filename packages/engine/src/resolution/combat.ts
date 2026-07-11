/**
 * Combat resolution
 */

import type {
  Character,
  Enemy,
  Weapon,
  Modifier,
  AttackResult,
  Effect,
  DamageModification,
  OutcomeType,
  Position,
  EffectLevel,
} from "@mythxengine/types";
import { effectLevelToMultiplier } from "@mythxengine/types";
import type { RNG } from "../rng/rng.js";
import { rollWithAdvantage, calculateNetAdvantage } from "../dice/advantage.js";
import { calculateDamage } from "./damage.js";
import type { RulesContext } from "../rules/context.js";
import {
  getDefaultRulesContext,
  checkCriticalSuccess,
  checkCriticalFailure,
  calculateDefenseTarget,
  getResistanceMultiplier,
  getVulnerabilityMultiplier,
} from "../rules/context.js";
import { determineOutcomeFromConfig } from "./outcome.js";

export interface AttackOptions {
  attacker: Character | Enemy;
  defender: Character | Enemy;
  weapon: Weapon;
  modifiers?: Modifier[];
  rng: RNG;
  /** Explicit sources of advantage (e.g., "flanking", "high ground") */
  advantageSources?: string[];
  /** Explicit sources of disadvantage (e.g., "darkness", "cover") */
  disadvantageSources?: string[];
  /** Damage type for resistance/vulnerability (default: "physical") */
  damageType?: string;
  /** Rules context (uses defaults if not provided) */
  rules?: RulesContext;
  /** Position (risk level) for consequence framing (default: "risky") */
  position?: Position;
  /**
   * Effect level (impact) — multiplies post-armor / post-resistance
   * damage by `effectLevelToMultiplier` (limited 0.5×, standard 1×,
   * great 1.5×). Same multiplier applies to graze damage on partial
   * hits. Default: "standard".
   */
  effectLevel?: EffectLevel;
}

/**
 * Check if combatant is a Character (not an Enemy)
 */
function isCharacter(combatant: Character | Enemy): combatant is Character {
  return "archetypeId" in combatant;
}

/**
 * Get skill bonus for combat
 */
function getCombatSkillBonus(combatant: Character | Enemy, skillName?: string): number {
  if (!skillName) return 0;
  if (!isCharacter(combatant)) return 0; // Enemies don't have skills

  const skill = combatant.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
  return skill?.bonus ?? 0;
}

/**
 * Get condition modifiers for attack
 */
function getAttackConditionMod(combatant: Character | Enemy): number {
  let total = 0;
  for (const condition of combatant.conditions) {
    for (const effect of condition.effects) {
      if (effect.type === "MODIFY_SKILL" && effect.skillId === "combat") {
        total += effect.amount;
      }
    }
  }
  return total;
}

/**
 * Get advantage/disadvantage sources from attacker conditions
 */
function getAttackAdvantage(attacker: Character | Enemy): {
  advantageSources: string[];
  disadvantageSources: string[];
} {
  const advantageSources: string[] = [];
  const disadvantageSources: string[] = [];

  for (const condition of attacker.conditions) {
    for (const effect of condition.effects as Effect[]) {
      if (effect.type === "GRANT_ADVANTAGE") {
        if (effect.scope === "all" || effect.scope === "attacks") {
          advantageSources.push(`condition:${condition.name}`);
        }
      } else if (effect.type === "GRANT_DISADVANTAGE") {
        if (effect.scope === "all" || effect.scope === "attacks") {
          disadvantageSources.push(`condition:${condition.name}`);
        }
      }
    }
  }

  return { advantageSources, disadvantageSources };
}

/**
 * Calculate damage multiplier from defender's resistance/vulnerability
 *
 * @param defender - The defender
 * @param damageType - The damage type being dealt
 * @param rules - Rules context for default multipliers
 * @returns Object with multiplier and reason
 */
function getDamageMultiplier(
  defender: Character | Enemy,
  damageType: string,
  rules: RulesContext
): { multiplier: number; reason?: "resistance" | "vulnerability" } {
  let hasResistance = false;
  let hasVulnerability = false;
  // Use rules context for default multipliers
  let resistanceMultiplier = getResistanceMultiplier(rules);
  let vulnerabilityMultiplier = getVulnerabilityMultiplier(rules);

  for (const condition of defender.conditions) {
    for (const effect of condition.effects as Effect[]) {
      if (
        effect.type === "RESISTANCE" &&
        effect.damageType.toLowerCase() === damageType.toLowerCase()
      ) {
        hasResistance = true;
        if (effect.multiplier !== undefined) {
          resistanceMultiplier = effect.multiplier;
        }
      } else if (
        effect.type === "VULNERABILITY" &&
        effect.damageType.toLowerCase() === damageType.toLowerCase()
      ) {
        hasVulnerability = true;
        if (effect.multiplier !== undefined) {
          vulnerabilityMultiplier = effect.multiplier;
        }
      }
    }
  }

  // If both, they cancel out (like advantage/disadvantage)
  if (hasResistance && hasVulnerability) {
    return { multiplier: 1 };
  }

  if (hasResistance) {
    return { multiplier: resistanceMultiplier, reason: "resistance" };
  }

  if (hasVulnerability) {
    return { multiplier: vulnerabilityMultiplier, reason: "vulnerability" };
  }

  return { multiplier: 1 };
}

/**
 * Get armor value for a defender
 */
function getArmorValue(defender: Character | Enemy): number {
  // For both Character and Enemy, prefer explicit armor field
  if ("armor" in defender && typeof defender.armor === "number") {
    return defender.armor;
  }

  // For characters, check explicit armorValue in equipment
  const equipment = (defender as Character).equipment;
  if (equipment?.armorValue !== undefined) {
    return equipment.armorValue;
  }

  // Fallback: parse from armor string (legacy support)
  const armorStr = equipment?.armor;
  if (!armorStr) return 0;

  // Try to extract number from description like "Light armor (+1 defense)"
  const match = armorStr.match(/\+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Resolve an attack
 *
 * Attack roll: d20 + ability + skill vs 10 + defender AGI
 * On hit: roll damage - armor
 *
 * Supports advantage/disadvantage:
 * - Explicit sources passed via advantageSources/disadvantageSources
 * - Conditions with GRANT_ADVANTAGE/GRANT_DISADVANTAGE effects
 * - Advantage + disadvantage cancel to normal roll
 *
 * Supports resistance/vulnerability:
 * - Defender conditions with RESISTANCE/VULNERABILITY effects
 * - Resistance halves damage, vulnerability doubles it
 * - Resistance + vulnerability cancel out
 */
export function resolveAttack(options: AttackOptions): AttackResult {
  const {
    attacker,
    defender,
    weapon,
    modifiers = [],
    rng,
    advantageSources = [],
    disadvantageSources = [],
    damageType = "physical",
    rules = getDefaultRulesContext(),
    position,
    effectLevel,
  } = options;
  const effectMultiplier = effectLevelToMultiplier(effectLevel);

  // Determine attack ability
  const attackAbility = weapon.ability ?? "STR";
  const attackMod = attacker.abilities[attackAbility];

  // Get combat skill bonus
  const skillBonus = getCombatSkillBonus(attacker, weapon.skill);

  // Condition modifiers
  const conditionMods = getAttackConditionMod(attacker);

  // Other modifiers
  const otherMods = modifiers.reduce((sum, m) => sum + m.amount, 0);

  // Total attack bonus
  const totalAttackMod = attackMod + skillBonus + conditionMods + otherMods;

  // Defense target from rules context (default: 10 + defender AGI)
  const defenseTarget = calculateDefenseTarget(rules, defender.abilities);

  // Get advantage/disadvantage from attacker conditions
  const conditionAdvantage = getAttackAdvantage(attacker);

  // Combine explicit and condition-based advantage sources
  const allAdvantageSources = [...advantageSources, ...conditionAdvantage.advantageSources];
  const allDisadvantageSources = [
    ...disadvantageSources,
    ...conditionAdvantage.disadvantageSources,
  ];

  // Calculate net advantage state
  const advantageState = calculateNetAdvantage(allAdvantageSources, allDisadvantageSources);

  // Roll attack with advantage/disadvantage
  const attackRoll = rollWithAdvantage("d20", rng, advantageState);
  const attackTotal = attackRoll.natural + totalAttackMod;

  // Calculate attack margin
  const attackMargin = attackTotal - defenseTarget;

  // Check for critical using rules context
  const criticalHit = checkCriticalSuccess(rules, attackRoll.natural);
  const criticalMiss = checkCriticalFailure(rules, attackRoll.natural);

  // Determine three-tier outcome
  const { criticals, outcomeThresholds } = rules.rules.mechanics;
  const outcome: OutcomeType = determineOutcomeFromConfig(
    attackMargin,
    attackRoll.natural,
    outcomeThresholds,
    criticals
  );

  // Handle miss (failure or critical failure)
  if (outcome === "failure" || outcome === "critical_failure") {
    return {
      hit: false,
      outcome,
      roll: { ...attackRoll, total: attackTotal },
      critical: criticalMiss ? "miss" : undefined,
      advantageState,
      position: position ?? "risky",
      effectLevel: effectLevel ?? "standard",
    };
  }

  // Calculate base damage using rules context for damage config
  const armor = getArmorValue(defender);
  const damageResult = calculateDamage(weapon, attackMod, armor, rng, rules);

  // Apply critical damage multiplier from rules context
  const critMultiplier = criticalHit ? criticals.damageMultiplier : 1;
  let baseDamage = Math.floor(damageResult.damage * critMultiplier);

  // Apply resistance/vulnerability using rules context for default multipliers
  const damageMultiplierInfo = getDamageMultiplier(defender, damageType, rules);
  const originalDamage = baseDamage;
  baseDamage = Math.floor(baseDamage * damageMultiplierInfo.multiplier);

  // Build damage modification info if applicable. Uses pre-effect
  // baseline so the resistance/vulnerability story stays clean — the
  // effect multiplier is a separate axis ("how hard did it land")
  // tracked via `effectLevel` on the result.
  let damageModification: DamageModification | undefined;
  if (damageMultiplierInfo.reason) {
    damageModification = {
      originalDamage,
      finalDamage: baseDamage,
      reason: damageMultiplierInfo.reason,
      damageType,
    };
  }

  // Handle partial hit (graze damage from rules.damage.grazeMultiplier).
  // Effect multiplier scales the graze too — a "great" graze still
  // bites, a "limited" graze can round to zero on small numbers.
  if (outcome === "partial") {
    const baseGraze = Math.floor(baseDamage * rules.rules.mechanics.damage.grazeMultiplier);
    const grazeDamage = Math.floor(baseGraze * effectMultiplier);
    const defenderHpRemaining = defender.hp.current - grazeDamage;

    return {
      hit: false, // Backwards compat: partial is not a "hit"
      outcome,
      roll: { ...attackRoll, total: attackTotal },
      grazeDamage,
      defenderHpRemaining,
      advantageState,
      damageModification,
      position: position ?? "risky",
      effectLevel: effectLevel ?? "standard",
    };
  }

  // Full hit (success or critical success). Effect multiplier applies
  // last so it scales the final delivered impact, including crit
  // multiplier and any resistance/vulnerability adjustment.
  const finalDamage = Math.floor(baseDamage * effectMultiplier);
  const defenderHpRemaining = defender.hp.current - finalDamage;

  return {
    hit: true,
    outcome,
    roll: { ...attackRoll, total: attackTotal },
    damage: finalDamage,
    critical: criticalHit ? "hit" : undefined,
    defenderHpRemaining,
    advantageState,
    damageModification,
    position: position ?? "risky",
    effectLevel: effectLevel ?? "standard",
  };
}
