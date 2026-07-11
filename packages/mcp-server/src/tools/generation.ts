/**
 * Generation tools - world content generation
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  generationTools as sharedGenerationTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for generation tools
 */
function createGenerationToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted generation tools for MCP server
 *
 * Includes all 13 generation tools:
 * - World seed, archetypes, monsters, items, encounters, locations, npcs, narrative, situations, arcs
 * - save_generation_result, resume_generation, assemble_world_pack
 */
export const generationTools: MCPToolEntry[] = toMCPTools(
  sharedGenerationTools as unknown as AnySharedTool[],
  createGenerationToolContext()
);
