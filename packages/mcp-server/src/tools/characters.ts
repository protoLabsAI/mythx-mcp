/**
 * Character tools - CRUD operations for characters
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  characterTools as sharedCharacterTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for character tools
 */
function createCharacterToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted character tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const characterTools: MCPToolEntry[] = toMCPTools(
  sharedCharacterTools as unknown as AnySharedTool[],
  createCharacterToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = characterTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${characterTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const createCharacterTool = getToolOrThrow("create_character");
export const getCharacterTool = getToolOrThrow("get_character");
export const listCharactersTool = getToolOrThrow("list_characters");
export const deleteCharacterTool = getToolOrThrow("delete_character");
