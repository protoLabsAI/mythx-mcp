/**
 * Faction Generation Tool (Shared)
 *
 * Generates formal faction objects with relationships, resources, and territory.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";

export const GenerateFactionsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z.number().min(1).max(10).optional().default(3).describe("Number of factions to generate"),
});

export type GenerateFactionsInput = z.infer<typeof GenerateFactionsInputSchema>;

export interface GenerateFactionsOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForFactions {
  name: string;
  tagline: string;
  aesthetic: { visualStyle: string; tone: string; themes: string[] };
  settings: { lethality: string; magicLevel: string; supernaturalPresence: string };
  coreConflict: string;
  npcSeeds?: Array<{ id?: string; name: string; concept: string }>;
  locationSeeds?: Array<{ id?: string; name: string; concept: string }>;
}

export const generateFactionsTool = defineSharedTool({
  name: "generate_factions",
  description:
    "Generate factions with relationships, resources, and territory based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateFactionsInputSchema,

  handler: async (input, ctx): Promise<GenerateFactionsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed or in progress
    const existingStep = session.generation.history.find(
      (s) => s.type === "factions" && (s.status === "completed" || s.status === "in_progress")
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForFactions;

    const stepId = randomUUID();
    const count = input.count;

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "factions",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    const systemPrompt = `You are a faction designer for tabletop RPGs. Create factions that drive political intrigue, provide quest hooks, and create meaningful choices for players.

Design Guidelines:
- Each faction should have clear goals that may conflict with other factions
- Relationships between factions should create tension and opportunities
- Territory should reference locations from the world
- Key members should reference NPCs from the world
- Hooks should give GMs concrete adventure seeds
- Secrets should provide revelations for players to discover
- Factions should be interconnected — their relationships form a web of alliances and rivalries
- Include a visualDescription: one sentence describing their visual identity — banner colors, emblem, symbols, typical dress. Used for banner image generation.

Relationship Attitudes:
- hostile: Open conflict or war
- unfriendly: Distrust and competition
- neutral: No strong feelings either way
- friendly: Cooperation on shared interests
- allied: Strong partnership or shared cause

Output valid JSON only.`;

    const userPrompt = `Generate ${count} factions for this world:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Visual Style: ${worldSeed.aesthetic.visualStyle}
Core Conflict: ${worldSeed.coreConflict}
Lethality: ${worldSeed.settings.lethality}
Magic Level: ${worldSeed.settings.magicLevel}
Supernatural Presence: ${worldSeed.settings.supernaturalPresence}

NPCs in the world (for key member references):
${worldSeed.npcSeeds?.map((n, i) => `${i + 1}. ${n.name}: ${n.concept}`).join("\n") || "none available"}

Locations in the world (for territory references):
${worldSeed.locationSeeds?.map((l, i) => `${i + 1}. ${l.name}: ${l.concept}`).join("\n") || "none available"}

NPC IDs for key member references: ${worldSeed.npcSeeds?.map((s) => `${s.id || `npc:${s.name.toLowerCase().replace(/\s+/g, "-")}`}: ${s.name}`).join(", ") || "none available"}
Location IDs for territory references: ${worldSeed.locationSeeds?.map((s) => `${s.id || `location:${s.name.toLowerCase().replace(/\s+/g, "-")}`}: ${s.name}`).join(", ") || "none available"}

IMPORTANT: Each faction should have relationships to OTHER factions you generate. Use the faction IDs you create.

Output a JSON object:
{
  "factions": [
    {
      "id": "faction:slug-name",
      "name": "Faction Name",
      "description": "What this faction is and does",
      "visualDescription": "One sentence visual identity — banner colors, emblem, symbols, typical dress",
      "goals": ["Primary goal", "Secondary goal"],
      "resources": ["What they have access to"],
      "territory": ["location:id-they-control"],
      "keyMembers": ["npc:id-of-important-members"],
      "relationships": {
        "faction:other-id": { "attitude": "hostile|unfriendly|neutral|friendly|allied", "reason": "Why" }
      },
      "hooks": ["Plot hook involving this faction"],
      "secrets": ["Hidden truth about the faction"]
    }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "{ factions: WorldFaction[] }",
      },
      stepId,
      message: `Faction generation initiated for ${count} factions. Execute the prompt and call save_generation_result.`,
    };
  },
});
