/**
 * Scene Framing Tools
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  sceneFramingTools as sharedSceneFramingTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for scene framing tools
 */
function createSceneFramingToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted scene framing tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const sceneFramingTools: MCPToolEntry[] = toMCPTools(
  sharedSceneFramingTools as unknown as AnySharedTool[],
  createSceneFramingToolContext()
);

// Re-export individual tools for backward compatibility
function getToolOrThrow(name: string): MCPToolEntry {
  const tool = sceneFramingTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Missing tool: ${name}. Available: ${sceneFramingTools.map((t) => t.name).join(", ")}`
    );
  }
  return tool;
}

export const analyzeSceneTool = getToolOrThrow("analyze_scene");
export const suggestSceneCutTool = getToolOrThrow("suggest_scene_cut");
export const frameSceneTool = getToolOrThrow("frame_scene");
