/**
 * MCP Adapter tests
 */

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import type {
  SharedToolDefinition,
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
} from "@mythxengine/types";
import {
  toMCPTool,
  toMCPTools,
  createMCPRegistry,
  type AnySharedTool,
} from "../adapters/mcp-adapter.js";

// Mock implementations
const mockSessionManager: ISessionManager = {
  get: vi.fn(),
  getOrCreate: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

const mockWorldPackManager: IWorldPackManager = {
  get: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

const mockEventBus: IEventBus = {
  publish: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  psubscribe: vi.fn(() => () => {}),
};

const mockContext: ToolContext = {
  sessions: mockSessionManager,
  worldPacks: mockWorldPackManager,
  getRules: vi.fn(),
  eventBus: mockEventBus,
};

// Test schemas
const inputSchema = z.object({
  name: z.string(),
});

const complexSchema = z.object({
  required: z.string().describe("A required field"),
  optional: z.string().optional().describe("An optional field"),
  enumField: z.enum(["A", "B", "C"]),
  numberField: z.number(),
  arrayField: z.array(z.string()),
});

describe("toMCPTool", () => {
  it("converts a shared tool to MCP format", async () => {
    const sharedTool: SharedToolDefinition<typeof inputSchema, { result: string }> = {
      name: "test_tool",
      description: "A test tool",
      inputSchema,
      handler: async (input) => ({ result: input.name }),
    };

    const mcpTool = toMCPTool(sharedTool, mockContext);

    expect(mcpTool.name).toBe("test_tool");
    expect(mcpTool.description).toBe("A test tool");
    expect(mcpTool.inputSchema).toBeDefined();
    expect(mcpTool.inputSchema.type).toBe("object");
  });

  it("handler validates input with Zod schema", async () => {
    const sharedTool: SharedToolDefinition<typeof inputSchema, { result: string }> = {
      name: "test_tool",
      description: "A test tool",
      inputSchema,
      handler: async (input) => ({ result: input.name }),
    };

    const mcpTool = toMCPTool(sharedTool, mockContext);

    // Valid input
    const result = await mcpTool.handler({ name: "test" });
    expect(result).toEqual({ result: "test" });

    // Invalid input should throw
    await expect(mcpTool.handler({ name: 123 })).rejects.toThrow();
    await expect(mcpTool.handler({})).rejects.toThrow();
  });

  it("passes context to handler", async () => {
    const handlerSpy = vi.fn().mockResolvedValue({ success: true });
    const sharedTool: SharedToolDefinition<typeof inputSchema, { success: boolean }> = {
      name: "context_test",
      description: "Tests context passing",
      inputSchema,
      handler: handlerSpy,
    };

    const mcpTool = toMCPTool(sharedTool, mockContext);
    await mcpTool.handler({ name: "test" });

    expect(handlerSpy).toHaveBeenCalledWith({ name: "test" }, mockContext);
  });

  it("converts JSON schema correctly", () => {
    const sharedTool: SharedToolDefinition<typeof complexSchema, unknown> = {
      name: "complex_tool",
      description: "A tool with complex schema",
      inputSchema: complexSchema,
      handler: async () => ({}),
    };

    const mcpTool = toMCPTool(sharedTool, mockContext);
    const schema = mcpTool.inputSchema;

    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).required).toBeDefined();
    expect((schema.properties as Record<string, unknown>).optional).toBeDefined();
    expect(schema.required).toContain("required");
    expect(schema.required).not.toContain("optional");
  });
});

describe("toMCPTools", () => {
  it("converts multiple tools", () => {
    // Create tools with handler that takes unknown input (matches AnySharedTool interface)
    const tool1: AnySharedTool = {
      name: "tool1",
      description: "First tool",
      inputSchema,
      handler: async (input) => {
        const parsed = inputSchema.parse(input);
        return { result: parsed.name.length };
      },
    };
    const tool2: AnySharedTool = {
      name: "tool2",
      description: "Second tool",
      inputSchema,
      handler: async (input) => {
        const parsed = inputSchema.parse(input);
        return { result: parsed.name.length * 2 };
      },
    };

    const mcpTools = toMCPTools([tool1, tool2], mockContext);

    expect(mcpTools).toHaveLength(2);
    expect(mcpTools[0].name).toBe("tool1");
    expect(mcpTools[1].name).toBe("tool2");
  });
});

describe("createMCPRegistry", () => {
  it("creates a registry map from tools", () => {
    // Create tools with handler that takes unknown input (matches AnySharedTool interface)
    const tool1: AnySharedTool = {
      name: "tool1",
      description: "First tool",
      inputSchema,
      handler: async () => ({}),
    };
    const tool2: AnySharedTool = {
      name: "tool2",
      description: "Second tool",
      inputSchema,
      handler: async () => ({}),
    };

    const registry = createMCPRegistry([tool1, tool2], mockContext);

    expect(registry.size).toBe(2);
    expect(registry.has("tool1")).toBe(true);
    expect(registry.has("tool2")).toBe(true);
    expect(registry.get("tool1")?.name).toBe("tool1");
  });
});
