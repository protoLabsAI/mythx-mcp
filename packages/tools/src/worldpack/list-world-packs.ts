/**
 * List World Packs Tool
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

export const ListWorldPacksInputSchema = z.object({});

// Minimal schema for world pack structure validation
// Only validates the fields needed for listing (meta and record counts)
const WorldPackListSchema = z.object({
  meta: z.object({
    id: z.string(),
    name: z.string(),
    tagline: z.string(),
  }),
  archetypes: z.record(z.unknown()),
  monsters: z.record(z.unknown()),
  items: z.record(z.unknown()),
  encounters: z.record(z.unknown()),
  locations: z.record(z.unknown()),
  npcs: z.record(z.unknown()),
});

export interface WorldPackSummary {
  id: string;
  name: string;
  tagline: string;
  contentCounts: {
    archetypes: number;
    monsters: number;
    items: number;
    encounters: number;
    locations: number;
    npcs: number;
  };
}

export interface ListWorldPacksOutput {
  count: number;
  packs: WorldPackSummary[];
}

export const listWorldPacksTool = defineSharedTool({
  name: "list_world_packs",
  description: "List all saved world packs with their metadata and content counts.",
  inputSchema: ListWorldPacksInputSchema,
  handler: async (_input, ctx): Promise<ListWorldPacksOutput> => {
    const packIds = await ctx.worldPacks.list();

    const packs: WorldPackSummary[] = [];
    for (const id of packIds) {
      const pack = await ctx.worldPacks.get(id);
      if (!pack) continue;

      // Validate world pack structure with Zod instead of type assertion
      const validationResult = WorldPackListSchema.safeParse(pack);
      if (!validationResult.success) {
        console.error(
          `[listWorldPacks] Invalid world pack structure for ${id}:`,
          validationResult.error.message
        );
        // Skip invalid packs rather than failing the entire operation
        continue;
      }

      const validatedPack = validationResult.data;

      packs.push({
        id: validatedPack.meta.id,
        name: validatedPack.meta.name,
        tagline: validatedPack.meta.tagline,
        contentCounts: {
          archetypes: Object.keys(validatedPack.archetypes).length,
          monsters: Object.keys(validatedPack.monsters).length,
          items: Object.keys(validatedPack.items).length,
          encounters: Object.keys(validatedPack.encounters).length,
          locations: Object.keys(validatedPack.locations).length,
          npcs: Object.keys(validatedPack.npcs).length,
        },
      });
    }

    return {
      count: packs.length,
      packs,
    };
  },
});
