/**
 * Rules Context
 *
 * Provides resolved rules to engine functions.
 * When no rules context is provided, default rules are used.
 */

import {
  type ResolvedRules,
  type ResolvedMechanics,
  type CriticalsConfig,
  type DamageConfig,
  type AbilityDefinition,
  type WorldRulesConfig,
  resolveRules,
  validateRulesConfig,
  isCriticalSuccess,
  isCriticalFailure,
} from "@mythxengine/types";
import type { WeaponParseOptions } from "../equipment/parser.js";

/**
 * Rules context for engine functions
 */
export interface RulesContext {
  /** Fully resolved rules */
  rules: ResolvedRules;
}

// Cached default rules (module-level singleton)
let defaultRulesCache: ResolvedRules | null = null;

/**
 * Get or create default rules (cached)
 */
export function getDefaultRulesContext(): RulesContext {
  if (!defaultRulesCache) {
    defaultRulesCache = resolveRules();
  }
  return { rules: defaultRulesCache };
}

/**
 * Reset the default rules cache.
 * Intended for test isolation - call in beforeEach/afterEach to prevent
 * test pollution from cached state.
 */
export function resetDefaultRulesCache(): void {
  defaultRulesCache = null;
}

/**
 * Create a rules context from a world pack's rules config
 * @throws Error if rulesConfig is invalid
 */
export function createRulesContext(rulesConfig?: unknown): RulesContext {
  if (!rulesConfig) {
    return getDefaultRulesContext();
  }

  // Basic structure check
  if (typeof rulesConfig !== "object" || rulesConfig === null) {
    throw new Error("rulesConfig must be an object");
  }

  // Validate the config
  const config = rulesConfig as WorldRulesConfig;
  const errors = validateRulesConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid rules config: ${errors.join("; ")}`);
  }

  return { rules: resolveRules(config) };
}

/**
 * Get the mechanics config from rules context
 */
export function getMechanics(ctx: RulesContext): ResolvedMechanics {
  return ctx.rules.mechanics;
}

/**
 * Get the criticals config from rules context
 */
export function getCriticals(ctx: RulesContext): CriticalsConfig {
  return ctx.rules.mechanics.criticals;
}

/**
 * Check if a natural roll is a critical success using rules context
 */
export function checkCriticalSuccess(ctx: RulesContext, natural: number): boolean {
  return isCriticalSuccess(natural, ctx.rules.mechanics.criticals);
}

/**
 * Check if a natural roll is a critical failure using rules context
 */
export function checkCriticalFailure(ctx: RulesContext, natural: number): boolean {
  return isCriticalFailure(natural, ctx.rules.mechanics.criticals);
}

/**
 * Get ability definition by ID
 */
export function getAbilityDefinition(
  ctx: RulesContext,
  abilityId: string
): AbilityDefinition | undefined {
  return ctx.rules.abilityMap.get(abilityId);
}

/**
 * Check if an ability ID is valid in this rules context
 */
export function isValidAbility(ctx: RulesContext, abilityId: string): boolean {
  return ctx.rules.abilityMap.has(abilityId);
}

/**
 * Get the defense ability (AGI by default, or from rules config)
 */
export function getDefenseAbility(ctx: RulesContext): string {
  return ctx.rules.mechanics.defense.ability ?? "AGI";
}

/**
 * Get the initiative ability id.
 *
 * Resolution order:
 *  1. The first ability whose `usage.initiative === true` (per
 *     {@link AbilityDefinition}).
 *  2. Fall back to "AGI" so that the default ability set still works.
 */
export function getInitiativeAbility(ctx: RulesContext): string {
  const flagged = ctx.rules.abilities.find((a) => a.usage?.initiative === true);
  return flagged?.id ?? "AGI";
}

/**
 * Get the base defense value
 */
export function getBaseDefense(ctx: RulesContext): number {
  return ctx.rules.mechanics.defense.base;
}

/**
 * Calculate defense target for a defender
 */
export function calculateDefenseTarget(
  ctx: RulesContext,
  defenderAbilities: Record<string, number>
): number {
  const { base, ability } = ctx.rules.mechanics.defense;
  const abilityId = ability ?? "AGI";
  const abilityMod = defenderAbilities[abilityId] ?? 0;
  return base + abilityMod;
}

/**
 * Get the damage config from rules context
 */
export function getDamageConfig(ctx: RulesContext): DamageConfig {
  return ctx.rules.mechanics.damage;
}

/**
 * Get resistance multiplier from rules
 */
export function getResistanceMultiplier(ctx: RulesContext): number {
  return ctx.rules.mechanics.resistanceMultiplier;
}

/**
 * Get vulnerability multiplier from rules
 */
export function getVulnerabilityMultiplier(ctx: RulesContext): number {
  return ctx.rules.mechanics.vulnerabilityMultiplier;
}

/**
 * Check if this is a roll-under system.
 * Defensive: a malformed RulesContext (missing `mechanics`) returns
 * the default-system answer (false) instead of crashing — see
 * docs/audits/chat-flow-audit.md and the chat-harness battle-test
 * that surfaced this with a "Cannot read properties of undefined
 * (reading 'rollUnder')" stack from the chat agent.
 */
export function isRollUnder(ctx: RulesContext): boolean {
  return ctx.rules?.mechanics?.rollUnder?.enabled ?? false;
}

/**
 * Get the dice to use for tests (d20 or d100 for roll-under).
 * Defensive against partial RulesContext (see `isRollUnder`).
 */
export function getTestDice(ctx: RulesContext): string {
  return ctx.rules?.mechanics?.rollUnder?.enabled
    ? (ctx.rules.mechanics.rollUnder.dice ?? "d20")
    : "d20";
}

/**
 * Build {@link WeaponParseOptions} from a rules context. Use this when
 * calling the equipment parser so worlds can override keyword sets and
 * defaults via `MechanicsConfig.equipmentParsing`. Ability ids stay as
 * `string` end-to-end so worlds with custom abilities work correctly.
 */
export function getWeaponParseOptions(ctx: RulesContext): WeaponParseOptions {
  const cfg = ctx.rules.mechanics.equipmentParsing;
  return {
    rangedKeywords: cfg.rangedKeywords,
    abilityKeywords: cfg.abilityKeywords,
    defaultAbility: cfg.defaultMeleeAbility,
    defaultRangedAbility: cfg.defaultRangedAbility,
    defaultDamage: cfg.defaultDamage,
  };
}
