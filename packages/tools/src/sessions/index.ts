/**
 * Session Tools
 *
 * Tools for listing, creating, and loading game sessions.
 */

export { listSessionsTool, type SessionSummary, type ListSessionsOutput } from "./list-sessions.js";
export { createSessionTool, type CreateSessionOutput } from "./create-session.js";
export { loadSessionTool, type LoadSessionOutput } from "./load-session.js";
export { addNoteTool, type AddNoteOutput } from "./add-note.js";
export { searchNotesTool, type SearchNotesOutput } from "./search-notes.js";
export { deleteSessionTool, type DeleteSessionOutput } from "./delete-session.js";
export {
  setPlayModeTool,
  SetPlayModeInputSchema,
  type SetPlayModeInput,
  type SetPlayModeOutput,
} from "./set-play-mode.js";
export {
  updatePacingStateTool,
  UpdatePacingStateInputSchema,
  type UpdatePacingStateInput,
  type UpdatePacingStateOutput,
} from "./update-pacing-state.js";
export { addNpcTool, AddNpcInputSchema, type AddNpcInput, type AddNpcOutput } from "./add-npc.js";

import { listSessionsTool } from "./list-sessions.js";
import { createSessionTool } from "./create-session.js";
import { loadSessionTool } from "./load-session.js";
import { addNoteTool } from "./add-note.js";
import { searchNotesTool } from "./search-notes.js";
import { deleteSessionTool } from "./delete-session.js";
import { setPlayModeTool } from "./set-play-mode.js";
import { updatePacingStateTool } from "./update-pacing-state.js";
import { addNpcTool } from "./add-npc.js";

/**
 * All session tools
 */
export const sessionTools = [
  listSessionsTool,
  createSessionTool,
  loadSessionTool,
  addNoteTool,
  searchNotesTool,
  deleteSessionTool,
  setPlayModeTool,
  updatePacingStateTool,
  addNpcTool,
];
