/**
 * Tool Execution Contract
 *
 * All MCP tools follow a uniform pattern for consistent error handling
 * and response formatting.
 */

import { z } from "zod";
import type { GameEvent } from "../game/index.js";

/**
 * Standard tool error
 */
export interface ToolError {
  code: string;
  message: string;
  field?: string;
}

/**
 * Standard tool output envelope
 */
export interface ToolOutput<T = unknown> {
  success: boolean;
  result?: T;
  events?: GameEvent[];
  errors: ToolError[];
}

/**
 * MCP tool entry for registry
 */
export interface MCPToolEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

/**
 * Tool registry type
 */
export type MCPToolRegistry = Map<string, MCPToolEntry>;

/**
 * Zod schema for tool errors
 */
export const ToolErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string().optional(),
});

/**
 * Create a success output
 */
export function successOutput<T>(result: T, events?: GameEvent[]): ToolOutput<T> {
  return {
    success: true,
    result,
    events,
    errors: [],
  };
}

/**
 * Create an error output
 */
export function errorOutput(code: string, message: string, field?: string): ToolOutput<never> {
  return {
    success: false,
    errors: [{ code, message, field }],
  };
}

// Re-export shared tool types
export * from "./shared.js";
