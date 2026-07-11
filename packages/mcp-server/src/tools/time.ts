/**
 * Time tools - game time tracking, deadlines, and condition expiration
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  timeTools as sharedTimeTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for time tools
 */
function createTimeToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted time tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const timeTools: MCPToolEntry[] = toMCPTools(
  sharedTimeTools as unknown as AnySharedTool[],
  createTimeToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = timeTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}. Available: ${timeTools.map((t) => t.name).join(", ")}`);
  }
  return tool;
}

export const getTimeTool = getToolOrThrow("get_time");
export const advanceTimeTool = getToolOrThrow("advance_time");
export const setTimeTool = getToolOrThrow("set_time");
export const addDeadlineTool = getToolOrThrow("add_deadline");
export const removeDeadlineTool = getToolOrThrow("remove_deadline");
