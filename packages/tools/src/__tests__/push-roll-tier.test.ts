/**
 * push_roll outcome-tier re-derivation tests
 *
 * A push reports the new margin AND the outcome tier it lands in —
 * the player gets "failure upgraded to partial", not a bare margin to
 * map against the thresholds themselves (frame-feel-report gap #3).
 * Tier derivation is margin-only: criticals were decided on the
 * original natural die, so a push can never create or undo one.
 */

import { describe, it, expect, vi } from "vitest";
import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  SessionState,
  OutcomeType,
} from "@mythxengine/types";
import { DEFAULT_OUTCOME_THRESHOLDS } from "@mythxengine/types";
import { getDefaultRulesContext, determineOutcome } from "@mythxengine/engine";
import { pushRollTool, PushRollInputSchema } from "../stress/push-roll.js";

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
    characters: {
      "char-1": {
        id: "char-1",
        name: "Marlowe",
        hp: { current: 7, max: 7 },
        stress: { current: 0, max: 9 },
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
    ...opts,
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

/** The tier a margin lands in under default thresholds, sans criticals. */
function tierFor(margin: number): OutcomeType {
  return determineOutcome(margin, 0, DEFAULT_OUTCOME_THRESHOLDS, { success: [], failure: [] });
}

describe("push_roll — outcome tier re-derivation", () => {
  it("reports previousOutcome and a newOutcome consistent with the pushed margin", async () => {
    const session = makeSession("s1");
    const { ctx } = makeCtx(session);

    const envelope = await pushRollTool.handler(
      PushRollInputSchema.parse({
        sessionId: "s1",
        characterId: "char-1",
        originalRoll: 8,
        originalMargin: -6,
      }),
      ctx
    );

    expect(envelope.result.previousOutcome).toBe("failure");
    expect(envelope.result.newMargin).toBe(-6 + envelope.result.bonus);
    expect(envelope.result.newOutcome).toBe(tierFor(envelope.result.newMargin));
    expect(envelope.result.outcomeImproved).toBe(
      envelope.result.newOutcome !== envelope.result.previousOutcome
    );
  });

  it("names the tier shift in the summary", async () => {
    const session = makeSession("s1");
    const { ctx } = makeCtx(session);

    const envelope = await pushRollTool.handler(
      PushRollInputSchema.parse({
        sessionId: "s1",
        characterId: "char-1",
        originalRoll: 8,
        originalMargin: -6,
      }),
      ctx
    );

    if (envelope.result.outcomeImproved) {
      expect(envelope.summary).toContain(
        `${envelope.result.previousOutcome} upgraded to ${envelope.result.newOutcome}`
      );
    } else {
      expect(envelope.summary).toContain(`still ${envelope.result.newOutcome}`);
    }
  });

  it("a partial pushed past the success threshold reports success", async () => {
    // Margin -1 (partial): any bonus 1–6 lands at >= 0 → success.
    const session = makeSession("s1");
    const { ctx } = makeCtx(session);

    const envelope = await pushRollTool.handler(
      PushRollInputSchema.parse({
        sessionId: "s1",
        characterId: "char-1",
        originalRoll: 11,
        originalMargin: -1,
      }),
      ctx
    );

    expect(envelope.result.previousOutcome).toBe("partial");
    expect(envelope.result.newOutcome).toBe("success");
    expect(envelope.result.outcomeImproved).toBe(true);
  });

  it("a deep failure that stays below partial reports 'still failure'", async () => {
    // Margin -11: even a 6 only reaches -5, still failure.
    const session = makeSession("s1");
    const { ctx } = makeCtx(session);

    const envelope = await pushRollTool.handler(
      PushRollInputSchema.parse({
        sessionId: "s1",
        characterId: "char-1",
        originalRoll: 3,
        originalMargin: -11,
      }),
      ctx
    );

    expect(envelope.result.previousOutcome).toBe("failure");
    expect(envelope.result.newOutcome).toBe("failure");
    expect(envelope.result.outcomeImproved).toBe(false);
    expect(envelope.summary).toContain("still failure");
  });

  it("keeps the tier shift in the summary when the push triggers trauma", async () => {
    const session = makeSession("s1");
    (
      session.characters["char-1"] as unknown as { stress: { current: number; max: number } }
    ).stress = { current: 8, max: 9 };
    const { ctx } = makeCtx(session);

    const envelope = await pushRollTool.handler(
      PushRollInputSchema.parse({
        sessionId: "s1",
        characterId: "char-1",
        originalRoll: 11,
        originalMargin: -1,
      }),
      ctx
    );

    expect(envelope.outcome).toBe("trauma_gained");
    expect(envelope.summary).toContain("trauma");
    expect(envelope.summary).toContain("partial upgraded to success");
    expect(envelope.result.newOutcome).toBe("success");
  });
});
