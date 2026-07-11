/**
 * Encounter Generation Tool (Shared)
 *
 * Generates encounters based on the world seed.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldRulesConfig } from "@mythxengine/types";
import { buildRulesPromptSection } from "./rules-prompt.js";
import {
  formatMonsterManifest,
  formatManifestInline,
  getRecommendedCount,
  type WorldTier,
} from "./manifest-helpers.js";

export const GenerateEncountersInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z
    .number()
    .min(1)
    .max(30)
    .optional()
    .default(12)
    .describe("Number of encounters to generate"),
  types: z
    .array(z.enum(["combat", "event", "social"]))
    .min(1)
    .optional()
    .default(["combat", "event", "social"])
    .describe("Encounter types to include (at least one required)"),
});

export type GenerateEncountersInput = z.infer<typeof GenerateEncountersInputSchema>;

export interface GenerateEncountersOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

/** Schema for validating worldSeed has the required properties */
const WorldSeedForEncountersSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  aesthetic: z.object({
    visualStyle: z.string(),
    tone: z.string(),
    themes: z.array(z.string()),
  }),
  settings: z.object({
    lethality: z.string(),
    supernaturalPresence: z.string(),
  }),
  coreConflict: z.string(),
  locationSeeds: z.array(
    z.object({ id: z.string().optional(), name: z.string(), concept: z.string() })
  ),
  monsterSeeds: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      concept: z.string(),
      threat: z.string(),
    })
  ),
  npcSeeds: z.array(z.object({ id: z.string().optional(), name: z.string(), concept: z.string() })),
  // Passthrough for rules — already validated when saved to session.
  // Using z.unknown() instead of WorldRulesConfigSchema to avoid type mismatch
  // between @mythxengine/worlds schema output and @mythxengine/types WorldRulesConfig.
  rules: z
    .unknown()
    .optional()
    .transform((v) => v as WorldRulesConfig | undefined),
});

/** Format a seed array or return fallback text if empty */
function formatSeedList<T extends { name: string; concept: string }>(
  seeds: T[],
  formatter: (seed: T) => string,
  emptyText: string
): string {
  if (!seeds || seeds.length === 0) {
    return emptyText;
  }
  return seeds.map(formatter).join("\n");
}

export const generateEncountersTool = defineSharedTool({
  name: "generate_encounters",
  description: "Generate encounters based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateEncountersInputSchema,

  handler: async (input, ctx): Promise<GenerateEncountersOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "encounters" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    // Validate worldSeed shape before use
    const parseResult = WorldSeedForEncountersSchema.safeParse(session.generation.worldSeed);
    if (!parseResult.success) {
      throw new Error(
        `Invalid world seed structure: ${parseResult.error.issues.map((i) => i.message).join(", ")}`
      );
    }
    const worldSeed = parseResult.data;

    const stepId = randomUUID();
    const tier = (session.generation?.tier || "medium") as WorldTier;
    // Use tier-based recommended count if not explicitly provided
    const count = input.count ?? getRecommendedCount("encounters", tier);
    const types = input.types!;

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "encounters",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    // Build rules section from seed (uses defaults if no custom rules)
    const rulesSection = buildRulesPromptSection(worldSeed.rules);

    const systemPrompt = `You are an encounter designer for tabletop RPGs. Create varied, engaging encounters that challenge players in different ways.

${rulesSection}

### Encounter Types
- Combat: Fights with monsters, enemies, or environmental hazards
- Event: Skill challenges, puzzles, traps, or environmental obstacles
- Social: Negotiations, interrogations, persuasion, or roleplay scenarios

### Encounter Design Guidelines
- Combat encounters reference monsters by ID (monster:slug-name)
- Social encounters reference NPCs by ID (npc:slug-name)
- Event encounters have choices with skill tests (use abilities and difficulties from rules above)
- Include GM guidance and multiple possible outcomes

Output valid JSON only.`;

    // Calculate distribution
    const distribution: Record<string, number> = {};
    const perType = Math.floor(count / types.length);
    const remainder = count % types.length;
    types.forEach((type, i) => {
      distribution[type] = perType + (i < remainder ? 1 : 0);
    });

    const userPrompt = `Generate ${count} encounters for this world:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Core Conflict: ${worldSeed.coreConflict}
Lethality: ${worldSeed.settings.lethality}
Supernatural Presence: ${worldSeed.settings.supernaturalPresence}

Locations where encounters might occur:
${formatSeedList(
  worldSeed.locationSeeds,
  (l) => `- ${l.name}: ${l.concept}`,
  "(No specific locations defined - create generic encounter locations)"
)}

Monsters available:
${formatSeedList(
  worldSeed.monsterSeeds,
  (m) => `- ${m.name} (${m.threat}): ${m.concept}`,
  "(No monsters defined yet - create generic threat encounters)"
)}

NPCs available:
${formatSeedList(
  worldSeed.npcSeeds,
  (n) => `- ${n.name}: ${n.concept}`,
  "(No NPCs defined yet - create generic social encounters)"
)}

ID Manifest (reference these exact IDs in your encounters):
Monster IDs:
${formatMonsterManifest(worldSeed.monsterSeeds)}
NPC IDs: ${formatManifestInline(worldSeed.npcSeeds, "npc")}
Location IDs: ${formatManifestInline(worldSeed.locationSeeds, "location")}

IMPORTANT: Use monster IDs from this manifest in combat.monsters[].monsterId fields. Use NPC IDs in social.npcIds[] fields. Reference location IDs where encounters occur.

Encounter distribution:
${Object.entries(distribution)
  .map(([type, n]) => `- ${type}: ${n} encounters`)
  .join("\n")}

Output a JSON object:
{
  "encounters": [
    {
      "id": "encounter:slug-name",
      "name": "Encounter Name",
      "type": "combat|event|social",
      "description": "What this encounter is about",
      "text": "Narrative text when encounter begins (read-aloud)",
      "gmGuidance": "Tips for running this encounter",
      "outcomes": ["Possible outcome 1", "Possible outcome 2", "Possible outcome 3"],
      "combat": {
        "monsters": [
          { "monsterId": "monster:slug-name", "count": 2 }
        ],
        "surprise": "none|enemies|party",
        "environment": {
          "lighting": "bright|dim|dark",
          "terrain": "open|cramped|hazardous",
          "hazards": ["optional hazard descriptions"]
        }
      },
      "event": {
        "choices": [
          {
            "text": "Choice description",
            "test": { "ability": "STR|AGI|WIT|CON", "difficulty": 12 },
            "successOutcome": "What happens on success",
            "failureOutcome": "Required (fail-forward). What CHANGES on failure — a complication, a cost, a partial truth, a clock tick, an attitude shift. Never just 'you fail' or 'nothing happens'."
          }
        ]
      },
      "social": {
        "npcIds": ["npc:slug-name"],
        "initialAttitude": "hostile|unfriendly|neutral|friendly|allied",
        "negotiable": true
      }
    }
  ]
}

Notes:
- Include combat object only for combat encounters
- Include event object only for event encounters
- Include social object only for social encounters

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "WorldEncounter[]",
      },
      stepId,
      message: `Encounter generation initiated for ${count} encounters. Execute the prompt and call save_generation_result.`,
    };
  },
});
