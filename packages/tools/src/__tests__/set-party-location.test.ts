/**
 * set_party_location tool tests
 *
 * Verifies:
 *   - Persists currentLocationId to session.save when locationId is valid
 *   - Returns the previous id and the resolved name from the world pack
 *   - Throws on unknown sessionId
 *   - Throws on unknown locationId when a world pack is active
 *   - Allows the write through unchecked when no world pack is active
 *     (pre-pack sessions, tutorials, etc.)
 *   - Throws when worldPackId is set but the pack itself is missing
 *     (data-integrity issue, not silent acceptance)
 */

import { describe, it, expect, vi } from "vitest";
import type {
  ToolContext,
  ISessionManager,
  IWorldPackManager,
  IEventBus,
  SessionState,
} from "@mythxengine/types";
import { setPartyLocationTool } from "../location/index.js";
import { getDefaultRulesContext } from "@mythxengine/engine";

function createMockSession(id: string, opts: Partial<SessionState> = {}): SessionState {
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
  };
}

function createMockContext(
  opts: {
    session?: SessionState | null;
    worldPack?: unknown | null;
  } = {}
) {
  const sessions = new Map<string, SessionState>();
  if (opts.session) sessions.set(opts.session.metadata.id, opts.session);

  const sessionManager: ISessionManager = {
    get: vi.fn(async (id: string) => sessions.get(id) ?? null),
    getOrCreate: vi.fn(async (id: string) => {
      if (!sessions.has(id)) sessions.set(id, createMockSession(id));
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
    get: vi.fn(async () => opts.worldPack ?? null),
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

  return { ctx, sessions, sessionManager };
}

describe("setPartyLocationTool", () => {
  it("persists currentLocationId on the session and returns the previous id + name", async () => {
    const session = createMockSession("s1", {
      worldPackId: "world-1",
      currentLocationId: "old-town",
    });
    const { ctx, sessions } = createMockContext({
      session,
      worldPack: {
        locations: {
          "harbor-district": { name: "Harbor District" },
          "old-town": { name: "Old Town" },
        },
      },
    });

    const result = await setPartyLocationTool.handler(
      { sessionId: "s1", locationId: "harbor-district" },
      ctx
    );

    expect(result).toEqual({
      previousLocationId: "old-town",
      currentLocationId: "harbor-district",
      locationName: "Harbor District",
    });
    expect(sessions.get("s1")?.currentLocationId).toBe("harbor-district");
    expect(ctx.sessions.save).toHaveBeenCalledTimes(1);
  });

  it("returns previousLocationId=null when the session had no prior location", async () => {
    const session = createMockSession("s1", { worldPackId: "world-1" });
    const { ctx } = createMockContext({
      session,
      worldPack: { locations: { harbor: { name: "Harbor" } } },
    });

    const result = await setPartyLocationTool.handler(
      { sessionId: "s1", locationId: "harbor" },
      ctx
    );

    expect(result.previousLocationId).toBeNull();
    expect(result.currentLocationId).toBe("harbor");
    expect(result.locationName).toBe("Harbor");
  });

  it("throws when the session does not exist", async () => {
    const { ctx } = createMockContext();
    await expect(
      setPartyLocationTool.handler({ sessionId: "nope", locationId: "anywhere" }, ctx)
    ).rejects.toThrow(/Session not found/);
  });

  it("throws when the locationId is not in the world pack", async () => {
    const session = createMockSession("s1", { worldPackId: "world-1" });
    const { ctx } = createMockContext({
      session,
      worldPack: { locations: { harbor: { name: "Harbor" } } },
    });

    await expect(
      setPartyLocationTool.handler({ sessionId: "s1", locationId: "ghost-town" }, ctx)
    ).rejects.toThrow(/Location 'ghost-town' not found/);
  });

  it("accepts the write when the session has no world pack (pre-pack flows)", async () => {
    const session = createMockSession("s1");
    expect(session.worldPackId).toBeUndefined();
    const { ctx, sessions } = createMockContext({ session });

    const result = await setPartyLocationTool.handler(
      { sessionId: "s1", locationId: "any-id-goes" },
      ctx
    );

    expect(result.currentLocationId).toBe("any-id-goes");
    expect(result.locationName).toBeNull();
    expect(sessions.get("s1")?.currentLocationId).toBe("any-id-goes");
  });

  it("throws when worldPackId is set but the pack itself is missing", async () => {
    const session = createMockSession("s1", { worldPackId: "deleted-pack" });
    const { ctx } = createMockContext({ session, worldPack: null });

    await expect(
      setPartyLocationTool.handler({ sessionId: "s1", locationId: "harbor" }, ctx)
    ).rejects.toThrow(/World pack not found/);
  });
});
