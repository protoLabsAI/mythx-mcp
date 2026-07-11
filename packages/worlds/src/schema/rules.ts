/**
 * Rules Configuration Zod Schemas
 *
 * Zod validators for the rules configuration system.
 * These schemas validate world pack rules configurations.
 */

import { z } from "zod";

// ============================================================================
// ABILITY CONFIGURATION
// ============================================================================

/**
 * How an ability is used in the system
 */
export const AbilityUsageSchema = z.object({
  meleeAttack: z.boolean().optional(),
  rangedAttack: z.boolean().optional(),
  defense: z.boolean().optional(),
  damage: z.boolean().optional(),
  hp: z.boolean().optional(),
  initiative: z.boolean().optional(),
});

export type AbilityUsage = z.infer<typeof AbilityUsageSchema>;

/**
 * Base ability definition object (without refinements, for partial use)
 */
export const AbilityDefinitionBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  minValue: z.number(),
  maxValue: z.number(),
  defaultValue: z.number(),
  usage: AbilityUsageSchema.optional(),
});

/**
 * Definition of a single ability (with validation refinements)
 */
export const AbilityDefinitionSchema = AbilityDefinitionBaseSchema.refine(
  (data) => data.minValue < data.maxValue,
  { message: "minValue must be less than maxValue" }
).refine((data) => data.defaultValue >= data.minValue && data.defaultValue <= data.maxValue, {
  message: "defaultValue must be between minValue and maxValue",
});

export type AbilityDefinition = z.infer<typeof AbilityDefinitionSchema>;

/**
 * Partial ability definition for overrides (excludes id, no refinements)
 */
export const AbilityOverrideSchema = AbilityDefinitionBaseSchema.omit({ id: true }).partial();

export type AbilityOverride = z.infer<typeof AbilityOverrideSchema>;

/**
 * Configuration for abilities in a world pack
 */
export const AbilitiesConfigSchema = z
  .object({
    replace: z.array(AbilityDefinitionSchema).optional(),
    add: z.array(AbilityDefinitionSchema).optional(),
    override: z.record(z.string(), AbilityOverrideSchema).optional(),
  })
  .refine(
    (data) => {
      // Can't use both replace and add/override
      if (data.replace && (data.add || data.override)) {
        return false;
      }
      return true;
    },
    { message: "Cannot use 'replace' together with 'add' or 'override'" }
  );

export type AbilitiesConfig = z.infer<typeof AbilitiesConfigSchema>;

// ============================================================================
// DIFFICULTY CONFIGURATION
// ============================================================================

/**
 * Definition of a difficulty level
 */
export const DifficultyDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  target: z.number().int(),
  description: z.string().optional(),
});

export type DifficultyDefinition = z.infer<typeof DifficultyDefinitionSchema>;

/**
 * Configuration for difficulties in a world pack
 */
export const DifficultiesConfigSchema = z.object({
  replace: z.array(DifficultyDefinitionSchema).optional(),
  add: z.array(DifficultyDefinitionSchema).optional(),
});

export type DifficultiesConfig = z.infer<typeof DifficultiesConfigSchema>;

// ============================================================================
// MECHANICS CONFIGURATION
// ============================================================================

/**
 * Defense calculation configuration
 */
export const DefenseConfigSchema = z.object({
  base: z.number().int(),
  ability: z.string().optional(),
});

export type DefenseConfig = z.infer<typeof DefenseConfigSchema>;

/**
 * Damage calculation configuration
 */
export const DamageConfigSchema = z.object({
  addAbility: z.boolean(),
  subtractArmor: z.boolean(),
  minimumDamage: z.number().int().min(0),
  grazeMultiplier: z.number().min(0).max(1),
});

export type DamageConfig = z.infer<typeof DamageConfigSchema>;

/**
 * Critical hit/miss configuration
 */
export const CriticalsConfigSchema = z.object({
  successOn: z.array(z.number().int()),
  failureOn: z.array(z.number().int()),
  damageMultiplier: z.number().positive(),
  autoSuccess: z.boolean(),
  autoFailure: z.boolean(),
});

export type CriticalsConfig = z.infer<typeof CriticalsConfigSchema>;

/**
 * Roll-under system configuration
 */
export const RollUnderConfigSchema = z.object({
  enabled: z.boolean(),
  dice: z.string(),
});

export type RollUnderConfig = z.infer<typeof RollUnderConfigSchema>;

/**
 * Advantage/disadvantage configuration
 */
export const AdvantageConfigSchema = z.object({
  dice: z.string(),
});

export type AdvantageConfig = z.infer<typeof AdvantageConfigSchema>;

/**
 * Outcome thresholds — base shape (without ordering refinement).
 *
 * Kept as a plain `ZodObject` so callers can still apply `.partial()` to
 * it inside the larger MechanicsConfig (Zod's `.partial()` is only
 * available on `ZodObject`, not `ZodEffects`). The refined version
 * below is the one to use when validating a fully-specified config at
 * the world-input boundary.
 */
const OutcomeThresholdsConfigBaseSchema = z.object({
  criticalSuccess: z.number().int(),
  success: z.number().int(),
  partial: z.number().int(),
});

/**
 * Outcome thresholds for the five-tier system.
 *
 * Order matters: a margin >= criticalSuccess is a crit, >= success is a
 * full success, >= partial is a partial, otherwise failure. If the
 * inequalities aren't strictly descending (criticalSuccess >= success
 * >= partial) the resolver short-circuits in the wrong tier and the
 * five-tier ladder collapses, so we reject inverted ladders here.
 */
export const OutcomeThresholdsConfigSchema = OutcomeThresholdsConfigBaseSchema.refine(
  ({ criticalSuccess, success, partial }) => criticalSuccess >= success && success >= partial,
  {
    message: "Thresholds must satisfy criticalSuccess >= success >= partial",
    path: ["criticalSuccess"],
  }
);

export type OutcomeThresholdsConfig = z.infer<typeof OutcomeThresholdsConfigSchema>;

/**
 * Stress mechanics configuration
 */
export const StressConfigSchema = z.object({
  maxStress: z.number().int().min(1),
  pushCost: z.number().int().min(0),
  pushBonus: z.string(),
  flashbackCost: z.number().int().min(0),
  resistSeverityCosts: z.object({
    minor: z.number().int().min(0),
    moderate: z.number().int().min(0),
    severe: z.number().int().min(0),
  }),
  resistThreshold: z.number().int(),
  recoveryPerShortRest: z.number().int().min(0),
  recoveryPerLongRest: z.union([z.literal("all"), z.number().int().min(0)]),
});

export type StressConfig = z.infer<typeof StressConfigSchema>;

/**
 * Equipment-string parser configuration
 */
export const EquipmentParsingConfigSchema = z.object({
  rangedKeywords: z.array(z.string()),
  abilityKeywords: z.record(z.string(), z.string()),
  defaultMeleeAbility: z.string(),
  defaultRangedAbility: z.string(),
  defaultDamage: z.string(),
});

export type EquipmentParsingConfig = z.infer<typeof EquipmentParsingConfigSchema>;

/**
 * Full mechanics configuration
 */
export const MechanicsConfigSchema = z.object({
  defense: DefenseConfigSchema.partial().optional(),
  damage: DamageConfigSchema.partial().optional(),
  criticals: CriticalsConfigSchema.partial().optional(),
  rollUnder: RollUnderConfigSchema.optional(),
  advantage: AdvantageConfigSchema.partial().optional(),
  resistanceMultiplier: z.number().positive().optional(),
  vulnerabilityMultiplier: z.number().positive().optional(),
  // Partial thresholds skip the ordering refinement (a partial override
  // gets merged with ordered defaults at resolve time, so the merged
  // result stays well-formed). Fully-specified threshold objects should
  // still validate via `OutcomeThresholdsConfigSchema` directly.
  outcomeThresholds: OutcomeThresholdsConfigBaseSchema.partial().optional(),
  stressConfig: StressConfigSchema.partial().optional(),
  equipmentParsing: EquipmentParsingConfigSchema.partial().optional(),
});

export type MechanicsConfig = z.infer<typeof MechanicsConfigSchema>;

// ============================================================================
// CUSTOM TESTS CONFIGURATION
// ============================================================================

/**
 * Roll configuration for a custom test
 */
export const CustomTestRollSchema = z.object({
  dice: z.string().min(1),
  ability: z.string().optional(),
  underAbility: z.string().optional(),
  difficulty: z.number().int().optional(),
  difficultyFormula: z.string().optional(),
  skill: z.string().optional(),
});

export type CustomTestRoll = z.infer<typeof CustomTestRollSchema>;

/**
 * Advantage/disadvantage scope
 */
const AdvantageScopeSchema = z.enum(["attacks", "defense", "skill_tests", "all"]);

/**
 * Effect schemas - discriminated union of all effect types
 */
const ModifyAbilityEffectSchema = z.object({
  type: z.literal("MODIFY_ABILITY"),
  ability: z.string(),
  amount: z.number(),
});

const ModifySkillEffectSchema = z.object({
  type: z.literal("MODIFY_SKILL"),
  skillId: z.string(),
  amount: z.number(),
});

const GrantAdvantageEffectSchema = z.object({
  type: z.literal("GRANT_ADVANTAGE"),
  scope: AdvantageScopeSchema,
  skills: z.array(z.string()).optional(),
});

const GrantDisadvantageEffectSchema = z.object({
  type: z.literal("GRANT_DISADVANTAGE"),
  scope: AdvantageScopeSchema,
  skills: z.array(z.string()).optional(),
});

const ResistanceEffectSchema = z.object({
  type: z.literal("RESISTANCE"),
  damageType: z.string(),
  multiplier: z.number().optional(),
});

const VulnerabilityEffectSchema = z.object({
  type: z.literal("VULNERABILITY"),
  damageType: z.string(),
  multiplier: z.number().optional(),
});

/**
 * Effect schema - discriminated union of all effect types
 */
export const EffectSchema = z.discriminatedUnion("type", [
  ModifyAbilityEffectSchema,
  ModifySkillEffectSchema,
  GrantAdvantageEffectSchema,
  GrantDisadvantageEffectSchema,
  ResistanceEffectSchema,
  VulnerabilityEffectSchema,
]);

/**
 * A single entry in an outcome table
 */
export const TableEntrySchema = z.object({
  range: z.tuple([z.number().int(), z.number().int()]),
  description: z.string(),
  effects: z.array(EffectSchema).optional(),
});

export type TableEntry = z.infer<typeof TableEntrySchema>;

/**
 * A table of outcomes
 */
export const OutcomeTableSchema = z.object({
  dice: z.string().min(1),
  addAbility: z.string().optional(),
  entries: z.array(TableEntrySchema),
});

export type OutcomeTable = z.infer<typeof OutcomeTableSchema>;

/**
 * Outcome definition for a test result
 */
export const CustomTestOutcomeSchema = z.object({
  description: z.string(),
  effects: z.array(EffectSchema).optional(),
  table: OutcomeTableSchema.optional(),
});

export type CustomTestOutcome = z.infer<typeof CustomTestOutcomeSchema>;

/**
 * Threshold trigger configuration
 */
export const ThresholdTriggerSchema = z.object({
  ability: z.string(),
  threshold: z.number(),
  direction: z.enum(["above", "below", "equals"]),
});

export type ThresholdTrigger = z.infer<typeof ThresholdTriggerSchema>;

/**
 * Full definition of a custom test type
 */
export const CustomTestDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    triggers: z.array(z.string()),
    thresholdTrigger: ThresholdTriggerSchema.optional(),
    roll: CustomTestRollSchema,
    outcomes: z.object({
      criticalSuccess: CustomTestOutcomeSchema.optional(),
      success: CustomTestOutcomeSchema.optional(),
      failure: CustomTestOutcomeSchema.optional(),
      criticalFailure: CustomTestOutcomeSchema.optional(),
    }),
    retryable: z.boolean().optional(),
    cooldownMinutes: z.number().int().positive().optional(),
  })
  .refine((data) => data.outcomes.success || data.outcomes.failure, {
    message: "At least success or failure outcome is required",
  });

export type CustomTestDefinition = z.infer<typeof CustomTestDefinitionSchema>;

/**
 * Configuration for custom tests
 */
export const CustomTestsConfigSchema = z.object({
  tests: z.array(CustomTestDefinitionSchema),
});

export type CustomTestsConfig = z.infer<typeof CustomTestsConfigSchema>;

// ============================================================================
// WORLD RULES CONFIG (TOP LEVEL)
// ============================================================================

/**
 * Complete rules configuration for a world pack
 */
export const WorldRulesConfigSchema = z.object({
  abilities: AbilitiesConfigSchema.optional(),
  difficulties: DifficultiesConfigSchema.optional(),
  mechanics: MechanicsConfigSchema.optional(),
  customTests: CustomTestsConfigSchema.optional(),
});

export type WorldRulesConfig = z.infer<typeof WorldRulesConfigSchema>;
