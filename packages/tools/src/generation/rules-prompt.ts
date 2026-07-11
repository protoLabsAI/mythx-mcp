/**
 * Rules Prompt Builder
 *
 * Generates rules description text for LLM prompts based on world pack rules config.
 * Used by all generation tools to communicate effective rules to the LLM.
 */

import type { WorldRulesConfig, AbilityDefinition } from "@mythxengine/types";
import {
  BASE_ABILITIES,
  BASE_DIFFICULTIES,
  BASE_CRITICALS,
  BASE_DEFENSE,
  BASE_DAMAGE,
} from "@mythxengine/types";

/**
 * Build the rules section for generation prompts.
 *
 * If no custom rules are provided, returns default rules description.
 * If custom rules are provided, merges with defaults and describes the effective rules.
 */
export function buildRulesPromptSection(rules?: WorldRulesConfig): string {
  if (!rules) {
    return getDefaultRulesSection();
  }

  const sections: string[] = [];

  // Abilities section
  sections.push(buildAbilitiesSection(rules));

  // Difficulties section
  sections.push(buildDifficultiesSection(rules));

  // Mechanics section
  sections.push(buildMechanicsSection(rules));

  // Custom tests section
  if (rules.customTests?.tests && rules.customTests.tests.length > 0) {
    sections.push(buildCustomTestsSection(rules));
  }

  return `## Game Rules

${sections.join("\n\n")}`;
}

/**
 * Default rules section when no custom rules are provided
 */
function getDefaultRulesSection(): string {
  return `## Game Rules

### Abilities
Four core abilities with modifiers from -3 to +3:
- **STR** (Strength): Physical power, melee damage, carrying
- **AGI** (Agility): Speed, reflexes, ranged attacks, defense
- **WIT** (Wit): Intelligence, perception, social, magic
- **CON** (Constitution): Toughness, HP, endurance, resistance

### Difficulty Levels
- EASY: DC 8
- STANDARD: DC 12
- HARD: DC 16
- EXTREME: DC 20

### Combat Mechanics
- Defense: 10 + AGI modifier
- Attack: d20 + ability + skill vs Defense
- Critical: Natural 20 (auto-success, 2x damage), Natural 1 (auto-fail)
- Damage: Weapon die + ability modifier - armor (minimum 0)

### HP Guidelines
- Low: 8-10 HP
- Medium: 10-12 HP
- High: 12-14 HP
- Tank: 14-16 HP`;
}

/**
 * Build abilities section from config
 */
function buildAbilitiesSection(rules: WorldRulesConfig): string {
  const abilities = getEffectiveAbilities(rules);

  const abilityLines = abilities.map(
    (a) => `- **${a.id}** (${a.name}): ${a.description} [${a.minValue} to ${a.maxValue}]`
  );

  return `### Abilities
${abilityLines.join("\n")}`;
}

/**
 * Get effective abilities (merged with defaults)
 */
function getEffectiveAbilities(rules: WorldRulesConfig): AbilityDefinition[] {
  const config = rules.abilities;

  if (!config) {
    return BASE_ABILITIES;
  }

  // Replace mode
  if (config.replace && config.replace.length > 0) {
    return config.replace;
  }

  // Start with base abilities
  let abilities = [...BASE_ABILITIES];

  // Apply overrides
  if (config.override) {
    abilities = abilities.map((a) => {
      const override = config.override?.[a.id];
      if (override) {
        return { ...a, ...override };
      }
      return a;
    });
  }

  // Add new abilities
  if (config.add && config.add.length > 0) {
    abilities = [...abilities, ...config.add];
  }

  return abilities;
}

/**
 * Build difficulties section from config
 */
function buildDifficultiesSection(rules: WorldRulesConfig): string {
  const config = rules.difficulties;

  // Get effective difficulties
  let difficulties = BASE_DIFFICULTIES;
  if (config?.replace && config.replace.length > 0) {
    difficulties = config.replace;
  } else if (config?.add && config.add.length > 0) {
    difficulties = [...difficulties, ...config.add];
  }

  // Sort by target value for consistent display
  const sorted = [...difficulties].sort((a, b) => a.target - b.target);
  const diffLines = sorted.map((d) => `- ${d.name.toUpperCase()}: DC ${d.target}`);

  return `### Difficulty Levels
${diffLines.join("\n")}`;
}

/**
 * Build mechanics section from config
 */
function buildMechanicsSection(rules: WorldRulesConfig): string {
  const mechanics = rules.mechanics;
  const lines: string[] = [];

  // Defense
  const defense = mechanics?.defense ?? BASE_DEFENSE;
  const defenseAbility = defense.ability ?? "AGI";
  lines.push(`- Defense: ${defense.base} + ${defenseAbility} modifier`);

  // Attack
  lines.push(`- Attack: d20 + ability + skill vs Defense`);

  // Criticals
  const criticals = mechanics?.criticals ?? BASE_CRITICALS;
  const critSuccessOn = criticals.successOn?.join(", ") ?? "20";
  const critFailOn = criticals.failureOn?.join(", ") ?? "1";
  const autoSuccess = criticals.autoSuccess !== false ? "auto-success" : "no auto-success";
  const autoFail = criticals.autoFailure !== false ? "auto-fail" : "no auto-fail";
  const critMult = criticals.damageMultiplier ?? 2;
  lines.push(`- Critical Success: Natural ${critSuccessOn} (${autoSuccess}, ${critMult}x damage)`);
  lines.push(`- Critical Failure: Natural ${critFailOn} (${autoFail})`);

  // Roll-under (if enabled). Critical ranges live on `criticals.successOn`
  // / `failureOn` (uniform across roll-over and roll-under) — already
  // surfaced in the criticals section above.
  if (mechanics?.rollUnder?.enabled) {
    const rollUnder = mechanics.rollUnder;
    lines.push(`- Roll-Under System: Roll ${rollUnder.dice} under ability score to succeed`);
  }

  // Damage
  const damage = mechanics?.damage ?? BASE_DAMAGE;
  const damageComponents: string[] = ["Weapon die"];
  if (damage.addAbility !== false) damageComponents.push("ability modifier");
  // Build damage formula with proper subtraction for armor
  let damageFormula = damageComponents.join(" + ");
  if (damage.subtractArmor !== false) damageFormula += " - armor";
  lines.push(`- Damage: ${damageFormula} (minimum ${damage.minimumDamage ?? 0})`);

  // Resistance/Vulnerability
  const resMult = mechanics?.resistanceMultiplier ?? 0.5;
  const vulnMult = mechanics?.vulnerabilityMultiplier ?? 2;
  lines.push(`- Resistance: ${resMult}x damage`);
  lines.push(`- Vulnerability: ${vulnMult}x damage`);

  return `### Combat Mechanics
${lines.join("\n")}`;
}

/**
 * Build custom tests section
 */
function buildCustomTestsSection(rules: WorldRulesConfig): string {
  const tests = rules.customTests?.tests ?? [];

  const testLines = tests.map((test) => {
    const triggers = test.triggers.join(", ");
    const rollDesc = test.roll.underAbility
      ? `Roll ${test.roll.dice} under ${test.roll.underAbility}`
      : `Roll ${test.roll.dice} + ${test.roll.ability ?? "ability"} vs DC`;

    return `- **${test.name}** (${test.id}): ${test.description}
  - Triggers: ${triggers}
  - Roll: ${rollDesc}`;
  });

  return `### Custom Tests
${testLines.join("\n")}`;
}

/**
 * Build HP guidelines based on rules
 */
export function buildHPGuidelines(_rules?: WorldRulesConfig): string {
  // Could be enhanced to read from rules config if we add HP guidelines there
  return `### HP Guidelines
- Low: 8-10 HP
- Medium: 10-12 HP
- High: 12-14 HP
- Tank: 14-16 HP`;
}

/**
 * Build monster HP guidelines by threat tier
 */
export function buildMonsterHPGuidelines(_rules?: WorldRulesConfig): string {
  // Could be enhanced to scale with rules config
  return `### Monster HP by Threat Tier
- Minion: 4-6 HP
- Standard: 10-14 HP
- Elite: 18-24 HP
- Boss: 30-40 HP`;
}
