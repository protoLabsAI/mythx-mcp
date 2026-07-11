/**
 * Portable Clues types
 */

import type { GameTime } from "@mythxengine/types";

/** Clue significance levels */
export const SIGNIFICANCE_LEVELS = ["minor", "moderate", "major", "critical"] as const;
export type SignificanceLevel = (typeof SIGNIFICANCE_LEVELS)[number];

/** Source types */
export const SOURCE_TYPES = ["npc", "location", "document", "observation", "item"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Suggested source for a clue
 */
export interface SuggestedSource {
  type: SourceType;
  id?: string;
  description: string;
}

/**
 * Prerequisites for revealing a clue
 */
export interface CluePrerequisites {
  requiredFlags?: string[];
  requiredEvidence?: string[];
  notBefore?: { day: number; hour: number };
}

/**
 * Portable clue structure
 */
export interface PortableClue {
  id: string;
  information: string;
  significance: SignificanceLevel;
  suggestedSources: SuggestedSource[];
  prerequisites?: CluePrerequisites;
  revealsLeadTo?: string;
  setsFlags?: string[];
  revealed: boolean;
  revealedAt?: GameTime;
  revealedVia?: string;
  gmNotes?: string;
}

/**
 * Session with portable clues
 */
export interface CluesSession {
  worldState: {
    portableClues?: PortableClue[];
    investigations?: Array<{ evidence: Array<{ id: string }> }>;
  };
  flags: string[];
  gameTime: GameTime;
}

/**
 * Get clues from session
 */
export function getClues(session: CluesSession): PortableClue[] {
  return session.worldState.portableClues || [];
}

/**
 * Save clues to session
 */
export function saveClues(session: CluesSession, clues: PortableClue[]): void {
  session.worldState.portableClues = clues;
}

/**
 * Format game time
 */
export function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}

/**
 * Check if clue prerequisites are met
 */
export function checkPrerequisites(
  clue: PortableClue,
  flags: string[],
  gameTime: GameTime,
  investigations: Array<{ evidence: Array<{ id: string }> }>
): { available: boolean; reason?: string } {
  if (!clue.prerequisites) {
    return { available: true };
  }

  // Check required flags
  if (clue.prerequisites.requiredFlags) {
    for (const flag of clue.prerequisites.requiredFlags) {
      if (!flags.includes(flag)) {
        return { available: false, reason: `Missing flag: ${flag}` };
      }
    }
  }

  // Check required evidence
  if (clue.prerequisites.requiredEvidence) {
    const allEvidence = investigations.flatMap((i) => i.evidence.map((e) => e.id));
    for (const evidenceId of clue.prerequisites.requiredEvidence) {
      if (!allEvidence.includes(evidenceId)) {
        return { available: false, reason: `Missing evidence: ${evidenceId}` };
      }
    }
  }

  // Check time window
  if (clue.prerequisites.notBefore) {
    const { day, hour } = clue.prerequisites.notBefore;
    if (gameTime.day < day || (gameTime.day === day && gameTime.hour < hour)) {
      return { available: false, reason: `Not available until Day ${day}, ${hour}:00` };
    }
  }

  return { available: true };
}
