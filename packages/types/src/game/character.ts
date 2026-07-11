/**
 * Character types
 */

import type { Abilities, AbilityName } from "./abilities.js";
import type { Condition, Effect } from "./conditions.js";
import type { CharacterInventory } from "./inventory.js";
import type { StressTracker, Trauma } from "./stress.js";

/**
 * Character psychology for story weaving
 * These elements allow the GM to personalize the narrative
 */
export interface CharacterPsychology {
  /** What terrifies or deeply unsettles the character */
  fears: string[];
  /** Current objectives the character is pursuing */
  goals: string[];
  /** Long-term dreams and desires */
  ambitions: string[];
  /** People, places, or ideals the character cares about */
  bonds: string[];
  /** Weaknesses that can be exploited or cause trouble */
  flaws: string[];
}

/**
 * Create an empty psychology (for characters without defined psychology)
 */
export function createEmptyPsychology(): CharacterPsychology {
  return {
    fears: [],
    goals: [],
    ambitions: [],
    bonds: [],
    flaws: [],
  };
}

/**
 * A skill provides a bonus to related tests
 */
export interface Skill {
  id: string;
  name: string;
  ability: AbilityName;
  bonus: number; // +1 to +5
  description: string;
}

/**
 * Special ability granted by archetype or advancement
 */
export interface SpecialAbility {
  id: string;
  name: string;
  description: string;
  usage: "passive" | "per_scene" | "per_session" | "per_day";
  usesRemaining?: number;
  effect: Effect;
}

/**
 * Character equipment (narrative, not itemized)
 */
export interface CharacterEquipment {
  /** e.g., ["Katana (d8)", "Pistol (d6)"] */
  weapons: string[];
  /** e.g., "Light armor (+1 defense)" */
  armor: string | null;
  /** Explicit armor value (preferred over parsing from armor string) */
  armorValue?: number;
  /** e.g., ["Medkit", "Grappling hook"] */
  gear: string[];
}

/**
 * A playable character (PC or NPC)
 */
export interface Character {
  id: string;
  name: string;
  archetypeId: string;

  // Stats
  abilities: Abilities;
  hp: { current: number; max: number };

  // Capabilities
  skills: Skill[];
  specialAbilities: SpecialAbility[];

  // Equipment (narrative mode - backwards compatible)
  equipment: CharacterEquipment;

  /**
   * Explicit armor value (preferred over parsing from equipment.armor string)
   * Provides direct access like Enemy.armor for consistency
   */
  armor?: number;

  /**
   * Unified inventory system (optional)
   * When present, this takes precedence over `equipment` for item resolution.
   * Supports both narrative and itemized modes.
   */
  inventory?: CharacterInventory;

  // State
  conditions: Condition[];
  flags: string[];

  // Metadata
  personality: string[];
  background: string;

  // Psychology (for story weaving)
  psychology: CharacterPsychology;

  // Stress mechanics (FitD-style, optional for backwards compat)
  /** Current stress level for push/resist mechanics */
  stress?: StressTracker;
  /** Permanent narrative consequences from exceeding max stress */
  trauma?: Trauma[];
}

/**
 * A weapon for combat.
 *
 * `ability` is a string ability id (looked up against the world's resolved
 * abilities — `Abilities` has a string index signature), not the legacy
 * narrow {@link AbilityName} type, so worlds with custom abilities can
 * declare weapons that use them.
 */
export interface Weapon {
  name: string;
  damage: string; // Dice expression, e.g., "d8"
  ability: string; // Which ability for attack rolls (e.g. "STR", or a custom id like "INT")
  skill?: string; // Associated skill
  properties?: string[];
}

/**
 * Narrative role an NPC plays in the story
 */
export type NarrativeRole =
  | "quest_giver" // Provides hooks and missions
  | "ally" // Helps the party
  | "obstacle" // Complicates progress (not necessarily hostile)
  | "information" // Provides knowledge or clues
  | "antagonist" // Opposes the party's goals
  | "merchant" // Provides goods/services
  | "background"; // Ambient NPC, adds atmosphere

/**
 * An NPC (non-player character)
 */
export interface NPC {
  id: string;
  name: string;
  description: string;
  personality: string;
  motivation: string;
  attitude: "friendly" | "neutral" | "hostile" | "unknown";
  dialogueHints: string[];

  // Story weaving
  /** Role this NPC plays in the narrative */
  narrativeRole: NarrativeRole;
  /** Scene IDs where this NPC appears */
  sceneAppearances?: string[];
  /** Character IDs this NPC has relationships with */
  relationships?: Record<string, string>;

  /**
   * Image URLs populated by `generate_portrait`. Slim inline shape
   * (deliberately not importing `EntityImages` from `@mythxengine/worlds`
   * to avoid a circular dep — worlds depends on types).
   */
  images?: {
    portrait?: { url: string; alt?: string };
  };

  /**
   * Marks NPCs added via `add_npc` at runtime. These are session-scoped
   * (not pack-scoped) — their portraits go to session media and they
   * live on `SessionState.npcs` for the lifetime of the session. The
   * post-release world-delta flow can promote runtime NPCs to pack
   * additions; until then the world pack stays read-only.
   */
  runtime?: boolean;
}

/**
 * An enemy combatant
 */
export interface Enemy {
  id: string;
  name: string;
  description: string;
  abilities: Abilities;
  hp: { current: number; max: number };
  armor: number;
  attacks: Weapon[];
  conditions: Condition[];
  threat: "minion" | "standard" | "elite" | "boss";
}

/**
 * Check if a character has the unified inventory system enabled
 */
export function hasInventory(character: Character): boolean {
  return character.inventory !== undefined;
}

/**
 * Check if a character is using itemized inventory mode
 */
export function hasItemizedInventory(character: Character): boolean {
  return character.inventory?.mode === "itemized";
}

/**
 * Check if a character is using narrative inventory mode
 * (either via legacy equipment or inventory.mode === "narrative")
 */
export function hasNarrativeInventory(character: Character): boolean {
  return !character.inventory || character.inventory.mode === "narrative";
}
