/**
 * Core Mechanics Configuration
 *
 * Allows world packs to customize fundamental game mechanics.
 */

import { OutcomeThresholds, DEFAULT_OUTCOME_THRESHOLDS } from "../game/outcome.js";

/**
 * Alias for OutcomeThresholds (for backwards compatibility)
 */
export type OutcomeThresholdsConfig = OutcomeThresholds;

/**
 * Defense calculation configuration
 */
export interface DefenseConfig {
  /** Base defense value before ability modifier (default: 10) */
  base: number;
  /** Which ability adds to defense (default: "AGI") */
  ability?: string;
}

/**
 * Damage calculation configuration
 */
export interface DamageConfig {
  /** Add ability modifier to damage (default: true) */
  addAbility: boolean;
  /** Subtract armor from damage (default: true) */
  subtractArmor: boolean;
  /** Minimum damage after all modifiers (default: 0) */
  minimumDamage: number;
  /** Multiplier applied to damage on a partial-hit / graze (default: 0.5) */
  grazeMultiplier: number;
}

/**
 * Critical hit/miss configuration
 */
export interface CriticalsConfig {
  /** Natural rolls that count as critical success (default: [20]) */
  successOn: number[];
  /** Natural rolls that count as critical failure (default: [1]) */
  failureOn: number[];
  /** Damage multiplier on critical hit (default: 2) */
  damageMultiplier: number;
  /** Critical success always succeeds regardless of total (default: true) */
  autoSuccess: boolean;
  /** Critical failure always fails regardless of total (default: true) */
  autoFailure: boolean;
}

/**
 * Roll-under system configuration (for d100 systems like Mothership).
 *
 * Critical-roll ranges live on {@link CriticalsConfig.successOn} /
 * `failureOn` — those arrays apply uniformly to roll-over and roll-under
 * systems, so there's no need for a separate range field here.
 */
export interface RollUnderConfig {
  /** Enable roll-under mechanics (default: false) */
  enabled: boolean;
  /** Dice to use for roll-under tests (default: "d100") */
  dice: string;
}

/**
 * Advantage/disadvantage configuration.
 *
 * The engine implements the standard 5e-style "best of two" / "worst of
 * two" mechanic on the configured dice. Other methods (reroll failures,
 * flat bonus, …) were declared in earlier drafts but never implemented;
 * if a world needs them they can be added back as a discriminated
 * union with real engine support.
 */
export interface AdvantageConfig {
  /** Dice to roll for advantage/disadvantage (default: "d20") */
  dice: string;
}

// OutcomeThresholdsConfig is imported from game/outcome.ts and re-exported above

/**
 * Stress cost per consequence severity for the resist mechanic.
 */
export interface ResistSeverityCosts {
  minor: number;
  moderate: number;
  severe: number;
}

/**
 * World-overridable keyword sets and defaults for the equipment-string
 * parser. The default set is fantasy-leaning ("bow", "crossbow", …);
 * sci-fi or non-English worlds can replace it.
 */
export interface EquipmentParsingConfig {
  /**
   * Property keywords that flag a weapon as ranged. Matching is case-
   * insensitive substring (e.g. "longbow" matches keyword "bow").
   */
  rangedKeywords: string[];
  /**
   * Mapping from a property word (lowercased) to an ability id. Used to
   * recognise explicit ability overrides like "(d6, WIT)".
   */
  abilityKeywords: Record<string, string>;
  /** Ability used for melee weapons when no explicit ability is given. */
  defaultMeleeAbility: string;
  /** Ability used for ranged weapons when no explicit ability is given. */
  defaultRangedAbility: string;
  /** Damage expression used when no dice can be parsed from the props. */
  defaultDamage: string;
}

/**
 * Stress mechanics configuration (FitD style)
 */
export interface StressConfig {
  /** Maximum stress before trauma (default: 9) */
  maxStress: number;
  /** Stress cost to push a roll (default: 2) */
  pushCost: number;
  /** Dice to roll for push bonus (default: "1d6") */
  pushBonus: string;
  /** Stress cost to flashback / retroactively prepare (default: 2) */
  flashbackCost: number;
  /** Stress cost per severity for resisting a consequence (default 1/2/3) */
  resistSeverityCosts: ResistSeverityCosts;
  /**
   * Resistance roll threshold — if d6 + ability ≥ this, base cost is reduced
   * by 1 (floor 1). (default: 5)
   */
  resistThreshold: number;
  /** Stress recovered per short rest (default: 2) */
  recoveryPerShortRest: number;
  /** Stress recovered per long rest (default: "all") */
  recoveryPerLongRest: "all" | number;
}

/**
 * Base stress configuration (Blades in the Dark defaults)
 */
export const BASE_STRESS: StressConfig = {
  maxStress: 9,
  pushCost: 2,
  pushBonus: "1d6",
  flashbackCost: 2,
  resistSeverityCosts: { minor: 1, moderate: 2, severe: 3 },
  resistThreshold: 5,
  recoveryPerShortRest: 2,
  recoveryPerLongRest: "all",
};

/**
 * Full mechanics configuration for a world pack
 */
export interface MechanicsConfig {
  /** Defense calculation */
  defense?: Partial<DefenseConfig>;
  /** Damage calculation */
  damage?: Partial<DamageConfig>;
  /** Critical rules */
  criticals?: Partial<CriticalsConfig>;
  /** Roll-under system (for d100 games) */
  rollUnder?: RollUnderConfig;
  /** Advantage/disadvantage mechanics */
  advantage?: Partial<AdvantageConfig>;
  /** Default resistance multiplier (default: 0.5) */
  resistanceMultiplier?: number;
  /** Default vulnerability multiplier (default: 2.0) */
  vulnerabilityMultiplier?: number;
  /** Outcome thresholds for three-tier resolution */
  outcomeThresholds?: Partial<OutcomeThresholdsConfig>;
  /** Stress mechanics configuration */
  stressConfig?: Partial<StressConfig>;
  /** Equipment-string parser tables and defaults */
  equipmentParsing?: Partial<EquipmentParsingConfig>;
}

/**
 * Base defense configuration
 */
export const BASE_DEFENSE: DefenseConfig = {
  base: 10,
  ability: "AGI",
};

/**
 * Base damage configuration
 */
export const BASE_DAMAGE: DamageConfig = {
  addAbility: true,
  subtractArmor: true,
  minimumDamage: 0,
  grazeMultiplier: 0.5,
};

/**
 * Base critical configuration
 */
export const BASE_CRITICALS: CriticalsConfig = {
  successOn: [20],
  failureOn: [1],
  damageMultiplier: 2,
  autoSuccess: true,
  autoFailure: true,
};

/**
 * Base advantage configuration
 */
export const BASE_ADVANTAGE: AdvantageConfig = {
  dice: "d20",
};

/**
 * Base equipment-parsing configuration (fantasy-leaning English defaults).
 */
export const BASE_EQUIPMENT_PARSING: EquipmentParsingConfig = {
  rangedKeywords: ["ranged", "thrown", "bow", "crossbow", "sling"],
  abilityKeywords: {
    str: "STR",
    agi: "AGI",
    wit: "WIT",
    con: "CON",
    strength: "STR",
    agility: "AGI",
    dexterity: "AGI",
    dex: "AGI",
  },
  defaultMeleeAbility: "STR",
  defaultRangedAbility: "AGI",
  defaultDamage: "d4",
};

/**
 * Fully resolved mechanics with all defaults applied
 */
export interface ResolvedMechanics {
  defense: DefenseConfig;
  damage: DamageConfig;
  criticals: CriticalsConfig;
  rollUnder?: RollUnderConfig;
  advantage: AdvantageConfig;
  resistanceMultiplier: number;
  vulnerabilityMultiplier: number;
  outcomeThresholds: OutcomeThresholdsConfig;
  stressConfig: StressConfig;
  equipmentParsing: EquipmentParsingConfig;
}

/**
 * Resolve mechanics configuration with defaults
 */
export function resolveMechanics(config?: MechanicsConfig): ResolvedMechanics {
  return {
    defense: { ...BASE_DEFENSE, ...config?.defense },
    damage: { ...BASE_DAMAGE, ...config?.damage },
    criticals: { ...BASE_CRITICALS, ...config?.criticals },
    rollUnder: config?.rollUnder,
    advantage: { ...BASE_ADVANTAGE, ...config?.advantage },
    resistanceMultiplier: config?.resistanceMultiplier ?? 0.5,
    vulnerabilityMultiplier: config?.vulnerabilityMultiplier ?? 2.0,
    outcomeThresholds: { ...DEFAULT_OUTCOME_THRESHOLDS, ...config?.outcomeThresholds },
    stressConfig: { ...BASE_STRESS, ...config?.stressConfig },
    equipmentParsing: { ...BASE_EQUIPMENT_PARSING, ...config?.equipmentParsing },
  };
}

/**
 * Check if a natural roll is a critical success
 */
export function isCriticalSuccess(natural: number, criticals: CriticalsConfig): boolean {
  return criticals.successOn.includes(natural);
}

/**
 * Check if a natural roll is a critical failure
 */
export function isCriticalFailure(natural: number, criticals: CriticalsConfig): boolean {
  return criticals.failureOn.includes(natural);
}
