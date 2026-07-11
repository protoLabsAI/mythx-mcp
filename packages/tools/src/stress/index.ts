/**
 * Stress Tools
 *
 * FitD-style stress mechanics: push, resist, recover, flashback.
 */

import { getStressTool } from "./get-stress.js";
import { pushRollTool } from "./push-roll.js";
import { resistConsequenceTool } from "./resist-consequence.js";
import { recoverStressTool } from "./recover-stress.js";
import { flashbackTool } from "./flashback.js";

// Re-export tools and types
export { getStressTool, type GetStressInput, type GetStressOutput } from "./get-stress.js";
export {
  pushRollTool,
  PushRollInputSchema,
  type PushRollInput,
  type PushRollEnvelope,
  type PushRollResult,
  type PushRollStateDelta,
  type PushRollSuggestedNext,
  type PushRollOutcome,
  type PushRollOutput,
} from "./push-roll.js";
export {
  resistConsequenceTool,
  ResistConsequenceInputSchema,
  type ResistConsequenceInput,
  type ResistConsequenceEnvelope,
  type ResistConsequenceResult,
  type ResistConsequenceStateDelta,
  type ResistConsequenceSuggestedNext,
  type ResistConsequenceOutcome,
  type ResistConsequenceOutput,
} from "./resist-consequence.js";
export {
  recoverStressTool,
  type RecoverStressInput,
  type RecoverStressOutput,
} from "./recover-stress.js";
export { flashbackTool, type FlashbackInput, type FlashbackOutput } from "./flashback.js";

/**
 * All stress tools
 */
export const stressTools = [
  getStressTool,
  pushRollTool,
  resistConsequenceTool,
  recoverStressTool,
  flashbackTool,
];
