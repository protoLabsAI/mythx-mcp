/**
 * Archetype Expansion Tool
 *
 * Expands an archetype with additional detail.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import type { MCPToolEntry } from "@mythxengine/types";
import { sessionManager } from "../../state/manager.js";

const ExpandArchetypeInput = z.object({
  sessionId: z.string(),
  archetypeId: z.string().describe("ID of the archetype to expand"),
});

/**
 * expand_archetype tool
 */
export const expandArchetypeTool: MCPToolEntry = {
  name: "expand_archetype",
  description:
    "Expand an archetype with additional detail (skill progression, party role, RP hooks). Returns a prompt for LLM execution.",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Session ID" },
      archetypeId: { type: "string", description: "ID of the archetype to expand" },
    },
    required: ["sessionId", "archetypeId"],
  },
  handler: async (args: unknown) => {
    const input = ExpandArchetypeInput.parse(args);

    const session = await sessionManager.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    const worldSeed = session.generation.worldSeed as {
      name: string;
      aesthetic: { tone: string; themes: string[] };
      coreConflict: string;
    };

    // Find the archetype
    const archetypes = session.generation.generatedContent.archetypes as Array<{ id: string }>;
    const archetype = archetypes.find((a) => a.id === input.archetypeId) as
      | {
          id: string;
          name: string;
          tagline: string;
          description: string;
          starting: { abilities: Record<string, number>; hp: number; maxHp: number };
          startingItems: string[];
          features: Array<{ id: string; name: string; description: string }>;
          playstyle: string;
          background: string;
          flavor: string;
        }
      | undefined;

    if (!archetype) {
      throw new Error(`Archetype not found: ${input.archetypeId}`);
    }

    // Check if already expanded
    const expandedArchetypes = session.generation.expansions.archetypes as Array<{ id: string }>;
    const alreadyExpanded = expandedArchetypes.find((a) => a.id === input.archetypeId);
    if (alreadyExpanded) {
      throw new Error(`Archetype already expanded: ${input.archetypeId}`);
    }

    const stepId = randomUUID();

    // Get other archetypes for party role context
    const otherArchetypes = (
      session.generation.generatedContent.archetypes as Array<{
        id: string;
        name: string;
        tagline: string;
      }>
    ).filter((a) => a.id !== input.archetypeId);

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "expand_archetype",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "expanding";
    await sessionManager.save(session);

    const systemPrompt = `You are expanding a character archetype for a tabletop RPG. Add skill progression, party role guidance, and roleplay hooks while maintaining the archetype's established identity.

Rules:
- Skill progression should show natural character growth
- Party role explains how this archetype works with others
- Roleplay hooks give players story threads to explore
- Suggested traits help players quickly get into character

Output valid JSON only.`;

    const userPrompt = `Expand this archetype with additional detail:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Core Conflict: ${worldSeed.coreConflict}

Archetype to expand:
- ID: ${archetype.id}
- Name: ${archetype.name}
- Tagline: ${archetype.tagline}
- Description: ${archetype.description}
- Starting Abilities: ${JSON.stringify(archetype.starting.abilities)}
- HP: ${archetype.starting.hp}
- Features: ${archetype.features.map((f) => f.name).join(", ")}
- Playstyle: ${archetype.playstyle}
- Background: ${archetype.background}

Other archetypes in the world (for party role context):
${otherArchetypes.map((a) => `- ${a.name}: ${a.tagline}`).join("\n")}

Output a JSON object with the expanded archetype (include ALL original fields plus new ones):
{
  "expandedArchetype": {
    "id": "${archetype.id}",
    "name": "${archetype.name}",
    "tagline": "${archetype.tagline}",
    "description": "${archetype.description}",
    "starting": ${JSON.stringify(archetype.starting)},
    "startingItems": ${JSON.stringify(archetype.startingItems)},
    "features": ${JSON.stringify(archetype.features)},
    "playstyle": "${archetype.playstyle}",
    "background": "${archetype.background}",
    "flavor": "${archetype.flavor}",
    "skillProgression": [
      {
        "level": 1,
        "skills": ["Starting skill focus areas"]
      },
      {
        "level": 3,
        "skills": ["Mid-game skill development"]
      },
      {
        "level": 5,
        "skills": ["Advanced skill mastery"]
      }
    ],
    "partyRole": "How this archetype contributes to a party and synergizes with others",
    "roleplayHooks": [
      "A personal quest or goal",
      "A relationship or bond to explore",
      "A flaw that creates drama",
      "A secret or mystery"
    ],
    "suggestedTraits": [
      "A personality trait that fits",
      "A quirk or habit",
      "A value or belief",
      "A fear or weakness"
    ]
  }
}

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "ExpandedArchetype",
      },
      stepId,
      message: `Archetype expansion initiated for ${archetype.name}. Execute the prompt and call save_generation_result.`,
    };
  },
};

export const expandArchetypeTools = [expandArchetypeTool];
