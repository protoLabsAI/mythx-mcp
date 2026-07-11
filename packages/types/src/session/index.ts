/**
 * Session state types for persistence
 */

import type {
  Character,
  Enemy,
  NPC,
  GameTime,
  Deadline,
  Player,
  TurnState,
  Item,
} from "../game/index.js";
import type { RNGState, CombatState } from "../game/index.js";
import { createInitialGameTime } from "../game/index.js";

/**
 * Generation manifest step status
 */
export interface ManifestStep {
  /** Step type (seed, archetypes, monsters, etc.) */
  type: string;
  /** Step ID linking to session history (handles duplicate step types) */
  stepId?: string;
  /** Current status */
  status: "in_progress" | "completed" | "failed";
  /** Output file path relative to generation dir */
  file?: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Error message if failed */
  error?: string;
  /** IDs of generated entities */
  generatedIds?: string[];
}

/**
 * Generation manifest - source of truth for generation progress
 * Stored at data/generation/{sessionId}/manifest.json
 */
export interface GenerationManifest {
  /** Session ID */
  sessionId: string;
  /** Original campaign seed prompt */
  campaignSeed: string;
  /** World tier (small/medium/large) */
  tier: "small" | "medium" | "large";
  /** Optional rules configuration */
  rulesConfig?: unknown;
  /** World settings */
  settings?: {
    lethality?: "low" | "medium" | "high" | "brutal";
    magicLevel?: "none" | "rare" | "common" | "high";
    technologyLevel?:
      | "primitive"
      | "medieval"
      | "renaissance"
      | "industrial"
      | "modern"
      | "futuristic";
    supernaturalPresence?: "subtle" | "common" | "pervasive";
  };
  /** Creation timestamp */
  createdAt: string;
  /** Overall status */
  status: "seeding" | "generating" | "expanding" | "assembling" | "complete";
  /** Generation steps */
  steps: ManifestStep[];
}

/**
 * World generation session state (minimal interface)
 * Full implementation in @mythxengine/worlds package
 */
export interface WorldGenerationSession {
  /** World seed (null until seeding complete) */
  worldSeed: unknown | null;

  /** Generated content */
  generatedContent: {
    archetypes: unknown[];
    monsters: unknown[];
    items: unknown[];
    encounters: unknown[];
    locations: unknown[];
    npcs: unknown[];
    conditions: unknown[];
    factions: unknown[];
    narrative: unknown | null;
    situations: unknown[];
    arcs: unknown[];
  };

  /** Expanded content */
  expansions: {
    locations: unknown[];
    archetypes: unknown[];
    npcs: unknown[];
    monsters: unknown[];
  };

  /** World tier (small/medium/large) — determines recommended content counts */
  tier?: "small" | "medium" | "large";

  /** Generation status */
  status: "idle" | "seeding" | "generating" | "expanding" | "assembling" | "complete";

  /** Generation history */
  history: Array<{
    id: string;
    type: string;
    startedAt: string;
    completedAt: string | null;
    status: "pending" | "in_progress" | "completed" | "failed";
    error?: string;
    generatedIds: string[];
  }>;

  /** Assembled world pack ID (if complete) */
  worldPackId: string | null;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  id: string;
  name: string;
  campaignId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session note
 */
export interface SessionNote {
  id: string;
  timestamp: string;
  content: string;
  tags: string[];
}

/**
 * Active situation clock (runtime state)
 */
export interface ActiveClock {
  /** Clock ID (from the situation) */
  clockId: string;
  /** Situation ID this clock belongs to */
  situationId: string;
  /** Clock name */
  name: string;
  /** What the clock counts toward */
  doom: string;
  /**
   * Current stage index (0-based). Internal state only — every tool
   * OUTPUT reports 1-based stage numbers ("stage N of totalStages"),
   * matching get_active_clocks and the CLOCK_TICKED event's `filled`.
   */
  currentStage: number;
  /** When the clock was started */
  startedAt: GameTime;
  /** Is the clock paused? */
  paused: boolean;
  /**
   * Is the clock visible to players? Clocks are GM-state by default
   * (false) — a clock becomes player-visible only when the fiction
   * reveals it (via `reveal_clock` or `tick_clock` with `reveal`).
   */
  playerVisible: boolean;
  /** Total stages in this clock */
  totalStages: number;
  /** Copy of stage definitions for runtime */
  stages: Array<{
    id: string;
    name: string;
    description: string;
    trigger: unknown;
    consequences: unknown;
    reversible: boolean;
  }>;
}

/**
 * A discovered lead (tracking player progress through situations)
 */
export interface DiscoveredLead {
  /** Lead ID */
  leadId: string;
  /** Situation the lead points to */
  targetSituationId: string;
  /** When it was discovered */
  discoveredAt: GameTime;
  /** How it was discovered */
  discoveryMethod: string;
  /** Context about discovery */
  discoveryContext?: string;
  /** The information the lead revealed */
  information: string;
  /** Which PC discovered this lead (for per-player knowledge tracking) */
  discoveredByPlayerId?: string;
  /** PCs who have been told about this lead (starts empty, grows as players share) */
  sharedWithPlayerIds?: string[];
}

/**
 * NPC relationship tracking
 */
export interface NPCRelationship {
  /** NPC ID */
  npcId: string;
  /** NPC name (for convenience) */
  npcName: string;
  /** Overall attitude toward the party */
  attitude: "hostile" | "unfriendly" | "neutral" | "friendly" | "allied";
  /** Per-character attitudes (optional) */
  characterAttitudes?: Record<string, "hostile" | "unfriendly" | "neutral" | "friendly" | "allied">;
  /** Interaction history */
  history: Array<{
    timestamp: GameTime;
    interaction: string;
    impact: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
    /** Which PC caused this interaction (for per-character attitude tracking) */
    actingCharacterId?: string;
  }>;
  /** What the NPC knows about the party */
  knows: string[];
  /** Favors/debts */
  owes: string[];
  /** What the NPC fears from the party */
  fears: string[];
  /** What the NPC wants from the party */
  wants: string[];
}

/**
 * Per-character knowledge entry for multiplayer asymmetric information
 */
export interface CharacterKnowledge {
  knownFacts: Array<{
    id: string;
    topic: string;
    fact: string;
    source: "witnessed" | "told" | "deduced" | "private";
    learnedAt: string;
    confidential: boolean;
  }>;
  visitedLocations: string[];
  npcEncounters: Record<string, { interactions: number; reputation: number }>;
  secrets: Array<{ id: string; content: string; sharedWith: string[] }>;
}

/**
 * AI Director-style narrative pacing state
 */
export interface PacingState {
  currentPhase: "setup" | "rising" | "peak" | "resolution" | "decompression";
  tensionLevel: number; // 0-100
  perPlayerSpotlight: Record<
    string,
    {
      lastSpotlightAt: string;
      totalBeats: number;
    }
  >;
  sceneBeatCount: number;
}

/**
 * Full session state for persistence
 */
export interface SessionState {
  // Metadata
  metadata: SessionMetadata;

  // RNG state for determinism
  rng: RNGState;
  seq: number;

  // Characters
  characters: Record<string, Character>;
  npcs: Record<string, NPC>;
  enemies: Record<string, Enemy>;

  // Combat (if active)
  combat: CombatState | null;

  // Session notes
  notes: SessionNote[];

  // Flags and world state
  flags: string[];
  worldState: Record<string, unknown>;

  // Game time tracking
  gameTime: GameTime;

  // Active deadlines/countdowns
  deadlines: Deadline[];

  // World generation (optional)
  generation?: WorldGenerationSession;

  // Multi-player support (optional, backwards compatible)
  /** Players in the session (human and AI) */
  players?: Record<string, Player>;
  /** Turn coordination state (null if not in turn-based mode) */
  turns?: TurnState | null;
  /** The GM player ID */
  gmPlayerId?: string;

  // Runtime GM support (Phase A additions)
  /** Active situation clocks */
  activeClocks?: ActiveClock[];
  /** Leads discovered by players */
  discoveredLeads?: DiscoveredLead[];
  /** NPC relationship tracking */
  relationships?: Record<string, NPCRelationship>;

  // Play mode
  /** Play mode: "interactive" prompts the player, "auto" plays all characters autonomously */
  playMode?: "interactive" | "auto";

  // World pack & rules (Phase 3: Extensible Rules)
  /** ID of the active world pack (for rules context) */
  worldPackId?: string;

  /**
   * Id of the location the party is currently at. Set by the
   * `set_party_location` tool; surfaced to the UI via GameSnapshot
   * so the persistent scene panel can look up the location's
   * pack-bundled image and description without parsing chat messages.
   *
   * Explicit `string | null` rather than `?: string` so "not yet set"
   * has a single canonical value (null) — an absent key would
   * round-trip as undefined, producing a three-state value that
   * breaks downstream code paths expecting the field to always be
   * present.
   */
  currentLocationId: string | null;

  // Multiplayer asymmetric information (optional, backwards compatible)
  /** Per-character knowledge tracking for multiplayer asymmetric information */
  characterKnowledge?: Record<string, CharacterKnowledge>;

  // Party inventory (shared loot/items)
  /** Shared party inventory for items not assigned to specific characters */
  partyInventory?: {
    items: Item[];
    gold: number;
  };

  /** AI Director-style narrative pacing state */
  pacingState?: PacingState;
}

/**
 * Create a new empty generation session
 */
export function createEmptyGenerationSession(): WorldGenerationSession {
  return {
    worldSeed: null,
    generatedContent: {
      archetypes: [],
      monsters: [],
      items: [],
      encounters: [],
      locations: [],
      npcs: [],
      conditions: [],
      factions: [],
      narrative: null,
      situations: [],
      arcs: [],
    },
    expansions: {
      locations: [],
      archetypes: [],
      npcs: [],
      monsters: [],
    },
    status: "idle",
    history: [],
    worldPackId: null,
  };
}

/**
 * Create a new empty session
 */
export function createEmptySession(id: string, name: string): SessionState {
  const now = new Date().toISOString();
  return {
    metadata: {
      id,
      name,
      createdAt: now,
      updatedAt: now,
    },
    rng: { seed: Date.now(), cursor: 0 },
    seq: 0,
    characters: {},
    npcs: {},
    enemies: {},
    combat: null,
    notes: [],
    flags: [],
    worldState: {},
    gameTime: createInitialGameTime(),
    deadlines: [],
    currentLocationId: null,
  };
}
