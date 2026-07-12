/**
 * MCP Adapter
 *
 * Converts SharedToolDefinition to MCPToolEntry format for the MCP server.
 */

import { z } from "zod";
import type {
  GateResult,
  MCPToolEntry,
  SharedToolDefinition,
  ToolContext,
} from "@mythxengine/types";
import { zodToJsonSchema } from "./zod-to-json.js";

/**
 * A simplified tool definition type for adapter input
 * This is more lenient to avoid TypeScript variance issues
 */
export interface AnySharedTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown, ctx: ToolContext) => Promise<unknown>;
  emits?: string[];
  /**
   * Optional pre-execution gate (mirrors cc-2.18 wrappedCanUseTool).
   * Runs after schema validation and before the handler. Denials
   * surface as `{ status: "denied", reason }` so the LLM gets a
   * structured tool result and can self-correct.
   */
  gate?: (input: unknown, ctx: ToolContext) => Promise<GateResult> | GateResult;
}

/**
 * Convert a shared tool to MCP tool entry format
 *
 * @param tool - The shared tool definition
 * @param ctx - The tool context to inject
 * @returns MCPToolEntry for MCP server registration
 */
export function toMCPTool<TInput extends z.ZodTypeAny, TOutput>(
  tool: SharedToolDefinition<TInput, TOutput>,
  ctx: ToolContext
): MCPToolEntry {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema),
    handler: async (args: unknown) => {
      const input = tool.inputSchema.parse(args);
      // Lifecycle: schema → gate → handler (subset of the web
      // adapter's schema → gate → preTool → handler → postTool in
      // apps/web/src/lib/tool-adapter.ts). Gates enforce game-mechanic
      // invariants (e.g. take_rest refuses while combat is active) and
      // must run on every transport — without this, MCP clients bypass
      // rules the chat surface enforces.
      //
      // Skill-prerequisite gates built on `requireSkill` deliberately
      // pass through here: they allow when `ctx.loadedSkills` is
      // undefined (see packages/tools/src/skills/load-skill.ts), and
      // the MCP context never sets it. So MCP clients are NOT forced
      // to call load_skill — only real game-state invariants enforce.
      //
      // preTool/postTool are intentionally NOT wired: the only postTool
      // in the codebase is load_skill's `ctx.loadedSkills` mutation,
      // which is chat-session-scoped by design and meaningless over
      // MCP (no loadedSkills in this context). Wire them here only if
      // a transport-agnostic hook ever appears.
      if (tool.gate) {
        const decision = await Promise.resolve(tool.gate(input, ctx));
        if (!decision.allow) {
          return { status: "denied", reason: decision.reason };
        }
      }
      return tool.handler(input, ctx);
    },
  };
}

/**
 * Convert multiple shared tools to MCP tool entries
 *
 * This function accepts an array of any shared tools (with relaxed typing)
 * to avoid TypeScript variance issues with generic types.
 *
 * @param tools - Array of shared tool definitions
 * @param ctx - The tool context to inject
 * @returns Array of MCPToolEntry for MCP server registration
 */
export function toMCPTools(tools: readonly AnySharedTool[], ctx: ToolContext): MCPToolEntry[] {
  // Delegate to toMCPTool so the schema → gate → handler lifecycle
  // lives in exactly one place.
  return tools.map((t) => toMCPTool(t, ctx));
}

/**
 * Create an MCP tool registry from shared tools
 *
 * @param tools - Array of shared tool definitions
 * @param ctx - The tool context to inject
 * @returns Map of tool name to MCPToolEntry
 */
export function createMCPRegistry(
  tools: readonly AnySharedTool[],
  ctx: ToolContext
): Map<string, MCPToolEntry> {
  const registry = new Map<string, MCPToolEntry>();
  const mcpTools = toMCPTools(tools, ctx);
  for (const tool of mcpTools) {
    registry.set(tool.name, tool);
  }
  return registry;
}
