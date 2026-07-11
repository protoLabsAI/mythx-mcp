/**
 * World Schema
 *
 * Defines the structure for complete world content packs.
 * Adapted from content-creation-system for system-agnostic RPG generation.
 */

import { z } from "zod";
import { WorldRulesConfigSchema, EffectSchema } from "./rules.js";

// ============================================================================
// IMAGE REFERENCES
// ============================================================================

/**
 * Image role types for different entity contexts
 */
export const ImageRoleSchema = z.enum([
  "portrait", // Character/NPC face/bust shot
  "fullBody", // Full character illustration
  "icon", // Small iconic representation (items, etc.)
  "banner", // Wide format for headers/covers
  "scene", // Environmental/location scene
  "token", // Combat/map token
]);

export type ImageRole = z.infer<typeof ImageRoleSchema>;

/**
 * Entity types that can have associated images
 */
export const ImageEntityTypeSchema = z.enum([
  "world",
  "archetype",
  "npc",
  "monster",
  "location",
  "item",
  "encounter",
  "faction",
]);

export type ImageEntityType = z.infer<typeof ImageEntityTypeSchema>;

/**
 * Reference to a generated or uploaded image
 * Can reference PayloadCMS media or external URLs
 */
export const ImageRefSchema = z.object({
  /** PayloadCMS media ID (if uploaded) */
  mediaId: z.string().optional(),
  /** Direct URL (for external or legacy images) */
  url: z.string().optional(),
  /** Alt text for accessibility */
  alt: z.string(),
  /** Image generation prompt used (for regeneration) */
  prompt: z.string().optional(),
  /** Seed used for generation (for reproducibility) */
  seed: z.number().optional(),
});

export type ImageRef = z.infer<typeof ImageRefSchema>;

/**
 * Collection of images for an entity with different roles
 */
export const EntityImagesSchema = z.object({
  /** Primary portrait image */
  portrait: ImageRefSchema.optional(),
  /** Full body illustration */
  fullBody: ImageRefSchema.optional(),
  /** Small icon representation */
  icon: ImageRefSchema.optional(),
  /** Wide banner image */
  banner: ImageRefSchema.optional(),
  /** Scene/environment image */
  scene: ImageRefSchema.optional(),
  /** Combat token image */
  token: ImageRefSchema.optional(),
});

export type EntityImages = z.infer<typeof EntityImagesSchema>;

// ============================================================================
// WORLD METADATA
// ============================================================================

/**
 * World aesthetic configuration (for AI guidance)
 */
export const WorldAestheticSchema = z.object({
  /** Visual style description */
  visualStyle: z.string(),
  /** Emotional tone */
  tone: z.string(),
  /** Core themes */
  themes: z.array(z.string()),
  /** Creative inspirations */
  inspirations: z.array(z.string()),
});

export type WorldAesthetic = z.infer<typeof WorldAestheticSchema>;

/**
 * World gameplay settings
 */
export const WorldSettingsSchema = z.object({
  /** How deadly is combat? */
  lethality: z.enum(["low", "medium", "high", "brutal"]),
  /** How common is magic? */
  magicLevel: z.enum(["none", "rare", "common", "high"]),
  /** Technology era */
  technologyLevel: z.enum([
    "primitive",
    "medieval",
    "renaissance",
    "industrial",
    "modern",
    "futuristic",
  ]),
  /** How present is the supernatural? */
  supernaturalPresence: z.enum(["subtle", "common", "pervasive"]),
});

export type WorldSettings = z.infer<typeof WorldSettingsSchema>;

/**
 * World content counts (for validation)
 */
export const WorldContentCountsSchema = z.object({
  archetypes: z.number(),
  items: z.number(),
  monsters: z.number(),
  encounters: z.number(),
  conditions: z.number(),
  locations: z.number(),
  npcs: z.number().optional(),
  factions: z.number().optional(),
});

export type WorldContentCounts = z.infer<typeof WorldContentCountsSchema>;

/**
 * World metadata
 */
export const WorldMetaSchema = z.object({
  /** Unique identifier */
  id: z.string(),
  /** Display name */
  name: z.string(),
  /** One-line hook */
  tagline: z.string(),
  /** Semantic version */
  version: z.string(),
  /** Aesthetic guidance */
  aesthetic: WorldAestheticSchema,
  /** Gameplay tuning */
  settings: WorldSettingsSchema,
  /** Content counts */
  contentCounts: WorldContentCountsSchema,
  /** World images (cover art, banners, etc.) */
  images: EntityImagesSchema.optional(),
});

export type WorldMeta = z.infer<typeof WorldMetaSchema>;

// ============================================================================
// ABILITIES (re-export for convenience)
// ============================================================================

export const AbilitiesSchema = z.object({
  STR: z.number().int().min(-5).max(5),
  AGI: z.number().int().min(-5).max(5),
  WIT: z.number().int().min(-5).max(5),
  CON: z.number().int().min(-5).max(5),
});

export const AbilityNameSchema = z.enum(["STR", "AGI", "WIT", "CON"]);
export type AbilityName = z.infer<typeof AbilityNameSchema>;

// ============================================================================
// ARCHETYPE
// ============================================================================

/**
 * Starting stats for an archetype
 */
export const ArchetypeStartingStatsSchema = z.object({
  abilities: AbilitiesSchema,
  hp: z.number().min(1),
  maxHp: z.number().min(1),
});

export type ArchetypeStartingStats = z.infer<typeof ArchetypeStartingStatsSchema>;

/**
 * Archetype feature
 */
export const ArchetypeFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

export type ArchetypeFeature = z.infer<typeof ArchetypeFeatureSchema>;

/**
 * A playable archetype in a world
 */
export const WorldArchetypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),

  /** Starting stats */
  starting: ArchetypeStartingStatsSchema,

  /** Starting equipment (item IDs) */
  startingItems: z.array(z.string()),

  /** Class features */
  features: z.array(ArchetypeFeatureSchema),

  /** Playstyle guidance */
  playstyle: z.string(),

  /** Background lore */
  background: z.string(),

  /** Flavor text */
  flavor: z.string(),

  /** Visual description for image generation */
  visualDescription: z.string().optional(),

  /** Archetype images (portrait, full body, token) */
  images: EntityImagesSchema.optional(),
});

export type WorldArchetype = z.infer<typeof WorldArchetypeSchema>;

// ============================================================================
// ITEM
// ============================================================================

/**
 * Item kind
 */
export const ItemKindSchema = z.enum(["weapon", "armor", "consumable", "special", "misc"]);
export type ItemKind = z.infer<typeof ItemKindSchema>;

/**
 * Weapon properties
 */
export const WeaponPropsSchema = z.object({
  damage: z.string(),
  ability: AbilityNameSchema,
  properties: z.array(z.string()).optional(),
});

export type WeaponProps = z.infer<typeof WeaponPropsSchema>;

/**
 * Armor properties
 */
export const ArmorPropsSchema = z.object({
  damageReduction: z.number(),
  properties: z.array(z.string()).optional(),
});

export type ArmorProps = z.infer<typeof ArmorPropsSchema>;

/**
 * Consumable properties
 */
export const ConsumablePropsSchema = z.object({
  uses: z.number(),
  effect: z.string(),
  effectDescription: z.string(),
});

export type ConsumableProps = z.infer<typeof ConsumablePropsSchema>;

/**
 * An item in a world
 */
export const WorldItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: ItemKindSchema,
  description: z.string(),

  /** Thematic flavor text */
  flavor: z.string(),

  /** Tags for filtering */
  tags: z.array(z.string()),

  /** Inventory slots consumed */
  slots: z.number(),

  /** Weapon properties (if weapon) */
  weapon: WeaponPropsSchema.optional(),

  /** Armor properties (if armor) */
  armor: ArmorPropsSchema.optional(),

  /** Consumable properties (if consumable) */
  consumable: ConsumablePropsSchema.optional(),

  /** Visual description for image generation */
  visualDescription: z.string().optional(),

  /** Item images (icon, full illustration) */
  images: EntityImagesSchema.optional(),
});

export type WorldItem = z.infer<typeof WorldItemSchema>;

// ============================================================================
// MONSTER
// ============================================================================

/**
 * Monster morale configuration
 */
export const MonsterMoraleSchema = z.object({
  /** Morale threshold (1-10) */
  threshold: z.number().min(1).max(10),
  /** When to check morale */
  checkWhen: z.enum(["belowHalfHP", "allyDies", "firstHit", "never"]),
  /** Auto-flee HP threshold */
  fleesBelowHP: z.number().optional(),
});

export type MonsterMorale = z.infer<typeof MonsterMoraleSchema>;

/**
 * Monster tactics (AI guidance)
 */
export const MonsterTacticsSchema = z.object({
  preferredRange: z.enum(["melee", "ranged", "any"]),
  targetPriority: z.enum(["weakest", "strongest", "nearest", "random"]),
  specialBehavior: z.string().optional(),
});

export type MonsterTactics = z.infer<typeof MonsterTacticsSchema>;

/**
 * Monster attack
 */
export const MonsterAttackSchema = z.object({
  name: z.string(),
  ability: AbilityNameSchema,
  damage: z.string(),
  properties: z.array(z.string()).optional(),
  flavor: z.string(),
});

export type MonsterAttack = z.infer<typeof MonsterAttackSchema>;

/**
 * Threat tier for monsters
 */
export const ThreatTierSchema = z.enum(["minion", "standard", "elite", "boss"]);
export type ThreatTier = z.infer<typeof ThreatTierSchema>;

/**
 * A monster in a world
 */
export const WorldMonsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  /** Base stats */
  hp: z.number().min(1),
  armor: z.number().min(0),
  /**
   * Ability scores. Optional — minions and simple creatures often don't
   * need stat blocks (they fight on HP/damage alone). When the prompt
   * fills the abilities block, downstream tools use it; when absent,
   * UI and gameplay fall back to "no ability mod" rather than fabricated
   * zeros that read as a populated stat block.
   */
  abilities: AbilitiesSchema.optional(),

  /** Threat tier */
  threat: ThreatTierSchema,

  /** Combat attacks */
  attacks: z.array(MonsterAttackSchema),

  /** Special abilities (condition IDs or descriptions) */
  specialAbilities: z.array(z.string()),

  /** Morale and fleeing */
  morale: MonsterMoraleSchema,

  /** Combat AI guidance */
  tactics: MonsterTacticsSchema,

  /**
   * Behavioral intent on round 1. What the monster does at T=0 if the
   * party does nothing — concrete, observable, in-fiction. Gives the
   * GM something to play instead of having to invent opening behavior
   * mid-encounter, and helps players read the threat before initiative.
   * Optional during the schema migration; required by Tier 3 prompt.
   */
  firstAction: z.string().optional(),

  /** World lore */
  lore: z.string(),

  /** Text when encountered */
  encounterText: z.string(),

  /** Text when defeated */
  deathText: z.string(),

  /** Visual description for image generation */
  visualDescription: z.string().optional(),

  /** Monster images (portrait, token, full illustration) */
  images: EntityImagesSchema.optional(),
});

export type WorldMonster = z.infer<typeof WorldMonsterSchema>;

// ============================================================================
// ENCOUNTER
// ============================================================================

/**
 * Encounter type
 */
export const EncounterTypeSchema = z.enum(["combat", "event", "social"]);
export type EncounterType = z.infer<typeof EncounterTypeSchema>;

/**
 * Combat encounter setup
 */
export const CombatSetupSchema = z.object({
  /** Monster spawns */
  monsters: z.array(
    z.object({
      monsterId: z.string(),
      count: z.union([z.number(), z.string()]), // number or dice expression
    })
  ),
  /** Starting conditions */
  surprise: z.enum(["none", "enemies", "party"]).optional(),
  /** Environment */
  environment: z
    .object({
      lighting: z.enum(["bright", "dim", "dark"]),
      terrain: z.enum(["open", "cramped", "hazardous"]),
      hazards: z.array(z.string()).optional(),
    })
    .optional(),
});

export type CombatSetup = z.infer<typeof CombatSetupSchema>;

/**
 * Event encounter choice
 */
export const EventChoiceSchema = z.object({
  text: z.string(),
  test: z
    .object({
      ability: AbilityNameSchema,
      difficulty: z.number(),
    })
    .optional(),
  successOutcome: z.string(),
  /**
   * What happens on failure. Required (fail-forward). Must advance the
   * fiction — never just block ("you fail", "nothing happens", "you cannot").
   * On a failed test the situation should change, complicate, or escalate.
   */
  failureOutcome: z.string(),
});

export type EventChoice = z.infer<typeof EventChoiceSchema>;

/**
 * Event encounter setup
 */
export const EventSetupSchema = z.object({
  choices: z.array(EventChoiceSchema),
});

export type EventSetup = z.infer<typeof EventSetupSchema>;

/**
 * Social encounter setup
 */
export const SocialSetupSchema = z.object({
  npcIds: z.array(z.string()),
  /** Initial NPC attitude - 5-level scale matching relationship tools */
  initialAttitude: z.enum(["hostile", "unfriendly", "neutral", "friendly", "allied"]),
  negotiable: z.boolean(),
});

export type SocialSetup = z.infer<typeof SocialSetupSchema>;

/**
 * An encounter in a world
 */
export const WorldEncounterSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: EncounterTypeSchema,
  description: z.string(),

  /** Narrative text when encounter begins */
  text: z.string(),

  /** GM guidance */
  gmGuidance: z.string(),

  /** Possible outcomes */
  outcomes: z.array(z.string()),

  /** Combat setup (if combat) */
  combat: CombatSetupSchema.optional(),

  /** Event setup (if event) */
  event: EventSetupSchema.optional(),

  /** Social setup (if social) */
  social: SocialSetupSchema.optional(),
});

export type WorldEncounter = z.infer<typeof WorldEncounterSchema>;

// ============================================================================
// LOCATION
// ============================================================================

/**
 * A location in a world
 */
export const WorldLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  /** Type of location */
  type: z.enum(["settlement", "dungeon", "wilderness", "landmark", "building"]),

  /** Atmospheric details */
  atmosphere: z.string(),

  /** What can be found here */
  features: z.array(z.string()),

  /**
   * Connected locations with traversal narrative. Each connection
   * answers what players actually experience moving between places —
   * the journey, not just the graph edge.
   *
   * Accepts either structured `{ to, travel, observation?, risk? }`
   * objects (preferred) OR flat ID strings (legacy / model fallback).
   * The parser normalizes flat strings to `{ to: ID, travel: "" }` so
   * pre-existing packs continue to load.
   */
  connections: z.array(
    z.union([
      z.object({
        /** Target location ID */
        to: z.string(),
        /** What the trip is like — terrain, time, mood */
        travel: z.string(),
        /** What the players notice in transit (optional) */
        observation: z.string().optional(),
        /** Hazards or threats encountered en route (optional) */
        risk: z.string().optional(),
      }),
      z.string(),
    ])
  ),

  /** Encounter IDs that can occur here */
  encounters: z.array(z.string()),

  /** NPC IDs present at this location */
  npcs: z.array(z.string()),

  /** Secrets or hidden content */
  secrets: z.array(z.string()).optional(),

  /** GM notes */
  gmNotes: z.string().optional(),

  /** Visual description for image generation */
  visualDescription: z.string().optional(),

  /** Location images (scene, banner, map) */
  images: EntityImagesSchema.optional(),
});

export type WorldLocation = z.infer<typeof WorldLocationSchema>;

/**
 * A connection element accepts either the structured form or a flat ID.
 * This helper extracts the target ID without forcing every call site to
 * branch on the union — use it everywhere connections are read for ID
 * lookup or graph traversal.
 */
export type LocationConnection = WorldLocation["connections"][number];

export function connectionId(c: LocationConnection): string {
  return typeof c === "string" ? c : c.to;
}

// ============================================================================
// NPC
// ============================================================================

/**
 * Narrative role an NPC plays in the story
 */
export const NarrativeRoleSchema = z.enum([
  "quest_giver",
  "ally",
  "obstacle",
  "information",
  "antagonist",
  "merchant",
  "background",
]);

export type NarrativeRole = z.infer<typeof NarrativeRoleSchema>;

/**
 * Optional combat stats for an NPC. Authored shape (prompt-friendly):
 * scalar HP and armor, ability scores, and weapon strings keyed by
 * name + damage. This is deliberately *not* the runtime `Enemy` shape
 * — runtime fields (current/max HP, parsed `Weapon` with ability and
 * properties, conditions, threat tier) are derived in
 * `promoteNPCToEnemy()` when the NPC enters combat.
 */
export const NPCCombatStatsSchema = z.object({
  hp: z.number().min(1),
  armor: z.number().min(0),
  // Reuse the canonical AbilitiesSchema (defined above) so combatStats
  // honors the same min/max bounds every other ability site enforces.
  // An inline z.object({ STR, AGI, WIT, CON }) of plain numbers would
  // pass validation for out-of-range authored values — the world-pack
  // boundary contract is "validated by the canonical schema, no
  // exceptions" (CLAUDE.md design principles).
  abilities: AbilitiesSchema,
  attacks: z.array(
    z.object({
      name: z.string(),
      damage: z.string(),
    })
  ),
});

export type NPCCombatStats = z.infer<typeof NPCCombatStatsSchema>;

/**
 * An NPC in a world
 */
export const WorldNPCSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  /** Personality traits */
  personality: z.string(),

  /**
   * What drives this NPC. The want/fear/lie triad (Apocalypse World fronts +
   * Save the Cat character beats) gives players three independent levers
   * for interaction:
   * - want: the conscious goal they pursue at the table
   * - fear: what they're avoiding, the source of their resistance
   * - lie: the false belief they hold, exploitable by perceptive PCs
   *
   * Accepts either the structured triad (preferred) OR a flat string
   * (legacy / model fallback) which the parser populates as `want` with
   * empty `fear`/`lie`.
   */
  motivation: z.union([
    z.object({
      want: z.string(),
      fear: z.string(),
      lie: z.string(),
    }),
    z.string(),
  ]),

  /** Initial attitude */
  attitude: z.enum(["friendly", "neutral", "hostile", "unknown"]),

  /** Example dialogue or speech patterns */
  dialogueHints: z.array(z.string()),

  /** Role this NPC plays in the narrative */
  narrativeRole: NarrativeRoleSchema,

  /** Location IDs where this NPC can be found */
  locations: z.array(z.string()).optional(),

  /** Relationships to other NPCs/characters */
  relationships: z.record(z.string()).optional(),

  /** Secrets this NPC knows or hides */
  secrets: z.array(z.string()).optional(),

  /** Visual description for image generation */
  visualDescription: z.string().optional(),

  /** NPC images (portrait, token) */
  images: EntityImagesSchema.optional(),

  /**
   * Optional combat stats for NPCs who might fight (antagonists, guards,
   * any NPC the GM expects to bring into combat). Authored shape — not
   * the runtime `Enemy` shape — so it stays prompt-friendly: scalar HP
   * and armor, ability scores, and weapon strings that
   * `parseWeaponString` can hydrate when the NPC enters combat.
   *
   * Absent on most NPCs (merchants, quest-givers, ambient roles); the
   * `expand_npc` tool fills it on demand. Use `promoteNPCToEnemy()` to
   * project these into a session combatant.
   */
  combatStats: NPCCombatStatsSchema.optional(),
});

export type WorldNPC = z.infer<typeof WorldNPCSchema>;

// ============================================================================
// FACTION
// ============================================================================

/**
 * A faction in a world
 */
export const WorldFactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  /** Faction goals */
  goals: z.array(z.string()),

  /** Resources or power the faction commands */
  resources: z.array(z.string()),

  /** Location IDs the faction controls or operates from */
  territory: z.array(z.string()),

  /** NPC IDs of important faction members */
  keyMembers: z.array(z.string()),

  /** Relationships to other factions */
  relationships: z.record(
    z.object({
      attitude: z.enum(["hostile", "unfriendly", "neutral", "friendly", "allied"]),
      reason: z.string(),
    })
  ),

  /** Plot hooks involving this faction */
  hooks: z.array(z.string()),

  /** Hidden truths about the faction */
  secrets: z.array(z.string()),

  /** Legacy fields for backwards compatibility */
  values: z.array(z.string()).optional(),
  members: z.array(z.string()).optional(),

  /** Visual description for image generation (emblem, banner style) */
  visualDescription: z.string().optional(),

  /** Faction images (icon/emblem, banner) */
  images: EntityImagesSchema.optional(),
});

export type WorldFaction = z.infer<typeof WorldFactionSchema>;

// ============================================================================
// CONDITION (World-specific)
// ============================================================================

/**
 * A condition effect in a world.
 *
 * Aligned with the runtime {@link Condition} type so a world-pack
 * condition can be applied to a character at runtime without an
 * intermediate translation layer:
 *
 *  - `effects: Effect[]` — discriminated union of mechanical effects
 *    the engine actually consumes. Same shape as runtime conditions.
 *  - `duration: number | "permanent" | "until_rest"` — same as runtime.
 *  - `stackable: boolean` — same as runtime.
 *
 * Lore-only fields (severity / cure / sources / mechanicsText) are
 * optional metadata for UI / sourcebook display; the engine never reads
 * them, so they're free-text.
 */
export const WorldConditionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  // === Mechanical fields (engine-consumed) ===

  /** Mechanical effects applied while the condition is active. */
  effects: z.array(EffectSchema),

  /**
   * Duration. Numeric values are round-counted (decremented by
   * `tickConditionDurations`); `"until_rest"` is cleared by long/camp
   * rest; `"permanent"` is never auto-cleared.
   */
  duration: z.union([
    z.number().int().nonnegative(),
    z.literal("permanent"),
    z.literal("until_rest"),
  ]),

  /** Whether multiple instances can stack on the same target. */
  stackable: z.boolean(),

  // === Lore / sourcebook fields (display-only) ===

  /** Human-readable mechanical summary, e.g. "-2 to AGI checks". */
  mechanicsText: z.string().optional(),
  /** How severe the condition is, for sourcebook tagging. */
  severity: z.enum(["minor", "moderate", "severe"]).optional(),
  /** How to remove the condition (in-fiction). */
  cure: z.string().optional(),
  /** Entity ids that inflict or cause this condition. */
  sources: z.array(z.string()).optional(),
});

export type WorldCondition = z.infer<typeof WorldConditionSchema>;

// ============================================================================
// NARRATIVE GUIDANCE
// ============================================================================

/**
 * Narrative guidance for AI/GM
 */
export const NarrativeGuidanceSchema = z.object({
  /** Example session openers */
  openingScenes: z.array(z.string()),
  /** Story starter hooks */
  plotHooks: z.array(z.string()),
  /** Common conflict types */
  commonConflicts: z.array(z.string()),
  /** How stories typically resolve */
  resolutionPatterns: z.array(z.string()),
});

export type NarrativeGuidance = z.infer<typeof NarrativeGuidanceSchema>;

// ============================================================================
// LEAD (The Edge) - Alexandrian Node-Based Design
// ============================================================================

/**
 * A lead connects situations by providing discoverable information.
 * Based on The Alexandrian's node-based scenario design.
 */
export const LeadSchema = z.object({
  /** Unique identifier: lead:source-to-target-method */
  id: z.string(),
  /** What the lead reveals */
  information: z.string(),
  /** Situation this lead points to */
  targetSituationId: z.string(),
  /** How the lead is discovered */
  discovery: z.object({
    /** Method of discovery */
    method: z.enum([
      "location", // Found at a specific place
      "npc", // Given by an NPC
      "investigation", // Requires active searching
      "observation", // Noticed passively
      "document", // Found in written materials
      "consequence", // Result of another action
      "rumor", // Heard through gossip
      "item", // Discovered via an item
    ]),
    /** NPC/location/item providing the lead */
    sourceId: z.string().optional(),
    /** Description of how to find it */
    description: z.string(),
    /** Optional skill test to discover */
    test: z
      .object({
        ability: AbilityNameSchema,
        difficulty: z.number(),
        skill: z.string().optional(),
      })
      .optional(),
  }),
  /** How obvious the lead is */
  prominence: z.enum([
    "obvious", // Cannot be missed
    "available", // Easily found with basic effort
    "hidden", // Requires specific action or skill
    "obscured", // Actively concealed
  ]),
  /** Conditions for the lead to be available */
  prerequisites: z
    .object({
      /** Flags that must be set */
      requiredFlags: z.array(z.string()).optional(),
      /** Flags that block this lead */
      blockedByFlags: z.array(z.string()).optional(),
      /** Time window when available */
      timeWindow: z
        .object({
          after: z.object({ day: z.number(), hour: z.number() }).optional(),
          before: z.object({ day: z.number(), hour: z.number() }).optional(),
        })
        .optional(),
    })
    .optional(),
  /** GM notes for running this lead */
  gmNotes: z.string().optional(),
});

export type Lead = z.infer<typeof LeadSchema>;

// ============================================================================
// SITUATION CLOCK (Proactive Timeline)
// ============================================================================

/**
 * A stage in a situation clock - what happens at each tick
 */
export const ClockStageSchema = z.object({
  /** Unique stage ID */
  id: z.string(),
  /** Stage name */
  name: z.string(),
  /** What happens at this stage */
  description: z.string(),
  /** What triggers this stage */
  trigger: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("time"),
      /** Minutes from clock start */
      minutesFromStart: z.number(),
    }),
    z.object({
      type: z.literal("event"),
      /** Description of triggering event */
      eventDescription: z.string(),
      /** Optional flag to check */
      flag: z.string().optional(),
    }),
    z.object({
      type: z.literal("playerInaction"),
      /** Minutes of no player engagement */
      minutesOfInaction: z.number(),
    }),
  ]),
  /** What changes when this stage triggers */
  consequences: z.object({
    /** Flags to set */
    setFlags: z.array(z.string()).optional(),
    /** Flags to remove */
    removeFlags: z.array(z.string()).optional(),
    /** Changes to NPCs */
    npcChanges: z
      .array(
        z.object({
          npcId: z.string(),
          change: z.string(),
        })
      )
      .optional(),
    /** Changes to locations */
    locationChanges: z
      .array(
        z.object({
          locationId: z.string(),
          change: z.string(),
        })
      )
      .optional(),
    /** Changes to lead availability */
    leadChanges: z
      .array(
        z.object({
          leadId: z.string(),
          available: z.boolean(),
        })
      )
      .optional(),
    /** Narrative text for this stage */
    narrative: z.string(),
  }),
  /** Can this stage be undone? */
  reversible: z.boolean(),
});

export type ClockStage = z.infer<typeof ClockStageSchema>;

/**
 * A clock tracking what happens if PCs don't intervene
 */
export const SituationClockSchema = z.object({
  /** Unique clock ID */
  id: z.string(),
  /** Clock name */
  name: z.string(),
  /** What the clock counts toward (the doom) */
  doom: z.string(),
  /**
   * What player action pauses, reverses, or resets this clock. The lever
   * the players can pull. Required so clocks aren't invisible railroads.
   */
  pauseCondition: z.string(),
  /** Stages of the clock */
  stages: z.array(ClockStageSchema),
  /** Current stage index (runtime state, null if not started) */
  currentStage: z.number().nullable(),
  /** When the clock started (runtime state) */
  startedAt: z
    .object({
      day: z.number(),
      hour: z.number(),
      minute: z.number(),
    })
    .nullable(),
  /** Is the clock paused? */
  paused: z.boolean(),
});

export type SituationClock = z.infer<typeof SituationClockSchema>;

// ============================================================================
// WORLD SITUATION (The Node)
// ============================================================================

/**
 * A situation is a set of circumstances that will change without PC intervention.
 * Based on The Alexandrian's node-based scenario design.
 */
export const WorldSituationSchema = z.object({
  // Core identification
  /** Unique identifier: situation:slug-name */
  id: z.string(),
  /** Situation name */
  name: z.string(),
  /** Description of the situation */
  description: z.string(),
  /** Current status */
  status: z.enum(["dormant", "brewing", "active", "resolved", "failed"]),

  // Stakes - what's at risk
  stakes: z.object({
    /** What could go wrong */
    risks: z.array(z.string()),
    /** What could be gained */
    opportunities: z.array(z.string()),
    /** Who suffers most if ignored */
    primaryVictim: z.string().optional(),
    /** What happens if PCs don't act */
    ifIgnored: z.string(),
  }),

  // Actors - who's involved
  actors: z.array(
    z.object({
      /** NPC or faction ID */
      entityId: z.string(),
      /** What they want from this situation */
      agenda: z.string(),
      /** What power they have */
      leverage: z.string(),
      /**
       * What they do if not opposed, with timeline. The triad is the
       * GM's playbook: now is the next-round move, then the cascade if
       * players continue not engaging this actor. Accepts either the
       * structured triad (preferred) or a flat string (legacy / model
       * fallback) which the parser populates as `now` with empty future
       * steps. Required so the situation has motion regardless of what
       * the players do.
       */
      defaultAction: z.union([
        z.object({
          now: z.string(),
          ifIgnored1Step: z.string(),
          ifIgnored2Steps: z.string(),
        }),
        z.string(),
      ]),
      /** Is this the main antagonist? */
      isPrimaryAntagonist: z.boolean().optional(),
    })
  ),

  // Locations - where it happens
  locations: z.object({
    /** Primary location IDs */
    primary: z.array(z.string()),
    /** Related location IDs */
    related: z.array(z.string()).optional(),
    /** Location-specific context */
    details: z.record(z.string()).optional(),
  }),

  // Clock - what happens over time
  clock: SituationClockSchema.optional(),

  // Leads - outgoing edges to other situations
  outgoingLeads: z.array(LeadSchema),

  // Entry points - how PCs discover this situation
  entryPoints: z.object({
    /** Lead IDs from other situations pointing here */
    incomingLeadIds: z.array(z.string()),
    /** Ways to discover this directly */
    directDiscovery: z.array(
      z.object({
        method: z.string(),
        description: z.string(),
        locationId: z.string().optional(),
        npcId: z.string().optional(),
      })
    ),
    /** Target number of entry points (Three Clue Rule) */
    minimumLeadsTarget: z.number().default(3),
  }),

  // Complications - what makes this hard
  complications: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      type: z.enum([
        "obstacle", // Physical barrier
        "opposition", // Active resistance
        "moral", // Ethical dilemma
        "resource", // Missing tools/info
        "time", // Deadline pressure
        "information", // Unknown factors
        "relationship", // Social complications
      ]),
      /** Possible ways to resolve */
      resolutions: z.array(z.string()),
    })
  ),

  // Outcomes - how this can end
  outcomes: z.object({
    /** Full success */
    victory: z.object({
      description: z.string(),
      consequences: z.array(z.string()),
      flagsSet: z.array(z.string()).optional(),
    }),
    /** Complete failure */
    failure: z.object({
      description: z.string(),
      consequences: z.array(z.string()),
      flagsSet: z.array(z.string()).optional(),
    }),
    /** Partial successes */
    partial: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          consequences: z.array(z.string()),
          flagsSet: z.array(z.string()).optional(),
        })
      )
      .optional(),
    /** Unexpected outcomes */
    wildcards: z.array(z.string()).optional(),
  }),

  // GM Guidance
  gmGuidance: z.object({
    /** Thematic elements to emphasize */
    themes: z.array(z.string()),
    /** Tone notes for running this */
    toneNotes: z.string(),
    /** Common approaches and responses */
    anticipatedApproaches: z.array(
      z.object({
        approach: z.string(),
        response: z.string(),
      })
    ),
    /** Elements to hint at earlier */
    foreshadowing: z.array(z.string()).optional(),
    /** Connections to arcs */
    arcConnections: z.array(z.string()).optional(),
  }),

  /** Tags for filtering/organization */
  tags: z.array(z.string()),
  /** Parent arc ID */
  arcId: z.string().optional(),
  /** Layer in layer-cake structures */
  layer: z.number().optional(),
});

export type WorldSituation = z.infer<typeof WorldSituationSchema>;

// ============================================================================
// WORLD ARC (The Cluster)
// ============================================================================

/**
 * An arc groups related situations around a central tension.
 * Provides structure for multi-session storylines.
 */
export const WorldArcSchema = z.object({
  /** Unique identifier: arc:slug-name */
  id: z.string(),
  /** Arc name */
  name: z.string(),
  /** Arc description */
  description: z.string(),

  // Central tension
  tension: z.object({
    /** The core conflict */
    centralConflict: z.string(),
    /** Source of the conflict */
    source: z.string(),
    /** Opposing forces */
    opposingForces: z.array(
      z.object({
        name: z.string(),
        goal: z.string(),
        factionId: z.string().optional(),
      })
    ),
    /** Why this matters now */
    urgency: z.string().optional(),
  }),

  /** Situation IDs in this arc */
  situationIds: z.array(z.string()),

  // Structure for pacing
  structure: z.object({
    /** Arc structure type */
    type: z.enum([
      "funnel", // Multiple entry points narrow to climax
      "layer_cake", // Situations unlock in layers
      "hub_spoke", // Central hub with satellite situations
      "chain", // Linear progression
      "web", // Interconnected without clear structure
    ]),
    /** Situation ID -> layer number mapping */
    layers: z.record(z.number()).optional(),
    /** Entry point situation IDs (for funnel) */
    entryPoints: z.array(z.string()).optional(),
    /** Climax situation ID (for funnel) */
    climax: z.string().optional(),
    /** Hub situation ID (for hub_spoke) */
    hub: z.string().optional(),
    /** Suggested play order */
    suggestedOrder: z.array(z.string()).optional(),
  }),

  // Resolution
  resolution: z.object({
    /** How this arc can conclude */
    patterns: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        triggerConditions: z.array(z.string()),
      })
    ),
    /** Arcs unlocked by completing this one */
    unlocksArcs: z.array(z.string()).optional(),
    /** Changes to the world on resolution */
    worldChanges: z.array(z.string()),
  }),

  /** Thematic elements */
  themes: z.array(z.string()),

  // GM Guidance
  gmGuidance: z.object({
    /** How to introduce this arc */
    introduction: z.string(),
    /** Pacing advice */
    pacing: z.string(),
    /** Key NPCs to feature */
    keyNpcs: z.array(z.string()),
    /** Atmosphere notes */
    atmosphere: z.string(),
  }),

  /** Arc status */
  status: z.enum(["dormant", "foreshadowed", "active", "climax", "resolved"]),
});

export type WorldArc = z.infer<typeof WorldArcSchema>;

// ============================================================================
// WORLD CONTENT PACK
// ============================================================================

/**
 * A complete world content pack
 */
export const WorldContentPackSchema = z.object({
  /** World metadata */
  meta: WorldMetaSchema,

  /** Playable archetypes */
  archetypes: z.record(WorldArchetypeSchema),

  /** Items */
  items: z.record(WorldItemSchema),

  /** Monsters */
  monsters: z.record(WorldMonsterSchema),

  /** Encounters */
  encounters: z.record(WorldEncounterSchema),

  /** Conditions (status effects) */
  conditions: z.record(WorldConditionSchema),

  /** Locations */
  locations: z.record(WorldLocationSchema),

  /** NPCs */
  npcs: z.record(WorldNPCSchema),

  /** Factions (optional) */
  factions: z.record(WorldFactionSchema).optional(),

  /** Situations - node-based scenario design (optional) */
  situations: z.record(WorldSituationSchema).optional(),

  /** Story arcs grouping situations (optional) */
  arcs: z.record(WorldArcSchema).optional(),

  /** Narrative guidance for AI/GM */
  narrativeGuidance: NarrativeGuidanceSchema,

  /**
   * Rules configuration (optional)
   * Allows world packs to extend or override base game rules.
   * If not provided, default rules are used.
   */
  rules: WorldRulesConfigSchema.optional(),
});

export type WorldContentPack = z.infer<typeof WorldContentPackSchema>;
