/**
 * Arc Generation Tool (Shared)
 *
 * Generates story arcs that group related situations around a central tension.
 * Arcs provide structure for multi-session storylines.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import { formatManifestInline, getRecommendedCount, type WorldTier } from "./manifest-helpers.js";

export const GenerateArcsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe("Number of arcs to generate (default: from world seed or 2)"),
  focusOn: z.array(z.string()).optional().describe("Specific arc seeds to focus on (by name)"),
});

export type GenerateArcsInput = z.infer<typeof GenerateArcsInputSchema>;

export interface GenerateArcsOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForArcs {
  name: string;
  tagline: string;
  aesthetic: { tone: string; themes: string[] };
  coreConflict: string;
  arcSeeds?: Array<{ name: string; concept: string; structure?: string }>;
  situationSeeds?: Array<{ id?: string; name: string; concept: string; urgency?: string }>;
  npcSeeds: Array<{ id?: string; name: string; concept: string }>;
}

export const generateArcsTool = defineSharedTool({
  name: "generate_arcs",
  description:
    "Generate story arcs that group situations around central tensions. Returns a prompt for LLM execution.",
  inputSchema: GenerateArcsInputSchema,

  handler: async (input, ctx): Promise<GenerateArcsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "arcs" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForArcs;

    // Get existing situations for references - be defensive about undefined
    const existingSituations = (session.generation.generatedContent?.situations ?? []) as Array<{
      id: string;
      name: string;
      description: string;
      layer?: number;
    }>;

    // Get situation seeds from the world seed (pre-allocated IDs)
    const situationSeeds = worldSeed.situationSeeds || [];

    // Arcs can run in parallel with situations if the seed has pre-allocated situation IDs.
    // We need either existing generated situations OR situation seeds with IDs.
    if (existingSituations.length === 0 && situationSeeds.length === 0) {
      throw new Error(
        "No situations or situation seeds found. Either generate situations first, or ensure the world seed includes situation seeds with pre-allocated IDs."
      );
    }

    const stepId = randomUUID();
    const tier = (session.generation?.tier || "medium") as WorldTier;
    const arcSeeds =
      input.focusOn && worldSeed.arcSeeds
        ? worldSeed.arcSeeds.filter((a) => input.focusOn!.includes(a.name))
        : worldSeed.arcSeeds || [];
    const count = input.count || arcSeeds.length || getRecommendedCount("arcs", tier);

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "arcs",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    const systemPrompt = `You are a narrative architect for tabletop RPGs. You create story arcs that organize situations into meaningful campaigns.

An ARC groups related situations around a central tension. Arcs provide:
- Structure for pacing (funnel, layer-cake, hub-spoke, chain, web)
- Clear opposing forces and conflicts
- Resolution patterns for satisfying conclusions
- GM guidance for running the arc

Arc Structure Types:
- FUNNEL: Multiple entry points that narrow toward a single climax
- LAYER_CAKE: Situations unlock in layers (solve layer 1 to access layer 2)
- HUB_SPOKE: Central hub situation with satellite situations
- CHAIN: Linear progression from start to finish
- WEB: Interconnected without clear structure

Output valid JSON only.`;

    // Build situation reference section - use existing situations if available, fall back to seeds
    let situationSection: string;
    if (existingSituations.length > 0) {
      const situationList = existingSituations
        .map(
          (s) =>
            `- ${s.id}: ${s.name} - ${s.description.substring(0, 100)}...${s.layer !== undefined ? ` (layer ${s.layer})` : ""}`
        )
        .join("\n");
      situationSection = `Existing Situations to organize into arcs:\n${situationList}`;
    } else {
      // Use pre-allocated situation seed IDs for parallel generation
      const seedList = situationSeeds
        .map(
          (s) =>
            `- ${s.id || `situation:${s.name.toLowerCase().replace(/\\s+/g, "-")}`}: ${s.name} - ${s.concept}${s.urgency ? ` (urgency: ${s.urgency})` : ""}`
        )
        .join("\n");
      situationSection = `Situation seeds (use these pre-allocated IDs — situations are being generated in parallel):\n${seedList}\n\nIMPORTANT: Reference the situation IDs above in situationIds[] and structure fields. These situations are being generated concurrently.`;
    }

    const userPrompt = `Generate ${count} story arc(s) for this world:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Core Conflict: ${worldSeed.coreConflict}

${
  arcSeeds.length > 0
    ? `Arc seeds to develop:\n${arcSeeds
        .slice(0, count)
        .map(
          (a, i) =>
            `${i + 1}. ${a.name}: ${a.concept}${a.structure ? ` (structure: ${a.structure})` : ""}`
        )
        .join("\n")}`
    : "Create arcs that explore the core conflict from different angles."
}

${situationSection}

NPCs available for key roles:
${worldSeed.npcSeeds.map((n) => `- ${n.name}: ${n.concept}`).join("\n")}

ID Manifest:
NPC IDs: ${formatManifestInline(worldSeed.npcSeeds, "npc")}

IMPORTANT: Reference NPC IDs in gmGuidance.keyNpcs[]. For situationIds[], reference situation IDs that exist or will be generated.

Output a JSON object:
{
  "arcs": [
    {
      "id": "arc:slug-name",
      "name": "Arc Name",
      "description": "Overview of this storyline",

      "tension": {
        "centralConflict": "The core conflict of this arc",
        "source": "Where the conflict originates",
        "opposingForces": [
          {
            "name": "Force Name",
            "goal": "What they want",
            "factionId": "faction:id-if-applicable"
          }
        ],
        "urgency": "Why this matters now"
      },

      "situationIds": ["situation:id-1", "situation:id-2"],

      "structure": {
        "type": "funnel|layer_cake|hub_spoke|chain|web",
        "layers": {
          "situation:id-1": 1,
          "situation:id-2": 2
        },
        "entryPoints": ["situation:entry-1"],
        "climax": "situation:climax-id",
        "hub": "situation:hub-id",
        "suggestedOrder": ["situation:first", "situation:second"]
      },

      "resolution": {
        "patterns": [
          {
            "name": "Victory Pattern",
            "description": "How the arc concludes positively",
            "triggerConditions": ["All antagonists defeated", "Key artifact secured"]
          },
          {
            "name": "Pyrrhic Victory",
            "description": "Win at a cost",
            "triggerConditions": ["Main threat stopped but ally lost"]
          }
        ],
        "unlocksArcs": ["arc:sequel-arc-id"],
        "worldChanges": ["Major change 1", "Major change 2"]
      },

      "themes": ["Theme 1", "Theme 2"],

      "gmGuidance": {
        "introduction": "How to introduce this arc to players",
        "pacing": "Advice on running this arc over multiple sessions",
        "keyNpcs": ["npc:key-character-1", "npc:key-character-2"],
        "atmosphere": "The feel and mood to maintain"
      },

      "status": "dormant"
    }
  ]
}

IMPORTANT:
- Reference actual situation IDs from the existing situations list
- Choose appropriate structure type for the arc's pacing needs
- Include multiple resolution patterns for player agency
- Key NPCs should drive the narrative
- World changes should be meaningful consequences

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "WorldArc[]",
      },
      stepId,
      message: `Arc generation initiated for ${count} arc(s). Execute the prompt and call save_generation_result.`,
    };
  },
});
