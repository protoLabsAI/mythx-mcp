/**
 * Location Generation Tool (Shared)
 *
 * Generates locations based on the world seed.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldRulesConfig } from "@mythxengine/types";
import { buildRulesPromptSection } from "./rules-prompt.js";
import {
  formatManifestList,
  formatManifestInline,
  formatMonsterManifest,
} from "./manifest-helpers.js";

export const GenerateLocationsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .describe("Number of locations to generate (default: from world seed)"),
  focusOn: z.array(z.string()).optional().describe("Specific location seeds to focus on (by name)"),
});

export type GenerateLocationsInput = z.infer<typeof GenerateLocationsInputSchema>;

export interface GenerateLocationsOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForLocations {
  name: string;
  tagline: string;
  aesthetic: { visualStyle: string; tone: string; themes: string[] };
  settings: { technologyLevel: string; supernaturalPresence: string };
  coreConflict: string;
  locationSeeds: Array<{ id?: string; name: string; concept: string }>;
  npcSeeds: Array<{ id?: string; name: string; concept: string }>;
  monsterSeeds?: Array<{ id: string; name: string; concept: string; threat: string }>;
  rules?: WorldRulesConfig;
}

export const generateLocationsTool = defineSharedTool({
  name: "generate_locations",
  description: "Generate locations based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateLocationsInputSchema,

  handler: async (input, ctx): Promise<GenerateLocationsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "locations" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForLocations;

    const stepId = randomUUID();

    // Apply focusOn filter, fall back to full list if filter results in empty
    let filteredSeeds = input.focusOn
      ? worldSeed.locationSeeds.filter((l) => input.focusOn!.includes(l.name))
      : worldSeed.locationSeeds;

    if (filteredSeeds.length === 0) {
      filteredSeeds = worldSeed.locationSeeds;
    }

    // Clamp count to available seeds
    const count = Math.min(input.count || filteredSeeds.length, filteredSeeds.length);
    const locationSeeds = filteredSeeds.slice(0, count);

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "locations",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    // Build rules section from seed (uses defaults if no custom rules)
    const rulesSection = buildRulesPromptSection(worldSeed.rules);

    const systemPrompt = `You are a location designer for tabletop RPGs. Create memorable, explorable locations that serve as backdrops for adventure.

${rulesSection}

### Location Design Guidelines
- Each location needs a clear type (settlement, dungeon, wilderness, landmark, building)
- Include atmospheric details (sights, sounds, smells)
- List notable features players can interact with
- Define connections to other locations (by ID)
- Suggest encounters that might occur here
- Place NPCs where appropriate
- Include optional secrets for discovery
- Include a visualDescription: one sentence describing what the place looks like — architecture, lighting, key visual features. Used for scene image generation.

Output valid JSON only.`;

    const userPrompt = `Generate ${count} locations for this world:

World: ${worldSeed.name}
Visual Style: ${worldSeed.aesthetic.visualStyle}
Tone: ${worldSeed.aesthetic.tone}
Core Conflict: ${worldSeed.coreConflict}
Technology Level: ${worldSeed.settings.technologyLevel}
Supernatural Presence: ${worldSeed.settings.supernaturalPresence}

Location seeds to develop:
${locationSeeds.map((l, i) => `${i + 1}. ${l.name}: ${l.concept}`).join("\n")}

NPCs that might be placed:
${worldSeed.npcSeeds.map((n) => `- ${n.name}: ${n.concept}`).join("\n")}

Output a JSON object:
{
  "locations": [
    {
      "id": "location:slug-name",
      "name": "Location Name",
      "description": "2-3 sentences describing the location",
      "visualDescription": "One sentence physical appearance for image generation",
      "type": "settlement|dungeon|wilderness|landmark|building",
      "atmosphere": "Sensory details - what players see, hear, smell",
      "features": [
        "Verb-phrased: 'Climb the leaning belfry to reach the rookery' — at least half of features should read as actionable verbs (what can players DO here?), not noun phrases."
      ],
      "connections": [
        {
          "to": "location:other-location-id",
          "travel": "What the trip is like — terrain, time, mood",
          "observation": "What players notice in transit (optional)",
          "risk": "Hazard or threat encountered en route (optional)"
        }
      ],
      "encounters": [],
      "npcs": ["npc:resident-npc-id"],
      "secrets": ["Hidden thing players might discover"],
      "gmNotes": "Tips for running scenes here"
    }
  ]
}

ID Manifest (use these exact IDs):
Location IDs: ${formatManifestList(locationSeeds, "location")}
NPC IDs for resident placement: ${formatManifestInline(worldSeed.npcSeeds, "npc")}
Monster IDs for encounter references: ${formatMonsterManifest(worldSeed.monsterSeeds || [], true)}

IMPORTANT:
- Use the location IDs above as-is for each location you generate.
- Reference NPC IDs from the manifest for npcs[] arrays.
- For connections[], use the pre-allocated location IDs (e.g., "location:cinderwall").
- Leave encounters[] as an EMPTY ARRAY []. Encounters are generated separately and reference locations, not the other way around. Do NOT invent encounter IDs.

Notes:
- Connections should form a logical network (paths, roads, doors)
- Not all locations need secrets
- Place NPCs where they logically belong

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "{ locations: WorldLocation[] }",
      },
      stepId,
      message: `Location generation initiated for ${count} locations. Execute the prompt and call save_generation_result.`,
    };
  },
});
