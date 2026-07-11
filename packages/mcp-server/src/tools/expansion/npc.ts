/**
 * NPC Expansion Tool
 *
 * Expands an NPC with additional detail.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import type { MCPToolEntry } from "@mythxengine/types";
import { sessionManager } from "../../state/manager.js";

const ExpandNPCInput = z.object({
  sessionId: z.string(),
  npcId: z.string().describe("ID of the NPC to expand"),
});

/**
 * expand_npc tool
 */
export const expandNPCTool: MCPToolEntry = {
  name: "expand_npc",
  description:
    "Expand an NPC with additional detail (backstory, combat stats, quest hooks). Returns a prompt for LLM execution.",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Session ID" },
      npcId: { type: "string", description: "ID of the NPC to expand" },
    },
    required: ["sessionId", "npcId"],
  },
  handler: async (args: unknown) => {
    const input = ExpandNPCInput.parse(args);

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
      settings: { lethality: string };
    };

    // Find the NPC
    const npcs = session.generation.generatedContent.npcs as Array<{ id: string }>;
    const npc = npcs.find((n) => n.id === input.npcId) as
      | {
          id: string;
          name: string;
          description: string;
          personality: string;
          motivation: string;
          attitude: string;
          dialogueHints: string[];
          narrativeRole: string;
          locations?: string[];
          relationships?: Record<string, string>;
          secrets?: string[];
        }
      | undefined;

    if (!npc) {
      throw new Error(`NPC not found: ${input.npcId}`);
    }

    // Check if already expanded
    const expandedNPCs = session.generation.expansions.npcs as Array<{ id: string }>;
    const alreadyExpanded = expandedNPCs.find((n) => n.id === input.npcId);
    if (alreadyExpanded) {
      throw new Error(`NPC already expanded: ${input.npcId}`);
    }

    const stepId = randomUUID();

    // Get items for inventory
    const items = session.generation.generatedContent.items as Array<{
      id: string;
      name: string;
      kind: string;
    }>;

    // Record the generation step
    session.generation.history.push({
      id: stepId,
      type: "expand_npc",
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      generatedIds: [],
    });
    session.generation.status = "expanding";
    await sessionManager.save(session);

    const systemPrompt = `You are expanding an NPC for a tabletop RPG. Add backstory, combat stats (if relevant), quest hooks, and inventory while maintaining the NPC's established identity.

Rules:
- Backstory should explain how they became who they are
- Combat stats only for NPCs who might fight (antagonists, guards, etc.)
- Quest hooks should connect to their motivation and narrative role
- Inventory should fit their role and economic status
- Abilities: STR, AGI, WIT, CON (-3 to +3)

Output valid JSON only.`;

    const userPrompt = `Expand this NPC with additional detail:

World: ${worldSeed.name}
Tone: ${worldSeed.aesthetic.tone}
Themes: ${worldSeed.aesthetic.themes.join(", ")}
Core Conflict: ${worldSeed.coreConflict}
Lethality: ${worldSeed.settings.lethality}

NPC to expand:
- ID: ${npc.id}
- Name: ${npc.name}
- Description: ${npc.description}
- Personality: ${npc.personality}
- Motivation: ${npc.motivation}
- Attitude: ${npc.attitude}
- Narrative Role: ${npc.narrativeRole}
- Dialogue Hints: ${npc.dialogueHints.join("; ")}
${npc.secrets ? `- Secrets: ${npc.secrets.join("; ")}` : ""}

Available items for inventory:
${items
  .slice(0, 20)
  .map((i) => `- ${i.id}: ${i.name} (${i.kind})`)
  .join("\n")}

Output a JSON object with the expanded NPC (include ALL original fields plus new ones):
{
  "expandedNPC": {
    "id": "${npc.id}",
    "name": "${npc.name}",
    "description": "${npc.description}",
    "personality": "${npc.personality}",
    "motivation": "${npc.motivation}",
    "attitude": "${npc.attitude}",
    "dialogueHints": ${JSON.stringify(npc.dialogueHints)},
    "narrativeRole": "${npc.narrativeRole}",
    "locations": ${JSON.stringify(npc.locations || [])},
    "relationships": ${JSON.stringify(npc.relationships || {})},
    "secrets": ${JSON.stringify(npc.secrets || [])},
    "backstory": "Detailed backstory explaining their history and how they came to be who they are",
    "combatStats": {
      "hp": 10,
      "armor": 0,
      "abilities": { "STR": 0, "AGI": 0, "WIT": 0, "CON": 0 },
      "attacks": [
        { "name": "Attack Name", "damage": "d6" }
      ]
    },
    "questHooks": [
      "A quest or task they might offer",
      "A problem they need help with",
      "Information they could trade for a favor"
    ],
    "inventory": ["item:id-from-list", "item:another-id"]
  }
}

Notes:
- Backstory should be 2-4 sentences
- Include combatStats only if this NPC might fight (null otherwise)
- Quest hooks should connect to their motivation
- Inventory should be 2-5 appropriate items

Return ONLY the JSON object, no markdown formatting.`;

    return {
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputSchemaName: "ExpandedNPC",
      },
      stepId,
      message: `NPC expansion initiated for ${npc.name}. Execute the prompt and call save_generation_result.`,
    };
  },
};

export const expandNPCTools = [expandNPCTool];
