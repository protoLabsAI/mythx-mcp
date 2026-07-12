/**
 * Rest tools - party rest and recovery
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  restTools as sharedRestTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for rest tools
 */
function createRestToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted rest tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const restTools: MCPToolEntry[] = toMCPTools(
  sharedRestTools as unknown as AnySharedTool[],
  createRestToolContext()
);

// Re-export individual tools for direct access
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = restTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}. Available: ${restTools.map((t) => t.name).join(", ")}`);
  }
  return tool;
}

export const takeRestTool = getToolOrThrow("take_rest");
