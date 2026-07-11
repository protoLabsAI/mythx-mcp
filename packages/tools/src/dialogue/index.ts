/**
 * Dialogue Module
 *
 * Tools for structured NPC dialogue flows.
 */

export { startDialogueTool } from "./start-dialogue.js";
export type { StartDialogueInput, StartDialogueOutput } from "./start-dialogue.js";

export { advanceDialogueTool } from "./advance-dialogue.js";
export type { AdvanceDialogueInput, AdvanceDialogueOutput } from "./advance-dialogue.js";

import { startDialogueTool } from "./start-dialogue.js";
import { advanceDialogueTool } from "./advance-dialogue.js";

export const dialogueTools = [startDialogueTool, advanceDialogueTool];
