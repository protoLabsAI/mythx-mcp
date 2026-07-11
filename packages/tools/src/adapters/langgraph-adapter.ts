/**
 * LangGraph Adapter
 *
 * Converts SharedToolDefinition to LangGraph StructuredTool format.
 *
 * Note: This module uses dynamic imports to avoid requiring LangGraph
 * as a dependency when only using MCP functionality.
 */

import { z } from "zod";
import type { SharedToolDefinition, ToolContext } from "@mythxengine/types";

/**
 * LangGraph tool interface (minimal definition to avoid dependency)
 * Full interface from @langchain/core/tools
 */
export interface LangGraphTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  invoke: (input: unknown) => Promise<string>;
}

/**
 * Convert a shared tool to LangGraph tool format
 *
 * @param sharedTool - The shared tool definition
 * @param getContext - Function to get the current tool context (allows dynamic context)
 * @returns LangGraph-compatible tool object
 */
export function toLangGraphTool<TInput extends z.ZodTypeAny, TOutput>(
  sharedTool: SharedToolDefinition<TInput, TOutput>,
  getContext: () => ToolContext
): LangGraphTool {
  return {
    name: sharedTool.name,
    description: sharedTool.description,
    schema: sharedTool.inputSchema,
    invoke: async (input: unknown): Promise<string> => {
      const ctx = getContext();
      const parsedInput = sharedTool.inputSchema.parse(input);
      const result = await sharedTool.handler(parsedInput, ctx);
      return JSON.stringify(result);
    },
  };
}

/**
 * Convert multiple shared tools to LangGraph format
 *
 * @param tools - Array of shared tool definitions
 * @param getContext - Function to get the current tool context
 * @returns Array of LangGraph-compatible tools
 */
export function toLangGraphTools(
  tools: SharedToolDefinition<z.ZodTypeAny, unknown>[],
  getContext: () => ToolContext
): LangGraphTool[] {
  return tools.map((t) => toLangGraphTool(t, getContext));
}

/**
 * Create a LangGraph tool with proper @langchain/core/tools integration
 *
 * This function is designed to be used with the actual LangGraph SDK.
 * Usage:
 *
 * ```typescript
 * import { tool } from "@langchain/core/tools";
 * import { createLangChainTool } from "@mythxengine/tools/adapters";
 *
 * const myTool = createLangChainTool(sharedToolDef, getContext, tool);
 * ```
 *
 * @param sharedTool - The shared tool definition
 * @param getContext - Function to get the current tool context
 * @param toolFactory - The `tool` function from @langchain/core/tools
 * @returns A properly typed LangChain StructuredTool
 */
export function createLangChainTool<TInput extends z.ZodTypeAny, TOutput>(
  sharedTool: SharedToolDefinition<TInput, TOutput>,
  getContext: () => ToolContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolFactory: (
    fn: (input: z.infer<TInput>) => Promise<string>,
    config: { name: string; description: string; schema: TInput }
  ) => any
): unknown {
  return toolFactory(
    async (input: z.infer<TInput>): Promise<string> => {
      const ctx = getContext();
      const result = await sharedTool.handler(input, ctx);
      return JSON.stringify(result);
    },
    {
      name: sharedTool.name,
      description: sharedTool.description,
      schema: sharedTool.inputSchema,
    }
  );
}
