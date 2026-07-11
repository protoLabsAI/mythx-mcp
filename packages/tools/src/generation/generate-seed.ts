/**
 * World Seed Generation Tool (Shared)
 *
 * Creates the foundation for a new world from a campaign seed prompt.
 * Returns a prompt for LLM execution.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import {
  defineSharedTool,
  createEmptyGenerationSession,
  createEmptySession,
  type WorldRulesConfig,
} from "@mythxengine/types";
import { WorldRulesConfigSchema } from "@mythxengine/worlds";
import { buildRulesPromptSection } from "./rules-prompt.js";
import { tierContentCounts } from "./manifest-helpers.js";

/**
 * Input schema for generate_world_seed
 */
export const GenerateWorldSeedInputSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required").describe("Session ID"),
  campaignSeed: z
    .string()
    .min(1, "Campaign seed prompt is required")
    .describe(
      "The creative prompt for world generation (e.g., 'noir detective in a steampunk city')"
    ),
  tier: z
    .enum(["small", "medium", "large"])
    .optional()
    .default("medium")
    .describe(
      "World size: small (6 archetypes, 4 locations), medium (6 archetypes, 6 locations), large (6 archetypes, 10 locations)"
    ),
  settings: z
    .object({
      lethality: z.enum(["low", "medium", "high", "brutal"]).optional(),
      magicLevel: z.enum(["none", "rare", "common", "high"]).optional(),
      technologyLevel: z
        .enum(["primitive", "medieval", "renaissance", "industrial", "modern", "futuristic"])
        .optional(),
      supernaturalPresence: z.enum(["subtle", "common", "pervasive"]).optional(),
    })
    .optional()
    .describe("Optional world settings overrides"),
  rulesConfig: WorldRulesConfigSchema.optional().describe(
    "Optional rules configuration for custom abilities, mechanics, or tests"
  ),
});

export type GenerateWorldSeedInput = z.infer<typeof GenerateWorldSeedInputSchema>;

/**
 * Output type for generate_world_seed
 */
export interface GenerateWorldSeedOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  /** Recommended content counts based on the selected tier */
  recommendedCounts: Record<string, number>;
  alreadyCompleted?: boolean;
}

// Use the comprehensive tier counts from manifest-helpers
const tierCounts = tierContentCounts;

/**
 * Generate world seed tool definition
 */
export const generateWorldSeedTool = defineSharedTool({
  name: "generate_world_seed",
  description:
    "Create the foundation for a new world from a campaign seed prompt. Returns a prompt for LLM execution.",
  inputSchema: GenerateWorldSeedInputSchema,

  handler: async (input, ctx): Promise<GenerateWorldSeedOutput> => {
    let session = await ctx.sessions.get(input.sessionId);

    // Auto-create a generation session if one doesn't exist
    // This allows world gen to work without requiring a pre-existing session
    if (!session) {
      const newSession = createEmptySession(
        input.sessionId,
        `Generation: ${input.campaignSeed.slice(0, 50)}`
      );
      newSession.generation = createEmptyGenerationSession();
      await ctx.sessions.save(newSession);
      session = newSession;
      console.log(`[generate_world_seed] Auto-created generation session: ${input.sessionId}`);
    }

    // Initialize generation session if not present
    if (!session.generation) {
      session.generation = createEmptyGenerationSession();
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "seed" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        recommendedCounts: {},
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    // Check if already seeded
    if (session.generation.worldSeed) {
      throw new Error("World already seeded. Create a new session to generate a different world.");
    }

    // Check for concurrent seeding attempt
    if (session.generation.status === "seeding") {
      throw new Error(
        "World seeding already in progress. Wait for it to complete or create a new session."
      );
    }

    // Also check history for in-progress seed step (belt and suspenders)
    const inProgressSeed = session.generation.history.find(
      (step) => step.type === "seed" && step.status === "in_progress"
    );
    if (inProgressSeed) {
      throw new Error(
        `World seeding already in progress (step ${inProgressSeed.id}). Wait for it to complete.`
      );
    }

    const stepId = randomUUID();
    const tier = input.tier || "medium";
    const counts = tierCounts[tier];

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "seed",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "seeding";
    session.generation.tier = tier;
    await ctx.sessions.save(session);

    // Build the rules section for the prompt
    // Type assertion needed: Zod schema uses z.string() for ability in effects
    // to support custom abilities, while TypeScript types use strict AbilityName.
    // The function only uses data for string building, so the looser type is safe.
    const rulesSection = buildRulesPromptSection(input.rulesConfig as WorldRulesConfig | undefined);

    // Build the system prompt
    const systemPrompt = `You are a world-building expert for tabletop RPGs. You create compelling, internally consistent worlds that are immediately playable.

Your output must be valid JSON matching the WorldSeed schema. Focus on:
- Creating a unique, evocative world concept
- Establishing clear aesthetic and tonal guidelines
- Seeding interesting archetypes, locations, NPCs, and monsters
- Ensuring the core conflict drives gameplay

${rulesSection}`;

    // Build the user prompt
    const settingsOverrides = input.settings
      ? `

The user has specified these settings:
${input.settings.lethality ? `- Lethality: ${input.settings.lethality}` : ""}
${input.settings.magicLevel ? `- Magic Level: ${input.settings.magicLevel}` : ""}
${input.settings.technologyLevel ? `- Technology Level: ${input.settings.technologyLevel}` : ""}
${input.settings.supernaturalPresence ? `- Supernatural Presence: ${input.settings.supernaturalPresence}` : ""}
`
      : "";

    // Rules config JSON for inclusion in output (if provided)
    const rulesConfigJson = input.rulesConfig
      ? `\n  "rules": ${JSON.stringify(input.rulesConfig)},`
      : "";

    const userPrompt = `Create a world seed for this campaign concept:

<campaign_seed>
${input.campaignSeed}
</campaign_seed>

World size tier: ${tier}
- ${counts.archetypes} archetype seeds (name + brief concept)
- ${counts.locations} location seeds (name + brief concept)
- ${counts.npcs} NPC seeds (name + brief concept)
- ${counts.monsters} monster seeds (name + concept + threat tier)
- 15-20 item seeds covering weapons, armor, consumables, special items, and misc gear that fit the archetypes and world
${settingsOverrides}
Generate unique slugified IDs for all seed entities using the format \`type:slug-name\` (e.g., \`archetype:shadow-knight\`, \`location:iron-citadel\`). These IDs will be used by all subsequent generators for cross-referencing.

Output a JSON object with this structure:
{
  "id": "world-id-slug",
  "name": "World Name",
  "tagline": "One-line hook",
  "campaignSeed": ${JSON.stringify(input.campaignSeed)},
  "aesthetic": {
    "visualStyle": "Visual description",
    "tone": "Emotional tone",
    "themes": ["theme1", "theme2"],
    "inspirations": ["inspiration1", "inspiration2"]
  },
  "settings": {
    "lethality": "low|medium|high|brutal",
    "magicLevel": "none|rare|common|high",
    "technologyLevel": "primitive|medieval|renaissance|industrial|modern|futuristic",
    "supernaturalPresence": "subtle|common|pervasive"
  },${rulesConfigJson}
  "coreConflict": "Description of the central conflict",
  "archetypeSeeds": [{"id": "archetype:slug-name", "name": "Name", "concept": "Brief concept"}],
  "locationSeeds": [{"id": "location:slug-name", "name": "Name", "concept": "Brief concept"}],
  "npcSeeds": [{"id": "npc:slug-name", "name": "Name", "concept": "Brief concept"}],
  "monsterSeeds": [{"id": "monster:slug-name", "name": "Name", "concept": "Brief concept", "threat": "minion|standard|elite|boss"}],
  "itemSeeds": [{"id": "item:slug-name", "name": "Name", "kind": "weapon|armor|consumable|special|misc"}],
  "createdAt": "${new Date().toISOString()}"
}

Return ONLY the JSON object, no markdown formatting or explanation.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "WorldSeed",
      },
      stepId,
      recommendedCounts: counts,
      message: `World seed generation initiated for: "${input.campaignSeed}". Execute the prompt with an LLM and call save_generation_result with the output. Recommended content counts for ${tier} tier: ${JSON.stringify(counts)}`,
    };
  },
});
