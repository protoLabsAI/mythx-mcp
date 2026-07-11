/**
 * NPC Relationship Tracking Tools
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  relationshipsTools as sharedRelationshipsTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for relationship tools
 */
function createRelationshipsToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted relationship tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const relationshipTools: MCPToolEntry[] = toMCPTools(
  sharedRelationshipsTools as unknown as AnySharedTool[],
  createRelationshipsToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = relationshipTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${relationshipTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const getRelationshipTool = getToolOrThrow("get_relationship");
export const initializeRelationshipTool = getToolOrThrow("initialize_relationship");
export const updateRelationshipTool = getToolOrThrow("update_relationship");
export const listRelationshipsTool = getToolOrThrow("list_relationships");
export const getNpcDispositionTool = getToolOrThrow("get_npc_disposition");
