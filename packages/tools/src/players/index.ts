/**
 * Player Tools
 *
 * Tools for player CRUD operations and character assignment.
 */

export {
  createPlayerTool,
  type CreatePlayerInput,
  type CreatePlayerOutput,
} from "./create-player.js";

export { getPlayerTool, type GetPlayerInput, type GetPlayerOutput } from "./get-player.js";

export {
  listPlayersTool,
  type ListPlayersInput,
  type ListPlayersOutput,
  type PlayerSummary,
} from "./list-players.js";

export {
  updatePlayerTool,
  type UpdatePlayerInput,
  type UpdatePlayerOutput,
} from "./update-player.js";

export {
  deletePlayerTool,
  type DeletePlayerInput,
  type DeletePlayerOutput,
} from "./delete-player.js";

export {
  assignCharacterTool,
  type AssignCharacterInput,
  type AssignCharacterOutput,
} from "./assign-character.js";

export {
  updateCompanionStateTool,
  type UpdateCompanionStateInput,
  type UpdateCompanionStateOutput,
} from "./update-companion-state.js";

import { createPlayerTool } from "./create-player.js";
import { getPlayerTool } from "./get-player.js";
import { listPlayersTool } from "./list-players.js";
import { updatePlayerTool } from "./update-player.js";
import { deletePlayerTool } from "./delete-player.js";
import { assignCharacterTool } from "./assign-character.js";
import { updateCompanionStateTool } from "./update-companion-state.js";

/**
 * All player tools
 */
export const playerTools = [
  createPlayerTool,
  getPlayerTool,
  listPlayersTool,
  updatePlayerTool,
  deletePlayerTool,
  assignCharacterTool,
  updateCompanionStateTool,
];
