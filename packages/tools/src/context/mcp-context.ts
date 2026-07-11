/**
 * MCP Context Factory
 *
 * Creates a ToolContext configured for the MCP server with:
 * - File-based session storage
 * - File-based world pack storage
 * - No real-time EventBus (nullEventBus)
 */

import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  GetRulesFunction,
  IEventBus,
} from "@mythxengine/types";

/**
 * Configuration for creating an MCP context
 */
export interface MCPContextConfig {
  /** Session manager instance */
  sessions: ISessionManager;
  /** World pack manager instance */
  worldPacks: IWorldPackManager;
  /** Function to get rules for a session */
  getRules: GetRulesFunction;
}

/**
 * No-op EventBus for MCP (file-based, no real-time sync needed)
 */
const nullEventBus: IEventBus = {
  publish: () => {},
  subscribe: () => () => {},
  psubscribe: () => () => {},
};

/**
 * Create a ToolContext for the MCP server
 *
 * Uses the nullEventBus since MCP is file-based with no real-time sync.
 *
 * @param config - The context configuration
 * @returns ToolContext configured for MCP
 */
export function createMCPContext(config: MCPContextConfig): ToolContext {
  return {
    sessions: config.sessions,
    worldPacks: config.worldPacks,
    getRules: config.getRules,
    eventBus: nullEventBus,
  };
}

/**
 * Create a lazy context factory for MCP
 *
 * This is useful when the context needs to be created dynamically
 * (e.g., when managers are singletons that might not be initialized yet)
 *
 * @param getConfig - Function to get the context configuration
 * @returns Function that returns the ToolContext
 */
export function createMCPContextFactory(getConfig: () => MCPContextConfig): () => ToolContext {
  let cachedContext: ToolContext | null = null;

  return () => {
    if (!cachedContext) {
      cachedContext = createMCPContext(getConfig());
    }
    return cachedContext;
  };
}
