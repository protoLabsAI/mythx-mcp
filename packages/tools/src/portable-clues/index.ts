/**
 * Portable Clues Tools
 *
 * Flexible revelations that can be delivered anywhere.
 * Based on the Lazy DM pattern of "secrets and clues" abstracted from discovery.
 */

// Types and helpers
export * from "./types.js";

// Tools
export {
  createPortableClueTool,
  type CreatePortableClueInput,
  type CreatePortableClueOutput,
} from "./create-portable-clue.js";

export {
  getUnrevealedCluesTool,
  type GetUnrevealedCluesInput,
  type GetUnrevealedCluesOutput,
} from "./get-unrevealed-clues.js";

export {
  revealClueTool,
  type RevealClueInput,
  type RevealClueOutput,
} from "./reveal-clue.js";

export {
  suggestClueDeliveryTool,
  type SuggestClueDeliveryInput,
  type SuggestClueDeliveryOutput,
} from "./suggest-clue-delivery.js";

export {
  importLeadsAsCluesTool,
  type ImportLeadsAsCluesInput,
  type ImportLeadsAsCluesOutput,
} from "./import-leads-as-clues.js";

// Tool array
import { createPortableClueTool } from "./create-portable-clue.js";
import { getUnrevealedCluesTool } from "./get-unrevealed-clues.js";
import { revealClueTool } from "./reveal-clue.js";
import { suggestClueDeliveryTool } from "./suggest-clue-delivery.js";
import { importLeadsAsCluesTool } from "./import-leads-as-clues.js";

/**
 * All portable clue tools
 */
export const portableClueTools = [
  createPortableClueTool,
  getUnrevealedCluesTool,
  revealClueTool,
  suggestClueDeliveryTool,
  importLeadsAsCluesTool,
];
