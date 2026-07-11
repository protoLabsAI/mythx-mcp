/**
 * Test fixture factory functions
 */
import type { SessionState } from "@mythxengine/types";
import type { WorldContentPack } from "@mythxengine/worlds";
import type { AppConfig } from "../schemas/config.js";
import type { ChatMessage } from "../schemas/chat.js";
import type { MediaEntry } from "../schemas/media.js";

let counter = 0;
function nextId(prefix = "test"): string {
  return `${prefix}-${++counter}`;
}

/** Reset counter between test files */
export function resetFixtures(): void {
  counter = 0;
}

interface TestSessionOverrides extends Omit<Partial<SessionState>, "metadata"> {
  metadata?: Partial<SessionState["metadata"]>;
}

/**
 * Create a minimal valid SessionState
 */
export function createTestSession(overrides: TestSessionOverrides = {}): SessionState {
  const id = overrides.metadata?.id ?? nextId("session");
  const now = new Date().toISOString();

  return {
    metadata: {
      id,
      name: overrides.metadata?.name ?? `Test Session ${id}`,
      createdAt: overrides.metadata?.createdAt ?? now,
      updatedAt: overrides.metadata?.updatedAt ?? now,
    },
    rng: overrides.rng ?? { seed: 12345, cursor: 0 },
    seq: overrides.seq ?? 0,
    characters: overrides.characters ?? {},
    npcs: overrides.npcs ?? {},
    enemies: overrides.enemies ?? {},
    combat: overrides.combat ?? null,
    notes: overrides.notes ?? [],
    flags: overrides.flags ?? [],
    worldState: overrides.worldState ?? {},
    gameTime: overrides.gameTime ?? {
      day: 1,
      hour: 8,
      minute: 0,
    },
    deadlines: overrides.deadlines ?? [],
    currentLocationId: overrides.currentLocationId ?? null,
    ...(overrides.generation !== undefined && { generation: overrides.generation }),
    ...(overrides.players !== undefined && { players: overrides.players }),
    ...(overrides.turns !== undefined && { turns: overrides.turns }),
    ...(overrides.activeClocks !== undefined && { activeClocks: overrides.activeClocks }),
    ...(overrides.discoveredLeads !== undefined && { discoveredLeads: overrides.discoveredLeads }),
    ...(overrides.relationships !== undefined && { relationships: overrides.relationships }),
    ...(overrides.worldPackId !== undefined && { worldPackId: overrides.worldPackId }),
    ...(overrides.partyInventory !== undefined && { partyInventory: overrides.partyInventory }),
  };
}

/**
 * Create a SessionState with characters and combat for complex round-trip tests
 */
export function createComplexSession(id?: string): SessionState {
  return createTestSession({
    metadata: { id: id ?? nextId("complex") },
    characters: {
      "char-1": {
        id: "char-1",
        name: "Thorn",
        archetypeId: "warrior",
        hp: { current: 25, max: 30 },
        abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 },
        skills: [
          {
            id: "athletics",
            name: "Athletics",
            bonus: 2,
            ability: "STR",
            description: "Physical feats",
          },
        ],
        specialAbilities: [],
        equipment: { weapons: ["Longsword (d8)"], armor: "Chain Mail (+2 defense)", gear: [] },
        conditions: [],
        flags: ["has_sword"],
        personality: ["Brave"],
        background: "A wandering knight",
        psychology: { fears: [], goals: [], ambitions: [], bonds: [], flaws: [] },
        stress: { current: 2, max: 9 },
        trauma: [],
      },
    },
    notes: [
      {
        id: "note-1",
        timestamp: new Date().toISOString(),
        content: "The party entered the dungeon",
        tags: ["exploration"],
      },
    ],
    flags: ["dungeon_entered"],
    worldState: { dungeonLevel: 2 },
    activeClocks: [
      {
        clockId: "clock-1",
        situationId: "sit-1",
        name: "Alarm",
        doom: "Guards arrive",
        currentStage: 1,
        startedAt: { day: 1, hour: 8, minute: 0 },
        paused: false,
        totalStages: 4,
        stages: [
          {
            id: "stage-1",
            name: "Stage 1",
            description: "Tension rises",
            trigger: null,
            consequences: null,
            reversible: true,
          },
        ],
      },
    ],
  });
}

/**
 * Create a minimal valid WorldContentPack
 */
export function createTestWorldPack(id?: string, name?: string): WorldContentPack {
  const packId = id ?? nextId("world");
  return {
    meta: {
      id: packId,
      name: name ?? `Test World ${packId}`,
      tagline: "A test world for unit testing",
      version: "1.0.0",
      aesthetic: {
        visualStyle: "Dark fantasy",
        tone: "Gritty",
        themes: ["survival", "exploration"],
        inspirations: ["Dark Souls"],
      },
      settings: {
        lethality: "medium",
        magicLevel: "common",
        technologyLevel: "medieval",
        supernaturalPresence: "common",
      },
      contentCounts: {
        archetypes: 0,
        items: 0,
        monsters: 0,
        encounters: 0,
        conditions: 0,
        locations: 0,
      },
    },
    archetypes: {},
    items: {},
    monsters: {},
    encounters: {},
    conditions: {},
    locations: {},
    npcs: {},
    narrativeGuidance: {
      openingScenes: ["You awaken in darkness"],
      plotHooks: ["A stranger approaches"],
      commonConflicts: ["Survival vs morality"],
      resolutionPatterns: ["Pyrrhic victory"],
    },
  } as WorldContentPack;
}

/**
 * Create a test AppConfig
 */
export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    apiKeys: { anthropic: "sk-test-key" },
    preferences: { theme: "dark", autoSave: true },
    lastSessionId: "session-1",
    ...overrides,
  };
}

/**
 * Create a test ChatMessage
 */
export function createTestChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: overrides.id ?? nextId("msg"),
    role: overrides.role ?? "user",
    content: overrides.content ?? "Hello, world!",
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test MediaEntry
 */
export function createTestMediaEntry(overrides: Partial<MediaEntry> = {}): MediaEntry {
  return {
    id: overrides.id ?? nextId("media"),
    filename: overrides.filename ?? `${nextId("img")}.png`,
    mimeType: overrides.mimeType ?? "image/png",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}
