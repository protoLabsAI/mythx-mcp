/**
 * Turn Coordination Tools
 *
 * Tools for managing multi-player turn-based coordination.
 */

export {
  startTurnsTool,
  type StartTurnsInput,
  type StartTurnsOutput,
} from "./start-turns.js";

export {
  getCurrentTurnTool,
  type GetCurrentTurnInput,
  type GetCurrentTurnOutput,
} from "./get-current-turn.js";

export {
  advanceTurnTool,
  type AdvanceTurnInput,
  type AdvanceTurnOutput,
} from "./advance-turn.js";

export {
  endTurnsTool,
  type EndTurnsInput,
  type EndTurnsOutput,
} from "./end-turns.js";

export {
  requestPlayerInputTool,
  type RequestPlayerInputInput,
  type RequestPlayerInputOutput,
} from "./request-player-input.js";

export {
  submitPlayerActionTool,
  type SubmitPlayerActionInput,
  type SubmitPlayerActionOutput,
} from "./submit-player-action.js";

export {
  getAIPlayerContextTool,
  type GetAIPlayerContextInput,
  type GetAIPlayerContextOutput,
} from "./get-ai-player-context.js";

export {
  submitAIPlayerActionTool,
  type SubmitAIPlayerActionInput,
  type SubmitAIPlayerActionOutput,
} from "./submit-ai-player-action.js";

import { startTurnsTool } from "./start-turns.js";
import { getCurrentTurnTool } from "./get-current-turn.js";
import { advanceTurnTool } from "./advance-turn.js";
import { endTurnsTool } from "./end-turns.js";
import { requestPlayerInputTool } from "./request-player-input.js";
import { submitPlayerActionTool } from "./submit-player-action.js";
import { getAIPlayerContextTool } from "./get-ai-player-context.js";
import { submitAIPlayerActionTool } from "./submit-ai-player-action.js";

/**
 * All turn coordination tools
 */
export const turnsTools = [
  startTurnsTool,
  getCurrentTurnTool,
  advanceTurnTool,
  endTurnsTool,
  requestPlayerInputTool,
  submitPlayerActionTool,
  getAIPlayerContextTool,
  submitAIPlayerActionTool,
];
