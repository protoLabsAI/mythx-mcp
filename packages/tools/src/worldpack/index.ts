/**
 * World Pack Tools
 *
 * Tools for listing, loading, and querying world packs.
 */

// List world packs tool and schema
export {
  listWorldPacksTool,
  ListWorldPacksInputSchema,
  type WorldPackSummary,
  type ListWorldPacksOutput,
} from "./list-world-packs.js";

// Load world summary tool and schema
export {
  loadWorldSummaryTool,
  LoadWorldSummaryInputSchema,
  type LoadWorldSummaryOutput,
} from "./load-world-summary.js";

// Entity lookup tools and schemas
export {
  // Tools
  getArchetypeTool,
  getLocationTool,
  getNpcTool,
  getMonsterTool,
  getItemTool,
  getEncounterTool,
  getConditionTool,
  getSituationTool,
  getArcTool,
  getFactionTool,
  entityLookupTools,
  // Input schemas (Zod)
  GetArchetypeInputSchema,
  GetLocationInputSchema,
  GetNpcInputSchema,
  GetMonsterInputSchema,
  GetItemInputSchema,
  GetEncounterInputSchema,
  GetConditionInputSchema,
  GetSituationInputSchema,
  GetArcInputSchema,
  GetFactionInputSchema,
  // Input types (inferred from Zod)
  type GetArchetypeInput,
  type GetLocationInput,
  type GetNpcInput,
  type GetMonsterInput,
  type GetItemInput,
  type GetEncounterInput,
  type GetConditionInput,
  type GetSituationInput,
  type GetArcInput,
  type GetFactionInput,
} from "./entity-lookup.js";

import { listWorldPacksTool } from "./list-world-packs.js";
import { loadWorldSummaryTool } from "./load-world-summary.js";
import { entityLookupTools } from "./entity-lookup.js";

/**
 * All world pack tools
 */
export const worldpackTools = [
  listWorldPacksTool,
  loadWorldSummaryTool,
  ...entityLookupTools,
];
