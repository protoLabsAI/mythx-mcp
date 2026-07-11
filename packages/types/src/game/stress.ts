/**
 * Stress and Trauma types for FitD-style meta-currency mechanics
 */

import { BASE_STRESS } from "../rules/mechanics.js";

/**
 * Stress tracker for FitD-style meta-currency mechanics.
 *
 * @remarks
 * Characters track stress (default max: 9) and can spend it for mechanical benefits:
 * - **Push roll**: Spend 2 stress for +1d6 bonus after failure/partial
 * - **Resist consequence**: Spend 1-3 stress (by severity) to reduce/avoid consequence
 * - **Flashback**: Spend 2 stress for retroactive preparation
 *
 * When stress exceeds max, the character gains a {@link Trauma} - a permanent
 * narrative consequence that shapes their personality and creates roleplay hooks.
 *
 * Stress recovers through rest:
 * - Short rest: Recover 2 stress
 * - Long rest: Recover all stress
 *
 * @example
 * ```typescript
 * // Character has stress: { current: 7, max: 9 }
 *
 * // Push a failed roll
 * await pushRoll({ characterId, originalRoll: 8 });
 * // Stress becomes: { current: 9, max: 9 } - at limit!
 *
 * // Next stress would cause trauma
 * const wouldTrauma = wouldCauseTrauma(character.stress, 1); // true
 * ```
 *
 * @see {@link BASE_STRESS} for default costs and recovery values
 * @see {@link Trauma} for permanent consequences
 */
export interface StressTracker {
  /** Current stress level (0 to max) */
  current: number;
  /** Maximum stress before trauma (default: 9) */
  max: number;
}

/**
 * Permanent narrative consequence from exceeding max stress.
 *
 * @remarks
 * Traumas are lasting effects gained when a character's stress exceeds their max.
 * They shape the character's personality, create roleplay hooks, and persist
 * across sessions. Unlike conditions, traumas cannot be easily removed - they're
 * part of the character's story.
 *
 * Traumas are narrative rather than mechanical. The GM and player use them to
 * inform the character's behavior and decision-making, but they don't impose
 * specific mechanical penalties.
 *
 * @example
 * Common trauma examples:
 * - **Haunted**: Plagued by visions of past failures
 * - **Paranoid**: Sees threats everywhere, trusts no one
 * - **Reckless**: Throws caution to the wind
 * - **Vicious**: Solves problems with violence first
 * - **Obsessed**: Fixated on a goal to the exclusion of all else
 * - **Unstable**: Emotional control is fragile
 *
 * @example
 * ```typescript
 * // When stress exceeds max, gain trauma
 * if (character.stress.current > character.stress.max) {
 *   const trauma: Trauma = {
 *     id: uuid(),
 *     name: "Paranoid",
 *     description: "After the ambush, always expects betrayal",
 *     acquiredAt: new Date().toISOString()
 *   };
 *   character.trauma = [...(character.trauma || []), trauma];
 *   character.stress.current = 0; // Reset stress after trauma
 * }
 * ```
 */
export interface Trauma {
  /** Unique identifier */
  id: string;
  /** Name of the trauma (e.g., "Haunted", "Paranoid") */
  name: string;
  /** Description of how this affects the character */
  description: string;
  /** When this trauma was acquired (ISO timestamp) */
  acquiredAt: string;
}

/**
 * Severity levels for consequences that can be resisted
 */
export type ConsequenceSeverity = "minor" | "moderate" | "severe";

/**
 * Type of rest for stress recovery
 */
export type RestType = "short" | "long";

/**
 * Create an empty stress tracker
 */
export function createStressTracker(max: number = BASE_STRESS.maxStress): StressTracker {
  return {
    current: 0,
    max,
  };
}

/**
 * Check if a character has room for more stress
 */
export function canTakeStress(tracker: StressTracker, amount: number): boolean {
  return tracker.current + amount <= tracker.max;
}

/**
 * Calculate how much stress would overflow (causing trauma)
 */
export function calculateOverflow(tracker: StressTracker, amount: number): number {
  return Math.max(0, tracker.current + amount - tracker.max);
}

/**
 * Check if adding stress would cause trauma
 */
export function wouldCauseTrauma(tracker: StressTracker, amount: number): boolean {
  return calculateOverflow(tracker, amount) > 0;
}
