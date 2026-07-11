/**
 * Skills tools - loading on-demand prompt fragments (load_skill)
 *
 * This file bridges shared tools to the MCP server by:
 * 1. Using the shared tool definitions from @mythxengine/tools
 * 2. Adapting them to MCPToolEntry format via the MCP adapter
 * 3. Providing the required ToolContext from the MCP server's state
 *
 * Exposing `load_skill` over MCP lets any MCP client pull the runtime
 * GM skill playbooks (combat-runner, engine-flows, …) on demand — the
 * same mechanism the LangGraph agent uses.
 */

import type { MCPToolEntry, ToolContext } from "@mythxengine/types";
import {
  skillsTools as sharedSkillsTools,
  toMCPTools,
  createMCPContext,
  type AnySharedTool,
} from "@mythxengine/tools";
import { sessionManager } from "../state/manager.js";
import { worldPackManager } from "../state/worldpacks.js";
import { getRulesForSession } from "../state/rules.js";

/**
 * Create the MCP context for skills tools
 */
function createSkillsToolContext(): ToolContext {
  return createMCPContext({
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: getRulesForSession,
  });
}

/**
 * Adapted skills tools for MCP server
 *
 * Note: The cast to AnySharedTool[] is safe because the adapter
 * will parse and validate inputs through the Zod schema before
 * passing them to the handler.
 */
export const skillsTools: MCPToolEntry[] = toMCPTools(
  sharedSkillsTools as unknown as AnySharedTool[],
  createSkillsToolContext()
);
