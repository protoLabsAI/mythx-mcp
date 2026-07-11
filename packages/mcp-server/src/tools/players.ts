/**
 * Player tools - CRUD operations for players
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  playerTools as sharedPlayerTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for player tools
 */
function createPlayerToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted player tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const playerTools: MCPToolEntry[] = toMCPTools(
  sharedPlayerTools as unknown as AnySharedTool[],
  createPlayerToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = playerTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${playerTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const createPlayerTool = getToolOrThrow("create_player");
export const getPlayerTool = getToolOrThrow("get_player");
export const listPlayersTool = getToolOrThrow("list_players");
export const updatePlayerTool = getToolOrThrow("update_player");
export const deletePlayerTool = getToolOrThrow("delete_player");
export const assignCharacterTool = getToolOrThrow("assign_character");
