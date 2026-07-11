/**
 * Turn coordination tools - Multi-player turn management
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  turnsTools as sharedTurnsTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for turn tools
 */
function createTurnsToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted turn tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const turnTools: MCPToolEntry[] = toMCPTools(
  sharedTurnsTools as unknown as AnySharedTool[],
  createTurnsToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = turnTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}. Available: ${turnTools.map((t) => t.name).join(", ")}`);
  }
  return tool;
}

export const startTurnsTool = getToolOrThrow("start_turns");
export const getCurrentTurnTool = getToolOrThrow("get_current_turn");
export const advanceTurnTool = getToolOrThrow("advance_turn");
export const endTurnsTool = getToolOrThrow("end_turns");
export const requestPlayerInputTool = getToolOrThrow("request_player_input");
export const submitPlayerActionTool = getToolOrThrow("submit_player_action");
export const getAIPlayerContextTool = getToolOrThrow("get_ai_player_context");
export const submitAIPlayerActionTool = getToolOrThrow("submit_ai_player_action");
