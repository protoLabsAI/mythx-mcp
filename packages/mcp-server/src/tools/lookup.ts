/**
 * Lookup tools - deterministic world pack and rulebook research
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  researchTools as sharedResearchTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for lookup tools
 */
function createLookupToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted lookup tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const lookupTools: MCPToolEntry[] = toMCPTools(
  sharedResearchTools as unknown as AnySharedTool[],
  createLookupToolContext()
);

// Re-export individual tools for direct access
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = lookupTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${lookupTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const quickResearchTool = getToolOrThrow("quick_research");
export const batchLookupTool = getToolOrThrow("batch_lookup");
export const lookupRuleTool = getToolOrThrow("lookup_rule");
