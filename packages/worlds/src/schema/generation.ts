/**
 * Generation State Types
 *
 * Defines types for tracking world generation progress and LLM interaction.
 */

import { z } from "zod";
import {
  WorldAestheticSchema,
  WorldSettingsSchema,
  WorldArchetypeSchema,
  WorldMonsterSchema,
  WorldItemSchema,
  WorldEncounterSchema,
  WorldLocationSchema,
  WorldNPCSchema,
  NarrativeGuidanceSchema,
  WorldConditionSchema,
  WorldFactionSchema,
  WorldSituationSchema,
  WorldArcSchema,
} from "./world.js";

// ============================================================================
// WORLD SEED
// ============================================================================

/**
 * Initial world concept generated from a campaign seed
 */
export const WorldSeedSchema = z
  .object({
    /** Generated world ID */
    id: z.string(),

    /** World name */
    name: z.string(),

    /** One-line hook */
    tagline: z.string(),

    /** Original campaign seed prompt */
    campaignSeed: z.string(),

    /** Aesthetic guidance */
    aesthetic: WorldAestheticSchema,

    /** Gameplay settings */
    settings: WorldSettingsSchema,

    /** Core story conflict */
    coreConflict: z.string(),

    /**
     * Pre-allocated seed entries with canonical IDs.
     *
     * Every seed list is required (not optional) and every entry has a
     * non-optional `id`. The seed parser fills `id` deterministically via
     * `slugify(name)` so wave-1 / wave-2 generators have a stable ID
     * manifest to reference. This is what prevents the "archetypes name
     * items the items generator never created" class of cross-reference
     * bug — the IDs are coordinated upfront.
     */

    archetypeSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        concept: z.string(),
      })
    ),

    locationSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        concept: z.string(),
      })
    ),

    npcSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        concept: z.string(),
      })
    ),

    monsterSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        concept: z.string(),
        threat: z.enum(["minion", "standard", "elite", "boss"]),
      })
    ),

    itemSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(["weapon", "armor", "consumable", "tool", "treasure"]).optional(),
      })
    ),

    encounterSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        concept: z.string(),
        type: z.enum(["combat", "social", "exploration", "puzzle"]).optional(),
      })
    ),

    factionSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        concept: z.string(),
      })
    ),

    situationSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        concept: z.string(),
        urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
      })
    ),

    arcSeeds: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        concept: z.string(),
        structure: z.enum(["funnel", "layer_cake", "hub_spoke", "chain", "web"]).optional(),
      })
    ),

    /** Optional rules configuration */
    rules: z.unknown().optional(),

    /** Creation timestamp */
    createdAt: z.string(),
  })
  .passthrough();

export type WorldSeed = z.infer<typeof WorldSeedSchema>;

// ============================================================================
// GENERATION STEP
// ============================================================================

/**
 * A single generation step record
 */
export const GenerationStepSchema = z.object({
  /** Step ID */
  id: z.string(),

  /** Type of generation */
  type: z.enum([
    "seed",
    "archetypes",
    "monsters",
    "items",
    "encounters",
    "locations",
    "npcs",
    "conditions",
    "factions",
    "narrative",
    "situations",
    "arcs",
    "expand_location",
    "expand_archetype",
    "expand_npc",
    "expand_monster",
    "expand_situation",
  ]),

  /** When this step was initiated */
  startedAt: z.string(),

  /** When this step completed (null if in progress) */
  completedAt: z.string().nullable(),

  /** Status */
  status: z.enum(["pending", "in_progress", "completed", "failed"]),

  /** Error message if failed */
  error: z.string().optional(),

  /** IDs of content generated in this step */
  generatedIds: z.array(z.string()),
});

export type GenerationStep = z.infer<typeof GenerationStepSchema>;

// ============================================================================
// EXPANDED CONTENT TYPES
// ============================================================================

/**
 * Expanded location with additional detail
 */
export const ExpandedLocationSchema = WorldLocationSchema.extend({
  /** Detailed area descriptions */
  areas: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        features: z.array(z.string()),
      })
    )
    .optional(),

  /** Random encounter table */
  randomEncounters: z
    .array(
      z.object({
        weight: z.number(),
        encounterId: z.string(),
      })
    )
    .optional(),

  /** Treasure/loot available */
  treasure: z.array(z.string()).optional(),
});

export type ExpandedLocation = z.infer<typeof ExpandedLocationSchema>;

/**
 * Expanded archetype with additional detail
 */
export const ExpandedArchetypeSchema = WorldArchetypeSchema.extend({
  /** Recommended skill progression */
  skillProgression: z
    .array(
      z.object({
        level: z.number(),
        skills: z.array(z.string()),
      })
    )
    .optional(),

  /** Party role description */
  partyRole: z.string().optional(),

  /** RP hooks */
  roleplayHooks: z.array(z.string()).optional(),

  /** Suggested personality traits */
  suggestedTraits: z.array(z.string()).optional(),
});

export type ExpandedArchetype = z.infer<typeof ExpandedArchetypeSchema>;

/**
 * Expanded NPC with additional detail.
 *
 * `combatStats` is inherited from `WorldNPCSchema` (now the canonical
 * source) — no need to redeclare. ExpandedNPC adds backstory, quest
 * hooks, and inventory on top.
 */
export const ExpandedNPCSchema = WorldNPCSchema.extend({
  /** Detailed backstory */
  backstory: z.string().optional(),

  /** Quest hooks this NPC can provide */
  questHooks: z.array(z.string()).optional(),

  /** Inventory/items they possess */
  inventory: z.array(z.string()).optional(),
});

export type ExpandedNPC = z.infer<typeof ExpandedNPCSchema>;

/**
 * Expanded monster with additional detail
 */
export const ExpandedMonsterSchema = WorldMonsterSchema.extend({
  /** Detailed lair description */
  lair: z
    .object({
      description: z.string(),
      hazards: z.array(z.string()),
      treasure: z.array(z.string()),
    })
    .optional(),

  /** Variants of this monster */
  variants: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        modifications: z.record(z.unknown()),
      })
    )
    .optional(),

  /** Ecology/habitat info */
  ecology: z.string().optional(),
});

export type ExpandedMonster = z.infer<typeof ExpandedMonsterSchema>;

// ============================================================================
// WORLD GENERATION SESSION
// ============================================================================

/**
 * Generated content storage
 */
export const GeneratedContentSchema = z.object({
  archetypes: z.array(WorldArchetypeSchema),
  monsters: z.array(WorldMonsterSchema),
  items: z.array(WorldItemSchema),
  encounters: z.array(WorldEncounterSchema),
  locations: z.array(WorldLocationSchema),
  npcs: z.array(WorldNPCSchema),
  conditions: z.array(WorldConditionSchema),
  factions: z.array(WorldFactionSchema),
  narrative: NarrativeGuidanceSchema.nullable(),
  situations: z.array(WorldSituationSchema),
  arcs: z.array(WorldArcSchema),
});

export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;

/**
 * Expanded content storage
 */
export const ExpansionsSchema = z.object({
  locations: z.array(ExpandedLocationSchema),
  archetypes: z.array(ExpandedArchetypeSchema),
  npcs: z.array(ExpandedNPCSchema),
  monsters: z.array(ExpandedMonsterSchema),
});

export type Expansions = z.infer<typeof ExpansionsSchema>;

/**
 * World generation session state
 */
export const WorldGenerationSessionSchema = z.object({
  /** World seed (null until seeding complete) */
  worldSeed: WorldSeedSchema.nullable(),

  /** Generated content */
  generatedContent: GeneratedContentSchema,

  /** Expanded content */
  expansions: ExpansionsSchema,

  /** Generation status */
  status: z.enum(["idle", "seeding", "generating", "expanding", "assembling", "complete"]),

  /** Generation history */
  history: z.array(GenerationStepSchema),

  /** Assembled world pack ID (if complete) */
  worldPackId: z.string().nullable(),
});

export type WorldGenerationSession = z.infer<typeof WorldGenerationSessionSchema>;

/**
 * Create an empty world generation session
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

// ============================================================================
// GENERATION TOOL RESPONSE
// ============================================================================

/**
 * Prompt for LLM execution
 */
export const GenerationPromptSchema = z.object({
  /** System message */
  system: z.string(),
  /** User message */
  user: z.string(),
  /** Expected output schema name (for reference) */
  outputSchemaName: z.string(),
});

export type GenerationPrompt = z.infer<typeof GenerationPromptSchema>;

/**
 * Response from a generation tool
 */
export const GenerationToolResponseSchema = z.object({
  /** Prompt for LLM to execute (if tool needs LLM) */
  prompt: GenerationPromptSchema.optional(),

  /** Direct result (if tool has immediate result) */
  result: z.unknown().optional(),

  /** Step ID for tracking */
  stepId: z.string().optional(),

  /** Message to display */
  message: z.string(),
});

export type GenerationToolResponse = z.infer<typeof GenerationToolResponseSchema>;

// ============================================================================
// SAVE GENERATION RESULT INPUT
// ============================================================================

/**
 * Input for saving LLM generation results
 */
export const SaveGenerationResultInputSchema = z.object({
  sessionId: z.string(),
  stepId: z.string(),
  result: z.unknown(),
});

export type SaveGenerationResultInput = z.infer<typeof SaveGenerationResultInputSchema>;

// ============================================================================
// WORLD PACK SUMMARY
// ============================================================================

/**
 * Summary of a saved world pack
 */
export const WorldPackSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  createdAt: z.string(),
  contentCounts: z.object({
    archetypes: z.number(),
    monsters: z.number(),
    items: z.number(),
    encounters: z.number(),
    locations: z.number(),
    npcs: z.number(),
  }),
});

export type WorldPackSummary = z.infer<typeof WorldPackSummarySchema>;

// ============================================================================
// VALIDATION RESULT
// ============================================================================

/**
 * Validation issue
 */
export const ValidationIssueSchema = z.object({
  type: z.enum(["error", "warning"]),
  path: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * Result of validating a world pack
 */
export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(ValidationIssueSchema),
  stats: z.object({
    totalItems: z.number(),
    missingReferences: z.number(),
    duplicateIds: z.number(),
  }),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
