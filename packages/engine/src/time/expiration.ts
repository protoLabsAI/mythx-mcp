/**
 * Time Expiration Utilities
 *
 * Pure functions for game time calculations and expiration checks.
 */

import type { GameTime, Deadline } from "@mythxengine/types";
import { advanceGameTime, createInitialGameTime } from "@mythxengine/types";

// Re-export the GameTime constructors/transitions from types so consumers
// can pull every time helper from `@mythxengine/engine` (single import
// surface; matches the audit's "pick one origin" rule for time math).
export { advanceGameTime, createInitialGameTime };

/**
 * Total minutes in a game day
 */
const MINUTES_PER_DAY = 24 * 60;

/**
 * Convert GameTime to total minutes since the start of day 1.
 *
 * Day numbering is 1-based (matching {@link createInitialGameTime}, which
 * returns `{ day: 1, hour: 6, minute: 0 }`), so `{ day: 1, hour: 0, minute: 0 }`
 * is the canonical epoch and returns `0`.
 */
export function gameTimeToMinutes(time: GameTime): number {
  return (time.day - 1) * MINUTES_PER_DAY + time.hour * 60 + time.minute;
}

/**
 * Convert total minutes (since the start of day 1) back to GameTime.
 */
export function minutesToGameTime(totalMinutes: number): GameTime {
  // Clamp negative values to 0 (day 1, 00:00)
  const clamped = Math.max(0, totalMinutes);
  const day = Math.floor(clamped / MINUTES_PER_DAY) + 1;
  const remaining = clamped % MINUTES_PER_DAY;
  const hour = Math.floor(remaining / 60);
  const minute = remaining % 60;

  return { day, hour, minute };
}

/**
 * Compare two GameTime values
 *
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareGameTime(a: GameTime, b: GameTime): number {
  return gameTimeToMinutes(a) - gameTimeToMinutes(b);
}

/**
 * Calculate minutes remaining until a target time (negative if passed).
 */
export function minutesUntil(current: GameTime, target: GameTime): number {
  return gameTimeToMinutes(target) - gameTimeToMinutes(current);
}

/**
 * Format a duration in minutes as a human-readable string
 * (e.g. "2 hours 30 minutes", "expired").
 *
 * The 0-minute boundary is treated as expired, matching
 * {@link getTimeUntil} / {@link formatTimeRemaining} and the
 * deadline-fire predicate used by `advance_time` (which fires
 * deadlines on `compareGameTime(...) >= 0`).
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "expired";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (mins > 0) parts.push(`${mins} minute${mins !== 1 ? "s" : ""}`);

  return parts.join(" ");
}

/**
 * Check if time A is before time B
 */
export function isBefore(a: GameTime, b: GameTime): boolean {
  return compareGameTime(a, b) < 0;
}

/**
 * Check if time A is after time B
 */
export function isAfter(a: GameTime, b: GameTime): boolean {
  return compareGameTime(a, b) > 0;
}

/**
 * Check if time A equals time B
 */
export function isEqual(a: GameTime, b: GameTime): boolean {
  return compareGameTime(a, b) === 0;
}

/**
 * Check if a deadline has expired
 *
 * @param deadline - Deadline to check
 * @param currentTime - Current game time
 * @returns true if the deadline has passed
 */
export function isDeadlineExpired(deadline: Deadline, currentTime: GameTime): boolean {
  return compareGameTime(currentTime, deadline.expiresAt) >= 0;
}

/**
 * Check if a deadline is approaching (within threshold)
 *
 * @param deadline - Deadline to check
 * @param currentTime - Current game time
 * @param thresholdMinutes - Warning threshold in minutes (default: 60)
 * @returns true if deadline is within threshold and not expired
 */
export function isDeadlineApproaching(
  deadline: Deadline,
  currentTime: GameTime,
  thresholdMinutes: number = 60
): boolean {
  const currentMinutes = gameTimeToMinutes(currentTime);
  const expiresMinutes = gameTimeToMinutes(deadline.expiresAt);
  const remaining = expiresMinutes - currentMinutes;

  return remaining > 0 && remaining <= thresholdMinutes;
}

/**
 * Result of time calculation
 */
export interface TimeRemaining {
  /** Total minutes remaining (negative if expired) */
  totalMinutes: number;
  /** Days remaining */
  days: number;
  /** Hours remaining (after days) */
  hours: number;
  /** Minutes remaining (after hours) */
  minutes: number;
  /** Whether the time has already passed */
  expired: boolean;
}

/**
 * Calculate time remaining until a target time
 *
 * @param currentTime - Current game time
 * @param targetTime - Target time to reach
 * @returns Time remaining breakdown
 */
export function getTimeUntil(currentTime: GameTime, targetTime: GameTime): TimeRemaining {
  const currentMinutes = gameTimeToMinutes(currentTime);
  const targetMinutes = gameTimeToMinutes(targetTime);
  const totalMinutes = targetMinutes - currentMinutes;

  if (totalMinutes <= 0) {
    return {
      totalMinutes,
      days: 0,
      hours: 0,
      minutes: 0,
      expired: true,
    };
  }

  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const remainingAfterDays = totalMinutes % MINUTES_PER_DAY;
  const hours = Math.floor(remainingAfterDays / 60);
  const minutes = remainingAfterDays % 60;

  return {
    totalMinutes,
    days,
    hours,
    minutes,
    expired: false,
  };
}

/**
 * Calculate time remaining for a deadline
 *
 * @param deadline - Deadline to check
 * @param currentTime - Current game time
 * @returns Time remaining until deadline
 */
export function getTimeUntilDeadline(deadline: Deadline, currentTime: GameTime): TimeRemaining {
  return getTimeUntil(currentTime, deadline.expiresAt);
}

/**
 * Add time to a GameTime
 *
 * @param time - Base time
 * @param minutesToAdd - Minutes to add (can be negative)
 * @returns New game time
 */
export function addMinutes(time: GameTime, minutesToAdd: number): GameTime {
  const totalMinutes = gameTimeToMinutes(time) + minutesToAdd;
  // Clamp to non-negative
  return minutesToGameTime(Math.max(0, totalMinutes));
}

/**
 * Add hours to a GameTime
 *
 * @param time - Base time
 * @param hoursToAdd - Hours to add (can be negative)
 * @returns New game time
 */
export function addHours(time: GameTime, hoursToAdd: number): GameTime {
  return addMinutes(time, hoursToAdd * 60);
}

/**
 * Add days to a GameTime
 *
 * @param time - Base time
 * @param daysToAdd - Days to add (can be negative)
 * @returns New game time
 */
export function addDays(time: GameTime, daysToAdd: number): GameTime {
  return addMinutes(time, daysToAdd * MINUTES_PER_DAY);
}

/**
 * Filter deadlines to get only active (non-expired) ones
 *
 * @param deadlines - All deadlines
 * @param currentTime - Current game time
 * @returns Only deadlines that haven't expired
 */
export function getActiveDeadlines(deadlines: Deadline[], currentTime: GameTime): Deadline[] {
  return deadlines.filter((d) => !isDeadlineExpired(d, currentTime));
}

/**
 * Filter deadlines to get approaching ones
 *
 * @param deadlines - All deadlines
 * @param currentTime - Current game time
 * @param thresholdMinutes - Warning threshold (default: 60)
 * @returns Deadlines that are approaching but not expired
 */
export function getApproachingDeadlines(
  deadlines: Deadline[],
  currentTime: GameTime,
  thresholdMinutes: number = 60
): Deadline[] {
  return deadlines.filter(
    (d) => d.warnOnApproach && isDeadlineApproaching(d, currentTime, thresholdMinutes)
  );
}

/**
 * Sort deadlines by expiration time (soonest first)
 *
 * @param deadlines - Deadlines to sort
 * @returns Sorted copy of deadlines
 */
export function sortDeadlinesBySoonest(deadlines: Deadline[]): Deadline[] {
  return [...deadlines].sort((a, b) => compareGameTime(a.expiresAt, b.expiresAt));
}

/**
 * Format time remaining as a human-readable string
 *
 * @param remaining - Time remaining result
 * @returns Human-readable string
 */
export function formatTimeRemaining(remaining: TimeRemaining): string {
  if (remaining.expired) {
    return "expired";
  }

  const parts: string[] = [];

  if (remaining.days > 0) {
    parts.push(`${remaining.days}d`);
  }
  // Only show hours if there are hours OR if there are no days (to avoid "0m" alone for sub-hour times)
  if (remaining.hours > 0 || (remaining.days === 0 && remaining.minutes === 0)) {
    parts.push(`${remaining.hours}h`);
  }
  if (remaining.minutes > 0 || parts.length === 0) {
    parts.push(`${remaining.minutes}m`);
  }

  return parts.join(" ");
}

/**
 * Format a GameTime as a readable string
 *
 * @param time - Game time
 * @param format - Format style
 * @returns Formatted string
 */
export function formatGameTime(time: GameTime, format: "short" | "long" = "short"): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const minuteStr = time.minute.toString().padStart(2, "0");

  if (format === "short") {
    return `Day ${time.day}, ${hour12}:${minuteStr} ${ampm}`;
  }

  return `Day ${time.day} at ${hour12}:${minuteStr} ${ampm}`;
}
