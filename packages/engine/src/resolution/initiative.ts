/**
 * Initiative resolution
 */

import type { Character, Enemy, InitiativeResult } from "@mythxengine/types";
import type { RNG } from "../rng/rng.js";
import { rollDice } from "../dice/roller.js";
import type { RulesContext } from "../rules/context.js";
import { getDefaultRulesContext, getInitiativeAbility } from "../rules/context.js";

type Combatant = Character | Enemy;

/**
 * Roll initiative for all combatants.
 *
 * Initiative formula: `d20 + abilities[initiativeAbility]`, where the
 * initiative ability is resolved from the world's rules (the first
 * ability flagged `usage.initiative: true`, defaulting to AGI).
 *
 * Ties are broken by the same ability mod, descending.
 *
 * Returns the combatant ids in turn order (highest first).
 */
export function rollInitiative(
  combatants: readonly Combatant[],
  rng: RNG,
  rules: RulesContext = getDefaultRulesContext()
): string[] {
  const ability = getInitiativeAbility(rules);
  const results: InitiativeResult[] = [];

  for (const combatant of combatants) {
    const roll = rollDice("d20", rng);
    const mod = combatant.abilities[ability] ?? 0;
    const total = roll.total + mod;

    results.push({
      characterId: combatant.id,
      roll,
      total,
    });
  }

  results.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const combatantA = combatants.find((c) => c.id === a.characterId);
    const combatantB = combatants.find((c) => c.id === b.characterId);
    const modA = combatantA?.abilities[ability] ?? 0;
    const modB = combatantB?.abilities[ability] ?? 0;
    return modB - modA;
  });

  return results.map((r) => r.characterId);
}

/**
 * Get initiative results with full details.
 */
export function rollInitiativeDetailed(
  combatants: readonly Combatant[],
  rng: RNG,
  rules: RulesContext = getDefaultRulesContext()
): InitiativeResult[] {
  const ability = getInitiativeAbility(rules);
  const results: InitiativeResult[] = [];

  for (const combatant of combatants) {
    const roll = rollDice("d20", rng);
    const mod = combatant.abilities[ability] ?? 0;
    const total = roll.total + mod;

    results.push({
      characterId: combatant.id,
      roll,
      total,
    });
  }

  results.sort((a, b) => b.total - a.total);

  return results;
}
