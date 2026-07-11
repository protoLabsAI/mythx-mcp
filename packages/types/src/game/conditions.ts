/**
 * Conditions and effects
 */

import type { AbilityName } from "./abilities.js";
import type { GameTime } from "./state.js";

/**
 * A status condition on a character
 */
export interface Condition {
  id: string;
  name: string;
  description: string;
  duration: number | "permanent" | "until_rest";
  effects: Effect[];
  stackable: boolean;
  /** Optional: game time when this condition expires (for time-based conditions) */
  expiresAtGameTime?: GameTime;
}

/**
 * Scope for advantage/disadvantage effects
 */
export type AdvantageScope = "attacks" | "defense" | "skill_tests" | "all";

/**
 * An effect that modifies game state.
 *
 * Only the variants the engine actually consumes live here. Earlier
 * drafts had `MODIFY_HP`, `MODIFY_DEFENSE`, `ADD_CONDITION`,
 * `REMOVE_CONDITION`, `SET_FLAG`, `DEAL_DAMAGE`, `HEAL`, and `NARRATIVE`
 * variants as well, but none had a runtime consumer (engine or tools)
 * — they were intent-carriers for a system that never landed. If we
 * need them, add them back together with the consumer that reads them.
 */
export type Effect =
  | { type: "MODIFY_ABILITY"; ability: AbilityName; amount: number }
  | { type: "MODIFY_SKILL"; skillId: string; amount: number }
  | { type: "GRANT_ADVANTAGE"; scope: AdvantageScope; skills?: string[] }
  | { type: "GRANT_DISADVANTAGE"; scope: AdvantageScope; skills?: string[] }
  | { type: "RESISTANCE"; damageType: string; multiplier?: number }
  | { type: "VULNERABILITY"; damageType: string; multiplier?: number };

export type EffectType = Effect["type"];

/**
 * Common conditions
 */
export const COMMON_CONDITIONS = {
  WOUNDED: {
    id: "wounded",
    name: "Wounded",
    description: "-1 to all tests",
    duration: "until_rest" as const,
    effects: [
      { type: "MODIFY_ABILITY" as const, ability: "STR" as const, amount: -1 },
      { type: "MODIFY_ABILITY" as const, ability: "AGI" as const, amount: -1 },
      { type: "MODIFY_ABILITY" as const, ability: "WIT" as const, amount: -1 },
      { type: "MODIFY_ABILITY" as const, ability: "CON" as const, amount: -1 },
    ],
    stackable: false,
  },
  STUNNED: {
    id: "stunned",
    name: "Stunned",
    description: "Skip next turn",
    duration: 1,
    effects: [],
    stackable: false,
  },
  FRIGHTENED: {
    id: "frightened",
    name: "Frightened",
    description: "-2 to attacks, can't approach source",
    duration: 3,
    effects: [{ type: "MODIFY_SKILL" as const, skillId: "combat", amount: -2 }],
    stackable: false,
  },
  INSPIRED: {
    id: "inspired",
    name: "Inspired",
    description: "+2 to all tests until end of scene",
    duration: "until_rest" as const,
    effects: [
      { type: "MODIFY_ABILITY" as const, ability: "STR" as const, amount: 2 },
      { type: "MODIFY_ABILITY" as const, ability: "AGI" as const, amount: 2 },
      { type: "MODIFY_ABILITY" as const, ability: "WIT" as const, amount: 2 },
      { type: "MODIFY_ABILITY" as const, ability: "CON" as const, amount: 2 },
    ],
    stackable: false,
  },
  BLESSED: {
    id: "blessed",
    name: "Blessed",
    description: "Advantage on all rolls",
    duration: 3,
    effects: [{ type: "GRANT_ADVANTAGE" as const, scope: "all" as const }],
    stackable: false,
  },
  CURSED: {
    id: "cursed",
    name: "Cursed",
    description: "Disadvantage on all rolls",
    duration: 3,
    effects: [{ type: "GRANT_DISADVANTAGE" as const, scope: "all" as const }],
    stackable: false,
  },
  HIDDEN: {
    id: "hidden",
    name: "Hidden",
    description: "Advantage on attacks until revealed",
    duration: "until_rest" as const,
    effects: [{ type: "GRANT_ADVANTAGE" as const, scope: "attacks" as const }],
    stackable: false,
  },
  FIRE_RESISTANT: {
    id: "fire_resistant",
    name: "Fire Resistant",
    description: "Takes half damage from fire",
    duration: "permanent" as const,
    effects: [{ type: "RESISTANCE" as const, damageType: "fire" }],
    stackable: false,
  },
  FIRE_VULNERABLE: {
    id: "fire_vulnerable",
    name: "Fire Vulnerable",
    description: "Takes double damage from fire",
    duration: "permanent" as const,
    effects: [{ type: "VULNERABILITY" as const, damageType: "fire" }],
    stackable: false,
  },
  PRONE: {
    id: "prone",
    name: "Prone",
    description: "Attackers have advantage (melee) or disadvantage (ranged)",
    duration: "permanent" as const,
    effects: [], // Handled situationally by GM
    stackable: false,
  },
} as const;
