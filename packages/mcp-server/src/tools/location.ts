/**
 * Location tools - party position state
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  locationTools as sharedLocationTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for location tools
 */
function createLocationToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted location tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const locationTools: MCPToolEntry[] = toMCPTools(
  sharedLocationTools as unknown as AnySharedTool[],
  createLocationToolContext()
);

// Re-export individual tools for direct access
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = locationTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${locationTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const setPartyLocationTool = getToolOrThrow("set_party_location");
