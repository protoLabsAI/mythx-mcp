/**
 * Combat tools - combat tracker and resolution
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  combatTools as sharedCombatTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for combat tools
 */
function createCombatToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted combat tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const combatTools: MCPToolEntry[] = toMCPTools(
  sharedCombatTools as unknown as AnySharedTool[],
  createCombatToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = combatTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${combatTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const startCombatTool = getToolOrThrow("start_combat");
export const rollInitiativeTool = getToolOrThrow("roll_initiative");
export const attackTool = getToolOrThrow("attack");
export const applyDamageTool = getToolOrThrow("apply_damage");
export const addCombatConditionTool = getToolOrThrow("add_combat_condition");
export const nextTurnTool = getToolOrThrow("next_turn");
export const endCombatTool = getToolOrThrow("end_combat");
export const getCombatStateTool = getToolOrThrow("get_combat_state");
