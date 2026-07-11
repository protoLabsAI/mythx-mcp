/**
 * Item Generation Tool (Shared)
 *
 * Generates items based on the world seed.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldRulesConfig } from "@mythxengine/types";
import { buildRulesPromptSection } from "./rules-prompt.js";
import {
  formatItemManifest,
  formatManifestInline,
  getRecommendedCount,
  type WorldTier,
} from "./manifest-helpers.js";

export const GenerateItemsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z.number().min(1).max(50).optional().default(20).describe("Number of items to generate"),
  kinds: z
    .array(z.enum(["weapon", "armor", "consumable", "special", "misc"]))
    .min(1)
    .optional()
    .default(["weapon", "armor", "consumable", "special", "misc"])
    .describe("Item kinds to include (at least one required)"),
});

export type GenerateItemsInput = z.infer<typeof GenerateItemsInputSchema>;

export interface GenerateItemsOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForItems {
  name: string;
  tagline: string;
  aesthetic: { visualStyle: string; tone: string; themes: string[] };
  settings: { lethality: string; magicLevel: string; technologyLevel: string };
  archetypeSeeds: Array<{ id?: string; name: string; concept: string }>;
  itemSeeds?: Array<{ id: string; name: string; kind: string }>;
  rules?: WorldRulesConfig;
}

export const generateItemsTool = defineSharedTool({
  name: "generate_items",
  description: "Generate items based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateItemsInputSchema,

  handler: async (input, ctx): Promise<GenerateItemsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "items" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForItems;

    const stepId = randomUUID();
    const tier = (session.generation.tier || "medium") as WorldTier;
    // Use tier-based recommended count if not explicitly provided, fall back to schema default
    const count = input.count ?? getRecommendedCount("items", tier);
    const kinds = input.kinds!;

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "items",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    // Build rules section from seed (uses defaults if no custom rules)
    const rulesSection = buildRulesPromptSection(worldSeed.rules);

    const systemPrompt = `You are an item designer for tabletop RPGs. Create thematic, useful items that fit the world and support different playstyles.

${rulesSection}

### Item Design Guidelines
- Weapons use damage dice (d4=light, d6=standard, d8=heavy, d10=two-handed, d12=devastating)
- Weapons specify which ability they use for attacks (reference the abilities above)
- Armor provides damage reduction (1=light, 2=medium, 3=heavy)
- Consumables have limited uses and clear effects
- Items should reference the world's technology level and aesthetic
- Include items that support each archetype's playstyle
- Include a visualDescription: one sentence describing the physical object — shape, material, color, distinguishing markings. Used for item art generation.

Output valid JSON only.`;

    // Calculate distribution
    const distribution: Record<string, number> = {};
    const perKind = Math.floor(count / kinds.length);
    const remainder = count % kinds.length;
    kinds.forEach((kind, i) => {
      distribution[kind] = perKind + (i < remainder ? 1 : 0);
    });

    const userPrompt = `Generate ${count} items for this world:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Technology Level: ${worldSeed.settings.technologyLevel}
Magic Level: ${worldSeed.settings.magicLevel}
Lethality: ${worldSeed.settings.lethality}

Archetypes that need equipment:
${worldSeed.archetypeSeeds.map((a) => `- ${a.name}: ${a.concept}`).join("\n")}

Item distribution:
${Object.entries(distribution)
  .map(([kind, n]) => `- ${kind}: ${n} items`)
  .join("\n")}

Output a JSON object:
{
  "items": [
    {
      "id": "item:slug-name",
      "name": "Item Name",
      "kind": "weapon|armor|consumable|special|misc",
      "description": "What the item is and does",
      "visualDescription": "One sentence physical appearance for image generation",
      "flavor": "One-line evocative line — provenance, rumor, threat, joke. NOT a rarity tier like 'Rare' or 'Epic'.",
      "tags": ["one-word keywords for filtering — at least 2"],
      "slots": 1,
      "weapon": {
        "damage": "d6",
        "ability": "STR|AGI|WIT|CON",
        "properties": ["optional", "tags"]
      },
      "armor": {
        "damageReduction": 1,
        "properties": ["optional", "tags"]
      },
      "consumable": {
        "uses": 1,
        "effect": "mechanical effect",
        "effectDescription": "narrative description"
      }
    }
  ]
}

ID Manifest (use these exact IDs):
Item IDs: ${formatItemManifest(worldSeed.itemSeeds || [])}
Archetype IDs (items should support these classes): ${formatManifestInline(worldSeed.archetypeSeeds, "archetype")}

IMPORTANT: Use the item IDs above as-is. Each item must use its pre-allocated ID.

Notes:
- Include weapon object only for weapons
- Include armor object only for armor
- Include consumable object only for consumables
- special and misc items have no subtype objects

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "{ items: WorldItem[] }",
      },
      stepId,
      message: `Item generation initiated for ${count} items. Execute the prompt and call save_generation_result.`,
    };
  },
});
