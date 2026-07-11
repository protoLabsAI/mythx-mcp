/**
 * Combat Tools
 *
 * Tools for combat tracking and resolution.
 */

// Shared helpers
export { getCombatant, type CombatSession } from "./helpers.js";

export {
  startCombatTool,
  type StartCombatInput,
  type StartCombatEnvelope,
  type StartCombatResult,
  type StartCombatStateDelta,
  type StartCombatSuggestedNext,
  type StartCombatOutcome,
  type StartCombatOutput,
} from "./start-combat.js";

export {
  rollInitiativeTool,
  type RollInitiativeInput,
  type RollInitiativeOutput,
} from "./roll-initiative.js";

export {
  attackTool,
  AttackInputSchema,
  type AttackInput,
  type AttackEnvelope,
  type AttackResult,
  type AttackStateDelta,
  type AttackSuggestedNext,
  type AttackOutput,
} from "./attack.js";

export { applyDamageTool, type ApplyDamageInput, type ApplyDamageOutput } from "./apply-damage.js";

export {
  addCombatConditionTool,
  type AddCombatConditionInput,
  type AddCombatConditionOutput,
} from "./add-combat-condition.js";

export { nextTurnTool, type NextTurnInput, type NextTurnOutput } from "./next-turn.js";

export { endCombatTool, type EndCombatInput, type EndCombatOutput } from "./end-combat.js";

export {
  getCombatStateTool,
  type GetCombatStateInput,
  type GetCombatStateOutput,
} from "./get-combat-state.js";

import { startCombatTool } from "./start-combat.js";
import { rollInitiativeTool } from "./roll-initiative.js";
import { attackTool } from "./attack.js";
import { applyDamageTool } from "./apply-damage.js";
import { addCombatConditionTool } from "./add-combat-condition.js";
import { nextTurnTool } from "./next-turn.js";
import { endCombatTool } from "./end-combat.js";
import { getCombatStateTool } from "./get-combat-state.js";

/**
 * All combat tools
 */
export const combatTools = [
  startCombatTool,
  rollInitiativeTool,
  attackTool,
  applyDamageTool,
  addCombatConditionTool,
  nextTurnTool,
  endCombatTool,
  getCombatStateTool,
];
