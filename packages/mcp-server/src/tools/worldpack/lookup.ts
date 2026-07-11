/**
 * World Pack Lookup Tools
 *
 * Individual entity lookup tools for on-demand access to full entity details.
 * Use load_world_summary for a compact overview, then these tools for specifics.
 */

import { z } from "zod";
import type { MCPToolEntry } from "@mythxengine/types";
import { worldPackManager } from "../../state/worldpacks.js";

// ============================================================================
// GET ARCHETYPE
// ============================================================================

const GetArchetypeInput = z.object({
  packId: z.string(),
  archetypeId: z.string(),
});

export const getArchetypeTool: MCPToolEntry = {
  name: "get_archetype",
  description: "Get full details for a specific archetype from a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      archetypeId: { type: "string", description: "Archetype ID to retrieve" },
    },
    required: ["packId", "archetypeId"],
  },
  handler: async (args: unknown) => {
    const input = GetArchetypeInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const archetype = pack.archetypes[input.archetypeId];
    if (!archetype) throw new Error(`Archetype not found: ${input.archetypeId}`);

    return { archetype };
  },
};

// ============================================================================
// GET LOCATION
// ============================================================================

const GetLocationInput = z.object({
  packId: z.string(),
  locationId: z.string(),
});

export const getLocationTool: MCPToolEntry = {
  name: "get_location",
  description: "Get full details for a specific location from a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      locationId: { type: "string", description: "Location ID to retrieve" },
    },
    required: ["packId", "locationId"],
  },
  handler: async (args: unknown) => {
    const input = GetLocationInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const location = pack.locations[input.locationId];
    if (!location) throw new Error(`Location not found: ${input.locationId}`);

    return { location };
  },
};

// ============================================================================
// GET NPC
// ============================================================================

const GetNpcInput = z.object({
  packId: z.string(),
  npcId: z.string(),
});

export const getNpcTool: MCPToolEntry = {
  name: "get_npc",
  description: "Get full details for a specific NPC from a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      npcId: { type: "string", description: "NPC ID to retrieve" },
    },
    required: ["packId", "npcId"],
  },
  handler: async (args: unknown) => {
    const input = GetNpcInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const npc = pack.npcs[input.npcId];
    if (!npc) throw new Error(`NPC not found: ${input.npcId}`);

    return { npc };
  },
};

// ============================================================================
// GET MONSTER
// ============================================================================

const GetMonsterInput = z.object({
  packId: z.string(),
  monsterId: z.string(),
});

export const getMonsterTool: MCPToolEntry = {
  name: "get_monster",
  description: "Get full details for a specific monster from a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      monsterId: { type: "string", description: "Monster ID to retrieve" },
    },
    required: ["packId", "monsterId"],
  },
  handler: async (args: unknown) => {
    const input = GetMonsterInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const monster = pack.monsters[input.monsterId];
    if (!monster) throw new Error(`Monster not found: ${input.monsterId}`);

    return { monster };
  },
};

// ============================================================================
// GET ITEM
// ============================================================================

const GetItemInput = z.object({
  packId: z.string(),
  itemId: z.string(),
});

export const getItemTool: MCPToolEntry = {
  name: "get_item",
  description: "Get full details for a specific item from a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      itemId: { type: "string", description: "Item ID to retrieve" },
    },
    required: ["packId", "itemId"],
  },
  handler: async (args: unknown) => {
    const input = GetItemInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const item = pack.items[input.itemId];
    if (!item) throw new Error(`Item not found: ${input.itemId}`);

    return { item };
  },
};

// ============================================================================
// GET ENCOUNTER
// ============================================================================

const GetEncounterInput = z.object({
  packId: z.string(),
  encounterId: z.string(),
});

export const getEncounterTool: MCPToolEntry = {
  name: "get_encounter",
  description: "Get full details for a specific encounter from a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      encounterId: { type: "string", description: "Encounter ID to retrieve" },
    },
    required: ["packId", "encounterId"],
  },
  handler: async (args: unknown) => {
    const input = GetEncounterInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const encounter = pack.encounters[input.encounterId];
    if (!encounter) throw new Error(`Encounter not found: ${input.encounterId}`);

    return { encounter };
  },
};

// ============================================================================
// GET CONDITION
// ============================================================================

const GetConditionInput = z.object({
  packId: z.string(),
  conditionId: z.string(),
});

export const getConditionTool: MCPToolEntry = {
  name: "get_condition",
  description: "Get full details for a specific condition from a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      conditionId: { type: "string", description: "Condition ID to retrieve" },
    },
    required: ["packId", "conditionId"],
  },
  handler: async (args: unknown) => {
    const input = GetConditionInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const condition = pack.conditions[input.conditionId];
    if (!condition) throw new Error(`Condition not found: ${input.conditionId}`);

    return { condition };
  },
};

// ============================================================================
// GET SITUATION
// ============================================================================

const GetSituationInput = z.object({
  packId: z.string(),
  situationId: z.string(),
});

export const getSituationTool: MCPToolEntry = {
  name: "get_situation",
  description:
    "Get full details for a specific situation from a world pack. Includes leads, clock, complications, and outcomes.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      situationId: { type: "string", description: "Situation ID to retrieve" },
    },
    required: ["packId", "situationId"],
  },
  handler: async (args: unknown) => {
    const input = GetSituationInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    if (!pack.situations) throw new Error(`No situations in world pack: ${input.packId}`);
    const situation = pack.situations[input.situationId];
    if (!situation) throw new Error(`Situation not found: ${input.situationId}`);

    return { situation };
  },
};

// ============================================================================
// GET ARC
// ============================================================================

const GetArcInput = z.object({
  packId: z.string(),
  arcId: z.string(),
});

export const getArcTool: MCPToolEntry = {
  name: "get_arc",
  description:
    "Get full details for a specific story arc from a world pack. Includes structure, situations, and resolution patterns.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      arcId: { type: "string", description: "Arc ID to retrieve" },
    },
    required: ["packId", "arcId"],
  },
  handler: async (args: unknown) => {
    const input = GetArcInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    if (!pack.arcs) throw new Error(`No arcs in world pack: ${input.packId}`);
    const arc = pack.arcs[input.arcId];
    if (!arc) throw new Error(`Arc not found: ${input.arcId}`);

    return { arc };
  },
};

// ============================================================================
// GET FACTION
// ============================================================================

const GetFactionInput = z.object({
  packId: z.string(),
  factionId: z.string(),
});

export const getFactionTool: MCPToolEntry = {
  name: "get_faction",
  description: "Get full details for a specific faction from a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID" },
      factionId: { type: "string", description: "Faction ID to retrieve" },
    },
    required: ["packId", "factionId"],
  },
  handler: async (args: unknown) => {
    const input = GetFactionInput.parse(args);
    const pack = await worldPackManager.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    if (!pack.factions) throw new Error(`No factions in world pack: ${input.packId}`);
    const faction = pack.factions[input.factionId];
    if (!faction) throw new Error(`Faction not found: ${input.factionId}`);

    return { faction };
  },
};

// ============================================================================
// EXPORT
// ============================================================================

export const lookupTools = [
  getArchetypeTool,
  getLocationTool,
  getNpcTool,
  getMonsterTool,
  getItemTool,
  getEncounterTool,
  getConditionTool,
  getSituationTool,
  getArcTool,
  getFactionTool,
];
