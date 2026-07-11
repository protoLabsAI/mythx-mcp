/**
 * World Pack Entity Lookup Tools
 *
 * Individual entity lookup tools for on-demand access to full entity details.
 * Use load_world_summary for a compact overview, then these tools for specifics.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

// ============================================================================
// Shared Input Schema Pattern
// ============================================================================

const PackIdSchema = z.string().describe("World pack ID");

// ============================================================================
// GET ARCHETYPE
// ============================================================================

export const GetArchetypeInputSchema = z.object({
  packId: PackIdSchema,
  archetypeId: z.string().describe("Archetype ID to retrieve"),
});

export type GetArchetypeInput = z.infer<typeof GetArchetypeInputSchema>;

export const getArchetypeTool = defineSharedTool({
  name: "get_archetype",
  description: "Get full details for a specific archetype from a world pack.",
  inputSchema: GetArchetypeInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { archetypes?: Record<string, unknown> };
    if (!typedPack.archetypes) {
      throw new Error(`No archetypes in world pack: ${input.packId}`);
    }
    const archetype = typedPack.archetypes[input.archetypeId];
    if (!archetype) throw new Error(`Archetype not found: ${input.archetypeId}`);

    return { archetype };
  },
});

// ============================================================================
// GET LOCATION
// ============================================================================

export const GetLocationInputSchema = z.object({
  packId: PackIdSchema,
  locationId: z.string().describe("Location ID to retrieve"),
});

export type GetLocationInput = z.infer<typeof GetLocationInputSchema>;

export const getLocationTool = defineSharedTool({
  name: "get_location",
  description: "Get full details for a specific location from a world pack.",
  inputSchema: GetLocationInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { locations?: Record<string, unknown> };
    if (!typedPack.locations) {
      throw new Error(`No locations in world pack: ${input.packId}`);
    }
    const location = typedPack.locations[input.locationId];
    if (!location) throw new Error(`Location not found: ${input.locationId}`);

    return { location };
  },
});

// ============================================================================
// GET NPC
// ============================================================================

export const GetNpcInputSchema = z.object({
  packId: PackIdSchema,
  npcId: z.string().describe("NPC ID to retrieve"),
});

export type GetNpcInput = z.infer<typeof GetNpcInputSchema>;

export const getNpcTool = defineSharedTool({
  name: "get_npc",
  description: "Get full details for a specific NPC from a world pack.",
  inputSchema: GetNpcInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { npcs?: Record<string, unknown> };
    if (!typedPack.npcs) {
      throw new Error(`No NPCs in world pack: ${input.packId}`);
    }
    const npc = typedPack.npcs[input.npcId];
    if (!npc) throw new Error(`NPC not found: ${input.npcId}`);

    return { npc };
  },
});

// ============================================================================
// GET MONSTER
// ============================================================================

export const GetMonsterInputSchema = z.object({
  packId: PackIdSchema,
  monsterId: z.string().describe("Monster ID to retrieve"),
});

export type GetMonsterInput = z.infer<typeof GetMonsterInputSchema>;

export const getMonsterTool = defineSharedTool({
  name: "get_monster",
  description: "Get full details for a specific monster from a world pack.",
  inputSchema: GetMonsterInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { monsters?: Record<string, unknown> };
    if (!typedPack.monsters) {
      throw new Error(`No monsters in world pack: ${input.packId}`);
    }
    const monster = typedPack.monsters[input.monsterId];
    if (!monster) throw new Error(`Monster not found: ${input.monsterId}`);

    return { monster };
  },
});

// ============================================================================
// GET ITEM
// ============================================================================

export const GetItemInputSchema = z.object({
  packId: PackIdSchema,
  itemId: z.string().describe("Item ID to retrieve"),
});

export type GetItemInput = z.infer<typeof GetItemInputSchema>;

export const getItemTool = defineSharedTool({
  name: "get_item",
  description: "Get full details for a specific item from a world pack.",
  inputSchema: GetItemInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { items?: Record<string, unknown> };
    if (!typedPack.items) {
      throw new Error(`No items in world pack: ${input.packId}`);
    }
    const item = typedPack.items[input.itemId];
    if (!item) throw new Error(`Item not found: ${input.itemId}`);

    return { item };
  },
});

// ============================================================================
// GET ENCOUNTER
// ============================================================================

export const GetEncounterInputSchema = z.object({
  packId: PackIdSchema,
  encounterId: z.string().describe("Encounter ID to retrieve"),
});

export type GetEncounterInput = z.infer<typeof GetEncounterInputSchema>;

export const getEncounterTool = defineSharedTool({
  name: "get_encounter",
  description: "Get full details for a specific encounter from a world pack.",
  inputSchema: GetEncounterInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { encounters?: Record<string, unknown> };
    if (!typedPack.encounters) {
      throw new Error(`No encounters in world pack: ${input.packId}`);
    }
    const encounter = typedPack.encounters[input.encounterId];
    if (!encounter) throw new Error(`Encounter not found: ${input.encounterId}`);

    return { encounter };
  },
});

// ============================================================================
// GET CONDITION
// ============================================================================

export const GetConditionInputSchema = z.object({
  packId: PackIdSchema,
  conditionId: z.string().describe("Condition ID to retrieve"),
});

export type GetConditionInput = z.infer<typeof GetConditionInputSchema>;

export const getConditionTool = defineSharedTool({
  name: "get_condition",
  description: "Get full details for a specific condition from a world pack.",
  inputSchema: GetConditionInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { conditions?: Record<string, unknown> };
    if (!typedPack.conditions) {
      throw new Error(`No conditions in world pack: ${input.packId}`);
    }
    const condition = typedPack.conditions[input.conditionId];
    if (!condition) throw new Error(`Condition not found: ${input.conditionId}`);

    return { condition };
  },
});

// ============================================================================
// GET SITUATION
// ============================================================================

export const GetSituationInputSchema = z.object({
  packId: PackIdSchema,
  situationId: z.string().describe("Situation ID to retrieve"),
});

export type GetSituationInput = z.infer<typeof GetSituationInputSchema>;

export const getSituationTool = defineSharedTool({
  name: "get_situation",
  description:
    "Get full details for a specific situation from a world pack. Includes leads, clock, complications, and outcomes.",
  inputSchema: GetSituationInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { situations?: Record<string, unknown> };
    if (!typedPack.situations) {
      throw new Error(`No situations in world pack: ${input.packId}`);
    }
    const situation = typedPack.situations[input.situationId];
    if (!situation) throw new Error(`Situation not found: ${input.situationId}`);

    return { situation };
  },
});

// ============================================================================
// GET ARC
// ============================================================================

export const GetArcInputSchema = z.object({
  packId: PackIdSchema,
  arcId: z.string().describe("Arc ID to retrieve"),
});

export type GetArcInput = z.infer<typeof GetArcInputSchema>;

export const getArcTool = defineSharedTool({
  name: "get_arc",
  description:
    "Get full details for a specific story arc from a world pack. Includes structure, situations, and resolution patterns.",
  inputSchema: GetArcInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { arcs?: Record<string, unknown> };
    if (!typedPack.arcs) {
      throw new Error(`No arcs in world pack: ${input.packId}`);
    }
    const arc = typedPack.arcs[input.arcId];
    if (!arc) throw new Error(`Arc not found: ${input.arcId}`);

    return { arc };
  },
});

// ============================================================================
// GET FACTION
// ============================================================================

export const GetFactionInputSchema = z.object({
  packId: PackIdSchema,
  factionId: z.string().describe("Faction ID to retrieve"),
});

export type GetFactionInput = z.infer<typeof GetFactionInputSchema>;

export const getFactionTool = defineSharedTool({
  name: "get_faction",
  description: "Get full details for a specific faction from a world pack.",
  inputSchema: GetFactionInputSchema,
  handler: async (input, ctx) => {
    const pack = await ctx.worldPacks.get(input.packId);
    if (!pack) throw new Error(`World pack not found: ${input.packId}`);

    const typedPack = pack as { factions?: Record<string, unknown> };
    if (!typedPack.factions) {
      throw new Error(`No factions in world pack: ${input.packId}`);
    }
    const faction = typedPack.factions[input.factionId];
    if (!faction) throw new Error(`Faction not found: ${input.factionId}`);

    return { faction };
  },
});

// ============================================================================
// EXPORT
// ============================================================================

/**
 * All entity lookup tools
 */
export const entityLookupTools = [
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
