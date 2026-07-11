/**
 * Clock player-visibility tests
 *
 * Verifies the GM-state-by-default design for situation clocks:
 *   - start_situation_clock creates clocks hidden (playerVisible: false)
 *     unless the GM explicitly passes playerVisible: true
 *   - reveal_clock flips playerVisible on, persists, and emits
 *     CLOCK_REVEALED (idempotent: no duplicate event when already visible)
 *   - tick_clock does NOT auto-reveal (hidden doom may advance off-screen)
 *     but reveal: true ticks and reveals in one call
 *   - get_active_clocks surfaces playerVisible so the GM can see which
 *     clocks the players cannot
 */

import { describe, it, expect, vi } from "vitest";
import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  SessionState,
  ActiveClock,
} from "@mythxengine/types";
import { getDefaultRulesContext } from "@mythxengine/engine";
import {
  startSituationClockTool,
  tickClockTool,
  TickClockInputSchema,
  revealClockTool,
  getActiveClocksTool,
} from "../clocks/index.js";
import { StartSituationClockInputSchema } from "../clocks/start-situation-clock.js";
import { autoTickClocks } from "../clocks/auto-tick.js";
import { EventTypes } from "../events/channels.js";

function makeClock(overrides: Partial<ActiveClock> = {}): ActiveClock {
  return {
    clockId: "c1",
    situationId: "sit-1",
    name: "The Ritual Nears Completion",
    doom: "The ritual completes",
    currentStage: 0,
    startedAt: { day: 1, hour: 8, minute: 0 },
    paused: false,
    playerVisible: false,
    totalStages: 3,
    stages: [
      {
        id: "st-1",
        name: "Preparations",
        description: "Cultists gather",
        trigger: {},
        consequences: {},
        reversible: true,
      },
      {
        id: "st-2",
        name: "Chanting",
        description: "The chanting begins",
        trigger: {},
        consequences: {},
        reversible: true,
      },
      {
        id: "st-3",
        name: "Completion",
        description: "The ritual completes",
        trigger: {},
        consequences: {},
        reversible: false,
      },
    ],
    ...overrides,
  };
}

function makeSession(id: string, opts: Partial<SessionState> = {}): SessionState {
  return {
    metadata: {
      id,
      name: `Test Session ${id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    rng: { seed: 1, cursor: 0 },
    seq: 0,
    characters: {},
    npcs: {},
    enemies: {},
    combat: null,
    notes: [],
    flags: [],
    worldState: {},
    gameTime: { day: 1, hour: 8, minute: 0 },
    deadlines: [],
    currentLocationId: null,
    ...opts,
  } as SessionState;
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

  return { ctx, sessions, eventBus };
}

/** Session whose generated content carries a situation with a clock. */
function makeSessionWithSituation(id: string): SessionState {
  const clockDef = {
    id: "c1",
    name: "The Ritual Nears Completion",
    doom: "The ritual completes",
    stages: makeClock().stages,
    currentStage: null,
    startedAt: null,
    paused: false,
  };
  return makeSession(id, {
    generation: {
      generatedContent: {
        situations: [{ id: "sit-1", name: "The Ritual", clock: clockDef }],
      },
    },
  } as unknown as Partial<SessionState>);
}

describe("start_situation_clock — playerVisible default", () => {
  it("creates clocks hidden by default", async () => {
    const session = makeSessionWithSituation("s1");
    const { ctx, sessions } = makeCtx(session);

    const result = await startSituationClockTool.handler(
      StartSituationClockInputSchema.parse({ sessionId: "s1", situationId: "sit-1" }),
      ctx
    );

    expect(result.clock.playerVisible).toBe(false);
    expect(sessions.get("s1")?.activeClocks?.[0].playerVisible).toBe(false);
  });

  it("honors explicit playerVisible: true", async () => {
    const session = makeSessionWithSituation("s1");
    const { ctx, sessions } = makeCtx(session);

    const result = await startSituationClockTool.handler(
      StartSituationClockInputSchema.parse({
        sessionId: "s1",
        situationId: "sit-1",
        playerVisible: true,
      }),
      ctx
    );

    expect(result.clock.playerVisible).toBe(true);
    expect(sessions.get("s1")?.activeClocks?.[0].playerVisible).toBe(true);
  });
});

describe("reveal_clock", () => {
  it("flips playerVisible on, persists, and emits CLOCK_REVEALED", async () => {
    const session = makeSession("s1", { activeClocks: [makeClock()] });
    const { ctx, sessions, eventBus } = makeCtx(session);

    const result = await revealClockTool.handler({ sessionId: "s1", clockId: "c1" }, ctx);

    expect(result.clock.playerVisible).toBe(true);
    expect(result.message).toMatch(/now visible to players/);
    expect(sessions.get("s1")?.activeClocks?.[0].playerVisible).toBe(true);

    const publishMock = eventBus.publish as ReturnType<typeof vi.fn>;
    const revealed = publishMock.mock.calls.filter((call) => {
      const payload = call[1] as { type?: string } | undefined;
      return payload?.type === EventTypes.CLOCK_REVEALED;
    });
    expect(revealed).toHaveLength(1);
  });

  it("is idempotent: no duplicate event when the clock is already visible", async () => {
    const session = makeSession("s1", {
      activeClocks: [makeClock({ playerVisible: true })],
    });
    const { ctx, eventBus } = makeCtx(session);

    const result = await revealClockTool.handler({ sessionId: "s1", clockId: "c1" }, ctx);

    expect(result.clock.playerVisible).toBe(true);
    expect(result.message).toMatch(/already visible/);
    const publishMock = eventBus.publish as ReturnType<typeof vi.fn>;
    const revealed = publishMock.mock.calls.filter((call) => {
      const payload = call[1] as { type?: string } | undefined;
      return payload?.type === EventTypes.CLOCK_REVEALED;
    });
    expect(revealed).toHaveLength(0);
  });

  it("throws on unknown clock id, listing available ids", async () => {
    const session = makeSession("s1", { activeClocks: [makeClock()] });
    const { ctx } = makeCtx(session);

    await expect(
      revealClockTool.handler({ sessionId: "s1", clockId: "nope" }, ctx)
    ).rejects.toThrow(/Clock not found: "nope". Available: "c1"/);
  });

  it("throws when the session has no active clocks", async () => {
    const session = makeSession("s1");
    const { ctx } = makeCtx(session);

    await expect(revealClockTool.handler({ sessionId: "s1", clockId: "c1" }, ctx)).rejects.toThrow(
      /No active clocks/
    );
  });
});

describe("tick_clock — reveal interaction", () => {
  it("does NOT auto-reveal a hidden clock (hidden doom ticks off-screen)", async () => {
    const session = makeSession("s1", { activeClocks: [makeClock()] });
    const { ctx, sessions } = makeCtx(session);

    const result = await tickClockTool.handler(
      TickClockInputSchema.parse({ sessionId: "s1", clockId: "c1" }),
      ctx
    );

    expect(result.currentStage?.stage).toBe(2);
    expect(sessions.get("s1")?.activeClocks?.[0].playerVisible).toBe(false);
  });

  it("ticks and reveals in one call with reveal: true", async () => {
    const session = makeSession("s1", { activeClocks: [makeClock()] });
    const { ctx, sessions } = makeCtx(session);

    const result = await tickClockTool.handler(
      TickClockInputSchema.parse({ sessionId: "s1", clockId: "c1", reveal: true }),
      ctx
    );

    expect(result.currentStage?.stage).toBe(2);
    expect(sessions.get("s1")?.activeClocks?.[0].playerVisible).toBe(true);
  });

  it("never un-reveals: ticking a visible clock keeps it visible", async () => {
    const session = makeSession("s1", {
      activeClocks: [makeClock({ playerVisible: true })],
    });
    const { ctx, sessions } = makeCtx(session);

    await tickClockTool.handler(
      TickClockInputSchema.parse({ sessionId: "s1", clockId: "c1" }),
      ctx
    );

    expect(sessions.get("s1")?.activeClocks?.[0].playerVisible).toBe(true);
  });
});

describe("get_active_clocks — visibility surface", () => {
  it("reports playerVisible per clock so the GM can see which are hidden", async () => {
    const session = makeSession("s1", {
      activeClocks: [
        makeClock(),
        makeClock({ clockId: "c2", name: "Visible Clock", playerVisible: true }),
      ],
    });
    const { ctx } = makeCtx(session);

    const result = await getActiveClocksTool.handler({ sessionId: "s1" }, ctx);

    expect(result.clocks).toHaveLength(2);
    expect(result.clocks.find((c) => c.id === "c1")?.playerVisible).toBe(false);
    expect(result.clocks.find((c) => c.id === "c2")?.playerVisible).toBe(true);
  });
});

describe("stage numbering — 1-based across all tool outputs", () => {
  it("start_situation_clock reports stage 1 of N for a fresh clock", async () => {
    const session = makeSessionWithSituation("s1");
    const { ctx } = makeCtx(session);

    const result = await startSituationClockTool.handler(
      StartSituationClockInputSchema.parse({ sessionId: "s1", situationId: "sit-1" }),
      ctx
    );

    expect(result.clock.currentStage).toBe(1);
    expect(result.clock.totalStages).toBe(3);
  });

  it("tick_clock and get_active_clocks agree on the same state", async () => {
    const session = makeSession("s1", { activeClocks: [makeClock()] });
    const { ctx } = makeCtx(session);

    const tick = await tickClockTool.handler(
      TickClockInputSchema.parse({ sessionId: "s1", clockId: "c1" }),
      ctx
    );
    const query = await getActiveClocksTool.handler({ sessionId: "s1" }, ctx);

    expect(tick.previousStage?.stage).toBe(1);
    expect(tick.currentStage?.stage).toBe(2);
    expect(query.clocks[0].currentStage).toBe(2);
    expect(tick.stagesRemaining).toBe(query.clocks[0].stagesRemaining);
  });

  it("autoTickClocks reports 1-based stage numbers in clocks_ticked results", () => {
    const session = makeSession("s1", { activeClocks: [makeClock()] });
    const { ctx } = makeCtx(session);

    const results = autoTickClocks(session, "failure", ["c1"], ctx.eventBus, "s1", "roll_test");

    expect(results).toHaveLength(1);
    expect(results?.[0].previousStage).toBe(1);
    expect(results?.[0].currentStage).toBe(2);
    expect(results?.[0].stagesRemaining).toBe(1);
  });
});
