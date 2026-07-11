/**
 * Shared types for encounter tools
 */

/**
 * Difficulty levels
 */
export const DIFFICULTIES = ["easy", "medium", "hard", "deadly"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Encounter types
 */
export const ENCOUNTER_TYPES = ["combat", "social", "puzzle", "environmental"] as const;
export type EncounterType = (typeof ENCOUNTER_TYPES)[number];

/**
 * Threat tiers from M0 type system
 */
export type ThreatTier = "minion" | "standard" | "elite" | "boss";

/**
 * Monster interface from generated content
 */
export interface Monster {
  id: string;
  name: string;
  description: string;
  threatTier: ThreatTier;
  hp: number;
  abilities: { STR: number; AGI: number; WIT: number; CON: number };
  attacks: Array<{ name: string; damage: string; ability: string }>;
  tags?: string[];
  tactics?: string;
}

/**
 * Location interface
 */
export interface Location {
  id: string;
  name: string;
  type: string;
  encounters: string[];
  atmosphere: string;
}

/**
 * Encounter interface from generated content
 */
export interface Encounter {
  id: string;
  name: string;
  description: string;
  type: string;
  difficulty: string;
  monsters?: Array<{ monsterId: string; count: number }>;
  setup?: string;
  tactics?: string;
}

/**
 * Session type with generation content
 */
export interface SessionWithGeneration {
  characters: Record<string, unknown>;
  generation?: {
    generatedContent: {
      monsters?: unknown[];
      locations?: unknown[];
      encounters?: unknown[];
    };
  };
}
