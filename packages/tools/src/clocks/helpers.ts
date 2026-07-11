/**
 * Clock Helpers
 *
 * Shared utilities for clock tools.
 */

import type { GameTime } from "@mythxengine/types";

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
