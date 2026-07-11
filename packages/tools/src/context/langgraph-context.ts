/**
 * LangGraph Context Factory
 *
 * Creates a ToolContext configured for LangGraph with:
 * - Pluggable session storage (file, memory, or PayloadCMS)
 * - Pluggable world pack storage
 * - Active EventBus for real-time sync
 */

import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  GetRulesFunction,
} from "@mythxengine/types";

/**
 * Configuration for creating a LangGraph context
 */
export interface LangGraphContextConfig {
  /** Session manager instance */
  sessions: ISessionManager;
  /** World pack manager instance */
  worldPacks: IWorldPackManager;
  /** Function to get rules for a session */
  getRules: GetRulesFunction;
  /** Event bus for real-time communication */
  eventBus: IEventBus;
}

/**
 * Create a ToolContext for LangGraph
 *
 * Uses the provided EventBus for real-time sync.
 *
 * @param config - The context configuration
 * @returns ToolContext configured for LangGraph
 */
export function createLangGraphContext(config: LangGraphContextConfig): ToolContext {
  return {
    sessions: config.sessions,
    worldPacks: config.worldPacks,
    getRules: config.getRules,
    eventBus: config.eventBus,
  };
}

/**
 * Create a context factory for LangGraph
 *
 * Returns a function that provides the context, allowing for dynamic
 * context resolution (e.g., per-request context in a web server).
 *
 * @param getConfig - Function to get the context configuration
 * @returns Function that returns the ToolContext
 */
export function createLangGraphContextFactory(
  getConfig: () => LangGraphContextConfig
): () => ToolContext {
  return () => createLangGraphContext(getConfig());
}

/**
 * Create an in-memory EventBus for testing or single-process use
 *
 * This is a simple implementation suitable for testing.
 * For production, use Redis-backed EventBus.
 */
export function createInMemoryEventBus(): IEventBus {
  const subscribers = new Map<string, Set<(event: unknown) => void>>();
  const patternSubscribers = new Map<string, Set<(channel: string, event: unknown) => void>>();

  return {
    publish<T>(channel: string, event: T): void {
      // Direct subscribers
      const channelSubs = subscribers.get(channel);
      if (channelSubs) {
        for (const handler of channelSubs) {
          try {
            handler(event);
          } catch (e) {
            console.error("EventBus handler error:", e);
          }
        }
      }

      // Pattern subscribers
      for (const [pattern, handlers] of patternSubscribers) {
        if (matchPattern(pattern, channel)) {
          for (const handler of handlers) {
            try {
              handler(channel, event);
            } catch (e) {
              console.error("EventBus pattern handler error:", e);
            }
          }
        }
      }
    },

    subscribe<T>(channel: string, handler: (event: T) => void): () => void {
      if (!subscribers.has(channel)) {
        subscribers.set(channel, new Set());
      }
      const handlers = subscribers.get(channel)!;
      handlers.add(handler as (event: unknown) => void);

      return () => {
        handlers.delete(handler as (event: unknown) => void);
        if (handlers.size === 0) {
          subscribers.delete(channel);
        }
      };
    },

    psubscribe<T>(pattern: string, handler: (channel: string, event: T) => void): () => void {
      if (!patternSubscribers.has(pattern)) {
        patternSubscribers.set(pattern, new Set());
      }
      const handlers = patternSubscribers.get(pattern)!;
      handlers.add(handler as (channel: string, event: unknown) => void);

      return () => {
        handlers.delete(handler as (channel: string, event: unknown) => void);
        if (handlers.size === 0) {
          patternSubscribers.delete(pattern);
        }
      };
    },
  };
}

/**
 * Match a Redis-style pattern against a channel name
 * Supports * (single segment) and ** (multiple segments)
 *
 * Uses iterative segment matching to avoid ReDoS vulnerabilities.
 */
function matchPattern(pattern: string, channel: string): boolean {
  const patternParts = pattern.split(":");
  const channelParts = channel.split(":");

  let pi = 0; // pattern index
  let ci = 0; // channel index

  while (pi < patternParts.length && ci < channelParts.length) {
    const pp = patternParts[pi];

    if (pp === "**") {
      // ** matches zero or more segments
      // If this is the last pattern part, match everything remaining
      if (pi === patternParts.length - 1) {
        return true;
      }
      // Try to match the next pattern part against remaining channel parts
      const nextPattern = patternParts[pi + 1];
      while (ci < channelParts.length) {
        if (nextPattern === "*" || nextPattern === channelParts[ci] || nextPattern === "**") {
          break;
        }
        ci++;
      }
      pi++;
    } else if (pp === "*") {
      // * matches exactly one segment (any value)
      pi++;
      ci++;
    } else {
      // Literal match
      if (pp !== channelParts[ci]) {
        return false;
      }
      pi++;
      ci++;
    }
  }

  // Handle trailing ** which can match zero segments
  while (pi < patternParts.length && patternParts[pi] === "**") {
    pi++;
  }

  // Both must be exhausted for a match
  return pi === patternParts.length && ci === channelParts.length;
}
