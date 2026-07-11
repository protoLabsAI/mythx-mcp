/**
 * Monster Expansion Tool
 *
 * Expands a monster with additional detail.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import type { MCPToolEntry } from "@mythxengine/types";
import { sessionManager } from "../../state/manager.js";

const ExpandMonsterInput = z.object({
  sessionId: z.string(),
  monsterId: z.string().describe("ID of the monster to expand"),
});

/**
 * expand_monster tool
 */
export const expandMonsterTool: MCPToolEntry = {
  name: "expand_monster",
  description:
    "Expand a monster with additional detail (lair, variants, ecology). Returns a prompt for LLM execution.",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Session ID" },
      monsterId: { type: "string", description: "ID of the monster to expand" },
    },
    required: ["sessionId", "monsterId"],
  },
  handler: async (args: unknown) => {
    const input = ExpandMonsterInput.parse(args);

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

    // Find the monster
    const monsters = session.generation.generatedContent.monsters as Array<{ id: string }>;
    const monster = monsters.find((m) => m.id === input.monsterId) as
      | {
          id: string;
          name: string;
          description: string;
          hp: number;
          armor: number;
          abilities: Record<string, number>;
          threat: string;
          attacks: Array<{ name: string; ability: string; damage: string; flavor: string }>;
          specialAbilities: string[];
          morale: { threshold: number; checkWhen: string; fleesBelowHP?: number };
          tactics: { preferredRange: string; targetPriority: string; specialBehavior?: string };
          lore: string;
          encounterText: string;
          deathText: string;
        }
      | undefined;

    if (!monster) {
      throw new Error(`Monster not found: ${input.monsterId}`);
    }

    // Check if already expanded
    const expandedMonsters = session.generation.expansions.monsters as Array<{ id: string }>;
    const alreadyExpanded = expandedMonsters.find((m) => m.id === input.monsterId);
    if (alreadyExpanded) {
      throw new Error(`Monster already expanded: ${input.monsterId}`);
    }

    const stepId = randomUUID();

    // Get items for treasure
    const items = session.generation.generatedContent.items as Array<{
      id: string;
      name: string;
      kind: string;
    }>;

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "expand_monster",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "expanding";
    await sessionManager.save(session);

    const systemPrompt = `You are expanding a monster for a tabletop RPG. Add lair details, variants, and ecology while maintaining the monster's established identity.

Rules:
- Lair should be a dangerous, atmospheric location
- Variants offer different takes on the base monster
- Ecology explains how they fit into the world
- Treasure should make sense for the creature

Output valid JSON only.`;

    const userPrompt = `Expand this monster with additional detail:

World: ${worldSeed.name}
Visual Style: ${worldSeed.aesthetic.visualStyle}
Tone: ${worldSeed.aesthetic.tone}
Lethality: ${worldSeed.settings.lethality}
Supernatural Presence: ${worldSeed.settings.supernaturalPresence}

Monster to expand:
- ID: ${monster.id}
- Name: ${monster.name}
- Description: ${monster.description}
- Threat: ${monster.threat}
- HP: ${monster.hp}, Armor: ${monster.armor}
- Abilities: ${JSON.stringify(monster.abilities)}
- Attacks: ${monster.attacks.map((a) => a.name).join(", ")}
- Special Abilities: ${monster.specialAbilities.join("; ")}
- Lore: ${monster.lore}
- Tactics: ${monster.tactics.specialBehavior || `${monster.tactics.preferredRange}, targets ${monster.tactics.targetPriority}`}

Available items for treasure:
${items
  .slice(0, 15)
  .map((i) => `- ${i.id}: ${i.name} (${i.kind})`)
  .join("\n")}

Output a JSON object with the expanded monster (include ALL original fields plus new ones):
{
  "expandedMonster": {
    "id": "${monster.id}",
    "name": "${monster.name}",
    "description": "${monster.description}",
    "hp": ${monster.hp},
    "armor": ${monster.armor},
    "abilities": ${JSON.stringify(monster.abilities)},
    "threat": "${monster.threat}",
    "attacks": ${JSON.stringify(monster.attacks)},
    "specialAbilities": ${JSON.stringify(monster.specialAbilities)},
    "morale": ${JSON.stringify(monster.morale)},
    "tactics": ${JSON.stringify(monster.tactics)},
    "lore": "${monster.lore}",
    "encounterText": "${monster.encounterText}",
    "deathText": "${monster.deathText}",
    "lair": {
      "description": "Description of where this creature makes its home",
      "hazards": ["Environmental hazard 1", "Environmental hazard 2"],
      "treasure": ["item:id-from-list", "Description of unique loot"]
    },
    "variants": [
      {
        "name": "Variant Name",
        "description": "How this variant differs",
        "modifications": {
          "hp": "+4",
          "newAbility": "Description of added capability"
        }
      }
    ],
    "ecology": "How this creature fits into the world - diet, reproduction, territory, etc."
  }
}

Notes:
- Lair should include 2-3 hazards
- Treasure should include 2-4 items
- Include 1-2 variants
- Ecology should be 2-3 sentences

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "ExpandedMonster",
      },
      stepId,
      message: `Monster expansion initiated for ${monster.name}. Execute the prompt and call save_generation_result.`,
    };
  },
};

export const expandMonsterTools = [expandMonsterTool];
