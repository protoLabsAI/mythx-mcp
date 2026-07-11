/**
 * Game actions - dispatched to engine
 */

import type { Effect } from "./conditions.js";

/**
 * All actions that can be dispatched to the engine
 * Discriminated union for type-safe handling
 */
export type GameAction =
  | MoveAction
  | InteractAction
  | SkillTestAction
  | AttackAction
  | DefendAction
  | UseAbilityAction
  | UseItemAction
  | RestAction
  | FleeAction
  | DialogueAction
  | GMOverrideAction;

/** Move to a new location */
export interface MoveAction {
  type: "MOVE";
  locationId: string;
}

/** Interact with an object or NPC */
export interface InteractAction {
  type: "INTERACT";
  targetId: string;
  approach: string;
}

/** Perform a skill test */
export interface SkillTestAction {
  type: "SKILL_TEST";
  characterId: string;
  skill: string;
  difficulty: number;
  context: string;
}

/** Attack a target */
export interface AttackAction {
  type: "ATTACK";
  characterId: string;
  targetId: string;
  weaponIndex: number;
}

/** Take defensive stance */
export interface DefendAction {
  type: "DEFEND";
  characterId: string;
}

/** Use a special ability */
export interface UseAbilityAction {
  type: "USE_ABILITY";
  characterId: string;
  abilityId: string;
  targetId?: string;
}

/** Use an item */
export interface UseItemAction {
  type: "USE_ITEM";
  characterId: string;
  itemName: string;
  targetId?: string;
}

/** Rest to recover */
export interface RestAction {
  type: "REST";
  restType: "short" | "long";
}

/** Flee from combat */
export interface FleeAction {
  type: "FLEE";
  characterId: string;
}

/** Engage in dialogue */
export interface DialogueAction {
  type: "DIALOGUE";
  npcId: string;
  message: string;
}

/** GM override for narrative effects */
export interface GMOverrideAction {
  type: "GM_OVERRIDE";
  effect: Effect;
  narrative: string;
}

export type ActionType = GameAction["type"];

/**
 * Type guard to check action type
 */
export function isActionType<T extends ActionType>(
  action: GameAction,
  type: T
): action is Extract<GameAction, { type: T }> {
  return action.type === type;
}
