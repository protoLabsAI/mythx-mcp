/**
 * Session tools - session management and notes
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  sessionTools as sharedSessionTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for session tools
 */
function createSessionToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted session tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const sessionTools: MCPToolEntry[] = toMCPTools(
  sharedSessionTools as unknown as AnySharedTool[],
  createSessionToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = sessionTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${sessionTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const createSessionTool = getToolOrThrow("create_session");
export const listSessionsTool = getToolOrThrow("list_sessions");
export const loadSessionTool = getToolOrThrow("load_session");
export const addNoteTool = getToolOrThrow("add_note");
export const searchNotesTool = getToolOrThrow("search_notes");
export const deleteSessionTool = getToolOrThrow("delete_session");
