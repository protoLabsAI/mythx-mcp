/**
 * NPC Generation Tool (Shared)
 *
 * Generates NPCs based on the world seed.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldRulesConfig } from "@mythxengine/types";
import { buildRulesPromptSection } from "./rules-prompt.js";
import { formatManifestList, formatManifestInline } from "./manifest-helpers.js";

export const GenerateNPCsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .describe("Number of NPCs to generate (default: from world seed)"),
  focusOn: z.array(z.string()).optional().describe("Specific NPC seeds to focus on (by name)"),
});

export type GenerateNPCsInput = z.infer<typeof GenerateNPCsInputSchema>;

export interface GenerateNPCsOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForNPCs {
  name: string;
  tagline: string;
  aesthetic: { tone: string; themes: string[] };
  coreConflict: string;
  npcSeeds: Array<{ id?: string; name: string; concept: string }>;
  locationSeeds: Array<{ id?: string; name: string; concept: string }>;
  rules?: WorldRulesConfig;
}

export const generateNPCsTool = defineSharedTool({
  name: "generate_npcs",
  description: "Generate NPCs based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateNPCsInputSchema,

  handler: async (input, ctx): Promise<GenerateNPCsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "npcs" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForNPCs;

    const stepId = randomUUID();
    const npcSeeds = input.focusOn
      ? worldSeed.npcSeeds.filter((n) => input.focusOn!.includes(n.name))
      : worldSeed.npcSeeds;
    const count = input.count || npcSeeds.length;

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "npcs",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    // Build rules section from seed (uses defaults if no custom rules)
    const rulesSection = buildRulesPromptSection(worldSeed.rules);

    const systemPrompt = `You are an NPC designer for tabletop RPGs. Create memorable characters with clear motivations that drive interesting interactions.

${rulesSection}

### NPC Design Guidelines
- Each NPC needs a clear narrative role (quest_giver, ally, obstacle, information, antagonist, merchant, background)
- Personality should be distinct and easy to roleplay
- Motivation drives their actions and creates hooks
- Dialogue hints help GMs voice the character
- Include where they can be found (location IDs)
- Relationships create webs of intrigue
- Secrets add depth and discovery opportunities
- Include a visualDescription: one sentence describing their shoulders-up appearance — face, expression, clothing, distinguishing features. Used for portrait generation.

Output valid JSON only.`;

    const userPrompt = `Generate ${count} NPCs for this world:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Core Conflict: ${worldSeed.coreConflict}

NPC seeds to develop:
${npcSeeds
  .slice(0, count)
  .map((n, i) => `${i + 1}. ${n.name}: ${n.concept}`)
  .join("\n")}

Locations where NPCs might be found:
${worldSeed.locationSeeds.map((l) => `- ${l.name}: ${l.concept}`).join("\n")}

Output a JSON object:
{
  "npcs": [
    {
      "id": "npc:slug-name",
      "name": "NPC Name",
      "description": "Physical description and role",
      "visualDescription": "One sentence physical appearance for image generation",
      "personality": "Key personality traits and quirks",
      "motivation": {
        "want": "Conscious goal they pursue at the table — what they ARE doing",
        "fear": "What they're avoiding — the source of their resistance",
        "lie": "False belief they hold — exploitable by perceptive PCs"
      },
      "attitude": "friendly|neutral|hostile|unknown",
      "dialogueHints": [
        "A specific phrase or direct quote — what the GM says at the table, not voice notes",
        "A topic that unlocks information they'd otherwise withhold",
        "Another concrete dialogue beat. Minimum 2."
      ],
      "narrativeRole": "quest_giver|ally|obstacle|information|antagonist|merchant|background",
      "locations": ["location:where-they-can-be-found"],
      "relationships": {
        "npc:other-npc-id": "Narrative tie — power asymmetry, debt, shared secret, rivalry. NOT just 'connected' or 'allied'."
      },
      "secrets": ["Hidden information that changes the situation if revealed"]
    }
  ]
}

ID Manifest (use these exact IDs):
NPC IDs: ${formatManifestList(npcSeeds.slice(0, count), "npc")}
Location IDs for placement: ${formatManifestInline(worldSeed.locationSeeds, "location")}
Other NPC IDs for relationships: ${formatManifestInline(worldSeed.npcSeeds, "npc")}

IMPORTANT: Use the NPC IDs above as-is. Reference location IDs for the locations[] array. Reference other NPC IDs in the relationships{} object.

Notes:
- Mix narrative roles for variety
- Create relationship connections between NPCs
- Secrets are optional but add depth
- Dialogue hints should make the NPC easy to voice

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "WorldNPC[]",
      },
      stepId,
      message: `NPC generation initiated for ${count} NPCs. Execute the prompt and call save_generation_result.`,
    };
  },
});
