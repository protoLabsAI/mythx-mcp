/**
 * Combat Helpers
 *
 * Shared utilities for combat tools.
 */

import type { Character, Enemy } from "@mythxengine/types";

/**
 * Session shape expected by combat helpers
 */
export interface CombatSession {
  characters: Record<string, Character>;
  enemies: Record<string, Enemy>;
}

/**
 * Get a combatant (character or enemy) by ID
 *
 * @param session - Session containing characters and enemies
 * @param id - Combatant ID to look up
 * @returns Character or Enemy if found, null otherwise
 */
export function getCombatant(session: CombatSession, id: string): Character | Enemy | null {
  return session.characters[id] || session.enemies[id] || null;
}
