/**
 * Event Emitter Helpers
 *
 * Convenience functions for emitting standard events to the EventBus.
 */

import { randomUUID } from "crypto";
import type { IEventBus, BusEvent } from "@mythxengine/types";
import { GameChannels, EventTypes } from "./channels.js";

/**
 * Create a standard BusEvent.
 *
 * Pass `causedBy` to group this event under a chat turn in
 * `gameplay_events` (the sink reads `event.meta.causedBy` to
 * populate `gameplay_events.turn_id`). Tools should source it from
 * `ctx.currentTurnId` — see ToolContext in @mythxengine/types.
 */
export function createEvent<T>(
  type: string,
  channel: string,
  payload: T,
  options?: {
    sessionId?: string;
    sourceType?: "tool" | "agent" | "engine" | "system";
    sourceId?: string;
    causedBy?: string;
  }
): BusEvent<T> {
  const event: BusEvent<T> = {
    id: randomUUID(),
    type,
    channel,
    timestamp: Date.now(),
    sessionId: options?.sessionId,
    payload,
    source: options?.sourceType
      ? {
          type: options.sourceType,
          id: options.sourceId || "unknown",
        }
      : undefined,
  };
  if (options?.causedBy) {
    event.meta = { causedBy: options.causedBy };
  }
  return event;
}

/**
 * Emit a dice roll event
 */
export function emitDiceRolled(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    expression: string;
    rolls: number[];
    total: number;
  },
  toolId = "roll_dice",
  /** Chat-turn id for gameplay-events grouping. Pass `ctx.currentTurnId`. */
  causedBy?: string
): void {
  const channel = GameChannels.dice(sessionId);
  const event = createEvent(EventTypes.DICE_ROLLED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
    causedBy,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a test resolved event
 */
export function emitTestResolved(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    characterId: string;
    characterName: string;
    skill?: string;
    ability: string;
    success: boolean;
    margin: number;
    roll: number;
    critical?: "success" | "failure";
  },
  toolId = "roll_test",
  /** Chat-turn id for gameplay-events grouping. Pass `ctx.currentTurnId`. */
  causedBy?: string
): void {
  const channel = GameChannels.dice(sessionId);
  const event = createEvent(EventTypes.TEST_RESOLVED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
    causedBy,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a custom test resolved event
 */
export function emitCustomTestResolved(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    characterId: string;
    characterName: string;
    testId: string;
    testName: string;
    success: boolean;
    critical: boolean;
    outcome: string;
    roll: number;
    target: number;
  },
  toolId = "roll_custom_test",
  /** Chat-turn id for gameplay-events grouping. Pass `ctx.currentTurnId`. */
  causedBy?: string
): void {
  const channel = GameChannels.dice(sessionId);
  const event = createEvent(EventTypes.CUSTOM_TEST_RESOLVED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
    causedBy,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a session updated event
 */
export function emitSessionUpdated(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    field: string;
    previousValue?: unknown;
    newValue?: unknown;
  },
  toolId: string
): void {
  const channel = GameChannels.state(sessionId);
  const event = createEvent(EventTypes.SESSION_UPDATED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a character updated event
 *
 * Includes a CharacterSnapshot so the frontend can replace state directly.
 */
export function emitCharacterUpdated(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    characterId: string;
    characterName: string;
    changes: Record<string, unknown>;
    character?: {
      id: string;
      name: string;
      hp: number;
      maxHp: number;
      conditions: string[];
      isPlayer: boolean;
      stress?: { current: number; max: number };
    };
  },
  toolId: string,
  /** Chat-turn id for gameplay-events grouping. Pass `ctx.currentTurnId`. */
  causedBy?: string
): void {
  const channel = GameChannels.character(sessionId);
  const event = createEvent(EventTypes.CHARACTER_UPDATED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
    causedBy,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a combat event
 */
export function emitCombatEvent(
  eventBus: IEventBus,
  sessionId: string,
  type:
    | typeof EventTypes.COMBAT_STARTED
    | typeof EventTypes.COMBAT_ENDED
    | typeof EventTypes.TURN_ADVANCED
    | typeof EventTypes.DAMAGE_DEALT
    | typeof EventTypes.DAMAGE_TAKEN,
  payload: unknown,
  toolId: string,
  /** Chat-turn id for gameplay-events grouping. Pass `ctx.currentTurnId`. */
  causedBy?: string
): void {
  const channel = GameChannels.combat(sessionId);
  const event = createEvent(type, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
    causedBy,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a GM tool event (clocks, leads, relationships)
 */
export function emitGMEvent(
  eventBus: IEventBus,
  sessionId: string,
  type: string,
  payload: unknown,
  toolId: string,
  /** Chat-turn id for gameplay-events grouping. Pass `ctx.currentTurnId`. */
  causedBy?: string
): void {
  const channel = GameChannels.gm(sessionId);
  const event = createEvent(type, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
    causedBy,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit an inventory event
 */
export function emitInventoryEvent(
  eventBus: IEventBus,
  sessionId: string,
  type: string,
  payload: unknown,
  toolId: string
): void {
  const channel = GameChannels.inventory(sessionId);
  const event = createEvent(type, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit an image generation request to the SDXL service
 */
export function emitImageGenRequest(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    requestId: string;
    mode?: "txt2img" | "img2img";
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    cfgScale?: number;
    seed?: number;
    quality?: "lightning" | "fast" | "standard" | "highest";
    worldPackId?: string;
    entityType?: string;
    entityId?: string;
    imageRole?: string;
    pixelCleanup?: boolean;
    pixelUpscale?: number;
  },
  toolId: string
): void {
  const channel = GameChannels.imageGenRequests();
  const event = createEvent("IMAGEGEN_REQUEST", channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit an image generation started event to the session state channel
 */
export function emitImageGenStarted(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    requestId: string;
    entityType?: string;
    entityId?: string;
    imageRole?: string;
    prompt: string;
  },
  toolId: string
): void {
  const channel = GameChannels.state(sessionId);
  const event = createEvent(EventTypes.IMAGE_GENERATION_STARTED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a stress changed event
 */
export function emitStressChanged(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    characterId: string;
    characterName: string;
    previousStress: number;
    newStress: number;
    maxStress: number;
    reason: "push" | "resist" | "flashback" | "recovery" | "other";
    cost?: number;
    recovered?: number;
  },
  toolId: string
): void {
  const channel = GameChannels.character(sessionId);
  const event = createEvent(EventTypes.STRESS_CHANGED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a player updated event
 */
export function emitPlayerUpdated(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    playerId: string;
    playerName: string;
    changes: Record<string, unknown>;
  },
  toolId: string
): void {
  const channel = GameChannels.state(sessionId);
  const event = createEvent(EventTypes.PLAYER_UPDATED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
  });
  eventBus.publish(channel, event);
}

/**
 * Emit a trauma gained event
 */
export function emitTraumaGained(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    characterId: string;
    characterName: string;
    trauma: string;
    totalTraumas: number;
    triggerReason: "push" | "resist" | "flashback" | "manual";
  },
  toolId: string
): void {
  const channel = GameChannels.character(sessionId);
  const event = createEvent(EventTypes.TRAUMA_GAINED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId: toolId,
  });
  eventBus.publish(channel, event);
}

// ---------------------------------------------------------------------------
// Training-corpus emitters
//
// These exist purely so the gameplay-events sink in @mythxengine/storage
// can tag the right rows. Don't subscribe to them from UI / domain
// consumers — emit-and-forget for fine-tuning data only. Routing them
// through the existing `state` channel keeps the sink's wildcard
// subscribe surface unchanged.
// ---------------------------------------------------------------------------

/** Emit a chat turn start marker. Pair with NARRATOR_GENERATED on stream finish. */
export function emitChatTurnStarted(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    /** Stable id so a NARRATOR_GENERATED can reference its origin turn. */
    turnId: string;
    /** Hash of the system prompt used. Lets us partition the dataset by prompt version. */
    systemPromptHash: string;
    /** UIMessage[] count, plus the model id used (for stratification). */
    messageCount: number;
    modelId?: string;
    role?: string;
    worldPackId?: string;
  },
  sourceId = "chat-route"
): void {
  const channel = GameChannels.state(sessionId);
  const event = createEvent(EventTypes.CHAT_TURN_STARTED, channel, payload, {
    sessionId,
    sourceType: "system",
    sourceId,
  });
  eventBus.publish(channel, event);
}

/** Emit a narrator output. */
export function emitNarratorGenerated(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    /** Links back to the originating CHAT_TURN_STARTED. */
    turnId?: string;
    /** What kicked off the generation — 'chat', 'frame_scene', 'world-gen-narrative', etc. */
    trigger: string;
    /** Length in characters; full text is included only when privacy=full at the sink. */
    text: string;
    /** Token usage if available. */
    promptTokens?: number;
    completionTokens?: number;
    modelId?: string;
  },
  sourceId = "narrative"
): void {
  const channel = GameChannels.state(sessionId);
  const event = createEvent(EventTypes.NARRATOR_GENERATED, channel, payload, {
    sessionId,
    sourceType: "system",
    sourceId,
  });
  eventBus.publish(channel, event);
}

/** Emit a scene-framing output (separate from generic narrator output for stratification). */
export function emitSceneFramed(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    locationId?: string;
    /** Description text the LLM produced. */
    description: string;
    /** Tone / pacing classification if the tool returns one. */
    tone?: string;
  },
  sourceId = "frame_scene",
  /** Chat-turn id the gameplay-events sink reads to populate `turn_id`. */
  causedBy?: string
): void {
  const channel = GameChannels.state(sessionId);
  const event = createEvent(EventTypes.SCENE_FRAMED, channel, payload, {
    sessionId,
    sourceType: "tool",
    sourceId,
  });
  if (causedBy) {
    event.meta = { ...(event.meta ?? {}), causedBy };
  }
  eventBus.publish(channel, event);
}

/** Emit a session-ended marker. Use SESSION_DELETED for actual deletion. */
export function emitSessionEnded(
  eventBus: IEventBus,
  sessionId: string,
  payload: {
    /** "explicit" = user clicked end-game; "abandoned" = no activity for N hours;
     *  "crashed" = unrecoverable error during play. */
    reason: "explicit" | "abandoned" | "crashed";
    durationMs?: number;
    turnCount?: number;
  },
  sourceId = "session-lifecycle"
): void {
  const channel = GameChannels.state(sessionId);
  const event = createEvent(EventTypes.SESSION_ENDED, channel, payload, {
    sessionId,
    sourceType: "system",
    sourceId,
  });
  eventBus.publish(channel, event);
}
