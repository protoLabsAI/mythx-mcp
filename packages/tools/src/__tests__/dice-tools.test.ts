/**
 * Dice tools tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  SessionState,
  Character,
} from "@mythxengine/types";
import { rollDiceTool, rollTestTool, rollCustomTestTool } from "../dice/index.js";
import { getDefaultRulesContext, resetDefaultRulesCache } from "@mythxengine/engine";

// Create a proper mock character with full type
function createMockCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    archetypeId: "test-archetype",
    hp: { current: 10, max: 10 },
    abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 },
    skills: [
      {
        id: "athletics",
        name: "athletics",
        ability: "STR",
        bonus: 2,
        description: "Physical prowess",
      },
      { id: "stealth", name: "stealth", ability: "AGI", bonus: 1, description: "Sneaking" },
    ],
    specialAbilities: [],
    equipment: {
      weapons: ["Sword (d8)"],
      armor: null,
      gear: [],
    },
    conditions: [],
    flags: [],
    personality: ["Brave"],
    background: "A test hero",
    psychology: {
      fears: [],
      goals: [],
      ambitions: [],
      bonds: [],
      flaws: [],
    },
  };
}

// Create mock session
function createMockSession(id: string): SessionState {
  return {
    metadata: {
      id,
      name: `Test Session ${id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    rng: { seed: 12345, cursor: 0 },
    seq: 0,
    characters: {
      hero: createMockCharacter("hero", "Test Hero"),
    },
    npcs: {},
    enemies: {},
    combat: null,
    notes: [],
    flags: [],
    worldState: {},
    gameTime: { day: 1, hour: 8, minute: 0 },
    deadlines: [],
    currentLocationId: null,
  };
}

// Mock implementations
function createMockContext(): {
  ctx: ToolContext;
  sessionManager: ISessionManager;
  sessions: Map<string, SessionState>;
} {
  const sessions = new Map<string, SessionState>();

  const sessionManager: ISessionManager = {
    get: vi.fn(async (id: string) => sessions.get(id) ?? null),
    getOrCreate: vi.fn(async (id: string, name?: string) => {
      if (!sessions.has(id)) {
        const session = createMockSession(id);
        if (name) session.metadata.name = name;
        sessions.set(id, session);
      }
      return sessions.get(id)!;
    }),
    save: vi.fn(async (state: SessionState) => {
      sessions.set(state.metadata.id, state);
    }),
    delete: vi.fn(async (id: string) => {
      sessions.delete(id);
    }),
    list: vi.fn(async () => Array.from(sessions.keys())),
  };

  const worldPackManager: IWorldPackManager = {
    get: vi.fn(async () => null),
    save: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(async () => []),
  };

  const eventBus: IEventBus = {
    publish: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    psubscribe: vi.fn(() => () => {}),
  };

  const ctx: ToolContext = {
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: vi.fn(async () => getDefaultRulesContext()),
    eventBus,
  };

  return { ctx, sessionManager, sessions };
}

describe("rollDiceTool", () => {
  beforeEach(() => {
    resetDefaultRulesCache();
  });

  it("rolls dice without session (random)", async () => {
    const { ctx } = createMockContext();

    const result = await rollDiceTool.handler({ expression: "2d6+3" }, ctx);

    expect(result.expression).toBe("2d6+3");
    expect(result.rolls).toHaveLength(2);
    expect(result.modifier).toBe(3);
    expect(result.total).toBeGreaterThanOrEqual(5);
    expect(result.total).toBeLessThanOrEqual(15);
  });

  it("rolls dice with session (deterministic)", async () => {
    const { ctx, sessions } = createMockContext();
    const session = createMockSession("test-session");
    sessions.set("test-session", session);

    const result1 = await rollDiceTool.handler(
      { expression: "d20", sessionId: "test-session" },
      ctx
    );

    // RNG should have advanced
    expect(ctx.sessions.save).toHaveBeenCalled();
    expect(result1.total).toBeGreaterThanOrEqual(1);
    expect(result1.total).toBeLessThanOrEqual(20);
  });

  it("throws on invalid session ID", async () => {
    const { ctx } = createMockContext();

    await expect(
      rollDiceTool.handler({ expression: "d20", sessionId: "nonexistent" }, ctx)
    ).rejects.toThrow("Session not found");
  });

  it("emits dice rolled event when session is used", async () => {
    const { ctx, sessions } = createMockContext();
    const session = createMockSession("test-session");
    sessions.set("test-session", session);

    await rollDiceTool.handler({ expression: "d20", sessionId: "test-session" }, ctx);

    expect(ctx.eventBus.publish).toHaveBeenCalled();
  });
});

describe("rollTestTool", () => {
  beforeEach(() => {
    resetDefaultRulesCache();
  });

  it("performs ability test", async () => {
    const { ctx, sessions } = createMockContext();
    const session = createMockSession("test-session");
    sessions.set("test-session", session);

    const envelope = await rollTestTool.handler(
      {
        sessionId: "test-session",
        characterId: "hero",
        ability: "STR",
        difficulty: "standard",
        position: "risky",
        effectLevel: "standard",
      },
      ctx
    );

    expect(envelope.status).toBe("ok");
    expect(typeof envelope.outcome).toBe("string");
    expect(envelope.summary).toContain("Test Hero");
    // Summary is intentionally diegetic — no DC / modifier / raw d20.
    expect(envelope.summary).not.toMatch(/DC\s*\d|d20/i);
    expect(envelope.summary).toContain("STR");
    expect(envelope.summary).toContain("standard");
    expect(envelope.summary).toContain("risky");
    expect(envelope.state_delta.rng_advanced).toBe(true);
    expect(typeof envelope.state_delta.push_available).toBe("boolean");

    const result = envelope.result;
    expect(result.character).toBe("Test Hero");
    expect(result.ability).toBe("STR");
    expect(result.difficulty).toBe(12);
    expect(result.modifiers.ability).toBe(2); // STR is 2
    expect(typeof result.margin).toBe("number");
  });

  it("performs skill test", async () => {
    const { ctx, sessions } = createMockContext();
    const session = createMockSession("test-session");
    sessions.set("test-session", session);

    const envelope = await rollTestTool.handler(
      {
        sessionId: "test-session",
        characterId: "hero",
        skill: "athletics",
        difficulty: "standard",
        position: "risky",
        effectLevel: "standard",
      },
      ctx
    );

    expect(envelope.status).toBe("ok");
    const result = envelope.result;
    expect(result.skill).toBe("athletics");
    expect(result.difficulty).toBe(12); // STANDARD = 12
    expect(result.modifiers.skill).toBe(2); // athletics skill bonus is 2
  });

  it("handles advantage/disadvantage", async () => {
    const { ctx, sessions } = createMockContext();
    const session = createMockSession("test-session");
    sessions.set("test-session", session);

    const envelope = await rollTestTool.handler(
      {
        sessionId: "test-session",
        characterId: "hero",
        ability: "STR",
        difficulty: "standard",
        advantageSources: ["flanking"],
        position: "risky",
        effectLevel: "standard",
      },
      ctx
    );

    const result = envelope.result;
    expect(result.advantageState).toBe("advantage");
    expect(result.roll.advantage).toBeDefined();
    expect(result.roll.advantage?.bothRolls).toHaveLength(2);
  });

  it("throws on invalid session", async () => {
    const { ctx } = createMockContext();

    await expect(
      rollTestTool.handler(
        {
          sessionId: "nonexistent",
          characterId: "hero",
          difficulty: "standard",
          position: "risky",
          effectLevel: "standard",
        },
        ctx
      )
    ).rejects.toThrow("Session not found");
  });

  it("throws on invalid character", async () => {
    const { ctx, sessions } = createMockContext();
    const session = createMockSession("test-session");
    sessions.set("test-session", session);

    await expect(
      rollTestTool.handler(
        {
          sessionId: "test-session",
          characterId: "nonexistent",
          difficulty: "hard",
          position: "risky",
          effectLevel: "standard",
        },
        ctx
      )
    ).rejects.toThrow("Character not found");
  });
});

describe("rollCustomTestTool", () => {
  beforeEach(() => {
    resetDefaultRulesCache();
  });

  it("throws when custom test not found", async () => {
    const { ctx, sessions } = createMockContext();
    const session = createMockSession("test-session");
    sessions.set("test-session", session);

    await expect(
      rollCustomTestTool.handler(
        {
          sessionId: "test-session",
          characterId: "hero",
          testId: "nonexistent_test",
        },
        ctx
      )
    ).rejects.toThrow("Custom test not found");
  });
});
