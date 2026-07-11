/**
 * World Pack Augmentation Tools
 *
 * Add new content to existing world packs.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import type { MCPToolEntry } from "@mythxengine/types";
import type { WorldContentPack } from "@mythxengine/worlds";
import { worldPackManager, saveWorldPack } from "../../state/worldpacks.js";

const StartAugmentationInput = z.object({
  packId: z.string().describe("World pack ID to augment"),
  request: z
    .object({
      monsters: z.number().optional().describe("Number of monsters to add"),
      items: z.number().optional().describe("Number of items to add"),
      npcs: z.number().optional().describe("Number of NPCs to add"),
      locations: z.number().optional().describe("Number of locations to add"),
      encounters: z.number().optional().describe("Number of encounters to add"),
      archetypes: z.number().optional().describe("Number of archetypes to add"),
    })
    .describe("Content counts to generate"),
  theme: z
    .string()
    .optional()
    .describe("Theme or focus for new content (e.g., 'ice-themed enemies', 'merchant guild')"),
  locationContext: z
    .string()
    .optional()
    .describe("If adding to a specific location, its ID or description"),
});

/**
 * start_augmentation tool
 */
export const startAugmentationTool: MCPToolEntry = {
  name: "start_augmentation",
  description:
    "Start adding new content to an existing world pack. Returns generation prompts for the requested content types.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "World pack ID to augment" },
      request: {
        type: "object",
        description: "Content counts to generate",
        properties: {
          monsters: { type: "number", description: "Number of monsters to add" },
          items: { type: "number", description: "Number of items to add" },
          npcs: { type: "number", description: "Number of NPCs to add" },
          locations: { type: "number", description: "Number of locations to add" },
          encounters: { type: "number", description: "Number of encounters to add" },
          archetypes: { type: "number", description: "Number of archetypes to add" },
        },
      },
      theme: { type: "string", description: "Theme or focus for new content" },
      locationContext: {
        type: "string",
        description: "Location ID or description for contextual content",
      },
    },
    required: ["packId", "request"],
  },
  handler: async (args: unknown) => {
    const input = StartAugmentationInput.parse(args);

    // Load the world pack
    const worldPack = await worldPackManager.get(input.packId);
    if (!worldPack) {
      throw new Error(`World pack not found: ${input.packId}`);
    }

    const augmentationId = randomUUID().slice(0, 8);

    // Build context from existing world
    const worldContext = buildWorldContext(worldPack);
    const existingContent = summarizeExistingContent(worldPack);

    // Generate prompts for each requested content type
    const prompts: Array<{
      type: string;
      count: number;
      prompt: { system: string; user: string; outputSchemaName: string };
    }> = [];

    const themeClause = input.theme ? `\n\nTheme/Focus: ${input.theme}` : "";
    const locationClause = input.locationContext
      ? `\n\nLocation Context: ${input.locationContext}`
      : "";

    if (input.request.monsters && input.request.monsters > 0) {
      prompts.push({
        type: "monsters",
        count: input.request.monsters,
        prompt: buildMonsterPrompt(
          worldContext,
          existingContent,
          input.request.monsters,
          themeClause + locationClause
        ),
      });
    }

    if (input.request.items && input.request.items > 0) {
      prompts.push({
        type: "items",
        count: input.request.items,
        prompt: buildItemPrompt(
          worldContext,
          existingContent,
          input.request.items,
          themeClause + locationClause
        ),
      });
    }

    if (input.request.npcs && input.request.npcs > 0) {
      prompts.push({
        type: "npcs",
        count: input.request.npcs,
        prompt: buildNPCPrompt(
          worldContext,
          existingContent,
          input.request.npcs,
          themeClause + locationClause
        ),
      });
    }

    if (input.request.locations && input.request.locations > 0) {
      prompts.push({
        type: "locations",
        count: input.request.locations,
        prompt: buildLocationPrompt(
          worldContext,
          existingContent,
          input.request.locations,
          themeClause
        ),
      });
    }

    if (input.request.encounters && input.request.encounters > 0) {
      prompts.push({
        type: "encounters",
        count: input.request.encounters,
        prompt: buildEncounterPrompt(
          worldContext,
          existingContent,
          input.request.encounters,
          themeClause + locationClause
        ),
      });
    }

    if (input.request.archetypes && input.request.archetypes > 0) {
      prompts.push({
        type: "archetypes",
        count: input.request.archetypes,
        prompt: buildArchetypePrompt(
          worldContext,
          existingContent,
          input.request.archetypes,
          themeClause
        ),
      });
    }

    if (prompts.length === 0) {
      throw new Error("No content requested. Specify at least one content type with count > 0.");
    }

    return {
      augmentationId,
      packId: input.packId,
      packName: worldPack.meta.name,
      theme: input.theme || null,
      prompts,
      existingCounts: worldPack.meta.contentCounts,
      message: `Augmentation ready for ${worldPack.meta.name}. Execute each prompt and call merge_augmentation with the results.`,
    };
  },
};

// Minimal schemas for content validation - ensure required fields are present
const ContentIdSchema = z.object({ id: z.string().min(1) }).passthrough();

const MergeAugmentationInput = z.object({
  packId: z.string().describe("World pack ID to merge into"),
  content: z
    .object({
      monsters: z.array(ContentIdSchema).optional(),
      items: z.array(ContentIdSchema).optional(),
      npcs: z
        .array(ContentIdSchema.extend({ locations: z.array(z.string()).optional() }))
        .optional(),
      locations: z.array(ContentIdSchema).optional(),
      encounters: z.array(ContentIdSchema.extend({ locationId: z.string().optional() })).optional(),
      archetypes: z.array(ContentIdSchema).optional(),
    })
    .describe("New content to merge"),
  autoLink: z
    .boolean()
    .optional()
    .describe("Auto-link NPCs to locations, monsters to encounters (default: true)"),
});

/**
 * merge_augmentation tool
 */
export const mergeAugmentationTool: MCPToolEntry = {
  name: "merge_augmentation",
  description: "Merge newly generated content into an existing world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "World pack ID to merge into" },
      content: {
        type: "object",
        description: "New content arrays to merge",
        properties: {
          monsters: { type: "array", description: "New monsters" },
          items: { type: "array", description: "New items" },
          npcs: { type: "array", description: "New NPCs" },
          locations: { type: "array", description: "New locations" },
          encounters: { type: "array", description: "New encounters" },
          archetypes: { type: "array", description: "New archetypes" },
        },
      },
      autoLink: { type: "boolean", description: "Auto-link content (default: true)" },
    },
    required: ["packId", "content"],
  },
  handler: async (args: unknown) => {
    const input = MergeAugmentationInput.parse(args);
    const autoLink = input.autoLink !== false;

    // Load the world pack
    const worldPack = await worldPackManager.get(input.packId);
    if (!worldPack) {
      throw new Error(`World pack not found: ${input.packId}`);
    }

    const added: Record<string, number> = {};

    // Merge each content type
    // Note: Type assertions used because Zod's passthrough() validates id at runtime,
    // but TypeScript can't infer the full shape. LLM-generated content has full structure.
    if (input.content.monsters?.length) {
      for (const monster of input.content.monsters) {
        if (monster.id && !worldPack.monsters[monster.id]) {
          worldPack.monsters[monster.id] =
            monster as unknown as (typeof worldPack.monsters)[string];
          added.monsters = (added.monsters || 0) + 1;
        }
      }
    }

    if (input.content.items?.length) {
      for (const item of input.content.items) {
        if (item.id && !worldPack.items[item.id]) {
          worldPack.items[item.id] = item as unknown as (typeof worldPack.items)[string];
          added.items = (added.items || 0) + 1;
        }
      }
    }

    if (input.content.npcs?.length) {
      for (const npc of input.content.npcs) {
        if (npc.id && !worldPack.npcs[npc.id]) {
          worldPack.npcs[npc.id] = npc as unknown as (typeof worldPack.npcs)[string];
          added.npcs = (added.npcs || 0) + 1;

          // Auto-link: add NPC to their locations
          if (autoLink && npc.locations?.length) {
            for (const locId of npc.locations) {
              if (worldPack.locations[locId]) {
                // Initialize npcs array if missing
                if (!Array.isArray(worldPack.locations[locId].npcs)) {
                  worldPack.locations[locId].npcs = [];
                }
                if (!worldPack.locations[locId].npcs.includes(npc.id)) {
                  worldPack.locations[locId].npcs.push(npc.id);
                }
              }
            }
          }
        }
      }
    }

    if (input.content.locations?.length) {
      for (const location of input.content.locations) {
        if (location.id && !worldPack.locations[location.id]) {
          worldPack.locations[location.id] =
            location as unknown as (typeof worldPack.locations)[string];
          added.locations = (added.locations || 0) + 1;
        }
      }
    }

    if (input.content.encounters?.length) {
      for (const encounter of input.content.encounters) {
        if (encounter.id && !worldPack.encounters[encounter.id]) {
          worldPack.encounters[encounter.id] =
            encounter as unknown as (typeof worldPack.encounters)[string];
          added.encounters = (added.encounters || 0) + 1;

          // Auto-link: add encounter to location if specified
          if (autoLink && encounter.locationId && worldPack.locations[encounter.locationId]) {
            // Initialize encounters array if missing
            if (!Array.isArray(worldPack.locations[encounter.locationId].encounters)) {
              worldPack.locations[encounter.locationId].encounters = [];
            }
            if (!worldPack.locations[encounter.locationId].encounters.includes(encounter.id)) {
              worldPack.locations[encounter.locationId].encounters.push(encounter.id);
            }
          }
        }
      }
    }

    if (input.content.archetypes?.length) {
      for (const archetype of input.content.archetypes) {
        if (archetype.id && !worldPack.archetypes[archetype.id]) {
          worldPack.archetypes[archetype.id] =
            archetype as unknown as (typeof worldPack.archetypes)[string];
          added.archetypes = (added.archetypes || 0) + 1;
        }
      }
    }

    // Update content counts
    worldPack.meta.contentCounts = {
      archetypes: Object.keys(worldPack.archetypes).length,
      items: Object.keys(worldPack.items).length,
      monsters: Object.keys(worldPack.monsters).length,
      encounters: Object.keys(worldPack.encounters).length,
      conditions: Object.keys(worldPack.conditions).length,
      locations: Object.keys(worldPack.locations).length,
      npcs: Object.keys(worldPack.npcs).length,
      factions: Object.keys(worldPack.factions || {}).length,
    };

    // Save the updated pack
    await saveWorldPack(input.packId, worldPack);

    return {
      packId: input.packId,
      packName: worldPack.meta.name,
      added,
      newCounts: worldPack.meta.contentCounts,
      message: `Merged ${Object.values(added).reduce((a, b) => a + b, 0)} new items into ${worldPack.meta.name}.`,
    };
  },
};

// Helper functions

function buildWorldContext(pack: WorldContentPack): string {
  return `World: ${pack.meta.name}
Tagline: ${pack.meta.tagline}
Visual Style: ${pack.meta.aesthetic.visualStyle}
Tone: ${pack.meta.aesthetic.tone}
Themes: ${pack.meta.aesthetic.themes.join(", ")}
Lethality: ${pack.meta.settings.lethality}
Magic Level: ${pack.meta.settings.magicLevel}
Technology: ${pack.meta.settings.technologyLevel}
Supernatural: ${pack.meta.settings.supernaturalPresence}`;
}

function summarizeExistingContent(pack: WorldContentPack): string {
  const monsters = Object.values(pack.monsters)
    .slice(0, 5)
    .map((m) => `${m.name} (${m.threat})`);
  const npcs = Object.values(pack.npcs)
    .slice(0, 5)
    .map((n) => n.name);
  const locations = Object.values(pack.locations)
    .slice(0, 5)
    .map((l) => `${l.name} (${l.type})`);
  const items = Object.values(pack.items)
    .slice(0, 5)
    .map((i) => `${i.name} (${i.kind})`);

  return `Existing Content (samples):
- Monsters: ${monsters.join(", ")}${Object.keys(pack.monsters).length > 5 ? ` (+${Object.keys(pack.monsters).length - 5} more)` : ""}
- NPCs: ${npcs.join(", ")}${Object.keys(pack.npcs).length > 5 ? ` (+${Object.keys(pack.npcs).length - 5} more)` : ""}
- Locations: ${locations.join(", ")}${Object.keys(pack.locations).length > 5 ? ` (+${Object.keys(pack.locations).length - 5} more)` : ""}
- Items: ${items.join(", ")}${Object.keys(pack.items).length > 5 ? ` (+${Object.keys(pack.items).length - 5} more)` : ""}`;
}

function buildMonsterPrompt(worldContext: string, existing: string, count: number, extra: string) {
  return {
    system: `You are adding monsters to an existing RPG world pack. Create monsters that fit the established aesthetic and fill gaps in the existing roster. Each monster needs combat stats, behavior, and narrative hooks.

Abilities range from -3 to +3. Threat tiers: minion, standard, elite, boss.
Output valid JSON only.`,
    user: `${worldContext}

${existing}
${extra}

Generate ${count} NEW monsters that complement the existing roster. Output JSON:
{
  "monsters": [
    {
      "id": "monster:unique-slug",
      "name": "Monster Name",
      "description": "Physical description and lore",
      "threatTier": "standard",
      "hp": 10,
      "armor": 1,
      "abilities": { "STR": 1, "AGI": 0, "WIT": -1, "CON": 1 },
      "attacks": [
        { "name": "Attack Name", "damage": "d6+1", "description": "How it attacks" }
      ],
      "specialAbilities": ["Ability description"],
      "behavior": "How it acts in combat",
      "morale": "When it flees or surrenders",
      "loot": ["What it drops"],
      "habitat": "Where it's found",
      "encounterHooks": ["Why PCs might face it"]
    }
  ]
}`,
    outputSchemaName: "MonstersArray",
  };
}

function buildItemPrompt(worldContext: string, existing: string, count: number, extra: string) {
  return {
    system: `You are adding items to an existing RPG world pack. Create items that fit the world's technology and magic level. Include weapons, armor, consumables, and special items.

Item kinds: weapon, armor, consumable, special, misc.
Output valid JSON only.`,
    user: `${worldContext}

${existing}
${extra}

Generate ${count} NEW items. Output JSON:
{
  "items": [
    {
      "id": "item:unique-slug",
      "name": "Item Name",
      "kind": "weapon",
      "description": "What it looks like and does",
      "properties": ["property1", "property2"],
      "value": "common",
      "damage": "d6",
      "armor": 0,
      "effect": "Special effect if any"
    }
  ]
}

Value: worthless, common, uncommon, rare, legendary.
Include damage only for weapons, armor only for armor.`,
    outputSchemaName: "ItemsArray",
  };
}

function buildNPCPrompt(worldContext: string, existing: string, count: number, extra: string) {
  return {
    system: `You are adding NPCs to an existing RPG world pack. Create memorable characters with distinct personalities, motivations, and narrative hooks.

Output valid JSON only.`,
    user: `${worldContext}

${existing}
${extra}

Generate ${count} NEW NPCs. Output JSON:
{
  "npcs": [
    {
      "id": "npc:unique-slug",
      "name": "NPC Name",
      "description": "Physical description",
      "personality": "How they act and speak",
      "motivation": "What they want",
      "attitude": "friendly",
      "narrativeRole": "ally",
      "dialogueHints": ["Speech pattern or catchphrase"],
      "locations": ["location:id-if-applicable"],
      "secrets": ["Hidden information"],
      "relationships": { "npc:other-id": "relationship description" }
    }
  ]
}

Attitude: hostile, unfriendly, neutral, friendly, allied.
Narrative roles: ally, neutral, antagonist, quest_giver, merchant, information.`,
    outputSchemaName: "NPCsArray",
  };
}

function buildLocationPrompt(worldContext: string, existing: string, count: number, extra: string) {
  return {
    system: `You are adding locations to an existing RPG world pack. Create explorable places with atmosphere, features, and adventure hooks.

Location types: settlement, dungeon, wilderness, landmark, building.
Output valid JSON only.`,
    user: `${worldContext}

${existing}
${extra}

Generate ${count} NEW locations. Output JSON:
{
  "locations": [
    {
      "id": "location:unique-slug",
      "name": "Location Name",
      "type": "settlement",
      "description": "What the place looks like",
      "atmosphere": "How it feels to be there",
      "features": ["Notable feature 1", "Notable feature 2"],
      "connections": [],
      "encounters": [],
      "npcs": [],
      "secrets": ["Hidden things to discover"],
      "gmNotes": "Running tips for the GM"
    }
  ]
}`,
    outputSchemaName: "LocationsArray",
  };
}

function buildEncounterPrompt(
  worldContext: string,
  existing: string,
  count: number,
  extra: string
) {
  return {
    system: `You are adding encounters to an existing RPG world pack. Create combat, social, and event encounters that fit the world's tone.

Encounter types: combat, social, event, exploration.
Output valid JSON only.`,
    user: `${worldContext}

${existing}
${extra}

Generate ${count} NEW encounters. Output JSON:
{
  "encounters": [
    {
      "id": "encounter:unique-slug",
      "name": "Encounter Name",
      "type": "combat",
      "description": "What's happening",
      "setup": "How the encounter begins",
      "locationId": "location:id-or-null",
      "combat": {
        "monsters": [
          { "monsterId": "monster:existing-id", "count": 2 }
        ],
        "tactics": "How enemies fight",
        "terrain": "Environmental factors"
      },
      "rewards": ["What PCs gain"],
      "outcomes": {
        "victory": "What happens on success",
        "defeat": "What happens on failure",
        "retreat": "What happens if they flee"
      }
    }
  ]
}

For social encounters, use "social" object instead of "combat".
For events, use "event" object with triggers and consequences.`,
    outputSchemaName: "EncountersArray",
  };
}

function buildArchetypePrompt(
  worldContext: string,
  existing: string,
  count: number,
  extra: string
) {
  return {
    system: `You are adding playable archetypes to an existing RPG world pack. Create character classes that fit the world and offer distinct playstyles.

Abilities: STR, AGI, WIT, CON (range -2 to +2 for starting).
Output valid JSON only.`,
    user: `${worldContext}

${existing}
${extra}

Generate ${count} NEW archetypes. Output JSON:
{
  "archetypes": [
    {
      "id": "archetype:unique-slug",
      "name": "Archetype Name",
      "tagline": "One-line concept",
      "description": "What this archetype is about",
      "starting": {
        "abilities": { "STR": 0, "AGI": 1, "WIT": 1, "CON": 0 },
        "hp": 8,
        "maxHp": 8
      },
      "startingItems": ["item:existing-id"],
      "features": [
        {
          "id": "feature-slug",
          "name": "Feature Name",
          "description": "What it does",
          "type": "passive"
        }
      ],
      "playstyle": "How to play this archetype",
      "background": "Typical backstory hooks",
      "flavor": "Narrative description"
    }
  ]
}`,
    outputSchemaName: "ArchetypesArray",
  };
}
