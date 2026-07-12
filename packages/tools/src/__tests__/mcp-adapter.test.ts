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
  SessionState,
  Character,
} from "@mythxengine/types";
import { createEmptySession } from "@mythxengine/types";
import { getDefaultRulesContext } from "@mythxengine/engine";
import {
  toMCPTool,
  toMCPTools,
  createMCPRegistry,
  type AnySharedTool,
} from "../adapters/mcp-adapter.js";
import { startCombatTool } from "../combat/start-combat.js";
import { takeRestTool } from "../rest/take-rest.js";

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

describe("gate execution", () => {
  it("runs the gate after schema validation; denial short-circuits with the web transport's denied shape", async () => {
    const gateSpy = vi.fn().mockResolvedValue({ allow: false, reason: "not now" });
    const handlerSpy = vi.fn().mockResolvedValue({ result: "should not run" });
    const gatedTool: AnySharedTool = {
      name: "gated_tool",
      description: "A tool with a denying gate",
      inputSchema,
      gate: gateSpy,
      handler: handlerSpy,
    };

    const mcpTool = toMCPTools([gatedTool], mockContext)[0];
    const result = await mcpTool.handler({ name: "test" });

    // Same shape apps/web/src/lib/tool-adapter.ts returns on denial.
    expect(result).toEqual({ status: "denied", reason: "not now" });
    expect(gateSpy).toHaveBeenCalledWith({ name: "test" }, mockContext);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it("proceeds to the handler when the gate allows", async () => {
    const gatedTool: AnySharedTool = {
      name: "gated_tool",
      description: "A tool with an allowing gate",
      inputSchema,
      gate: vi.fn().mockReturnValue({ allow: true }),
      handler: async (input) => ({ result: inputSchema.parse(input).name }),
    };

    const mcpTool = toMCPTool(gatedTool as SharedToolDefinition, mockContext);
    const result = await mcpTool.handler({ name: "ok" });
    expect(result).toEqual({ result: "ok" });
  });
});

describe("gate enforcement over MCP with real tools (take_rest mid-combat)", () => {
  // Regression for the demonstrated bypass: over MCP, take_rest used to
  // succeed mid-combat because its only combat prohibition lives in its
  // gate, and the MCP adapter ran schema → handler only.
  function createHero(): Character {
    return {
      id: "hero",
      name: "Hero",
      archetypeId: "warrior",
      hp: { current: 12, max: 12 },
      abilities: { STR: 3, AGI: 2, WIT: 0, CON: 2 },
      skills: [{ id: "combat", name: "Combat", ability: "STR", bonus: 2, description: "Fighting" }],
      specialAbilities: [],
      equipment: { weapons: ["Sword"], armor: null, gear: [] },
      conditions: [],
      flags: [],
      personality: [],
      background: "A test hero",
      psychology: { fears: [], goals: [], ambitions: [], bonds: [], flaws: [] },
      stress: { current: 0, max: 9 },
    };
  }

  function createInMemoryContext(session: SessionState): ToolContext {
    const sessions = new Map<string, SessionState>([[session.metadata.id, session]]);
    const sessionManager: ISessionManager = {
      get: async (id) => sessions.get(id) ?? null,
      getOrCreate: async (id) => sessions.get(id)!,
      save: async (state) => {
        sessions.set(state.metadata.id, state);
      },
      delete: async () => {},
      list: async () => Array.from(sessions.keys()),
    };
    return {
      sessions: sessionManager,
      worldPacks: mockWorldPackManager,
      getRules: async () => getDefaultRulesContext(),
      eventBus: mockEventBus,
      // No `loadedSkills` — like the real MCP server context. The
      // requireSkill half of take_rest's gate passes through; only the
      // combat-active game invariant enforces.
    };
  }

  it("denies take_rest while combat is active, allows it otherwise", async () => {
    const session = createEmptySession("gate-rest-session", "Gate Rest Test");
    session.characters.hero = createHero();
    const ctx = createInMemoryContext(session);

    const startCombat = toMCPTool(startCombatTool, ctx);
    const takeRest = toMCPTool(takeRestTool, ctx);

    // Control: with no combat, the gate allows and the rest resolves.
    const restBefore = (await takeRest.handler({
      sessionId: "gate-rest-session",
      restType: "short",
    })) as { status: string };
    expect(restBefore.status).toBe("ok");

    // Start combat via the real tool through the MCP adapter.
    await startCombat.handler({
      sessionId: "gate-rest-session",
      characterIds: ["hero"],
      enemies: [{ name: "Goblin" }],
    });

    // Mid-combat, the gate must short-circuit with the denied shape.
    const denied = await takeRest.handler({
      sessionId: "gate-rest-session",
      restType: "short",
    });
    expect(denied).toEqual({
      status: "denied",
      reason: expect.stringContaining("Combat is still active"),
    });
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
