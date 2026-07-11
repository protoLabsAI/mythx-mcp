/**
 * Dice tools - rolling dice and tests
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  diceTools as sharedDiceTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for dice tools
 */
function createDiceToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted dice tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const diceTools: MCPToolEntry[] = toMCPTools(
  sharedDiceTools as unknown as AnySharedTool[],
  createDiceToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = diceTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}. Available: ${diceTools.map((t) => t.name).join(", ")}`);
  }
  return tool;
}

export const rollDiceTool = getToolOrThrow("roll_dice");
export const rollTestTool = getToolOrThrow("roll_test");
export const rollCustomTestTool = getToolOrThrow("roll_custom_test");
