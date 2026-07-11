/**
 * resist_consequence mechanical-effect tests (feel-report gap #4)
 *
 * A resist with a structured `damage` input applies the result itself:
 *   - successful resist (outcome "reduced") halves the damage, rounded
 *     down — 1 becomes 0 (negated entirely)
 *   - failed resist (outcome "absorbed") lets it land in full
 *   - `alreadyApplied: true` refunds the negated portion instead of
 *     applying the remainder (the Moment-3 graze case, where the GM
 *     previously had to heal_character by hand)
 * Without `damage`, behavior is unchanged (stress-only).
 *
 * Determinism: the resist roll is d6 + abilityMod vs threshold 5, so
 * CON +10 forces "reduced" and CON -10 forces "absorbed".
 */

import { describe, it, expect, vi } from "vitest";
import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  SessionState,
} from "@mythxengine/types";
import { getDefaultRulesContext } from "@mythxengine/engine";
import {
  resistConsequenceTool,
  ResistConsequenceInputSchema,
} from "../stress/resist-consequence.js";

function makeSession(id: string, conMod: number, hp = 7): SessionState {
  return {
    metadata: {
      id,
      name: `Test Session ${id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    rng: { seed: 1, cursor: 0 },
    seq: 0,
    characters: {
      "char-1": {
        id: "char-1",
        name: "Marlowe",
        hp: { current: hp, max: 7 },
        stress: { current: 0, max: 9 },
        abilities: { STR: 0, AGI: 0, WIT: 0, CON: conMod },
      },
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
  } as unknown as SessionState;
}

function makeCtx(session: SessionState) {
  const sessions = new Map<string, SessionState>([[session.metadata.id, session]]);

  const sessionManager: ISessionManager = {
    get: vi.fn(async (id: string) => sessions.get(id) ?? null),
    getOrCreate: vi.fn(async (id: string) => sessions.get(id)!),
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

  return { ctx, sessions };
}

function resist(over: Record<string, unknown> = {}) {
  return ResistConsequenceInputSchema.parse({
    sessionId: "s1",
    characterId: "char-1",
    severity: "moderate",
    resistAbility: "CON",
    ...over,
  });
}

describe("resist_consequence — mechanical damage application", () => {
  it("a successful resist halves un-applied damage and applies the remainder", async () => {
    const session = makeSession("s1", 10); // d6+10 always ≥ 5 → reduced
    const { ctx, sessions } = makeCtx(session);

    const env = await resistConsequenceTool.handler(
      resist({ damage: { amount: 5, alreadyApplied: false } }),
      ctx
    );

    expect(env.outcome).toBe("reduced");
    expect(env.state_delta.consequence_damage).toEqual({
      original: 5,
      final: 2,
      hp_delta: -2,
    });
    expect(sessions.get("s1")?.characters["char-1"].hp.current).toBe(5);
    expect(env.summary).toContain("5 damage reduced to 2");
  });

  it("a successful resist on already-applied damage refunds the negated portion", async () => {
    // Moment 3: graze applied 3 damage (7→4); resist reduced → final 1,
    // refund 2 → HP back to 6. Previously the GM healed by hand.
    const session = makeSession("s1", 10, 4);
    const { ctx, sessions } = makeCtx(session);

    const env = await resistConsequenceTool.handler(
      resist({ damage: { amount: 3, alreadyApplied: true } }),
      ctx
    );

    expect(env.outcome).toBe("reduced");
    expect(env.state_delta.consequence_damage).toEqual({
      original: 3,
      final: 1,
      hp_delta: 2,
    });
    expect(sessions.get("s1")?.characters["char-1"].hp.current).toBe(6);
  });

  it("a failed resist lets already-applied damage stand (no refund) and is honest about it", async () => {
    const session = makeSession("s1", -10, 3); // d6-10 always < 5 → absorbed
    const { ctx, sessions } = makeCtx(session);

    const env = await resistConsequenceTool.handler(
      resist({ severity: "severe", damage: { amount: 4, alreadyApplied: true } }),
      ctx
    );

    expect(env.outcome).toBe("absorbed");
    expect(env.state_delta.consequence_damage).toEqual({
      original: 4,
      final: 4,
      hp_delta: 0,
    });
    expect(sessions.get("s1")?.characters["char-1"].hp.current).toBe(3);
    expect(env.summary).toContain("4 damage lands in full");
    // Stress was still paid — the cruelest beat in the game.
    expect(env.state_delta.stress.cost).toBeGreaterThan(0);
  });

  it("a failed resist applies un-applied damage in full, flooring at 0", async () => {
    const session = makeSession("s1", -10, 3);
    const { ctx, sessions } = makeCtx(session);

    const env = await resistConsequenceTool.handler(
      resist({ damage: { amount: 5, alreadyApplied: false } }),
      ctx
    );

    expect(env.outcome).toBe("absorbed");
    expect(env.state_delta.consequence_damage?.final).toBe(5);
    expect(sessions.get("s1")?.characters["char-1"].hp.current).toBe(0);
  });

  it("a successful resist negates 1 damage entirely", async () => {
    const session = makeSession("s1", 10);
    const { ctx } = makeCtx(session);

    const env = await resistConsequenceTool.handler(
      resist({ severity: "minor", damage: { amount: 1, alreadyApplied: false } }),
      ctx
    );

    expect(env.state_delta.consequence_damage).toEqual({
      original: 1,
      final: 0,
      hp_delta: 0,
    });
    expect(env.summary).toContain("1 damage negated entirely");
  });

  it("without a damage input the resist stays stress-only (unchanged behavior)", async () => {
    const session = makeSession("s1", 10);
    const { ctx, sessions } = makeCtx(session);

    const env = await resistConsequenceTool.handler(resist(), ctx);

    expect(env.state_delta.consequence_damage).toBeUndefined();
    expect(env.state_delta.hp).toBeUndefined();
    expect(sessions.get("s1")?.characters["char-1"].hp.current).toBe(7);
  });
});
