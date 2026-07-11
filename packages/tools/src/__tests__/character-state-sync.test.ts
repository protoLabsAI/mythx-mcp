/**
 * Tests for the CHARACTER_UPDATED emission added to state-mutating
 * tools so the web client's party sidebar stays in sync.
 *
 * Each test asserts that the relevant tool emits a `CHARACTER_UPDATED`
 * event on `session:{id}:character` with a full character snapshot —
 * the missing piece behind MYTHX-14 (heal-in-chat-not-in-sidebar).
 *
 * See docs/audits/chat-flow-audit.md §2.1.
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
import { applyDamageTool } from "../combat/apply-damage.js";
import { addCombatConditionTool } from "../combat/add-combat-condition.js";
import { takeRestTool } from "../rest/take-rest.js";
import { useItemTool } from "../inventory/use-item.js";
import { getDefaultRulesContext } from "@mythxengine/engine";

function createMockCharacter(id: string, name: string, isPlayerCharacter = true): Character {
  return {
    id,
    name,
    archetypeId: "test-archetype",
    hp: { current: 10, max: 10 },
    abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 },
    skills: [],
    specialAbilities: [],
    equipment: { weapons: [], armor: null, gear: [] },
    conditions: [],
    flags: [],
    personality: [],
    background: isPlayerCharacter ? "A test hero" : "An NPC",
    psychology: { fears: [], goals: [], ambitions: [], bonds: [], flaws: [] },
    stress: { current: 0, max: 9 },
  };
}

function createMockEnemy(id: string, name: string): Enemy {
  return {
    id,
    name,
    hp: { current: 8, max: 8 },
    armor: 0,
    morale: { current: 5, max: 5 },
    abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 },
    attacks: [{ name: "Bite", damage: "d6" }],
    conditions: [],
    flags: [],
    behavior: "aggressive",
  } as unknown as Enemy;
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
    enemies: { goblin: createMockEnemy("goblin", "Goblin") },
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

interface CharacterUpdatedPayload {
  characterId: string;
  characterName: string;
  changes: Record<string, unknown>;
  character?: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    conditions: string[];
    isPlayer: boolean;
  };
}

describe("apply_damage CHARACTER_UPDATED emission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits CHARACTER_UPDATED for a player-character target", async () => {
    const session = createMockSession("s1");
    const { ctx, publishedEvents } = createMockContext(session);

    await applyDamageTool.handler({ sessionId: "s1", targetId: "hero", amount: 3 }, ctx);

    const characterUpdated = publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED");
    expect(characterUpdated).toBeDefined();
    expect(characterUpdated?.channel).toBe("session:s1:character");
    const payload = characterUpdated!.event.payload as CharacterUpdatedPayload;
    expect(payload.character?.id).toBe("hero");
    expect(payload.character?.hp).toBe(7);
    expect(payload.character?.maxHp).toBe(10);
    expect(payload.character?.isPlayer).toBe(true);
    expect(payload.changes).toMatchObject({ hpDelta: -3 });
  });

  it("does NOT emit CHARACTER_UPDATED for an enemy target", async () => {
    const session = createMockSession("s1");
    const { ctx, publishedEvents } = createMockContext(session);

    await applyDamageTool.handler({ sessionId: "s1", targetId: "goblin", amount: 3 }, ctx);

    const characterUpdated = publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED");
    expect(characterUpdated).toBeUndefined();
    // The DAMAGE_TAKEN event still fires though.
    expect(publishedEvents.find((p) => p.event.type === "DAMAGE_TAKEN")).toBeDefined();
  });
});

describe("add_combat_condition CHARACTER_UPDATED emission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits CHARACTER_UPDATED with the new condition for a player target", async () => {
    const session = createMockSession("s1");
    const { ctx, publishedEvents } = createMockContext(session);

    await addCombatConditionTool.handler(
      {
        sessionId: "s1",
        targetId: "hero",
        condition: {
          id: "wounded",
          name: "Wounded",
          description: "Bleeding badly",
          duration: "until_rest",
        },
      },
      ctx
    );

    const characterUpdated = publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED");
    expect(characterUpdated).toBeDefined();
    expect(characterUpdated?.channel).toBe("session:s1:character");
    const payload = characterUpdated!.event.payload as CharacterUpdatedPayload;
    expect(payload.character?.conditions).toContain("Wounded");
    expect(payload.changes).toMatchObject({ addedCondition: "Wounded" });
  });
});

describe("take_rest CHARACTER_UPDATED emission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits CHARACTER_UPDATED for every party character", async () => {
    const session = createMockSession("s1");
    // Add a second party character + pre-damage them so rest has work to do.
    session.characters.hero.hp.current = 4;
    session.characters.companion = createMockCharacter("companion", "Companion");
    session.characters.companion.hp.current = 5;
    const { ctx, publishedEvents } = createMockContext(session);

    await takeRestTool.handler({ sessionId: "s1", restType: "long" }, ctx);

    const updates = publishedEvents.filter((p) => p.event.type === "CHARACTER_UPDATED");
    expect(updates).toHaveLength(2);
    expect(updates.every((p) => p.channel === "session:s1:character")).toBe(true);
    const ids = updates.map((p) => (p.event.payload as CharacterUpdatedPayload).character?.id);
    expect(ids).toContain("hero");
    expect(ids).toContain("companion");
    // Hero was at 4/10; long rest = +50% of max = +5 → 9.
    const hero = updates.find(
      (p) => (p.event.payload as CharacterUpdatedPayload).character?.id === "hero"
    )!;
    expect((hero.event.payload as CharacterUpdatedPayload).character?.hp).toBe(9);
  });
});

describe("use_item CHARACTER_UPDATED emission", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * Build a session with two party characters where the user (hero)
   * carries one healing potion. Itemized inventory mode is required
   * by the use_item tool. Target starts wounded so the heal has work.
   */
  function sessionWithHealingPotion(): SessionState {
    const session = createMockSession("s1");
    session.characters.companion = createMockCharacter("companion", "Companion");
    session.characters.companion.hp.current = 4;
    // Itemized inventory on the source so getInventoryItem works.
    (session.characters.hero as unknown as { inventory: unknown }).inventory = {
      mode: "itemized",
      items: [
        {
          id: "potion-1",
          name: "Healing Potion",
          type: "consumable",
          healAmount: 3,
          uses: 1,
          maxUses: 1,
          stackable: false,
          quantity: 1,
        },
      ],
      equipped: { mainHand: null, offHand: null, armor: null, accessories: [] },
      capacity: 10,
      weight: { current: 0, max: 50 },
    };
    return session;
  }

  it("emits CHARACTER_UPDATED for the target only, not for the source", async () => {
    const session = sessionWithHealingPotion();
    const { ctx, publishedEvents } = createMockContext(session);

    await useItemTool.handler(
      {
        sessionId: "s1",
        characterId: "hero",
        itemId: "potion-1",
        targetCharacterId: "companion",
      },
      ctx
    );

    const updates = publishedEvents.filter((p) => p.event.type === "CHARACTER_UPDATED");
    // Exactly one — the target. The source's inventory mutation rides
    // the inventory channel (ITEM_USED / ITEM_REMOVED), not the
    // character channel; emitting a source CHARACTER_UPDATED would
    // carry a payload that can't actually represent the change.
    expect(updates).toHaveLength(1);
    expect(updates[0].channel).toBe("session:s1:character");
    const payload = updates[0].event.payload as CharacterUpdatedPayload;
    expect(payload.character?.id).toBe("companion");
    expect(payload.character?.hp).toBe(7); // 4 + 3 healing
    expect(payload.changes).toMatchObject({ itemUsed: "Healing Potion", effect: "healing" });
    // Inventory channel still gets its event for the source side.
    expect(publishedEvents.find((p) => p.event.type === "ITEM_USED")).toBeDefined();
  });

  it("emits one CHARACTER_UPDATED when target equals source (self-heal)", async () => {
    const session = sessionWithHealingPotion();
    session.characters.hero.hp.current = 5;
    const { ctx, publishedEvents } = createMockContext(session);

    await useItemTool.handler({ sessionId: "s1", characterId: "hero", itemId: "potion-1" }, ctx);

    const updates = publishedEvents.filter((p) => p.event.type === "CHARACTER_UPDATED");
    expect(updates).toHaveLength(1);
    const payload = updates[0].event.payload as CharacterUpdatedPayload;
    expect(payload.character?.id).toBe("hero");
    expect(payload.character?.hp).toBe(8); // 5 + 3 healing
  });

  it("does NOT emit CHARACTER_UPDATED when target is already at max HP", async () => {
    // Healing potion drunk while at full HP — actualHealing computes
    // to 0, so the snapshot is identical to current client state.
    // Emitting CHARACTER_UPDATED would be a pure no-op event.
    const session = sessionWithHealingPotion();
    session.characters.hero.hp.current = session.characters.hero.hp.max;
    const { ctx, publishedEvents } = createMockContext(session);

    await useItemTool.handler({ sessionId: "s1", characterId: "hero", itemId: "potion-1" }, ctx);

    expect(publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED")).toBeUndefined();
    // Inventory still mutated — uses decremented, item potentially
    // removed — so ITEM_USED still fires.
    expect(publishedEvents.find((p) => p.event.type === "ITEM_USED")).toBeDefined();
  });

  it("does NOT emit CHARACTER_UPDATED for non-healing items (inventory channel only)", async () => {
    const session = createMockSession("s1");
    // Itemized inventory carrying a narrative-effect consumable —
    // no healAmount, just an `effect` string. Triggers the use_item
    // "effect" branch which does NOT mutate hp/conditions/stress.
    (session.characters.hero as unknown as { inventory: unknown }).inventory = {
      mode: "itemized",
      items: [
        {
          id: "smoke-1",
          name: "Smoke Bomb",
          type: "consumable",
          effect: "Creates a cloud of obscuring smoke",
          uses: 1,
          maxUses: 1,
          stackable: false,
          quantity: 1,
        },
      ],
      equipped: { mainHand: null, offHand: null, armor: null, accessories: [] },
      capacity: 10,
      weight: { current: 0, max: 50 },
    };
    const { ctx, publishedEvents } = createMockContext(session);

    await useItemTool.handler({ sessionId: "s1", characterId: "hero", itemId: "smoke-1" }, ctx);

    // Snapshot didn't change — no CHARACTER_UPDATED. Inventory channel
    // still fires so the source-side state path is intact.
    expect(publishedEvents.find((p) => p.event.type === "CHARACTER_UPDATED")).toBeUndefined();
    expect(publishedEvents.find((p) => p.event.type === "ITEM_USED")).toBeDefined();
  });
});
