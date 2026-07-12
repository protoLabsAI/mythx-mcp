/**
 * Inventory tools - narrative and itemized inventory management
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  inventoryTools as sharedInventoryTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for inventory tools
 */
function createInventoryToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted inventory tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const inventoryTools: MCPToolEntry[] = toMCPTools(
  sharedInventoryTools as unknown as AnySharedTool[],
  createInventoryToolContext()
);

// Re-export individual tools for direct access
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = inventoryTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${inventoryTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const upgradeInventoryTool = getToolOrThrow("upgrade_inventory");
export const listInventoryTool = getToolOrThrow("list_inventory");
export const addItemTool = getToolOrThrow("add_item");
export const removeItemTool = getToolOrThrow("remove_item");
export const modifyGoldTool = getToolOrThrow("modify_gold");
export const equipItemTool = getToolOrThrow("equip_item");
export const unequipItemTool = getToolOrThrow("unequip_item");
export const useItemTool = getToolOrThrow("use_item");
export const transferItemTool = getToolOrThrow("transfer_item");
