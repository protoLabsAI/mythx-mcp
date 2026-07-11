/**
 * Game events - emitted by engine
 */

import type { Condition } from "./conditions.js";
import type { DiceResult } from "./dice.js";

/**
 * Immutable events emitted by the engine
 */
export type GameEvent =
  | SceneEnteredEvent
  | SkillTestResultEvent
  | DamageDealtEvent
  | DamageTakenEvent
  | CharacterDefeatedEvent
  | CombatStartedEvent
  | CombatEndedEvent
  | TurnAdvancedEvent
  | ConditionAppliedEvent
  | ConditionRemovedEvent
  | FlagSetEvent
  | RNGAdvancedEvent
  | StressChangedEvent
  | TraumaGainedEvent
  | ErrorEvent;

export interface SceneEnteredEvent {
  type: "SCENE_ENTERED";
  locationId: string;
  description: string;
}

export interface SkillTestResultEvent {
  type: "SKILL_TEST_RESULT";
  characterId: string;
  skill: string;
  roll: DiceResult;
  success: boolean;
  margin: number;
}

export interface DamageDealtEvent {
  type: "DAMAGE_DEALT";
  attackerId: string;
  targetId: string;
  amount: number;
  weapon: string;
}

export interface DamageTakenEvent {
  type: "DAMAGE_TAKEN";
  characterId: string;
  amount: number;
  hpRemaining: number;
}

export interface CharacterDefeatedEvent {
  type: "CHARACTER_DEFEATED";
  characterId: string;
}

export interface CombatStartedEvent {
  type: "COMBAT_STARTED";
  enemies: string[];
  turnOrder: string[];
}

export interface CombatEndedEvent {
  type: "COMBAT_ENDED";
  outcome: "victory" | "defeat" | "fled";
}

export interface TurnAdvancedEvent {
  type: "TURN_ADVANCED";
  actorId: string;
  round: number;
}

export interface ConditionAppliedEvent {
  type: "CONDITION_APPLIED";
  targetId: string;
  condition: Condition;
}

export interface ConditionRemovedEvent {
  type: "CONDITION_REMOVED";
  targetId: string;
  conditionId: string;
}

export interface FlagSetEvent {
  type: "FLAG_SET";
  flag: string;
  value: boolean;
}

export interface RNGAdvancedEvent {
  type: "RNG_ADVANCED";
  cursor: number;
}

export interface StressChangedEvent {
  type: "STRESS_CHANGED";
  characterId: string;
  characterName: string;
  previousStress: number;
  newStress: number;
  maxStress: number;
  reason: "push" | "resist" | "flashback" | "recovery" | "other";
  cost?: number;
  recovered?: number;
}

export interface TraumaGainedEvent {
  type: "TRAUMA_GAINED";
  characterId: string;
  characterName: string;
  trauma: string;
  totalTraumas: number;
  triggerReason: "push" | "resist" | "flashback";
}

export interface ErrorEvent {
  type: "ERROR";
  message: string;
  recoverable: boolean;
}

export type EventType = GameEvent["type"];

/**
 * Type guard to check event type
 */
export function isEventType<T extends EventType>(
  event: GameEvent,
  type: T
): event is Extract<GameEvent, { type: T }> {
  return event.type === type;
}
