/**
 * Context Module
 *
 * Context factories for different transport layers.
 */

export {
  createMCPContext,
  createMCPContextFactory,
} from "./mcp-context.js";
export type { MCPContextConfig } from "./mcp-context.js";

export {
  createLangGraphContext,
  createLangGraphContextFactory,
  createInMemoryEventBus,
} from "./langgraph-context.js";
export type { LangGraphContextConfig } from "./langgraph-context.js";

export { createEventCollector } from "./event-collector.js";
export type { EventCollector } from "./event-collector.js";
