/**
 * Skill/ability test resolution
 */

import type {
  Character,
  AbilityName,
  Modifier,
  TestResult,
  Effect,
  Position,
  EffectLevel,
} from "@mythxengine/types";
import type { RNG } from "../rng/rng.js";
import { rollWithAdvantage, calculateNetAdvantage } from "../dice/advantage.js";
import type { RulesContext } from "../rules/context.js";
import {
  getDefaultRulesContext,
  checkCriticalSuccess,
  checkCriticalFailure,
  getTestDice,
  isRollUnder,
} from "../rules/context.js";
import { determineOutcomeFromConfig, isSuccessful } from "./outcome.js";

export interface TestOptions {
  character: Character;
  skill?: string;
  ability?: AbilityName;
  difficulty: number;
  modifiers?: Modifier[];
  rng: RNG;
  /** Explicit sources of advantage (e.g., "flanking", "high ground") */
  advantageSources?: string[];
  /** Explicit sources of disadvantage (e.g., "darkness", "wounded") */
  disadvantageSources?: string[];
  /** Rules context (uses defaults if not provided) */
  rules?: RulesContext;
  /** Position (risk level) for consequence framing (default: "risky") */
  position?: Position;
  /** Effect level (impact) for success interpretation (default: "standard") */
  effectLevel?: EffectLevel;
}

/**
 * Get the ability associated with a skill
 */
function getSkillAbility(character: Character, skillName: string): AbilityName {
  const skill = character.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
  return skill?.ability ?? "WIT";
}

/**
 * Get the bonus from a skill
 */
function getSkillBonus(character: Character, skillName: string): number {
  const skill = character.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
  return skill?.bonus ?? 0;
}

/**
 * Get total condition modifiers for a character
 */
function getConditionMod(character: Character, ability?: AbilityName): number {
  let total = 0;

  for (const condition of character.conditions) {
    for (const effect of condition.effects) {
      if (effect.type === "MODIFY_ABILITY") {
        if (!ability || effect.ability === ability) {
          total += effect.amount;
        }
      }
    }
  }

  return total;
}

/**
 * Get advantage/disadvantage sources from character conditions
 *
 * @param character - The character to check
 * @param scope - The scope to check ("skill_tests" or "all")
 * @param skillName - Optional specific skill being tested
 */
function getConditionAdvantage(
  character: Character,
  scope: "skill_tests" | "all",
  skillName?: string
): { advantageSources: string[]; disadvantageSources: string[] } {
  const advantageSources: string[] = [];
  const disadvantageSources: string[] = [];

  for (const condition of character.conditions) {
    for (const effect of condition.effects as Effect[]) {
      if (effect.type === "GRANT_ADVANTAGE") {
        // Check if scope matches
        if (effect.scope === "all" || effect.scope === scope) {
          // Check if skill matches (if skills are specified)
          if (
            !effect.skills ||
            effect.skills.length === 0 ||
            (skillName && effect.skills.some((s) => s.toLowerCase() === skillName.toLowerCase()))
          ) {
            advantageSources.push(`condition:${condition.name}`);
          }
        }
      } else if (effect.type === "GRANT_DISADVANTAGE") {
        if (effect.scope === "all" || effect.scope === scope) {
          if (
            !effect.skills ||
            effect.skills.length === 0 ||
            (skillName && effect.skills.some((s) => s.toLowerCase() === skillName.toLowerCase()))
          ) {
            disadvantageSources.push(`condition:${condition.name}`);
          }
        }
      }
    }
  }

  return { advantageSources, disadvantageSources };
}

/**
 * Resolve a skill or ability test
 *
 * Roll d20 + ability + skill + modifiers vs difficulty
 *
 * Critical success/failure based on rules context (default: nat 20/1)
 *
 * Supports advantage/disadvantage:
 * - Explicit sources passed via advantageSources/disadvantageSources
 * - Conditions with GRANT_ADVANTAGE/GRANT_DISADVANTAGE effects
 * - Advantage + disadvantage cancel to normal roll
 */
export function resolveTest(options: TestOptions): TestResult {
  const {
    character,
    skill,
    ability,
    difficulty,
    modifiers = [],
    rng,
    advantageSources = [],
    disadvantageSources = [],
    rules = getDefaultRulesContext(),
    position,
    effectLevel,
  } = options;

  // Determine which ability to use
  const abilityName = ability ?? (skill ? getSkillAbility(character, skill) : "WIT");
  const abilityMod = character.abilities[abilityName];

  // Get skill bonus if applicable
  const skillBonus = skill ? getSkillBonus(character, skill) : 0;

  // Sum other modifiers
  const otherMods = modifiers.reduce((sum, m) => sum + m.amount, 0);

  // Condition modifiers
  const conditionMods = getConditionMod(character, abilityName);

  // Total modifier
  const totalMod = abilityMod + skillBonus + otherMods + conditionMods;

  // Get advantage/disadvantage from conditions
  const conditionAdvantage = getConditionAdvantage(character, "skill_tests", skill);

  // Combine explicit and condition-based advantage sources
  const allAdvantageSources = [...advantageSources, ...conditionAdvantage.advantageSources];
  const allDisadvantageSources = [
    ...disadvantageSources,
    ...conditionAdvantage.disadvantageSources,
  ];

  // Calculate net advantage state
  const advantageState = calculateNetAdvantage(allAdvantageSources, allDisadvantageSources);

  // Roll with advantage/disadvantage (dice type from rules)
  const dice = getTestDice(rules);
  const roll = rollWithAdvantage(dice, rng, advantageState);
  const total = roll.natural + totalMod;

  // Check for criticals using rules context
  const isCritSuccess = checkCriticalSuccess(rules, roll.natural);
  const isCritFail = checkCriticalFailure(rules, roll.natural);

  // Calculate margin. In a roll-under system success means total ≤ target,
  // so the margin is flipped: positive margin = succeeded by N. Margin
  // semantics (≥ 0 = success, ≥ criticalSuccess threshold = crit) stay
  // identical, so determineOutcomeFromConfig works without further changes.
  const margin = isRollUnder(rules) ? difficulty - total : total - difficulty;

  // Determine three-tier outcome
  const { criticals, outcomeThresholds } = rules.rules.mechanics;
  const outcome = determineOutcomeFromConfig(margin, roll.natural, outcomeThresholds, criticals);

  // Derive success boolean for backwards compatibility
  const success = isSuccessful(outcome);

  return {
    skill: skill ?? "",
    ability: abilityName,
    abilityMod,
    skillBonus,
    otherMods: otherMods + conditionMods,
    totalMod,
    difficulty,
    roll: {
      ...roll,
      total,
    },
    success,
    margin,
    critical: isCritSuccess || isCritFail,
    advantageState,
    // Five-tier outcome fields with defaults
    outcome,
    position: position ?? "risky",
    effectLevel: effectLevel ?? "standard",
  };
}
