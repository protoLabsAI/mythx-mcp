/**
 * Encounter tools - on-demand encounter generation and management
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  encounterTools as sharedEncounterTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for encounter tools
 */
function createEncounterToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted encounter tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const encounterTools: MCPToolEntry[] = toMCPTools(
  sharedEncounterTools as unknown as AnySharedTool[],
  createEncounterToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = encounterTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${encounterTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const generateEncounterTool = getToolOrThrow("generate_encounter");
export const scaleEncounterTool = getToolOrThrow("scale_encounter");
export const getEncounterSuggestionsTool = getToolOrThrow("get_encounter_suggestions");
