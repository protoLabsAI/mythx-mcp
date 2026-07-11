/**
 * Situations world-pack fallback tests
 *
 * Sessions created on a compiled/bundled world pack never populate
 * `session.generation.generatedContent.situations` — the pack is the
 * source of truth (situations stored as a Record keyed by id). Every
 * runtime tool that reads situations must resolve through
 * resolveRawSituations so bundled packs are playable:
 *   - generated content wins when present (world-gen sessions)
 *   - otherwise the session's world pack is read
 *   - no pack and no generated content → empty, tools degrade gracefully
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
import { resolveRawSituations } from "../situations/index.js";
import { getAvailableLeadsTool } from "../leads/get-available-leads.js";
import { GetAvailableLeadsInputSchema } from "../leads/get-available-leads.js";
import { revealLeadTool, RevealLeadInputSchema } from "../leads/reveal-lead.js";
import {
  startSituationClockTool,
  StartSituationClockInputSchema,
} from "../clocks/start-situation-clock.js";
import {
  importLeadsAsCluesTool,
  ImportLeadsAsCluesInputSchema,
} from "../portable-clues/import-leads-as-clues.js";

const PACK_ID = "world:test-pack";

/** A pack-shaped situation: leads + clock inline, keyed by id in the pack. */
function makePackSituation(id: string, name: string) {
  return {
    id,
    name,
    outgoingLeads: [
      {
        id: `${id}-lead-1`,
        information: `Something about ${name}`,
        targetSituationId: id,
        discovery: {
          method: "location",
          sourceId: "loc-docks",
          description: "Found at the docks",
        },
        prominence: "obvious",
      },
      {
        id: `${id}-lead-2`,
        information: `A rumor about ${name}`,
        targetSituationId: id,
        discovery: {
          method: "npc",
          sourceId: "npc-informant",
          description: "The informant talks",
        },
        prominence: "available",
      },
    ],
    clock: {
      id: `${id}-clock`,
      name: `${name} Clock`,
      doom: "It all goes wrong",
      stages: [
        {
          id: "st-1",
          name: "Stirring",
          description: "Trouble stirs",
          trigger: {},
          consequences: {},
          reversible: true,
        },
        {
          id: "st-2",
          name: "Breaking",
          description: "Trouble breaks",
          trigger: {},
          consequences: {},
          reversible: false,
        },
      ],
      currentStage: null,
      startedAt: null,
      paused: false,
    },
  };
}

function makePack() {
  return {
    id: PACK_ID,
    situations: {
      "sit-ledger": makePackSituation("sit-ledger", "The Missing Ledger"),
      "sit-strike": makePackSituation("sit-strike", "The Dock Strike"),
    },
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

function makeCtx(session: SessionState, pack: unknown = makePack()) {
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
    get: vi.fn(async (packId: string) => (packId === PACK_ID ? pack : null)),
    save: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(async () => [PACK_ID]),
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

  return { ctx, sessions, worldPackManager };
}

describe("resolveRawSituations", () => {
  it("falls back to the world pack when generated content is empty", async () => {
    const session = makeSession("s1", { worldPackId: PACK_ID } as Partial<SessionState>);
    const { ctx } = makeCtx(session);

    const situations = await resolveRawSituations(ctx, session);

    expect(situations).toHaveLength(2);
    expect((situations as Array<{ id: string }>).map((s) => s.id).sort()).toEqual([
      "sit-ledger",
      "sit-strike",
    ]);
  });

  it("prefers generated content when present", async () => {
    const session = makeSession("s1", {
      worldPackId: PACK_ID,
      generation: {
        generatedContent: {
          situations: [{ id: "sit-generated", name: "Generated", outgoingLeads: [] }],
        },
      },
    } as unknown as Partial<SessionState>);
    const { ctx, worldPackManager } = makeCtx(session);

    const situations = await resolveRawSituations(ctx, session);

    expect(situations).toHaveLength(1);
    expect((situations[0] as { id: string }).id).toBe("sit-generated");
    expect(worldPackManager.get).not.toHaveBeenCalled();
  });

  it("returns empty when the session has no pack and no generated content", async () => {
    const session = makeSession("s1");
    const { ctx } = makeCtx(session);

    expect(await resolveRawSituations(ctx, session)).toEqual([]);
  });

  it("returns empty when the pack does not exist", async () => {
    const session = makeSession("s1", {
      worldPackId: "world:missing",
    } as Partial<SessionState>);
    const { ctx } = makeCtx(session);

    expect(await resolveRawSituations(ctx, session)).toEqual([]);
  });
});

describe("bundled-pack session — lead tools", () => {
  it("get_available_leads surfaces pack leads", async () => {
    const session = makeSession("s1", { worldPackId: PACK_ID } as Partial<SessionState>);
    const { ctx } = makeCtx(session);

    const result = await getAvailableLeadsTool.handler(
      GetAvailableLeadsInputSchema.parse({ sessionId: "s1" }),
      ctx
    );

    expect(result.totalCount).toBe(4);
    expect(result.leads).toHaveLength(4);
    expect(result.leads.map((l) => l.targetSituation.name)).toContain("The Missing Ledger");
  });

  it("reveal_lead discovers a pack lead and persists it", async () => {
    const session = makeSession("s1", { worldPackId: PACK_ID } as Partial<SessionState>);
    const { ctx, sessions } = makeCtx(session);

    const result = await revealLeadTool.handler(
      RevealLeadInputSchema.parse({
        sessionId: "s1",
        leadId: "sit-ledger-lead-1",
        discoveryMethod: "location",
      }),
      ctx
    );

    expect(result.message).toBe("Lead discovered!");
    expect(result.lead.targetSituation?.name).toBe("The Missing Ledger");
    expect(sessions.get("s1")?.discoveredLeads).toHaveLength(1);
  });
});

describe("bundled-pack session — clock + clue tools", () => {
  it("start_situation_clock starts a clock from a pack situation", async () => {
    const session = makeSession("s1", { worldPackId: PACK_ID } as Partial<SessionState>);
    const { ctx, sessions } = makeCtx(session);

    const result = await startSituationClockTool.handler(
      StartSituationClockInputSchema.parse({ sessionId: "s1", situationId: "sit-strike" }),
      ctx
    );

    expect(result.clock.id).toBe("sit-strike-clock");
    expect(result.clock.totalStages).toBe(2);
    expect(sessions.get("s1")?.activeClocks?.[0].situationId).toBe("sit-strike");
  });

  it("import_leads_as_clues imports pack leads", async () => {
    const session = makeSession("s1", { worldPackId: PACK_ID } as Partial<SessionState>);
    const { ctx } = makeCtx(session);

    const result = await importLeadsAsCluesTool.handler(
      ImportLeadsAsCluesInputSchema.parse({ sessionId: "s1", situationId: "sit-ledger" }),
      ctx
    );

    expect(result.imported).toBe(2);
    expect(result.situation?.name).toBe("The Missing Ledger");
  });
});
