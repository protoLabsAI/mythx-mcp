/**
 * Narrative Generation Tool (Shared)
 *
 * Generates narrative guidance based on the world seed.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";

export const GenerateNarrativeInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type GenerateNarrativeInput = z.infer<typeof GenerateNarrativeInputSchema>;

export interface GenerateNarrativeOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForNarrative {
  name: string;
  tagline: string;
  aesthetic: { tone: string; themes: string[] };
  coreConflict: string;
  archetypeSeeds: Array<{ name: string; concept: string }>;
  locationSeeds: Array<{ name: string; concept: string }>;
  npcSeeds: Array<{ name: string; concept: string }>;
}

export const generateNarrativeTool = defineSharedTool({
  name: "generate_narrative",
  description:
    "Generate narrative guidance (opening scenes, plot hooks, conflicts) based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateNarrativeInputSchema,

  handler: async (input, ctx): Promise<GenerateNarrativeOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed or in progress
    const existingStep = session.generation.history.find(
      (s) => s.type === "narrative" && (s.status === "completed" || s.status === "in_progress")
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForNarrative;

    const stepId = randomUUID();

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "narrative",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    const systemPrompt = `You are a narrative designer for tabletop RPGs. Create guidance that helps GMs and AI run compelling sessions in this world.

Focus on:
- Opening scenes that immediately establish tone and hook players
- Plot hooks that connect to the core conflict
- Common conflicts that arise naturally from the world
- Resolution patterns that fit the world's tone

Output valid JSON only.`;

    const userPrompt = `Generate narrative guidance for this world:

World: ${worldSeed.name}
Tagline: ${worldSeed.tagline}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Core Conflict: ${worldSeed.coreConflict}

Archetypes:
${worldSeed.archetypeSeeds.map((a) => `- ${a.name}: ${a.concept}`).join("\n")}

Key Locations:
${worldSeed.locationSeeds.map((l) => `- ${l.name}: ${l.concept}`).join("\n")}

Important NPCs:
${worldSeed.npcSeeds.map((n) => `- ${n.name}: ${n.concept}`).join("\n")}

Output a JSON object:
{
  "narrative": {
    "openingScenes": [
      "A vivid opening scene description that establishes tone",
      "Another possible opening with different focus",
      "A third option for variety"
    ],
    "plotHooks": [
      "A hook that connects to the core conflict",
      "A hook involving key NPCs",
      "A hook tied to a specific location",
      "A personal hook for player characters",
      "A mysterious hook with unanswered questions"
    ],
    "commonConflicts": [
      "A type of conflict that arises naturally",
      "Another common source of tension",
      "A recurring challenge players will face",
      "An internal conflict characters might struggle with"
    ],
    "resolutionPatterns": [
      "How victories typically look in this world",
      "What partial successes might mean",
      "How failures manifest and their consequences",
      "Bittersweet outcomes that fit the tone"
    ]
  }
}

Notes:
- Opening scenes should be read-aloud quality
- Plot hooks should be immediately actionable
- Conflicts should feel organic to the world
- Resolution patterns should guide GM expectations

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "NarrativeGuidance",
      },
      stepId,
      message: `Narrative guidance generation initiated. Execute the prompt and call save_generation_result.`,
    };
  },
});
