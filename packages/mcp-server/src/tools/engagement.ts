/**
 * Engagement Hook Generator (MCP Adapter)
 *
 * Tools for "treasure, personal, mystery" engagement encodings.
 * Based on Alexandrian: "Make lore stick via treasure, mystery, personal ties."
 *
 * This file adapts the shared tools from @mythxengine/tools to MCP format by:
 * 1. Importing shared tool definitions
 * 2. Converting Zod schemas to JSON Schema
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  toMCPTools,
  nullEventBus,
  engagementTools as sharedEngagementTools,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create tool context for engagement tools
 */
function createEngagementToolContext(): ToolContext {
  return {
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
    eventBus: nullEventBus,
  };
}

/**
 * Engagement tools exported for MCP server
 */
export const engagementTools: MCPToolEntry[] = toMCPTools(
  sharedEngagementTools as unknown as AnySharedTool[],
  createEngagementToolContext()
);
