/**
 * Tests for the intent-named character-state tools that replaced the
 * kitchen-sink `update_character`. Each test asserts both the
 * mutation result and the `CHARACTER_UPDATED` emission on
 * `session:{id}:character`.
 *
 * See docs/audits/chat-flow-audit.md §3 + §5 P1.2.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  SessionState,
  Character,
  BusEvent,
} from "@mythxengine/types";
import {
  healCharacterTool,
  damageCharacterTool,
  applyConditionTool,
  removeConditionTool,
} from "../characters/index.js";
import { ApplyConditionInputSchema } from "../characters/apply-condition.js";
import { getDefaultRulesContext } from "@mythxengine/engine";

function createMockCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    archetypeId: "test-archetype",
    hp: { current: 6, max: 10 },
    abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 },
    skills: [],
    specialAbilities: [],
    equipment: { weapons: [], armor: null, gear: [] },
    conditions: [],
    flags: [],
    personality: [],
    background: "Test",
    psychology: { fears: [], goals: [], ambitions: [], bonds: [], flaws: [] },
  };
}

function createMockSession(id: string): SessionState {
  return {
    metadata: {
      id,
      name: `Test ${id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    rng: { seed: 12345, cursor: 0 },
    seq: 0,
    characters: { hero: createMockCharacter("hero", "Hero") },
    npcs: {},
    enemies: {},
    combat: null,
    notes: [],
    flags: [],
    worldState: {},
    gameTime: { day: 1, hour: 8, minute: 0 },
    deadlines: [],
    currentLocationId: null,
    players: {
      p1: { id: "p1", name: "Tester", controlType: "human", characterId: "hero" },
    } as unknown as SessionState["players"],
  };
}

interface PublishedEvent {
  channel: string;
  event: BusEvent;
}

function createMockContext(session: SessionState): {
  ctx: ToolContext;
  publishedEvents: PublishedEvent[];
} {
  const sessions = new Map<string, SessionState>([[session.metadata.id, session]]);
  const publishedEvents: PublishedEvent[] = [];

  const sessionManager: ISessionManager = {
    get: vi.fn(async (id: string) => sessions.get(id) ?? null),
    getOrCreate: vi.fn(async (id: string) => sessions.get(id)!),
    save: vi.fn(async (state: SessionState) => {
      sessions.set(state.metadata.id, state);
    }),
    delete: vi.fn(),
    list: vi.fn(async () => Array.from(sessions.keys())),
  };
  const worldPackManager: IWorldPackManager = {
    get: vi.fn(async () => null),
    save: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(async () => []),
  };
  const eventBus: IEventBus = {
    publish: vi.fn((channel: string, event: BusEvent) => {
      publishedEvents.push({ channel, event });
    }),
    subscribe: vi.fn(() => () => {}),
    psubscribe: vi.fn(() => () => {}),
  };

  const ctx: ToolContext = {
    sessions: sessionManager,
    worldPacks: worldPackManager,
    getRules: vi.fn(async () => getDefaultRulesContext()),
    eventBus,
  };

  return { ctx, publishedEvents };
}

describe("heal_character", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restores HP capped at max and emits CHARACTER_UPDATED", async () => {
    const session = createMockSession("s1");
    const { ctx, publishedEvents } = createMockContext(session);

    const out = await healCharacterTool.handler(
      { sessionId: "s1", characterId: "hero", amount: 3 },
      ctx
    );

    expect(out.amountHealed).toBe(3);
    expect(out.hp.current).toBe(9);
    const ev = publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED");
    expect(ev?.channel).toBe("session:s1:character");
  });

  it("caps at max HP and reports the actual amount healed", async () => {
    const session = createMockSession("s1");
    session.characters.hero.hp.current = 9; // 1 below max
    const { ctx } = createMockContext(session);

    const out = await healCharacterTool.handler(
      { sessionId: "s1", characterId: "hero", amount: 5 },
      ctx
    );

    expect(out.amountRequested).toBe(5);
    expect(out.amountHealed).toBe(1);
    expect(out.hp.current).toBe(10);
  });

  it("no-op heals at max HP do not emit CHARACTER_UPDATED", async () => {
    const session = createMockSession("s1");
    session.characters.hero.hp.current = session.characters.hero.hp.max;
    const { ctx, publishedEvents } = createMockContext(session);

    await healCharacterTool.handler({ sessionId: "s1", characterId: "hero", amount: 4 }, ctx);

    expect(publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED")).toBeUndefined();
  });
});

describe("damage_character", () => {
  beforeEach(() => vi.clearAllMocks());

  it("subtracts HP, floors at 0, and reports defeat", async () => {
    const session = createMockSession("s1");
    session.characters.hero.hp.current = 2;
    const { ctx, publishedEvents } = createMockContext(session);

    const out = await damageCharacterTool.handler(
      { sessionId: "s1", characterId: "hero", amount: 5 },
      ctx
    );

    expect(out.amount).toBe(2);
    expect(out.hp.current).toBe(0);
    expect(out.defeated).toBe(true);
    const ev = publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED");
    expect(ev?.channel).toBe("session:s1:character");
  });

  it("no-op damage at 0 HP does not emit CHARACTER_UPDATED", async () => {
    const session = createMockSession("s1");
    session.characters.hero.hp.current = 0;
    const { ctx, publishedEvents } = createMockContext(session);

    await damageCharacterTool.handler({ sessionId: "s1", characterId: "hero", amount: 3 }, ctx);

    expect(publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED")).toBeUndefined();
  });
});

describe("apply_condition coercion (schema-level)", () => {
  // Coercion runs at the adapter layer (toAISDKTools / toMCPTools)
  // before the handler sees input, so these tests exercise the
  // schema directly — same way real callers' input passes through.
  // Two footguns guarded: malformed JSON must not bubble up as a
  // SyntaxError, and `stackable: "false"` must not coerce to true.

  it("parses a JSON-string condition", () => {
    const parsed = ApplyConditionInputSchema.parse({
      sessionId: "s1",
      characterId: "hero",
      condition: JSON.stringify({
        id: "wounded",
        name: "Wounded",
        description: "Bleeding",
        duration: "until_rest",
        stackable: false,
      }),
    });

    expect(parsed.condition.name).toBe("Wounded");
    expect(parsed.condition.stackable).toBe(false);
  });

  it("treats stackable: 'false' as false (not truthy)", () => {
    const parsed = ApplyConditionInputSchema.parse({
      sessionId: "s1",
      characterId: "hero",
      condition: {
        id: "wounded",
        name: "Wounded",
        description: "Bleeding",
        duration: "until_rest",
        stackable: "false",
      },
    });

    expect(parsed.condition.stackable).toBe(false);
  });

  it("treats stackable: 'true' as true", () => {
    const parsed = ApplyConditionInputSchema.parse({
      sessionId: "s1",
      characterId: "hero",
      condition: {
        id: "wounded",
        name: "Wounded",
        description: "Bleeding",
        duration: "until_rest",
        stackable: "true",
      },
    });

    expect(parsed.condition.stackable).toBe(true);
  });

  it.each([
    ["1", true],
    ["0", false],
  ] as const)("treats stackable: %j as %s (numeric strings)", (input, expected) => {
    const parsed = ApplyConditionInputSchema.parse({
      sessionId: "s1",
      characterId: "hero",
      condition: {
        id: "wounded",
        name: "Wounded",
        description: "Bleeding",
        duration: "until_rest",
        stackable: input,
      },
    });

    expect(parsed.condition.stackable).toBe(expected);
  });

  it("rejects empty / whitespace-only condition id and name", () => {
    const empty = ApplyConditionInputSchema.safeParse({
      sessionId: "s1",
      characterId: "hero",
      condition: {
        id: "",
        name: "Wounded",
        description: "",
        duration: "until_rest",
      },
    });
    expect(empty.success).toBe(false);

    const whitespace = ApplyConditionInputSchema.safeParse({
      sessionId: "s1",
      characterId: "hero",
      condition: {
        id: "wounded",
        name: "   ",
        description: "",
        duration: "until_rest",
      },
    });
    expect(whitespace.success).toBe(false);
  });

  it("rejects malformed JSON via Zod (not a SyntaxError)", () => {
    const result = ApplyConditionInputSchema.safeParse({
      sessionId: "s1",
      characterId: "hero",
      condition: "{ this is not json",
    });

    expect(result.success).toBe(false);
    // Anything Zod-shaped — not the raw SyntaxError that would
    // escape if JSON.parse weren't wrapped.
    if (!result.success) {
      expect(result.error.name).toBe("ZodError");
    }
  });
});

describe("apply_condition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds the condition and emits CHARACTER_UPDATED", async () => {
    const session = createMockSession("s1");
    const { ctx, publishedEvents } = createMockContext(session);

    await applyConditionTool.handler(
      {
        sessionId: "s1",
        characterId: "hero",
        condition: {
          id: "wounded",
          name: "Wounded",
          description: "Bleeding",
          duration: "until_rest",
          stackable: false,
        },
      },
      ctx
    );

    expect(session.characters.hero.conditions).toHaveLength(1);
    expect(session.characters.hero.conditions[0].name).toBe("Wounded");
    const ev = publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED");
    expect(ev?.channel).toBe("session:s1:character");
  });
});

describe("remove_condition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes by id and emits CHARACTER_UPDATED", async () => {
    const session = createMockSession("s1");
    session.characters.hero.conditions = [
      {
        id: "wounded",
        name: "Wounded",
        description: "",
        duration: "until_rest",
        effects: [],
        stackable: false,
      },
    ];
    const { ctx, publishedEvents } = createMockContext(session);

    const out = await removeConditionTool.handler(
      { sessionId: "s1", characterId: "hero", condition: "wounded" },
      ctx
    );

    expect(out.removed).toBe("Wounded");
    expect(session.characters.hero.conditions).toHaveLength(0);
    expect(publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED")).toBeDefined();
  });

  it("removes by display name (case-insensitive)", async () => {
    const session = createMockSession("s1");
    session.characters.hero.conditions = [
      {
        id: "wounded",
        name: "Wounded",
        description: "",
        duration: "until_rest",
        effects: [],
        stackable: false,
      },
    ];
    const { ctx } = createMockContext(session);

    const out = await removeConditionTool.handler(
      { sessionId: "s1", characterId: "hero", condition: "WOUNDED" },
      ctx
    );

    expect(out.removed).toBe("Wounded");
  });

  it("no-op if condition isn't present (does not emit)", async () => {
    const session = createMockSession("s1");
    const { ctx, publishedEvents } = createMockContext(session);

    const out = await removeConditionTool.handler(
      { sessionId: "s1", characterId: "hero", condition: "wounded" },
      ctx
    );

    expect(out.removed).toBeNull();
    expect(publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED")).toBeUndefined();
  });
});
