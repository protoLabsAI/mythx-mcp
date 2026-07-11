/**
 * Situation Generation Tool (Shared)
 *
 * Generates situations (nodes) for Alexandrian-style node-based scenario design.
 * Each situation represents a set of circumstances that will change without PC intervention.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import { formatManifestList, getRecommendedCount, type WorldTier } from "./manifest-helpers.js";

export const GenerateSituationsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .describe("Number of situations to generate (default: from world seed or 5)"),
  focusOn: z
    .array(z.string())
    .optional()
    .describe("Specific situation seeds to focus on (by name)"),
});

export type GenerateSituationsInput = z.infer<typeof GenerateSituationsInputSchema>;

export interface GenerateSituationsOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForSituations {
  name: string;
  tagline: string;
  aesthetic: { tone: string; themes: string[] };
  coreConflict: string;
  situationSeeds?: Array<{ id?: string; name: string; concept: string; urgency?: string }>;
  npcSeeds: Array<{ id?: string; name: string; concept: string }>;
  locationSeeds: Array<{ id?: string; name: string; concept: string }>;
}

export const generateSituationsTool = defineSharedTool({
  name: "generate_situations",
  description:
    "Generate situations (nodes) based on the world seed using Alexandrian node-based design. Returns a prompt for LLM execution. Can generate all at once or one at a time using count=1 with focusOn for better parallelism.",
  inputSchema: GenerateSituationsInputSchema,

  handler: async (input, ctx): Promise<GenerateSituationsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "situations" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForSituations;

    // Get existing content for references
    const existingNpcs = session.generation.generatedContent.npcs as Array<{
      id: string;
      name: string;
    }>;
    const existingLocations = session.generation.generatedContent.locations as Array<{
      id: string;
      name: string;
    }>;

    const stepId = randomUUID();
    const tier = (session.generation.tier || "medium") as WorldTier;
    const situationSeeds =
      input.focusOn && worldSeed.situationSeeds
        ? worldSeed.situationSeeds.filter((s) => input.focusOn!.includes(s.name))
        : worldSeed.situationSeeds || [];
    const count = input.count || situationSeeds.length || getRecommendedCount("situations", tier);

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "situations",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    const systemPrompt = `You are a scenario designer for tabletop RPGs, expert in The Alexandrian's node-based scenario design.

You create SITUATIONS - dynamic circumstances that will change without PC intervention. Each situation is a node in a navigable network connected by LEADS (clues that point to other situations).

Key Principles:
1. THREE CLUE RULE: Each important situation should have at least 3 ways to discover it
2. PROACTIVE ELEMENTS: Include clocks showing what happens if PCs don't act
3. LEADS AS EDGES: Connect situations with discoverable information
4. SITUATIONS NOT PLOTS: Describe circumstances, not predetermined events

Output valid JSON only.`;

    const npcList =
      existingNpcs.length > 0
        ? `\nExisting NPCs (use these IDs):\n${existingNpcs.map((n) => `- ${n.id}: ${n.name}`).join("\n")}`
        : `\nNPC seeds (create IDs like "npc:slug-name"):\n${worldSeed.npcSeeds.map((n) => `- ${n.name}: ${n.concept}`).join("\n")}`;

    const locationList =
      existingLocations.length > 0
        ? `\nExisting Locations (use these IDs):\n${existingLocations.map((l) => `- ${l.id}: ${l.name}`).join("\n")}`
        : `\nLocation seeds (create IDs like "location:slug-name"):\n${worldSeed.locationSeeds.map((l) => `- ${l.name}: ${l.concept}`).join("\n")}`;

    const userPrompt = `Generate ${count} interconnected situations for this world:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Core Conflict: ${worldSeed.coreConflict}

${
  situationSeeds.length > 0
    ? `Situation seeds to develop:\n${situationSeeds
        .slice(0, count)
        .map(
          (s, i) =>
            `${i + 1}. ${s.name}: ${s.concept}${s.urgency ? ` (urgency: ${s.urgency})` : ""}`
        )
        .join("\n")}`
    : "Create situations that explore the core conflict from different angles."
}
${npcList}
${locationList}

ID Manifest (use these exact entity IDs):
NPC IDs:
${formatManifestList(worldSeed.npcSeeds, "npc")}
Location IDs:
${formatManifestList(worldSeed.locationSeeds, "location")}

IMPORTANT: Use NPC IDs from the manifest in actors[].entityId. Use location IDs in locations.primary[] and locations.related[]. For outgoingLeads[].targetSituationId, use situation IDs you define in this batch (e.g., situation:slug-name).

Output a JSON object:
{
  "situations": [
    {
      "id": "situation:slug-name",
      "name": "Situation Name",
      "description": "What's happening and why it matters",
      "status": "brewing",

      "stakes": {
        "risks": ["What could go wrong"],
        "opportunities": ["What could be gained"],
        "primaryVictim": "Who suffers if ignored (optional)",
        "ifIgnored": "What happens without PC intervention"
      },

      "actors": [
        {
          "entityId": "npc:entity-id or faction:id",
          "agenda": "What they want",
          "leverage": "Their power/resources",
          "defaultAction": {
            "now": "Their next-round move — concrete, observable, ready to play",
            "ifIgnored1Step": "Escalation if PCs don't engage this turn",
            "ifIgnored2Steps": "Further escalation if PCs continue to ignore them"
          },
          "isPrimaryAntagonist": true
        }
      ],

      "locations": {
        "primary": ["location:main-location"],
        "related": ["location:secondary"],
        "details": {
          "location:main-location": "Location-specific context"
        }
      },

      "clock": {
        "id": "clock:situation-name",
        "name": "Clock Name",
        "doom": "What the clock counts toward at the final stage",
        "pauseCondition": "What concrete player action stops, reverses, or resets this clock — the lever the players can pull. Required.",
        "stages": [
          {
            "id": "stage-1",
            "name": "Stage Name",
            "description": "What happens",
            "trigger": {
              "type": "time",
              "minutesFromStart": 1440
            },
            "consequences": {
              "setFlags": ["flag-name"],
              "narrative": "Description of what changes"
            },
            "reversible": true
          }
        ],
        "currentStage": null,
        "startedAt": null,
        "paused": false
      },

      "outgoingLeads": [
        {
          "id": "lead:source-to-target-method",
          "information": "What the lead reveals",
          "targetSituationId": "situation:target-id",
          "discovery": {
            "method": "npc|location|investigation|observation|document|consequence|rumor|item",
            "sourceId": "npc:or-location:id",
            "description": "How to find this lead"
          },
          "prominence": "obvious|available|hidden|obscured"
        }
      ],

      "entryPoints": {
        "incomingLeadIds": [],
        "directDiscovery": [
          {
            "method": "Observation",
            "description": "How PCs can stumble upon this",
            "locationId": "location:where"
          }
        ],
        "minimumLeadsTarget": 3
      },

      "complications": [
        {
          "id": "comp-1",
          "description": "What makes this hard",
          "type": "obstacle|opposition|moral|resource|time|information|relationship",
          "resolutions": ["Possible way to resolve"]
        }
      ],

      "outcomes": {
        "victory": {
          "description": "Full success",
          "consequences": ["What changes"],
          "flagsSet": ["victory-flag"]
        },
        "failure": {
          "description": "Complete failure",
          "consequences": ["What goes wrong"],
          "flagsSet": ["failure-flag"]
        },
        "partial": [
          {
            "name": "Partial Success",
            "description": "Mixed outcome",
            "consequences": ["Some good, some bad"],
            "flagsSet": ["partial-flag"]
          }
        ]
      },

      "gmGuidance": {
        "themes": ["Thematic elements"],
        "toneNotes": "How to run this",
        "anticipatedApproaches": [
          {
            "approach": "Players might try...",
            "response": "NPCs/world responds by..."
          }
        ],
        "foreshadowing": ["Hints to drop earlier"]
      },

      "tags": ["tag1", "tag2"],
      "layer": 1
    }
  ]
}

IMPORTANT:
- Create leads that connect situations to each other
- Ensure each situation has at least 3 entry points (leads + direct discovery)
- Include clocks for time-sensitive situations
- Vary discovery methods and prominence levels
- Connect actors to NPCs and locations

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "WorldSituation[]",
      },
      stepId,
      message: `Situation generation initiated for ${count} situations. Execute the prompt and call save_generation_result.`,
    };
  },
});
