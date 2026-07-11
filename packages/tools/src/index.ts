/**
 * @mythxengine/tools
 *
 * Transport-agnostic shared tools for RPG MCP.
 * Works with both MCP server and LangGraph.
 */

// Re-export shared types from @mythxengine/types
export type {
  SharedToolDefinition,
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  BusEvent,
  GetRulesFunction,
  IRulesContext,
  ToolResult,
} from "@mythxengine/types";
export { defineSharedTool, nullEventBus, toolResult } from "@mythxengine/types";

// Adapters
export * from "./adapters/index.js";

// Context factories
export * from "./context/index.js";

// Events
export * from "./events/index.js";

// Tool domains
export * from "./dice/index.js";
export * from "./sessions/index.js";
export * from "./worldpack/index.js";
export * from "./characters/index.js";
export * from "./players/index.js";
export * from "./time/index.js";
// Note: notes tools are now part of sessions (add_note, search_notes)
export * from "./combat/index.js";
export * from "./turns/index.js";
export * from "./clocks/index.js";
export * from "./situations/index.js";
export * from "./leads/index.js";
export * from "./relationships/index.js";
export * from "./generation/index.js";
export * from "./stress/index.js";
export * from "./inventory/index.js";
export * from "./scene-framing/index.js";
export * from "./location/index.js";
export * from "./gm-guidance/index.js";
export * from "./encounters/index.js";
export * from "./investigation/index.js";
export * from "./portable-clues/index.js";
export * from "./engagement/index.js";
export * from "./imagegen/index.js";
export * from "./shop/index.js";
export * from "./rest/index.js";
export * from "./dialogue/index.js";
export * from "./skills/index.js";

// Lookup utilities (deterministic replacement for GM Researcher)
export * from "./lookup/index.js";

// Aggregate all tools for convenience
import { diceTools } from "./dice/index.js";
import { sessionTools } from "./sessions/index.js";
import { worldpackTools } from "./worldpack/index.js";
import { characterTools } from "./characters/index.js";
import { playerTools } from "./players/index.js";
import { timeTools } from "./time/index.js";
import { combatTools } from "./combat/index.js";
import { turnsTools } from "./turns/index.js";
import { clocksTools } from "./clocks/index.js";
import { leadsTools } from "./leads/index.js";
import { relationshipsTools } from "./relationships/index.js";
import { generationTools } from "./generation/index.js";
import { stressTools } from "./stress/index.js";
import { sceneFramingTools } from "./scene-framing/index.js";
import { locationTools } from "./location/index.js";
import { researchTools } from "./lookup/index.js";
import { gmGuidanceTools } from "./gm-guidance/index.js";
import { encounterTools } from "./encounters/index.js";
import { investigationTools } from "./investigation/index.js";
import { portableClueTools } from "./portable-clues/index.js";
import { engagementTools } from "./engagement/index.js";
import { imagegenTools } from "./imagegen/index.js";
import { shopTools } from "./shop/index.js";
import { restTools } from "./rest/index.js";
import { dialogueTools } from "./dialogue/index.js";
import { skillsTools } from "./skills/index.js";

/**
 * All shared tools
 */
export const allSharedTools = [
  ...diceTools,
  ...sessionTools,
  ...worldpackTools,
  ...characterTools,
  ...playerTools,
  ...timeTools,
  ...combatTools,
  ...turnsTools,
  ...clocksTools,
  ...leadsTools,
  ...relationshipsTools,
  ...generationTools,
  ...stressTools,
  ...sceneFramingTools,
  ...locationTools,
  ...researchTools,
  ...gmGuidanceTools,
  ...encounterTools,
  ...investigationTools,
  ...portableClueTools,
  ...engagementTools,
  ...shopTools,
  ...restTools,
  ...dialogueTools,
  ...imagegenTools,
  ...skillsTools,
];
