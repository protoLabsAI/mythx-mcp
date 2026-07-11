/**
 * Event Channels and Types
 *
 * Defines channel naming conventions and standard event types
 * for the EventBus communication system.
 */

// ============================================================================
// Channel Naming Conventions
// ============================================================================

/**
 * Game-related channel generators
 * Follows Redis-style naming: session:{id}:{domain}
 */
export const GameChannels = {
  // Session-scoped channels
  /** Root session channel */
  session: (sessionId: string) => `session:${sessionId}`,
  /** Chat/dialogue events */
  chat: (sessionId: string) => `session:${sessionId}:chat`,
  /** State change events */
  state: (sessionId: string) => `session:${sessionId}:state`,
  /** Combat events */
  combat: (sessionId: string) => `session:${sessionId}:combat`,
  /** Agent/AI events */
  agent: (sessionId: string) => `session:${sessionId}:agent`,
  /** Dice/RNG events */
  dice: (sessionId: string) => `session:${sessionId}:dice`,
  /** Character events */
  character: (sessionId: string) => `session:${sessionId}:character`,
  /** Inventory events */
  inventory: (sessionId: string) => `session:${sessionId}:inventory`,
  /** GM tool events */
  gm: (sessionId: string) => `session:${sessionId}:gm`,
  /** Interrupt events */
  interrupt: (sessionId: string) => `session:${sessionId}:interrupt`,

  // Image generation channels
  /** Image generation request channel (for SDXL service) */
  imageGenRequests: () => "imagegen:requests" as const,
  /** Image generation progress channel (per-request) */
  imageGenProgress: (requestId: string) => `imagegen:${requestId}:progress` as const,

  // Pattern-based subscriptions (Redis-style wildcards)
  /** All session channels */
  allSessions: "session:*",
  /** All chat channels */
  allChat: "session:*:chat",
  /** All state channels */
  allState: "session:*:state",
  /** All combat channels */
  allCombat: "session:*:combat",
} as const;

// ============================================================================
// Event Type Constants
// ============================================================================

/**
 * Standard event types for the RPG system
 * Activates and extends the existing GameEvent types from @mythxengine/types
 */
export const EventTypes = {
  // Session events
  SESSION_CREATED: "SESSION_CREATED",
  SESSION_UPDATED: "SESSION_UPDATED",
  SESSION_DELETED: "SESSION_DELETED",

  // Character events
  CHARACTER_CREATED: "CHARACTER_CREATED",
  CHARACTER_UPDATED: "CHARACTER_UPDATED",
  CHARACTER_DELETED: "CHARACTER_DELETED",
  CHARACTER_DEFEATED: "CHARACTER_DEFEATED",

  // Dice events
  DICE_ROLLED: "DICE_ROLLED",
  TEST_RESOLVED: "TEST_RESOLVED",
  CUSTOM_TEST_RESOLVED: "CUSTOM_TEST_RESOLVED",

  // Combat events (matches existing GameEvent types)
  COMBAT_STARTED: "COMBAT_STARTED",
  COMBAT_ENDED: "COMBAT_ENDED",
  TURN_ADVANCED: "TURN_ADVANCED",
  DAMAGE_DEALT: "DAMAGE_DEALT",
  DAMAGE_TAKEN: "DAMAGE_TAKEN",
  CONDITION_APPLIED: "CONDITION_APPLIED",
  CONDITION_REMOVED: "CONDITION_REMOVED",

  // Image generation events
  IMAGE_GENERATION_STARTED: "IMAGE_GENERATION_STARTED",
  IMAGE_GENERATED: "IMAGE_GENERATED",

  // Flag/state events
  FLAG_SET: "FLAG_SET",
  RNG_ADVANCED: "RNG_ADVANCED",

  // GM tool events
  CLOCK_STARTED: "CLOCK_STARTED",
  CLOCK_TICKED: "CLOCK_TICKED",
  CLOCK_PAUSED: "CLOCK_PAUSED",
  CLOCK_RESUMED: "CLOCK_RESUMED",
  CLOCK_REVEALED: "CLOCK_REVEALED",
  LEAD_REVEALED: "LEAD_REVEALED",
  RELATIONSHIP_UPDATED: "RELATIONSHIP_UPDATED",

  // Player events
  PLAYER_INPUT_REQUESTED: "PLAYER_INPUT_REQUESTED",
  PLAYER_ACTION_SUBMITTED: "PLAYER_ACTION_SUBMITTED",
  PLAYER_UPDATED: "PLAYER_UPDATED",

  // Stress events
  STRESS_CHANGED: "STRESS_CHANGED",
  TRAUMA_GAINED: "TRAUMA_GAINED",

  // Inventory events
  INVENTORY_UPGRADED: "INVENTORY_UPGRADED",
  ITEM_ADDED: "ITEM_ADDED",
  ITEM_REMOVED: "ITEM_REMOVED",
  ITEM_EQUIPPED: "ITEM_EQUIPPED",
  ITEM_UNEQUIPPED: "ITEM_UNEQUIPPED",
  ITEM_USED: "ITEM_USED",
  ITEM_TRANSFERRED: "ITEM_TRANSFERRED",
  GOLD_CHANGED: "GOLD_CHANGED",

  // Interrupt events
  INTERRUPT_REQUEST: "INTERRUPT_REQUEST",
  INTERRUPT_RESPONSE: "INTERRUPT_RESPONSE",
  INTERRUPT_TIMEOUT: "INTERRUPT_TIMEOUT",
  INTERRUPT_CANCEL: "INTERRUPT_CANCEL",

  // Shop events
  ITEM_PURCHASED: "ITEM_PURCHASED",
  ITEM_SOLD: "ITEM_SOLD",

  // Rest events
  PARTY_RESTED: "PARTY_RESTED",

  // Dialogue events
  DIALOGUE_STARTED: "DIALOGUE_STARTED",
  DIALOGUE_ADVANCED: "DIALOGUE_ADVANCED",

  // Training-corpus events — emitted at gameplay seams the
  // gameplay-events sink (see packages/storage/src/training/) needs
  // to capture, but that no other domain consumer cares about.
  // Don't add UI subscribers to these; they exist for
  // post-hoc training-data assembly only.
  CHAT_TURN_STARTED: "CHAT_TURN_STARTED",
  // Pair-closure event for CHAT_TURN_STARTED. Carries a structured
  // outcome ("success" | "step_cap" | "error") so subscribers (the
  // story-page generator at /api/sessions/.../acts/active POST in
  // particular) can react instead of polling. Mirror of cc-2.18's
  // typed termination envelope (QueryEngine.ts:842-1117).
  CHAT_TURN_FINISHED: "CHAT_TURN_FINISHED",
  NARRATOR_GENERATED: "NARRATOR_GENERATED",
  SCENE_FRAMED: "SCENE_FRAMED",
  /**
   * Emitted once by the deterministic `onSessionStart` hook (apps/web
   * /src/lib/lifecycle/on-session-start.ts) when it has resolved the
   * starting location, primed active-situation clocks, and stamped
   * `worldState.lifecycle.onSessionStart`. Payload carries the same
   * `framingContext` block the orchestrator's first prompt sees, so
   * UI consumers can light up "adventure ready" affordances without
   * polling session state. Fires before the orchestrator's first
   * step on a fresh session; never fires again for that session.
   */
  FRAMING_CONTEXT_READY: "FRAMING_CONTEXT_READY",
  SESSION_ENDED: "SESSION_ENDED",

  // Explicit feedback signals — Phase 4 training pipeline.
  // Emitted by /api/training/rate and /api/training/regenerate.
  // Consumed exclusively by the gameplay-events sink; never shown in UI.
  PLAYER_RATED: "PLAYER_RATED",
  PLAYER_REGENERATED: "PLAYER_REGENERATED",

  // Error events
  ERROR: "ERROR",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
