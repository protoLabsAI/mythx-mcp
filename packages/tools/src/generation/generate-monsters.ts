/**
 * Monster Generation Tool (Shared)
 *
 * Generates monsters based on the world seed.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldRulesConfig } from "@mythxengine/types";
import { buildRulesPromptSection, buildMonsterHPGuidelines } from "./rules-prompt.js";
import { formatMonsterManifest, formatManifestInline } from "./manifest-helpers.js";

export const GenerateMonstersInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  count: z.number().min(1).max(20).optional().describe("Number of monsters to generate"),
  threatTiers: z
    .array(z.enum(["minion", "standard", "elite", "boss"]))
    .optional()
    .describe("Filter by threat tiers"),
  focusOn: z.array(z.string()).optional().describe("Specific monster seeds to focus on (by name)"),
});

export type GenerateMonstersInput = z.infer<typeof GenerateMonstersInputSchema>;

export interface GenerateMonstersOutput {
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  } | null;
  stepId: string;
  message: string;
  alreadyCompleted?: boolean;
}

interface WorldSeedForMonsters {
  name: string;
  tagline: string;
  aesthetic: { visualStyle: string; tone: string; themes: string[] };
  settings: { lethality: string; magicLevel: string; supernaturalPresence: string };
  coreConflict: string;
  monsterSeeds: Array<{ id?: string; name: string; concept: string; threat: string }>;
  locationSeeds?: Array<{ id?: string; name: string; concept: string }>;
  rules?: WorldRulesConfig;
}

export const generateMonstersTool = defineSharedTool({
  name: "generate_monsters",
  description: "Generate monsters based on the world seed. Returns a prompt for LLM execution.",
  inputSchema: GenerateMonstersInputSchema,

  handler: async (input, ctx): Promise<GenerateMonstersOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    // Check if this step type is already completed
    const existingStep = session.generation.history.find(
      (s) => s.type === "monsters" && s.status === "completed"
    );
    if (existingStep) {
      return {
        prompt: null,
        stepId: existingStep.id,
        message: "Step already completed. Use resume_generation to check status.",
        alreadyCompleted: true,
      };
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForMonsters;

    const stepId = randomUUID();

    // Filter monster seeds
    let filteredSeeds = worldSeed.monsterSeeds;
    if (input.focusOn) {
      filteredSeeds = filteredSeeds.filter((m) => input.focusOn!.includes(m.name));
    }
    if (input.threatTiers) {
      filteredSeeds = filteredSeeds.filter((m) =>
        input.threatTiers!.includes(m.threat as "minion" | "standard" | "elite" | "boss")
      );
    }

    // Fall back to full list if filters result in empty
    if (filteredSeeds.length === 0) {
      filteredSeeds = worldSeed.monsterSeeds;
    }

    // Clamp count to available seeds and schema max (20)
    const schemaMax = 20;
    const requestedCount = input.count ?? filteredSeeds.length;
    const count = Math.min(requestedCount, schemaMax, filteredSeeds.length);
    const monsterSeeds = filteredSeeds.slice(0, count);

    // Check if we have any monsters to generate
    if (monsterSeeds.length === 0) {
      throw new Error("No monster seeds available after filtering");
    }

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "monsters",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "generating";
    await ctx.sessions.save(session);

    // Build rules section from seed (uses defaults if no custom rules)
    const rulesSection = buildRulesPromptSection(worldSeed.rules);
    const monsterHPGuidelines = buildMonsterHPGuidelines(worldSeed.rules);

    const systemPrompt = `You are a monster designer for tabletop RPGs. Create dangerous, memorable creatures that challenge players and fit the world's tone.

${rulesSection}

${monsterHPGuidelines}

Design Guidelines:
- Armor: 0-1 for most, 2-3 for heavily armored
- Each monster needs 1-3 attacks with damage dice (d4, d6, d8, d10, d12)
- Include morale, tactics, lore, and narrative text
- Special abilities should be interesting but not overwhelming
- Include a visualDescription: one sentence describing their physical appearance — size, shape, coloring, distinguishing features. Used for portrait generation.

Morale Rules:
- threshold MUST be 1-10 (never 0). Lower = more likely to flee.
- For fearless/undead monsters, use checkWhen: "never" (NOT threshold: 0)
- For cowardly monsters, use low threshold (1-3) with checkWhen: "firstHit"
- For brave monsters, use high threshold (8-10) with checkWhen: "belowHalfHP"

Output valid JSON only.`;

    const userPrompt = `Generate ${count} monsters for this world:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Visual Style: ${worldSeed.aesthetic.visualStyle}
Core Conflict: ${worldSeed.coreConflict}
Lethality: ${worldSeed.settings.lethality}
Supernatural Presence: ${worldSeed.settings.supernaturalPresence}

Monster seeds to develop:
${monsterSeeds.map((m, i) => `${i + 1}. ${m.name} (${m.threat}): ${m.concept}`).join("\n")}

ID Manifest (use these exact IDs):
Monster IDs: ${formatMonsterManifest(monsterSeeds, true)}
Location IDs for habitat references: ${formatManifestInline(worldSeed.locationSeeds || [], "location")}

IMPORTANT: Use the monster IDs above as-is for each monster you generate.

Output a JSON object:
{
  "monsters": [
    {
      "id": "monster:slug-name",
      "name": "Monster Name",
      "description": "Physical description",
      "visualDescription": "One sentence physical appearance for image generation",
      "hp": 10,
      "armor": 0,
      "abilities": { "STR": 0, "AGI": 0, "WIT": -2, "CON": 0 },
      "threat": "minion|standard|elite|boss",
      "attacks": [
        {
          "name": "Attack Name",
          "ability": "STR|AGI|WIT|CON",
          "damage": "d6",
          "properties": ["optional", "tags"],
          "flavor": "Sensory description — what players see/hear/feel when it lands. Required, not optional."
        }
      ],
      "specialAbilities": ["Effect including trigger and any cost or limit"],
      "morale": {
        "threshold": 5,
        "checkWhen": "belowHalfHP|allyDies|firstHit|never",
        "fleesBelowHP": 3
      },
      "tactics": {
        "preferredRange": "melee|ranged|any",
        "targetPriority": "weakest|strongest|nearest|random",
        "specialBehavior": "Optional tactical notes"
      },
      "firstAction": "Behavioral intent on round 1 — what does it DO at T=0 if the party does nothing? Pursue, posture, retreat, set a trap, call for backup, etc. Required.",
      "lore": "What this creature does in the world when not in combat — its ecology, what it eats, where it sleeps, what it fears. Not optional flavor; this is what the GM telegraphs to players.",
      "encounterText": "The read-aloud-able narrative beat when players first see this creature. Distinct from description (which is what they look like) — encounterText is what the GM says at the table.",
      "deathText": "Narrative text when defeated"
    }
  ]
}

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "{ monsters: WorldMonster[] }",
      },
      stepId,
      message: `Monster generation initiated for ${count} monsters. Execute the prompt and call save_generation_result.`,
    };
  },
});
