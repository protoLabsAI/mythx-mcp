/**
 * Condition Generation Tool (Shared)
 *
 * Generates status effects/conditions tied to monsters and environments.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";

export const GenerateConditionsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(8)
    .describe("Number of conditions to generate"),
});

export type GenerateConditionsInput = z.infer<typeof GenerateConditionsInputSchema>;

export interface GenerateConditionsOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForConditions {
  name: string;
  tagline: string;
  aesthetic: { visualStyle: string; tone: string; themes: string[] };
  settings: { lethality: string; magicLevel: string; supernaturalPresence: string };
  coreConflict: string;
  monsterSeeds: Array<{ id?: string; name: string; concept: string; threat: string }>;
  locationSeeds?: Array<{ id?: string; name: string; concept: string }>;
}

export const generateConditionsTool = defineSharedTool({
  name: "generate_conditions",
  description:
    "Generate status effects and conditions based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateConditionsInputSchema,

  handler: async (input, ctx): Promise<GenerateConditionsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed or in progress
    const existingStep = session.generation.history.find(
      (s) => s.type === "conditions" && (s.status === "completed" || s.status === "in_progress")
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForConditions;

    const stepId = randomUUID();
    const count = input.count;

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "conditions",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    const systemPrompt = `You are a status effect designer for tabletop RPGs. Create conditions that are thematic, mechanically interesting, and tied to the world's monsters, environments, and magic.

Design Guidelines:
- Create a mix of combat, environmental, magical, and social conditions
- Each condition should have clear mechanical effects and a cure method
- Severity should match the condition's impact on gameplay
- Sources should reference monsters or locations from the world
- Duration types: "rounds" (combat), "minutes" (short-term), "hours" (long-term), "permanent" (until cured), "until-cured" (requires specific action)

Severity Guidelines:
- minor: Inconvenient but manageable (-1 penalties, minor damage)
- moderate: Significantly impacts effectiveness (-2 penalties, ongoing damage, limited actions)
- severe: Potentially debilitating (-3+ penalties, major restrictions, serious damage)

Output valid JSON only.`;

    const userPrompt = `Generate ${count} conditions for this world:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Visual Style: ${worldSeed.aesthetic.visualStyle}
Core Conflict: ${worldSeed.coreConflict}
Lethality: ${worldSeed.settings.lethality}
Magic Level: ${worldSeed.settings.magicLevel}
Supernatural Presence: ${worldSeed.settings.supernaturalPresence}

Monsters in the world (for source references):
${worldSeed.monsterSeeds.map((m, i) => `${i + 1}. ${m.name} (${m.threat}): ${m.concept}`).join("\n")}

Locations in the world (for source references):
${worldSeed.locationSeeds?.map((l, i) => `${i + 1}. ${l.name}: ${l.concept}`).join("\n") || "none available"}

Monster IDs for source references: ${worldSeed.monsterSeeds.map((s) => `${s.id || `monster:${s.name.toLowerCase().replace(/\s+/g, "-")}`}: ${s.name}`).join(", ")}
Location IDs for source references: ${worldSeed.locationSeeds?.map((s) => `${s.id || `location:${s.name.toLowerCase().replace(/\s+/g, "-")}`}: ${s.name}`).join(", ") || "none available"}

Create a variety of conditions across these categories:
- Combat conditions (poisoned, blinded, stunned, grappled, etc.)
- Environmental conditions (specific to the world's locations and climate)
- Magical conditions (curses, enchantments, wards — matching the magic level)
- Social conditions (intimidated, charmed, suspicious — for non-combat encounters)

Output a JSON object:
{
  "conditions": [
    {
      "id": "condition:slug-name",
      "name": "Condition Name",
      "description": "What this condition does narratively",
      "mechanics": "Mechanical effect (e.g., -2 to AGI checks, d4 damage per round)",
      "duration": "rounds|minutes|hours|permanent|until-cured",
      "severity": "minor|moderate|severe",
      "cure": "How to remove it",
      "sources": ["monster:id-that-inflicts", "location:id-where-it-occurs"]
    }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "{ conditions: WorldCondition[] }",
      },
      stepId,
      message: `Condition generation initiated for ${count} conditions. Execute the prompt and call save_generation_result.`,
    };
  },
});
