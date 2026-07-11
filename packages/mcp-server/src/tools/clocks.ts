/**
 * Clock tools - situation clocks with auto-tick integration
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  clocksTools as sharedClockTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
  type ClockTickResult,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Re-export ClockTickResult for use in auto-tick integration
 */
export type { ClockTickResult };

/**
 * Create the MCP context for clock tools
 */
function createClockToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted clock tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const clockTools: MCPToolEntry[] = toMCPTools(
  sharedClockTools as unknown as AnySharedTool[],
  createClockToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = clockTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${clockTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const startClockTool = getToolOrThrow("start_situation_clock");
export const tickClockTool = getToolOrThrow("tick_clock");
export const getActiveClocksTool = getToolOrThrow("get_active_clocks");
export const pauseClockTool = getToolOrThrow("pause_clock");
export const resumeClockTool = getToolOrThrow("resume_clock");
export const revealClockTool = getToolOrThrow("reveal_clock");
export const checkClockTriggersTool = getToolOrThrow("check_clock_triggers");
