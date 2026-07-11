/**
 * Equipment Parsing
 *
 * Pure functions for parsing weapon and armor strings into structured objects.
 */

import type { Weapon } from "@mythxengine/types";
import { BASE_EQUIPMENT_PARSING } from "@mythxengine/types";

/**
 * Parsed armor result
 */
export interface ParsedArmor {
  name: string;
  value: number;
}

/**
 * Options for weapon parsing.
 *
 * The keyword sets and defaults are world-overridable via
 * `MechanicsConfig.equipmentParsing`. Use {@link getWeaponParseOptions}
 * to derive these from a {@link RulesContext}.
 *
 * Ability ids are typed as `string` (not the legacy `AbilityName` core
 * union) so worlds with custom abilities — e.g. `"INT"`, `"SPD"`,
 * `"STRESS"` — can declare them as weapon defaults / keyword targets.
 */
export interface WeaponParseOptions {
  /** Default ability id for melee weapons when none is explicit */
  defaultAbility?: string;
  /** Default ability id for ranged weapons when none is explicit */
  defaultRangedAbility?: string;
  /** Default damage if none can be parsed */
  defaultDamage?: string;
  /** Property keywords flagging a ranged weapon */
  rangedKeywords?: string[];
  /** Property word → ability id mapping for explicit ability overrides */
  abilityKeywords?: Record<string, string>;
}

/**
 * Parse a weapon string into a Weapon object
 *
 * Supports formats:
 * - "Longsword" → { name: 'Longsword', damage: 'd4', ability: 'STR' }
 * - "Longsword (d8)" → { name: 'Longsword', damage: 'd8', ability: 'STR' }
 * - "Longbow (d8, ranged)" → { name: 'Longbow', damage: 'd8', ability: 'AGI', properties: ['ranged'] }
 * - "Dagger (d4, finesse)" → { name: 'Dagger', damage: 'd4', ability: 'STR', properties: ['finesse'] }
 * - "Staff (d6, WIT)" → { name: 'Staff', damage: 'd6', ability: 'WIT' }
 * - "Fire Bolt (d10, ranged, WIT)" → { name: 'Fire Bolt', damage: 'd10', ability: 'WIT', properties: ['ranged'] }
 *
 * @param weaponStr - Weapon string to parse
 * @param options - Parse options
 * @returns Parsed Weapon object
 */
export function parseWeaponString(weaponStr: string, options: WeaponParseOptions = {}): Weapon {
  const defaultAbility = options.defaultAbility ?? BASE_EQUIPMENT_PARSING.defaultMeleeAbility;
  const defaultRangedAbility =
    options.defaultRangedAbility ?? BASE_EQUIPMENT_PARSING.defaultRangedAbility;
  const defaultDamage = options.defaultDamage ?? BASE_EQUIPMENT_PARSING.defaultDamage;
  const rangedKeywords = options.rangedKeywords ?? BASE_EQUIPMENT_PARSING.rangedKeywords;
  const abilityKeywords = options.abilityKeywords ?? BASE_EQUIPMENT_PARSING.abilityKeywords;

  // Trim whitespace
  const trimmed = weaponStr.trim();

  // Try to match "Name (properties)" format
  const match = trimmed.match(/^(.+?)\s*\(([^)]+)\)$/);

  if (!match) {
    // No parentheses - just a name
    return {
      name: trimmed,
      damage: defaultDamage,
      ability: defaultAbility,
    };
  }

  const name = match[1].trim();
  const propsStr = match[2];

  // Split properties by comma
  const props = propsStr.split(",").map((p) => p.trim().toLowerCase());

  // Extract damage dice. Matches a dice expression at the start of a prop —
  // tolerates trailing words like "1d6+1 damage" or "1d4 damage, 6 shots"
  // that the world-gen produces in archetype.startingItems.
  let damage = defaultDamage;
  const diceExtractRegex = /^(\d*d\d+(?:[+-]\d+)?)\b/i;
  for (const prop of props) {
    const match = prop.match(diceExtractRegex);
    if (match) {
      damage = match[1];
      break;
    }
  }

  // Check for explicit ability override first
  let explicitAbility: string | null = null;
  for (const prop of props) {
    const abilityMatch = abilityKeywords[prop];
    if (abilityMatch) {
      explicitAbility = abilityMatch;
      break;
    }
  }

  // Determine final ability: explicit > ranged inference > default
  let ability: string;
  if (explicitAbility) {
    ability = explicitAbility;
  } else {
    const hasRanged = props.some((p) => rangedKeywords.some((kw) => p.includes(kw)));
    ability = hasRanged ? defaultRangedAbility : defaultAbility;
  }

  // Extract properties (non-dice-bearing, non-ability)
  const properties = props.filter((p) => !diceExtractRegex.test(p) && !abilityKeywords[p]);

  const result: Weapon = {
    name,
    damage,
    ability,
  };

  if (properties.length > 0) {
    result.properties = properties;
  }

  return result;
}

/**
 * Parse an armor string into a ParsedArmor object
 *
 * Supports formats:
 * - "Chainmail (3)" → { name: 'Chainmail', value: 3 }
 * - "Leather (+1)" → { name: 'Leather', value: 1 }
 * - "Light armor (+2 defense)" → { name: 'Light armor', value: 2 }
 * - "Robes" → { name: 'Robes', value: 0 }
 *
 * @param armorStr - Armor string to parse
 * @returns Parsed armor object
 */
export function parseArmorString(armorStr: string): ParsedArmor {
  const trimmed = armorStr.trim();

  // Try "Name (value)" format - handles internal whitespace
  const parenMatch = trimmed.match(/^(.+?)\s*\(\s*(\+?\d+)\s*\)$/);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim(),
      value: parseInt(parenMatch[2].replace("+", ""), 10),
    };
  }

  // Try "Name (+N ...)" format with description
  const plusMatch = trimmed.match(/^(.+?)\s*\(\s*\+(\d+).*\)$/);
  if (plusMatch) {
    return {
      name: plusMatch[1].trim(),
      value: parseInt(plusMatch[2], 10),
    };
  }

  // No value found - just a name
  return {
    name: trimmed,
    value: 0,
  };
}

/**
 * Parse multiple weapon strings
 *
 * @param weapons - Array of weapon strings
 * @param options - Parse options
 * @returns Array of parsed Weapon objects
 */
export function parseWeapons(weapons: string[], options: WeaponParseOptions = {}): Weapon[] {
  return weapons.map((w) => parseWeaponString(w, options));
}

/**
 * Format a weapon object back to string representation
 *
 * @param weapon - Weapon object
 * @param options - Parse options to determine defaults (for round-trip consistency)
 * @returns Formatted string like "Longsword (d8)" or just "Dagger" for simple defaults
 */
export function formatWeaponString(weapon: Weapon, options: WeaponParseOptions = {}): string {
  const { defaultAbility = "STR", defaultDamage = "d4" } = options;

  const hasProperties = weapon.properties && weapon.properties.length > 0;
  const hasNonDefaultAbility = weapon.ability !== defaultAbility;
  const hasNonDefaultDamage = weapon.damage !== defaultDamage;

  // Skip parentheses for simple weapons with all defaults
  if (!hasProperties && !hasNonDefaultAbility && !hasNonDefaultDamage) {
    return weapon.name;
  }

  const parts: string[] = [weapon.damage];

  if (hasProperties) {
    parts.push(...weapon.properties!);
  }

  // Only include ability if not the default
  if (hasNonDefaultAbility) {
    parts.push(weapon.ability);
  }

  return `${weapon.name} (${parts.join(", ")})`;
}

/**
 * Format an armor object back to string representation
 *
 * @param armor - Armor object
 * @returns Formatted string like "Chainmail (3)"
 */
export function formatArmorString(armor: ParsedArmor): string {
  if (armor.value === 0) {
    return armor.name;
  }
  return `${armor.name} (${armor.value})`;
}
