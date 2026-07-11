/**
 * Event Collector
 *
 * An IEventBus implementation that collects events during tool execution
 * instead of broadcasting them. Used in LangGraph context where the agent
 * runs in a separate process from the WebSocket server.
 *
 * Events are collected and returned via agent state (pendingEvents),
 * then synced to the frontend via the WebSocket event bus.
 */

import type { IEventBus, BusEvent } from "@mythxengine/types";

/**
 * Extended EventBus that can retrieve collected events
 */
export interface EventCollector extends IEventBus {
  /** Get all collected events */
  getEvents(): BusEvent[];
  /** Clear collected events */
  clear(): void;
  /** Get events and clear in one operation */
  drain(): BusEvent[];
}

/**
 * Create an event collector that stores events for later retrieval.
 *
 * Use this instead of createInMemoryEventBus() when running tools in
 * a separate process (e.g., LangGraph agent) that needs to return
 * events to the caller via state rather than broadcasting.
 *
 * @example
 * ```typescript
 * const collector = createEventCollector();
 * const toolContext = createLangGraphContext({ eventBus: collector });
 *
 * // Tools execute and emit events...
 * await agent.invoke({ messages });
 *
 * // Get collected events for state sync
 * const events = collector.drain();
 * return { messages: [...], pendingEvents: events };
 * ```
 */
export function createEventCollector(): EventCollector {
  const events: BusEvent[] = [];

  return {
    /**
     * Collect event instead of broadcasting
     */
    publish<T>(channel: string, event: T): void {
      // Ensure event has required fields
      const busEvent = event as BusEvent;
      if (busEvent.type && busEvent.channel) {
        events.push(busEvent);
      } else {
        // Wrap raw payload in BusEvent structure
        events.push({
          id: `collected_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: "UNKNOWN",
          channel,
          timestamp: Date.now(),
          payload: event,
        } as BusEvent);
      }
    },

    /**
     * No-op subscribe (collector doesn't broadcast)
     */
    subscribe<T>(_channel: string, _handler: (event: T) => void): () => void {
      // Collector doesn't support subscriptions
      return () => {};
    },

    /**
     * No-op pattern subscribe (collector doesn't broadcast)
     */
    psubscribe<T>(_pattern: string, _handler: (channel: string, event: T) => void): () => void {
      // Collector doesn't support subscriptions
      return () => {};
    },

    /**
     * Get all collected events (does not clear)
     */
    getEvents(): BusEvent[] {
      return [...events];
    },

    /**
     * Clear collected events
     */
    clear(): void {
      events.length = 0;
    },

    /**
     * Get events and clear in one atomic operation
     */
    drain(): BusEvent[] {
      const result = [...events];
      events.length = 0;
      return result;
    },
  };
}
