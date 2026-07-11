/**
 * Investigation tools - Mystery tracking and hypothesis testing
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  investigationTools as sharedInvestigationTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for investigation tools
 */
function createInvestigationToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted investigation tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const investigationTools: MCPToolEntry[] = toMCPTools(
  sharedInvestigationTools as unknown as AnySharedTool[],
  createInvestigationToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = investigationTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${investigationTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const startInvestigationTool = getToolOrThrow("start_investigation");
export const addEvidenceTool = getToolOrThrow("add_evidence");
export const addHypothesisTool = getToolOrThrow("add_hypothesis");
export const testHypothesisTool = getToolOrThrow("test_hypothesis");
export const recordNullResultTool = getToolOrThrow("record_null_result");
export const getInvestigationStatusTool = getToolOrThrow("get_investigation_status");
export const suggestNextStepsTool = getToolOrThrow("suggest_investigation_steps");
export const updateInvestigationStatusTool = getToolOrThrow("update_investigation_status");
