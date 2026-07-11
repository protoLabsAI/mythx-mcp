/**
 * Engine state types
 */

import type { Character, NPC, Enemy } from "./character.js";
import type { RNGState } from "./dice.js";
import type { CombatState } from "./combat.js";
import type { GameEvent } from "./events.js";

/**
 * Game phase
 */
export type GamePhase =
  | { mode: "EXPLORATION" }
  | { mode: "DIALOGUE"; npcId: string }
  | { mode: "COMBAT"; turnIndex: number }
  | { mode: "REST" }
  | { mode: "SCENE_TRANSITION" };

/**
 * Game time tracking
 */
export interface GameTime {
  day: number;
  hour: number;
  minute: number;
}

/**
 * A deadline/countdown in the game
 */
export interface Deadline {
  id: string;
  name: string;
  description: string;
  /** When this deadline expires */
  expiresAt: GameTime;
  /** Optional flag to set when deadline expires */
  onExpireFlag?: string;
  /** Whether to warn when approaching (within 1 hour) */
  warnOnApproach: boolean;
}

/**
 * Pure game state managed by the engine
 * This is a subset of SessionState - just the mechanics
 */
export interface EngineState {
  sessionId: string;
  rng: RNGState;
  /** Action sequence number */
  seq: number;

  party: Character[];
  npcs: NPC[];
  enemies: Enemy[];

  currentLocationId: string;
  phase: GamePhase;

  combat: CombatState | null;

  worldFlags: string[];
  questFlags: Record<string, boolean>;

  gameTime: GameTime;
}

/**
 * Result of dispatching an action
 */
export interface DispatchResult {
  nextState: EngineState;
  events: GameEvent[];
  requiresNarration: boolean;
}

/**
 * Create initial game time (dawn of day 1)
 */
export function createInitialGameTime(): GameTime {
  return { day: 1, hour: 6, minute: 0 };
}

/**
 * Advance game time
 */
export function advanceGameTime(time: GameTime, minutes: number): GameTime {
  let totalMinutes = time.hour * 60 + time.minute + minutes;
  const days = Math.floor(totalMinutes / (24 * 60));
  totalMinutes = totalMinutes % (24 * 60);

  return {
    day: time.day + days,
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

// gameTimeToMinutes / compareGameTime / minutesUntil / formatDuration moved
// to packages/engine/src/time/expiration.ts (single canonical home).
