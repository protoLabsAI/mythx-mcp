/**
 * Game Snapshot Schemas
 *
 * Zod schemas for frontend display and agent state synchronization.
 * These represent denormalized game state snapshots used for UI rendering
 * and state synchronization between the agent and frontend.
 *
 * Using Zod provides:
 * - Runtime validation
 * - TypeScript type inference
 * - Single source of truth for schema + type
 */

import { z } from "zod";
import { CharacterInventorySchema } from "./game/inventory.js";

// ============================================================================
// Character Snapshot
// ============================================================================

/**
 * Compact character representation for frontend display
 */
export const CharacterSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  hp: z.number(),
  maxHp: z.number(),
  conditions: z.array(z.string()),
  isPlayer: z.boolean(),
  stress: z
    .object({
      current: z.number(),
      max: z.number(),
    })
    .optional(),
  /**
   * Trauma list — scene-warping events accumulated when stress
   * exceeded max. Surfaced via TraumaBadge so the player knows which
   * scars the character carries; never auto-removed.
   */
  trauma: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().default(""),
        acquiredAt: z.string().default(""),
      })
    )
    .optional(),
  inventory: CharacterInventorySchema.optional(),
});

export type CharacterSnapshot = z.infer<typeof CharacterSnapshotSchema>;

// ============================================================================
// Combatant Snapshot
// ============================================================================

/**
 * Individual combatant in combat
 */
export const CombatantSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  hp: z.number(),
  maxHp: z.number(),
  initiative: z.number(),
  isEnemy: z.boolean(),
});

export type CombatantSnapshot = z.infer<typeof CombatantSnapshotSchema>;

// ============================================================================
// Combat Snapshot
// ============================================================================

/**
 * Combat state snapshot for frontend display
 */
export const CombatSnapshotSchema = z.object({
  active: z.boolean(),
  round: z.number(),
  currentTurnId: z.string().nullable(),
  combatants: z.array(CombatantSnapshotSchema),
});

export type CombatSnapshot = z.infer<typeof CombatSnapshotSchema>;

// ============================================================================
// Time Snapshot
// ============================================================================

/**
 * Time state snapshot
 */
export const TimeSnapshotSchema = z.object({
  day: z.number(),
  hour: z.number(),
  minute: z.number(),
  formatted: z.string(),
});

export type TimeSnapshot = z.infer<typeof TimeSnapshotSchema>;

// ============================================================================
// Game Snapshot
// ============================================================================

/**
 * Compact deadline view for the HUD. Mirrors `Deadline` from
 * `@mythxengine/types/game/state`, with the absolute `expiresAt`
 * pre-projected into a `minutesRemaining` field so the client doesn't
 * have to recompute against current time on every render.
 */
export const DeadlineSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  /** Negative = already past (engine prunes these but UI shouldn't crash). */
  minutesRemaining: z.number(),
  /** Render-style hint for the UI. */
  warnOnApproach: z.boolean().default(true),
});
export type DeadlineSnapshot = z.infer<typeof DeadlineSnapshotSchema>;

/**
 * Active situation clock projected for the UI. Mirrors `ActiveClock`
 * from `@mythxengine/types/session` but flattened to the shape the
 * existing `ClockDisplay` / `ClockList` components consume (segments
 * + filled count). Included in the snapshot so a reconnecting client
 * sees clocks already in flight, not just ones that tick after page
 * load via `CLOCK_TICKED` events.
 */
export const ClockSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Total stages in the clock. */
  segments: z.number(),
  /** Stages already advanced (0-based currentStage + 1, 0 if not started). */
  filled: z.number(),
  type: z.enum(["countdown", "progress"]).default("countdown"),
  /** Source situation id, for grouping in the Quests panel. */
  situationId: z.string().optional(),
  /** What the clock counts toward — surfaced in QuestsPanel. */
  doom: z.string().optional(),
  paused: z.boolean().default(false),
  /**
   * Player visibility. Clocks are GM-state by default; the snapshot
   * keeps ALL clocks (GM surfaces need them) and player surfaces
   * (e.g. the game frame) filter to `playerVisible === true`.
   */
  playerVisible: z.boolean().default(false),
});
export type ClockSnapshot = z.infer<typeof ClockSnapshotSchema>;

/**
 * Denormalized game state for frontend sync
 * Updated after each agent execution
 */
export const GameSnapshotSchema = z.object({
  sessionId: z.string(),
  worldPackId: z.string().nullable(),
  /**
   * Id of the location the party is currently at. Resolved from the
   * engine's currentLocationId. Drives the persistent scene panel
   * (location image + description from the world pack) so the UI
   * doesn't have to parse the message stream for "where are we".
   */
  currentLocationId: z.string().nullable(),
  characters: z.array(CharacterSnapshotSchema),
  combat: CombatSnapshotSchema.nullable(),
  time: TimeSnapshotSchema,
  /**
   * Active deadlines. Empty array when none. DeadlineTracker reads
   * `minutesRemaining` directly; visual warning style flips inside
   * the component based on `<= 60`.
   */
  deadlines: z.array(DeadlineSnapshotSchema).default([]),
  /**
   * Active situation clocks. Empty array when none. Drives the QUESTS
   * tab; included in the snapshot so a reconnecting client sees clocks
   * already in flight, not just CLOCK_TICKED deltas after page load.
   */
  clocks: z.array(ClockSnapshotSchema).default([]),
  lastUpdated: z.string(),
});

export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;

// ============================================================================
// Agent State (for frontend sync)
// ============================================================================

/**
 * Event type constants for type safety
 */
export const GameEventTypes = {
  CHARACTER_UPDATED: "CHARACTER_UPDATED",
  COMBAT_STARTED: "COMBAT_STARTED",
  COMBAT_ENDED: "COMBAT_ENDED",
  TURN_ADVANCED: "TURN_ADVANCED",
  TIME_ADVANCED: "TIME_ADVANCED",
  CLOCK_TICKED: "CLOCK_TICKED",
  CLOCK_STARTED: "CLOCK_STARTED",
  DAMAGE_TAKEN: "DAMAGE_TAKEN",
  STRESS_CHANGED: "STRESS_CHANGED",
  DICE_ROLLED: "DICE_ROLLED",
  TEST_RESOLVED: "TEST_RESOLVED",
} as const;

/**
 * Base event schema with common fields
 */
const BaseEventSchema = z.object({
  timestamp: z.string(),
});

/**
 * Character updated event
 */
const CharacterUpdatedEventSchema = BaseEventSchema.extend({
  type: z.literal(GameEventTypes.CHARACTER_UPDATED),
  payload: CharacterSnapshotSchema,
});

/**
 * Combat events
 */
const CombatEventSchema = BaseEventSchema.extend({
  type: z.enum([
    GameEventTypes.COMBAT_STARTED,
    GameEventTypes.COMBAT_ENDED,
    GameEventTypes.TURN_ADVANCED,
  ]),
  payload: z.object({
    combat: CombatSnapshotSchema.nullable(),
  }),
});

/**
 * Time advanced event
 */
const TimeAdvancedEventSchema = BaseEventSchema.extend({
  type: z.literal(GameEventTypes.TIME_ADVANCED),
  payload: z.object({
    time: TimeSnapshotSchema,
  }),
});

/**
 * Clock events
 */
const ClockEventSchema = BaseEventSchema.extend({
  type: z.enum([GameEventTypes.CLOCK_TICKED, GameEventTypes.CLOCK_STARTED]),
  payload: z.object({
    clockId: z.string(),
    clockName: z.string(),
    totalSegments: z.number(),
    filled: z.number(),
    clockType: z.enum(["countdown", "progress"]),
  }),
});

/**
 * Damage taken event
 */
const DamageTakenEventSchema = BaseEventSchema.extend({
  type: z.literal(GameEventTypes.DAMAGE_TAKEN),
  payload: z.object({
    characterId: z.string(),
    characterName: z.string().optional(),
    damage: z.number(),
    hpRemaining: z.number(),
  }),
});

/**
 * Stress changed event
 */
const StressChangedEventSchema = BaseEventSchema.extend({
  type: z.literal(GameEventTypes.STRESS_CHANGED),
  payload: z.object({
    characterId: z.string(),
    characterName: z.string().optional(),
    previousStress: z.number(),
    newStress: z.number(),
    maxStress: z.number(),
    reason: z.string().optional(),
  }),
});

/**
 * Dice rolled event
 */
const DiceRolledEventSchema = BaseEventSchema.extend({
  type: z.literal(GameEventTypes.DICE_ROLLED),
  payload: z.object({
    expression: z.string(),
    rolls: z.array(z.number()),
    total: z.number(),
    critical: z.enum(["success", "failure"]).nullable().optional(),
  }),
});

/**
 * Test resolved event
 */
const TestResolvedEventSchema = BaseEventSchema.extend({
  type: z.literal(GameEventTypes.TEST_RESOLVED),
  payload: z.object({
    characterId: z.string().optional(),
    characterName: z.string(),
    skill: z.string(),
    outcome: z.enum(["critical_success", "success", "partial", "failure", "critical_failure"]),
    margin: z.number(),
    roll: z.number().optional(),
    difficulty: z.number().optional(),
  }),
});

/**
 * Generic event for unknown/extension types (backwards compatibility)
 */
const GenericEventSchema = BaseEventSchema.extend({
  type: z.string(),
  payload: z.record(z.unknown()),
});

/**
 * Game event for frontend synchronization.
 * Discriminated union of known event types with fallback for extensions.
 */
export const GameEventForSyncSchema = z.union([
  CharacterUpdatedEventSchema,
  CombatEventSchema,
  TimeAdvancedEventSchema,
  ClockEventSchema,
  DamageTakenEventSchema,
  StressChangedEventSchema,
  DiceRolledEventSchema,
  TestResolvedEventSchema,
  GenericEventSchema, // Fallback for unknown types
]);

export type GameEventForSync = z.infer<typeof GameEventForSyncSchema>;

/**
 * Agent state synced from the LangGraph backend to the frontend.
 * Used by useCoAgent to access current game state and activity.
 */
export const AgentStateSchema = z.object({
  /** Current session ID */
  sessionId: z.string().nullable(),
  /** Current world pack ID */
  worldPackId: z.string().nullable(),
  /** Current activity message for UI display (null when idle) */
  currentActivity: z.string().nullable(),
  /** Denormalized game state snapshot */
  gameSnapshot: GameSnapshotSchema.nullable(),
  /** Whether the agent has been initialized */
  initialized: z.boolean().optional(),
  /** Pending events for frontend consumption (cleared after processing) */
  pendingEvents: z.array(GameEventForSyncSchema).optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;
