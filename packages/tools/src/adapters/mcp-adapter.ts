/**
 * MCP Adapter
 *
 * Converts SharedToolDefinition to MCPToolEntry format for the MCP server.
 */

import { z } from "zod";
import type { MCPToolEntry, SharedToolDefinition, ToolContext } from "@mythxengine/types";
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
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema),
    handler: async (args: unknown) => {
      const input = t.inputSchema.parse(args);
      return t.handler(input, ctx);
    },
  }));
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
