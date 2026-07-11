/**
 * Tool Adapters
 *
 * Convert SharedToolDefinition to various transport formats.
 */

export { zodToJsonSchema, getRequiredFields, getPropertyDescriptions } from "./zod-to-json.js";
export type { JsonSchema } from "./zod-to-json.js";

export { toMCPTool, toMCPTools, createMCPRegistry } from "./mcp-adapter.js";
export type { AnySharedTool } from "./mcp-adapter.js";

export {
  toLangGraphTool,
  toLangGraphTools,
  createLangChainTool,
} from "./langgraph-adapter.js";
export type { LangGraphTool } from "./langgraph-adapter.js";
