/**
 * Stress tools - FitD-style stress mechanics (push, resist, recover, flashback)
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  stressTools as sharedStressTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for stress tools
 */
function createStressToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted stress tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const stressTools: MCPToolEntry[] = toMCPTools(
  sharedStressTools as unknown as AnySharedTool[],
  createStressToolContext()
);

// Re-export individual tools for direct access
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = stressTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${stressTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const getStressTool = getToolOrThrow("get_stress");
export const pushRollTool = getToolOrThrow("push_roll");
export const resistConsequenceTool = getToolOrThrow("resist_consequence");
export const recoverStressTool = getToolOrThrow("recover_stress");
export const flashbackTool = getToolOrThrow("flashback");
