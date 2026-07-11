/**
 * Location Expansion Tool
 *
 * Expands a location with additional detail.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import type { MCPToolEntry } from "@mythxengine/types";
import { sessionManager } from "../../state/manager.js";

const ExpandLocationInput = z.object({
  sessionId: z.string(),
  locationId: z.string().describe("ID of the location to expand"),
});

/**
 * expand_location tool
 */
export const expandLocationTool: MCPToolEntry = {
  name: "expand_location",
  description:
    "Expand a location with additional detail (areas, random encounters, treasure). Returns a prompt for LLM execution.",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Session ID" },
      locationId: { type: "string", description: "ID of the location to expand" },
    },
    required: ["sessionId", "locationId"],
  },
  handler: async (args: unknown) => {
    const input = ExpandLocationInput.parse(args);

    const session = await sessionManager.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    const worldSeed = session.generation.worldSeed as {
      name: string;
      aesthetic: { visualStyle: string; tone: string };
      settings: { lethality: string; supernaturalPresence: string };
    };

    // Find the location
    const locations = session.generation.generatedContent.locations as Array<{ id: string }>;
    const location = locations.find((l) => l.id === input.locationId) as
      | {
          id: string;
          name: string;
          description: string;
          type: string;
          atmosphere: string;
          features: string[];
        }
      | undefined;

    if (!location) {
      throw new Error(`Location not found: ${input.locationId}`);
    }

    // Check if already expanded
    const expandedLocations = session.generation.expansions.locations as Array<{ id: string }>;
    const alreadyExpanded = expandedLocations.find((l) => l.id === input.locationId);
    if (alreadyExpanded) {
      throw new Error(`Location already expanded: ${input.locationId}`);
    }

    const stepId = randomUUID();

    // Get available encounters for random encounter table
    const encounters = session.generation.generatedContent.encounters as Array<{
      id: string;
      name: string;
      type: string;
    }>;

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "expand_location",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "expanding";
    await sessionManager.save(session);

    const systemPrompt = `You are expanding a location for a tabletop RPG. Add detailed areas, random encounters, and treasure while maintaining consistency with the existing description.

Rules:
- Areas should be distinct sub-locations within the main location
- Random encounters use weights (higher = more likely) totaling roughly 100
- Treasure should fit the location type and world tone
- Maintain the established atmosphere and features

Output valid JSON only.`;

    const userPrompt = `Expand this location with additional detail:

World: ${worldSeed.name}
Visual Style: ${worldSeed.aesthetic.visualStyle}
Tone: ${worldSeed.aesthetic.tone}
Lethality: ${worldSeed.settings.lethality}

Location to expand:
- ID: ${location.id}
- Name: ${location.name}
- Type: ${location.type}
- Description: ${location.description}
- Atmosphere: ${location.atmosphere}
- Features: ${location.features.join(", ")}

Available encounters for random table:
${encounters.map((e) => `- ${e.id}: ${e.name} (${e.type})`).join("\n")}

Output a JSON object with the expanded location (include ALL original fields plus new ones):
{
  "expandedLocation": {
    "id": "${location.id}",
    "name": "${location.name}",
    "description": "${location.description}",
    "type": "${location.type}",
    "atmosphere": "${location.atmosphere}",
    "features": ${JSON.stringify(location.features)},
    "connections": [],
    "encounters": [],
    "npcs": [],
    "secrets": [],
    "gmNotes": "",
    "areas": [
      {
        "name": "Area Name",
        "description": "What this sub-area looks like and contains",
        "features": ["Notable thing 1", "Notable thing 2"]
      }
    ],
    "randomEncounters": [
      {
        "weight": 30,
        "encounterId": "encounter:id-from-list"
      }
    ],
    "treasure": [
      "Description of findable treasure or loot"
    ]
  }
}

Notes:
- Add 2-4 distinct areas
- Include 3-5 random encounters with weights
- Add 2-4 treasure items appropriate to the location
- Keep original fields intact

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "ExpandedLocation",
      },
      stepId,
      message: `Location expansion initiated for ${location.name}. Execute the prompt and call save_generation_result.`,
    };
  },
};

export const expandLocationTools = [expandLocationTool];
