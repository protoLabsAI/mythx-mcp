/**
 * Lead/Clue Discovery Tools
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  leadsTools as sharedLeadsTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for leads tools
 */
function createLeadsToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted leads tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const leadTools: MCPToolEntry[] = toMCPTools(
  sharedLeadsTools as unknown as AnySharedTool[],
  createLeadsToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = leadTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}. Available: ${leadTools.map((t) => t.name).join(", ")}`);
  }
  return tool;
}

export const getAvailableLeadsTool = getToolOrThrow("get_available_leads");
export const revealLeadTool = getToolOrThrow("reveal_lead");
export const searchLeadsTool = getToolOrThrow("search_leads");
export const getDiscoveredLeadsTool = getToolOrThrow("get_discovered_leads");
export const suggestLeadOpportunityTool = getToolOrThrow("suggest_lead_opportunity");
