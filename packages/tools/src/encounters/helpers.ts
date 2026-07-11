/**
 * Helper functions for encounter tools
 */

import type { Monster, Location, Encounter, SessionWithGeneration, Difficulty, ThreatTier } from "./types.js";

/**
 * Get monsters from session
 */
export function getMonsters(session: SessionWithGeneration): Monster[] {
  if (!session.generation?.generatedContent?.monsters) {
    return [];
  }
  return session.generation.generatedContent.monsters as Monster[];
}

/**
 * Get locations from session
 */
export function getLocations(session: SessionWithGeneration): Location[] {
  if (!session.generation?.generatedContent?.locations) {
    return [];
  }
  return session.generation.generatedContent.locations as Location[];
}

/**
 * Get encounters from session
 */
export function getEncounters(session: SessionWithGeneration): Encounter[] {
  if (!session.generation?.generatedContent?.encounters) {
    return [];
  }
  return session.generation.generatedContent.encounters as Encounter[];
}

/**
 * Calculate threat value for a monster using M0 threat tiers
 */
export function getThreatValue(monster: Monster): number {
  const tierValues: Record<ThreatTier, number> = {
    minion: 1,
    standard: 2,
    elite: 4,
    boss: 8
  };
  return tierValues[monster.threatTier] || 2;
}

/**
 * Calculate party strength
 */
export function getPartyStrength(session: SessionWithGeneration): number {
  const characters = Object.values(session.characters);
  if (characters.length === 0) return 4; // Default party of 4
  return characters.length;
}

/**
 * Get target threat total for difficulty
 */
export function getTargetThreat(difficulty: Difficulty, partySize: number): { min: number; max: number } {
  const base = partySize * 2;
  switch (difficulty) {
    case "easy": return { min: base * 0.5, max: base * 0.75 };
    case "medium": return { min: base * 0.75, max: base * 1.25 };
    case "hard": return { min: base * 1.25, max: base * 2 };
    case "deadly": return { min: base * 2, max: base * 3 };
  }
}

/**
 * Select monsters to meet threat target
 */
export function selectMonsters(
  available: Monster[],
  target: { min: number; max: number },
  include: string[] = [],
  exclude: string[] = []
): Array<{ monster: Monster; count: number }> {
  const selected: Array<{ monster: Monster; count: number }> = [];
  let currentThreat = 0;

  // Filter available monsters
  let pool = available.filter(m => !exclude.includes(m.id));

  // First, add any required monsters
  for (const monsterId of include) {
    const monster = pool.find(m => m.id === monsterId);
    if (monster) {
      selected.push({ monster, count: 1 });
      currentThreat += getThreatValue(monster);
    }
  }

  // Sort remaining by threat tier for variety
  pool = pool.filter(m => !include.includes(m.id));
  pool.sort((a, b) => getThreatValue(a) - getThreatValue(b));

  // Fill to target
  while (currentThreat < target.min && pool.length > 0) {
    // Pick a monster that fits
    const remaining = target.max - currentThreat;

    // Try to find something that fits well
    let picked: Monster | undefined;
    for (const monster of pool) {
      if (getThreatValue(monster) <= remaining + 1) {
        picked = monster;
        break;
      }
    }

    // If nothing fits, take the smallest
    if (!picked) {
      picked = pool[0];
    }

    // Add to selection
    const existing = selected.find(s => s.monster.id === picked!.id);
    if (existing) {
      existing.count++;
    } else {
      selected.push({ monster: picked, count: 1 });
    }
    currentThreat += getThreatValue(picked);

    // Don't add too many of one type
    if (existing && existing.count >= 4) {
      pool = pool.filter(m => m.id !== picked!.id);
    }
  }

  return selected;
}
