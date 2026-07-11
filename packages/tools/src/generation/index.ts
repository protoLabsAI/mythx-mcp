/**
 * Generation Tools (Shared)
 *
 * Tools for world generation workflow.
 */

// World seed generation
export {
  generateWorldSeedTool,
  GenerateWorldSeedInputSchema,
  type GenerateWorldSeedInput,
  type GenerateWorldSeedOutput,
} from "./generate-seed.js";

// Content generation tools
export {
  generateArchetypesTool,
  GenerateArchetypesInputSchema,
  type GenerateArchetypesInput,
  type GenerateArchetypesOutput,
} from "./generate-archetypes.js";

export {
  generateMonstersTool,
  GenerateMonstersInputSchema,
  type GenerateMonstersInput,
  type GenerateMonstersOutput,
} from "./generate-monsters.js";

export {
  generateItemsTool,
  GenerateItemsInputSchema,
  type GenerateItemsInput,
  type GenerateItemsOutput,
} from "./generate-items.js";

export {
  generateEncountersTool,
  GenerateEncountersInputSchema,
  type GenerateEncountersInput,
  type GenerateEncountersOutput,
} from "./generate-encounters.js";

export {
  generateLocationsTool,
  GenerateLocationsInputSchema,
  type GenerateLocationsInput,
  type GenerateLocationsOutput,
} from "./generate-locations.js";

export {
  generateNPCsTool,
  GenerateNPCsInputSchema,
  type GenerateNPCsInput,
  type GenerateNPCsOutput,
} from "./generate-npcs.js";

export {
  generateNarrativeTool,
  GenerateNarrativeInputSchema,
  type GenerateNarrativeInput,
  type GenerateNarrativeOutput,
} from "./generate-narrative.js";

export {
  generateSituationsTool,
  GenerateSituationsInputSchema,
  type GenerateSituationsInput,
  type GenerateSituationsOutput,
} from "./generate-situations.js";

export {
  generateArcsTool,
  GenerateArcsInputSchema,
  type GenerateArcsInput,
  type GenerateArcsOutput,
} from "./generate-arcs.js";

export {
  generateConditionsTool,
  GenerateConditionsInputSchema,
  type GenerateConditionsInput,
  type GenerateConditionsOutput,
} from "./generate-conditions.js";

export {
  generateFactionsTool,
  GenerateFactionsInputSchema,
  type GenerateFactionsInput,
  type GenerateFactionsOutput,
} from "./generate-factions.js";

// Result saving
export {
  saveGenerationResultTool,
  SaveGenerationResultInputSchema,
  type SaveGenerationResultInput,
  type SaveGenerationResultOutput,
} from "./save-result.js";

// Resume generation
export {
  resumeGenerationTool,
  ResumeGenerationInputSchema,
  type ResumeGenerationInput,
  type ResumeGenerationOutput,
} from "./resume.js";

// Generation status
export {
  getGenerationStatusTool,
  GetGenerationStatusInputSchema,
  type GetGenerationStatusInput,
  type GetGenerationStatusOutput,
} from "./generation-status.js";

// Batch generation
export {
  batchGenerateTool,
  BatchGenerateInputSchema,
  type BatchGenerateInput,
  type BatchGenerateOutput,
} from "./batch-generate.js";

// Assemble world pack
export {
  assembleWorldPackTool,
  AssembleWorldPackInputSchema,
  type AssembleWorldPackInput,
  type AssembleWorldPackOutput,
  mergeById,
} from "./assemble.js";

// Rules prompt helpers
export {
  buildRulesPromptSection,
  buildHPGuidelines,
  buildMonsterHPGuidelines,
} from "./rules-prompt.js";

// ID manifest helpers
export {
  slugify,
  entityId,
  formatManifestEntry,
  formatManifestList,
  formatManifestInline,
  formatMonsterManifest,
  formatItemManifest,
  tierContentCounts,
  inferTier,
  getRecommendedCount,
  normalizeRef,
  normalizeRefs,
  resolveRef,
  resolveRefs,
  type WorldTier,
  type ResolveResult,
} from "./manifest-helpers.js";

// XML parsing utilities
export {
  extractTag,
  extractRequiredTag,
  extractOptionalTag,
  extractAllTags,
  extractTaggedJSON,
  extractRequiredInt,
  extractOptionalInt,
  extractBoolean,
  isXML,
  extractRequiredEnum,
  extractOptionalEnum,
} from "./xml-parser.js";

// Content-type XML parsers
export {
  parseSeedXML,
  parseArchetypesXML,
  parseMonstersXML,
  parseItemsXML,
  parseEncountersXML,
  parseLocationsXML,
  parseNPCsXML,
  parseNarrativeXML,
  parseSituationsXML,
  parseArcsXML,
  parseFactionsXML,
} from "./parsers/index.js";

// Imports for the tools array
import { generateWorldSeedTool } from "./generate-seed.js";
import { generateArchetypesTool } from "./generate-archetypes.js";
import { generateMonstersTool } from "./generate-monsters.js";
import { generateItemsTool } from "./generate-items.js";
import { generateEncountersTool } from "./generate-encounters.js";
import { generateLocationsTool } from "./generate-locations.js";
import { generateNPCsTool } from "./generate-npcs.js";
import { generateNarrativeTool } from "./generate-narrative.js";
import { generateSituationsTool } from "./generate-situations.js";
import { generateArcsTool } from "./generate-arcs.js";
import { generateConditionsTool } from "./generate-conditions.js";
import { generateFactionsTool } from "./generate-factions.js";
import { saveGenerationResultTool } from "./save-result.js";
import { resumeGenerationTool } from "./resume.js";
import { assembleWorldPackTool } from "./assemble.js";
import { getGenerationStatusTool } from "./generation-status.js";
import { batchGenerateTool } from "./batch-generate.js";

/**
 * All generation tools
 *
 * Complete list of tools for world generation, including:
 * - Domain generators (seed, archetypes, monsters, items, etc.)
 * - Result persistence (save_generation_result)
 * - Workflow management (resume_generation, assemble_world_pack)
 *
 * This is the full tool set - use contentGeneratorTools or
 * coordinatorGenerationTools for role-specific subsets.
 */
export const generationTools = [
  generateWorldSeedTool,
  generateArchetypesTool,
  generateMonstersTool,
  generateItemsTool,
  generateEncountersTool,
  generateLocationsTool,
  generateNPCsTool,
  generateConditionsTool,
  generateFactionsTool,
  generateNarrativeTool,
  generateSituationsTool,
  generateArcsTool,
  saveGenerationResultTool,
  resumeGenerationTool,
  getGenerationStatusTool,
  batchGenerateTool,
  assembleWorldPackTool,
];

/**
 * Content generation tools (for the content-generator subagent)
 *
 * Content generators handle all domain-specific generation, including:
 * - World seed creation
 * - All content types (archetypes, monsters, items, etc.)
 * - World pack assembly
 */
export const contentGenerationTools = [
  generateWorldSeedTool,
  generateArchetypesTool,
  generateMonstersTool,
  generateItemsTool,
  generateEncountersTool,
  generateLocationsTool,
  generateNPCsTool,
  generateConditionsTool,
  generateFactionsTool,
  generateNarrativeTool,
  generateSituationsTool,
  generateArcsTool,
  saveGenerationResultTool,
  batchGenerateTool,
  assembleWorldPackTool,
];

/**
 * Coordinator tools (for the world-gen orchestrator)
 *
 * The coordinator delegates domain-specific generation to content-generator
 * subagents via the task tool. It only has access to:
 * - resumeGenerationTool: Check status and resume interrupted generation
 * - saveGenerationResultTool: Save results from its own prompt executions
 *
 * Domain tools (generate_world_seed, assemble_world_pack, etc.) are handled
 * by delegation to content-generator subagents.
 */
export const coordinatorGenerationTools = [
  resumeGenerationTool,
  getGenerationStatusTool,
  saveGenerationResultTool,
];
