/**
 * EventBus tests
 */

import { describe, it, expect, vi } from "vitest";
import { createInMemoryEventBus } from "../context/langgraph-context.js";
import type { BusEvent } from "@mythxengine/types";

describe("createInMemoryEventBus", () => {
  it("publishes and receives events on same channel", () => {
    const eventBus = createInMemoryEventBus();
    const handler = vi.fn();

    eventBus.subscribe("test-channel", handler);
    eventBus.publish("test-channel", createEvent("TEST", "test-channel", { data: "hello" }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TEST",
        payload: { data: "hello" },
      })
    );
  });

  it("does not receive events from other channels", () => {
    const eventBus = createInMemoryEventBus();
    const handler = vi.fn();

    eventBus.subscribe("channel-a", handler);
    eventBus.publish("channel-b", createEvent("TEST", "channel-b", {}));

    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribe stops receiving events", () => {
    const eventBus = createInMemoryEventBus();
    const handler = vi.fn();

    const unsubscribe = eventBus.subscribe("test-channel", handler);
    eventBus.publish("test-channel", createEvent("TEST", "test-channel", {}));
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    eventBus.publish("test-channel", createEvent("TEST", "test-channel", {}));
    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it("psubscribe matches wildcard patterns", () => {
    const eventBus = createInMemoryEventBus();
    const handler = vi.fn();

    eventBus.psubscribe("session:*:state", handler);

    eventBus.publish(
      "session:123:state",
      createEvent("TEST", "session:123:state", { session: "123" })
    );
    eventBus.publish(
      "session:456:state",
      createEvent("TEST", "session:456:state", { session: "456" })
    );

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith(
      "session:123:state",
      expect.objectContaining({ payload: { session: "123" } })
    );
    expect(handler).toHaveBeenCalledWith(
      "session:456:state",
      expect.objectContaining({ payload: { session: "456" } })
    );
  });

  it("psubscribe does not match unrelated channels", () => {
    const eventBus = createInMemoryEventBus();
    const handler = vi.fn();

    eventBus.psubscribe("session:*:state", handler);

    eventBus.publish("session:123:combat", createEvent("TEST", "session:123:combat", {}));
    eventBus.publish("other:channel", createEvent("TEST", "other:channel", {}));

    expect(handler).not.toHaveBeenCalled();
  });

  it("multiple subscribers receive events", () => {
    const eventBus = createInMemoryEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.subscribe("test-channel", handler1);
    eventBus.subscribe("test-channel", handler2);
    eventBus.publish("test-channel", createEvent("TEST", "test-channel", {}));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("psubscribe matches double-wildcard patterns", () => {
    const eventBus = createInMemoryEventBus();
    const handler = vi.fn();

    eventBus.psubscribe("session:**", handler);

    eventBus.publish("session:123", createEvent("TEST", "session:123", { level: 1 }));
    eventBus.publish("session:123:state", createEvent("TEST", "session:123:state", { level: 2 }));
    eventBus.publish(
      "session:123:state:nested",
      createEvent("TEST", "session:123:state:nested", { level: 3 })
    );

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("psubscribe does not match with wrong prefix", () => {
    const eventBus = createInMemoryEventBus();
    const handler = vi.fn();

    eventBus.psubscribe("session:**", handler);

    eventBus.publish("other:123", createEvent("TEST", "other:123", {}));
    eventBus.publish("sessions:123", createEvent("TEST", "sessions:123", {}));

    expect(handler).not.toHaveBeenCalled();
  });

  it("catches and logs handler errors", () => {
    const eventBus = createInMemoryEventBus();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const errorHandler = vi.fn(() => {
      throw new Error("Handler error");
    });
    const normalHandler = vi.fn();

    eventBus.subscribe("test-channel", errorHandler);
    eventBus.subscribe("test-channel", normalHandler);
    eventBus.publish("test-channel", createEvent("TEST", "test-channel", {}));

    // Both handlers should be called despite error
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(normalHandler).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});

// Helper to create events
function createEvent<T>(type: string, channel: string, payload: T): BusEvent<T> {
  return {
    id: `test-${Date.now()}`,
    type,
    channel,
    timestamp: Date.now(),
    payload,
  };
}
