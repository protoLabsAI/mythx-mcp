/**
 * Archetype Generation Tool (Shared)
 *
 * Generates playable character archetypes based on the world seed.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldRulesConfig } from "@mythxengine/types";
import { buildRulesPromptSection, buildHPGuidelines } from "./rules-prompt.js";
import { formatManifestInline, formatItemManifest } from "./manifest-helpers.js";

export const GenerateArchetypesInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe("Number of archetypes to generate (default: from world seed)"),
  focusOn: z
    .array(z.string())
    .optional()
    .describe("Specific archetype seeds to focus on (by name)"),
});

export type GenerateArchetypesInput = z.infer<typeof GenerateArchetypesInputSchema>;

export interface GenerateArchetypesOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForArchetypes {
  name: string;
  tagline: string;
  aesthetic: { visualStyle: string; tone: string; themes: string[] };
  settings: { lethality: string; magicLevel: string; technologyLevel: string };
  coreConflict: string;
  archetypeSeeds: Array<{ id?: string; name: string; concept: string }>;
  locationSeeds?: Array<{ id?: string; name: string; concept: string }>;
  itemSeeds?: Array<{ id?: string; name: string; kind?: string }>;
  rules?: WorldRulesConfig;
}

export const generateArchetypesTool = defineSharedTool({
  name: "generate_archetypes",
  description:
    "Generate playable character archetypes based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateArchetypesInputSchema,

  handler: async (input, ctx): Promise<GenerateArchetypesOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "archetypes" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForArchetypes;

    const stepId = randomUUID();

    // Apply focusOn filter, fall back to full list if filter results in empty
    let filteredSeeds = input.focusOn
      ? worldSeed.archetypeSeeds.filter((a) => input.focusOn!.includes(a.name))
      : worldSeed.archetypeSeeds;

    if (filteredSeeds.length === 0) {
      filteredSeeds = worldSeed.archetypeSeeds;
    }

    // Clamp count to available seeds
    const count = Math.min(input.count || filteredSeeds.length, filteredSeeds.length);
    const archetypeSeeds = filteredSeeds.slice(0, count);

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "archetypes",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    // Build rules section from seed (uses defaults if no custom rules)
    const rulesSection = buildRulesPromptSection(worldSeed.rules);
    const hpGuidelines = buildHPGuidelines(worldSeed.rules);

    const systemPrompt = `You are a character archetype designer for tabletop RPGs. Create compelling, balanced archetypes that fit the world's tone and offer distinct playstyles.

${rulesSection}

${hpGuidelines}

Design Guidelines:
- Ability modifiers should sum to approximately +2 total
- Each archetype needs 2 unique features
- Starting items should be 3-5 thematic items (reference by ID like "item:weapon-name")
- Playstyle guidance should help players understand the archetype's role
- Include a visualDescription: one sentence describing the physical appearance of a typical member of this class — build, clothing, equipment, distinguishing visual traits. Used for portrait generation.

Output valid JSON only.`;

    const userPrompt = `Generate ${count} playable character archetypes for this world:

World: ${worldSeed.name}
Tagline: ${worldSeed.tagline}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Core Conflict: ${worldSeed.coreConflict}
Lethality: ${worldSeed.settings.lethality}
Magic Level: ${worldSeed.settings.magicLevel}

Archetype seeds to develop:
${archetypeSeeds.map((a, i) => `${i + 1}. ${a.name}: ${a.concept}`).join("\n")}

ID Manifest (use these exact IDs — do not invent new ones):
Archetype IDs: ${formatManifestInline(archetypeSeeds, "archetype")}
Item IDs available for starting equipment: ${formatItemManifest(worldSeed.itemSeeds || [], true)}
Location IDs: ${formatManifestInline(worldSeed.locationSeeds || [], "location")}

IMPORTANT: Use the archetype IDs above as-is. Reference item IDs from the manifest for startingItems arrays.

Output a JSON object:
{
  "archetypes": [
    {
      "id": "archetype:slug-name",
      "name": "Archetype Name",
      "tagline": "One-line concept — what they DO at the table",
      "description": "2-3 sentences describing the archetype",
      "visualDescription": "One sentence physical appearance for image generation",
      "starting": {
        "abilities": { "STR": 0, "AGI": 0, "WIT": 0, "CON": 0 },
        "hp": 10,
        "maxHp": 10
      },
      "startingItems": ["item:weapon-id", "item:armor-id", "item:gear-id"],
      "features": [
        { "id": "feature:feature-id", "name": "Feature Name", "description": "What it does — include trigger and any cost or limit" }
      ],
      "playstyle": "How to play this archetype effectively",
      "background": "Lore and backstory for this archetype",
      "flavor": "Short motto, signature phrase, or in-world saying about this archetype. Distinct from tagline — what the archetype says about themselves."
    }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "{ archetypes: WorldArchetype[] }",
      },
      stepId,
      message: `Archetype generation initiated for ${count} archetypes. Execute the prompt and call save_generation_result.`,
    };
  },
});
