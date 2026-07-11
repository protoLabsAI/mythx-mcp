/**
 * Encounter Tools (Shared)
 *
 * On-demand encounter generation and management.
 * Supports the Alexandrian principle: "Build toolkits you can deploy flexibly."
 */

// Types
export * from "./types.js";

// Helpers
export * from "./helpers.js";

// Tools
export {
  generateEncounterTool,
  GenerateEncounterInputSchema,
  type GenerateEncounterInput,
  type GenerateEncounterOutput,
} from "./generate-encounter.js";

export {
  scaleEncounterTool,
  ScaleEncounterInputSchema,
  type ScaleEncounterInput,
  type ScaleEncounterOutput,
} from "./scale-encounter.js";

export {
  getEncounterSuggestionsTool,
  GetEncounterSuggestionsInputSchema,
  type GetEncounterSuggestionsInput,
  type GetEncounterSuggestionsOutput,
} from "./get-encounter-suggestions.js";

// Tool array for bulk registration
import { generateEncounterTool } from "./generate-encounter.js";
import { scaleEncounterTool } from "./scale-encounter.js";
import { getEncounterSuggestionsTool } from "./get-encounter-suggestions.js";

export const encounterTools = [
  generateEncounterTool,
  scaleEncounterTool,
  getEncounterSuggestionsTool,
] as const;
