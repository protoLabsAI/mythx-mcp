/**
 * Book Generation Tools
 *
 * Tools for generating print-ready TTRPG books from world packs.
 */

export { rulebookTools, generateRulebookTool, saveRulebookResultTool } from "./rulebook.js";
export {
  worldbookTools,
  generateWorldBooksTool,
  saveBookResultTool,
  generateAppendiciesTool,
} from "./worldbooks.js";
export * from "./formatters.js";

import { rulebookTools } from "./rulebook.js";
import { worldbookTools } from "./worldbooks.js";

/**
 * All book generation tools
 */
export const bookTools = [...rulebookTools, ...worldbookTools];
