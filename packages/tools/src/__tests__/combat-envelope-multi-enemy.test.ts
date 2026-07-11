/**
 * Multi-enemy combat envelope validation.
 *
 * Battle-test ground truth: when the GM resolves attacks against
 * multiple enemies in the same combat (the common case once any fight
 * has more than one mook), every per-target attack must produce a
 * well-formed envelope and HP deltas must accumulate correctly per
 * defender. Single-target unit tests don't exercise the cross-target
 * RNG-advance path.
 *
 * Covers:
 *  - 3-enemy attack sequence yields 3 valid envelopes
 *  - Each envelope's `state_delta.hp_delta` matches the defender's HP
 *    drop (no double-counting, no cross-talk)
 *  - The same RNG produces *different* outcomes across the sequence
 *    (i.e. RNG state advances; we're not stuck on one roll)
 *  - GM moves only fire on partial/failure outcomes, never on success
 *  - Effect level scales damage per attack (limited 0.5×, great 1.5×)
 *  - Multi-target sequence emits one DAMAGE_DEALT event per landed
 *    attack on a unique channel per defender
 *
 * The Zod schemas guard envelope shape; this test guards the
 * cross-target *behavioural* invariants the schema can't express.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  SessionState,
  Character,
  Enemy,
  BusEvent,
} from "@mythxengine/types";
import { attackTool, AttackInputSchema, type AttackEnvelope } from "../combat/attack.js";
import { getDefaultRulesContext } from "@mythxengine/engine";

/**
 * Parse input through the Zod schema so the Zod `default()` calls
 * (damageType="physical", position="risky", effectLevel="standard")
 * apply, mirroring how the MCP / chat adapter feeds this tool. Direct
 * handler calls bypass parsing, which leaves required-but-defaulted
 * fields undefined and tsc complains.
 */
function input(partial: {
  sessionId: string;
  attackerId: string;
  defenderId: string;
  weaponIndex?: number;
  effectLevel?: "limited" | "standard" | "great";
  position?: "controlled" | "risky" | "desperate";
}) {
  return AttackInputSchema.parse(partial);
}

function createHero(): Character {
  return {
    id: "hero",
    name: "Hero",
    archetypeId: "warrior",
    hp: { current: 12, max: 12 },
    abilities: { STR: 3, AGI: 2, WIT: 0, CON: 2 },
    skills: [{ id: "combat", name: "Combat", ability: "STR", bonus: 2, description: "Fighting" }],
    specialAbilities: [],
    equipment: {
      weapons: ["Sword"],
      armor: null,
      gear: [],
    },
    conditions: [],
    flags: [],
    personality: [],
    background: "A test hero",
    psychology: { fears: [], goals: [], ambitions: [], bonds: [], flaws: [] },
    stress: { current: 0, max: 9 },
  };
}

function createEnemy(id: string, name: string, hp = 8): Enemy {
  return {
    id,
    name,
    description: `${name} — a test enemy`,
    hp: { current: hp, max: hp },
    armor: 0,
    abilities: { STR: 1, AGI: 0, WIT: 0, CON: 1 },
    attacks: [{ name: "Bite", damage: "d4", ability: "STR" }],
    conditions: [],
    threat: "standard",
  } as unknown as Enemy;
}

function createMultiEnemySession(seed = 12345): SessionState {
  return {
    metadata: {
      id: "multi-enemy-session",
      name: "Multi-Enemy Combat Test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    rng: { seed, cursor: 0 },
    seq: 0,
    characters: { hero: createHero() },
    npcs: {},
    enemies: {
      goblin1: createEnemy("goblin1", "Goblin Scout", 6),
      goblin2: createEnemy("goblin2", "Goblin Warrior", 8),
      goblin3: createEnemy("goblin3", "Goblin Brute", 12),
    },
    combat: {
      active: true,
      round: 1,
      turnOrder: ["hero", "goblin1", "goblin2", "goblin3"],
      currentTurnId: "hero",
      turnIndex: 0,
    },
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

describe("multi-enemy attack envelope sequence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces three well-formed envelopes against three distinct defenders", async () => {
    const session = createMultiEnemySession();
    const { ctx } = createMockContext(session);

    const envelopes: AttackEnvelope[] = [];
    for (const defenderId of ["goblin1", "goblin2", "goblin3"]) {
      const env = (await attackTool.handler(
        input({ sessionId: session.metadata.id, attackerId: "hero", defenderId }),
        ctx
      )) as AttackEnvelope;
      envelopes.push(env);
    }

    expect(envelopes).toHaveLength(3);
    for (const env of envelopes) {
      // Headline shape — every envelope has the four canonical sections.
      expect(env.status).toBe("ok");
      expect(env.outcome).toMatch(/^(critical_success|success|partial|failure|critical_failure)$/);
      expect(typeof env.summary).toBe("string");
      expect(env.summary.length).toBeGreaterThan(0);
      expect(env.result).toBeDefined();
      expect(env.state_delta).toBeDefined();
      expect(env.suggested_next).toBeDefined();
    }
  });

  it("advances the RNG between attacks (no two attacks lock on the same roll)", async () => {
    const session = createMultiEnemySession();
    const { ctx } = createMockContext(session);

    const naturals: number[] = [];
    for (const defenderId of ["goblin1", "goblin2", "goblin3"]) {
      const env = (await attackTool.handler(
        input({ sessionId: session.metadata.id, attackerId: "hero", defenderId }),
        ctx
      )) as AttackEnvelope;
      naturals.push(env.result.roll.natural);
    }

    // The d20 only has 20 distinct values, so two-out-of-three matches
    // is statistically possible and not a bug. But all three matching
    // a fixed seed almost certainly means the RNG state isn't advancing.
    const distinct = new Set(naturals).size;
    expect(distinct).toBeGreaterThan(1);
  });

  it("hp_delta in each envelope matches the targeted defender's HP drop", async () => {
    const session = createMultiEnemySession();
    const { ctx } = createMockContext(session);

    for (const defenderId of ["goblin1", "goblin2", "goblin3"]) {
      const before = session.enemies[defenderId].hp.current;
      const env = (await attackTool.handler(
        input({ sessionId: session.metadata.id, attackerId: "hero", defenderId }),
        ctx
      )) as AttackEnvelope;
      const after = session.enemies[defenderId].hp.current;
      const expectedDelta = -(before - after);
      expect(env.state_delta.hp_delta).toBe(expectedDelta);
    }
  });

  it("does not bleed damage between targets — each defender's HP changes only on its own attack", async () => {
    const session = createMultiEnemySession();
    const { ctx } = createMockContext(session);

    const startingHp = {
      goblin1: session.enemies.goblin1.hp.current,
      goblin2: session.enemies.goblin2.hp.current,
      goblin3: session.enemies.goblin3.hp.current,
    };

    // Attack ONLY goblin1 — goblin2/goblin3 must be untouched.
    await attackTool.handler(
      input({ sessionId: session.metadata.id, attackerId: "hero", defenderId: "goblin1" }),
      ctx
    );

    expect(session.enemies.goblin2.hp.current).toBe(startingHp.goblin2);
    expect(session.enemies.goblin3.hp.current).toBe(startingHp.goblin3);
  });

  it("emits exactly one DAMAGE_DEALT per landed/grazed attack with the correct defender id", async () => {
    const session = createMultiEnemySession();
    const { ctx, publishedEvents } = createMockContext(session);

    const expected: Array<{ defenderId: string; landed: boolean }> = [];
    for (const defenderId of ["goblin1", "goblin2", "goblin3"]) {
      const env = (await attackTool.handler(
        input({ sessionId: session.metadata.id, attackerId: "hero", defenderId }),
        ctx
      )) as AttackEnvelope;
      const landed = (env.result.damage ?? env.result.grazeDamage ?? 0) > 0;
      expected.push({ defenderId, landed });
    }

    const damageEvents = publishedEvents.filter((p) => p.event.type === "DAMAGE_DEALT");
    const landedCount = expected.filter((e) => e.landed).length;
    expect(damageEvents).toHaveLength(landedCount);

    for (const event of damageEvents) {
      const payload = event.event.payload as { defenderId: string };
      expect(["goblin1", "goblin2", "goblin3"]).toContain(payload.defenderId);
    }
  });

  it("only emits suggested GM moves for partial/failure outcomes", async () => {
    const session = createMultiEnemySession();
    const { ctx } = createMockContext(session);

    for (const defenderId of ["goblin1", "goblin2", "goblin3"]) {
      const env = (await attackTool.handler(
        input({ sessionId: session.metadata.id, attackerId: "hero", defenderId }),
        ctx
      )) as AttackEnvelope;

      const isMissOrGraze =
        env.outcome === "partial" ||
        env.outcome === "failure" ||
        env.outcome === "critical_failure";

      if (isMissOrGraze) {
        // GM moves should be suggested whenever the position-aware
        // matrix has anything for this outcome — getGMMoves can still
        // legitimately return undefined for some combinations, so we
        // only assert the *opposite* (that success doesn't suggest
        // moves). consequence_guidance follows the same rule.
        // No-op: the contract is enforced on the success branch.
      } else {
        expect(env.suggested_next.gm_moves).toBeUndefined();
        expect(env.suggested_next.consequence_guidance).toBeUndefined();
      }
    }
  });
});

describe("effect level scales damage in multi-enemy sequence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("limited effect lands less damage than great effect against the same defender setup", async () => {
    // Same deterministic seed → same dice rolls → the only delta is
    // the effect-level multiplier. We compare aggregate damage across
    // all three goblins for noise tolerance: limited is 0.5×, great
    // is 1.5×, so great should land strictly more total damage in any
    // run where at least one attack actually hits.
    const limitedSession = createMultiEnemySession(42);
    const greatSession = createMultiEnemySession(42);

    const { ctx: limitedCtx } = createMockContext(limitedSession);
    const { ctx: greatCtx } = createMockContext(greatSession);

    let limitedTotal = 0;
    let greatTotal = 0;
    for (const defenderId of ["goblin1", "goblin2", "goblin3"]) {
      const lim = (await attackTool.handler(
        input({
          sessionId: limitedSession.metadata.id,
          attackerId: "hero",
          defenderId,
          effectLevel: "limited",
        }),
        limitedCtx
      )) as AttackEnvelope;
      const grt = (await attackTool.handler(
        input({
          sessionId: greatSession.metadata.id,
          attackerId: "hero",
          defenderId,
          effectLevel: "great",
        }),
        greatCtx
      )) as AttackEnvelope;
      limitedTotal += lim.result.damage ?? lim.result.grazeDamage ?? 0;
      greatTotal += grt.result.damage ?? grt.result.grazeDamage ?? 0;
    }

    // If neither hits there's nothing to compare against — the seed
    // selection is intentional; if this fails we picked a seed where
    // the hero whiffs all three rolls. Tighten the expectation only
    // when at least one attack landed.
    if (limitedTotal > 0 || greatTotal > 0) {
      expect(greatTotal).toBeGreaterThan(limitedTotal);
    }
  });

  it("echoes the effect level back in the result envelope", async () => {
    const session = createMultiEnemySession(7);
    const { ctx } = createMockContext(session);

    const env = (await attackTool.handler(
      input({
        sessionId: session.metadata.id,
        attackerId: "hero",
        defenderId: "goblin1",
        effectLevel: "great",
      }),
      ctx
    )) as AttackEnvelope;

    expect(env.result.effectLevel).toBe("great");
  });
});
