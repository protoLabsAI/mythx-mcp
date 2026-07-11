/**
 * Notes Tools
 *
 * Tools for session note management.
 */

export { addNoteTool, type AddNoteInput, type AddNoteOutput } from "./add-note.js";

export {
  searchNotesTool,
  type SearchNotesInput,
  type SearchNotesOutput,
  type NoteResult,
} from "./search-notes.js";

import { addNoteTool } from "./add-note.js";
import { searchNotesTool } from "./search-notes.js";

/**
 * All notes tools
 */
export const notesTools = [addNoteTool, searchNotesTool];
