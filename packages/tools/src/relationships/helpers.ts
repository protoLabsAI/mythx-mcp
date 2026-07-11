/**
 * Relationship Helpers
 *
 * Shared utilities for relationship tools.
 */

import type { GameTime } from "@mythxengine/types";

/**
 * Attitude levels
 */
export const ATTITUDES = ["hostile", "unfriendly", "neutral", "friendly", "allied"] as const;

export type Attitude = (typeof ATTITUDES)[number];

/**
 * Get relationship summary text for an attitude level
 *
 * @param attitude - The attitude level
 * @returns Human-readable description of the attitude
 */
export function getAttitudeSummary(attitude: Attitude): string {
  switch (attitude) {
    case "hostile":
      return "Actively antagonistic, may attack or sabotage";
    case "unfriendly":
      return "Distrustful, uncooperative, may withhold help";
    case "neutral":
      return "No strong feelings, will deal fairly";
    case "friendly":
      return "Positive disposition, inclined to help";
    case "allied":
      return "Strong bond, will go out of their way to assist";
    default: {
      // Exhaustive check - should never reach here if Attitude type is correct
      const _exhaustive: never = attitude;
      return `Unknown attitude: ${_exhaustive}`;
    }
  }
}

/**
 * Format game time as human-readable string
 *
 * @param time - GameTime object with day, hour, minute
 * @returns Formatted string like "Day 1, 2:30 PM"
 */
export function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}
