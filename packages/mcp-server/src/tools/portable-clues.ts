/**
 * Portable clues tools - Flexible revelation system
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  portableClueTools as sharedPortableClueTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for portable clue tools
 */
function createPortableClueToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted portable clue tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const portableClueTools: MCPToolEntry[] = toMCPTools(
  sharedPortableClueTools as unknown as AnySharedTool[],
  createPortableClueToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = portableClueTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${portableClueTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const createPortableClueTool = getToolOrThrow("create_portable_clue");
export const getUnrevealedCluesTool = getToolOrThrow("get_unrevealed_clues");
export const revealClueTool = getToolOrThrow("reveal_clue");
export const suggestClueDeliveryTool = getToolOrThrow("suggest_clue_delivery");
export const importLeadsAsCluesTool = getToolOrThrow("import_leads_as_clues");
