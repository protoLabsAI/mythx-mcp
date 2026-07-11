/**
 * Ability Configuration
 *
 * Allows world packs to define custom abilities or override base abilities.
 */

/**
 * How an ability is used in the system
 */
export interface AbilityUsage {
  /** Can be used for melee attacks */
  meleeAttack?: boolean;
  /** Can be used for ranged attacks */
  rangedAttack?: boolean;
  /** Used in defense calculation */
  defense?: boolean;
  /** Added to damage rolls */
  damage?: boolean;
  /** Contributes to HP calculation */
  hp?: boolean;
  /** Used for initiative */
  initiative?: boolean;
}

/**
 * Definition of a single ability
 */
export interface AbilityDefinition {
  /** Unique identifier (e.g., "STR", "STRESS", "SANITY") */
  id: string;
  /** Display name (e.g., "Strength", "Stress", "Sanity") */
  name: string;
  /** Description of what this ability represents */
  description: string;
  /** Minimum allowed value */
  minValue: number;
  /** Maximum allowed value */
  maxValue: number;
  /** Default starting value for new characters */
  defaultValue: number;
  /** How this ability is used in the system */
  usage?: AbilityUsage;
}

/**
 * Configuration for abilities in a world pack
 */
export interface AbilitiesConfig {
  /**
   * Replace all base abilities with these.
   * Use this for systems with completely different abilities
   * (e.g., Mothership's STR/SPD/INT/CMB instead of STR/AGI/WIT/CON)
   */
  replace?: AbilityDefinition[];

  /**
   * Add these abilities to the base set.
   * Use this to add tracking abilities like STRESS, SANITY, CORRUPTION
   * while keeping the base 4.
   */
  add?: AbilityDefinition[];

  /**
   * Override specific properties of base abilities.
   * Use this to change ranges or descriptions without full replacement.
   */
  override?: {
    [abilityId: string]: Partial<Omit<AbilityDefinition, "id">>;
  };
}

/**
 * Base ability definitions (the defaults)
 */
export const BASE_ABILITIES: AbilityDefinition[] = [
  {
    id: "STR",
    name: "Strength",
    description: "Physical power, melee damage, carrying capacity",
    minValue: -3,
    maxValue: 3,
    defaultValue: 0,
    usage: { meleeAttack: true, damage: true },
  },
  {
    id: "AGI",
    name: "Agility",
    description: "Speed, reflexes, ranged attacks, defense",
    minValue: -3,
    maxValue: 3,
    defaultValue: 0,
    usage: { rangedAttack: true, defense: true, initiative: true },
  },
  {
    id: "WIT",
    name: "Wit",
    description: "Intelligence, perception, social skills, magic",
    minValue: -3,
    maxValue: 3,
    defaultValue: 0,
    usage: {},
  },
  {
    id: "CON",
    name: "Constitution",
    description: "Toughness, HP, endurance, resistance",
    minValue: -3,
    maxValue: 3,
    defaultValue: 0,
    usage: { hp: true },
  },
];

/**
 * Get the effective abilities after applying configuration
 */
export function resolveAbilities(config?: AbilitiesConfig): AbilityDefinition[] {
  if (!config) {
    return BASE_ABILITIES;
  }

  // If replacing, start with replacement set
  if (config.replace) {
    return config.replace;
  }

  // Start with base abilities
  let abilities = [...BASE_ABILITIES];

  // Apply overrides
  if (config.override) {
    abilities = abilities.map((ability) => {
      const override = config.override?.[ability.id];
      if (override) {
        return { ...ability, ...override };
      }
      return ability;
    });
  }

  // Add new abilities
  if (config.add) {
    abilities = [...abilities, ...config.add];
  }

  return abilities;
}

/**
 * Create an abilities record with default values
 */
export function createDefaultAbilitiesRecord(
  definitions: AbilityDefinition[]
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const def of definitions) {
    record[def.id] = def.defaultValue;
  }
  return record;
}

/**
 * Validate an ability value against its definition
 */
export function isValidAbilityValueForDefinition(
  value: number,
  definition: AbilityDefinition
): boolean {
  return (
    Number.isInteger(value) &&
    value >= definition.minValue &&
    value <= definition.maxValue
  );
}
