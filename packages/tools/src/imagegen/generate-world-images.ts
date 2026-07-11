/**
 * Generate World Images Tool (Shared)
 *
 * Pre-bakes images for world pack entities (all types by default)
 * during world creation. Calls pixelgen directly via HTTP — synchronous,
 * not via the event bus — so images are ready at character select.
 *
 * Run after assemble_world_pack.
 */

import { randomUUID } from "crypto";
import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { RESOLUTION_PRESETS, resolveStylePrefix } from "./defaults.js";
import {
  compileImagePrompt,
  getImageNegativePrompt,
  extractVisualDescription,
  type ImageType,
} from "./prompt-loader.js";
import { callPixelgen } from "./pixelgen-client.js";

/**
 * Input schema for generate_world_images
 */
const SUPPORTED_ENTITY_TYPES = [
  "archetype",
  "npc",
  "monster",
  "location",
  "item",
  "faction",
] as const;

export const GenerateWorldImagesInputSchema = z.object({
  packId: z.string().describe("World pack ID to generate images for"),
  entityTypes: z
    .array(z.enum(SUPPORTED_ENTITY_TYPES))
    .optional()
    .default([...SUPPORTED_ENTITY_TYPES])
    .describe("Entity types to generate images for (default: all types)"),
});

export type GenerateWorldImagesInput = z.infer<typeof GenerateWorldImagesInputSchema>;

/**
 * Per-entity generation result
 */
export interface GenerateWorldImagesDetail {
  entityType: string;
  entityId: string;
  status: "generated" | "cached" | "failed";
  imageUrl?: string;
}

/**
 * Output type for generate_world_images
 */
export interface GenerateWorldImagesOutput {
  generated: number;
  cached: number;
  failed: number;
  details: GenerateWorldImagesDetail[];
}

/**
 * Rarity glow effects for prompt enhancement
 */
const RARITY_EFFECTS: Record<string, string> = {
  common: "",
  uncommon: "faint green glow",
  rare: "blue magical aura",
  epic: "purple arcane energy",
  legendary: "golden radiant glow, divine light",
};

/**
 * Config for each supported entity type
 */
interface EntityConfig {
  imageRole: string;
  template: ImageType;
  resolution: keyof typeof RESOLUTION_PRESETS;
  filenamePrefix: string;
  getEntities: (p: WorldPackShape) => Array<{
    id: string;
    name: string;
    description?: string;
    visualDescription?: string;
    atmosphere?: string;
    type?: string;
    rarity?: string;
  }>;
}

type WorldPackShape = {
  meta?: { aesthetic?: { visualStyle?: string; tone?: string } };
  archetypes?: Record<
    string,
    { id: string; name: string; description?: string; visualDescription?: string }
  >;
  npcs?: Record<
    string,
    { id: string; name: string; description?: string; visualDescription?: string }
  >;
  monsters?: Record<
    string,
    { id: string; name: string; description?: string; visualDescription?: string }
  >;
  locations?: Record<
    string,
    {
      id: string;
      name: string;
      description?: string;
      visualDescription?: string;
      atmosphere?: string;
    }
  >;
  items?: Record<
    string,
    {
      id: string;
      name: string;
      description?: string;
      visualDescription?: string;
      type?: string;
      rarity?: string;
    }
  >;
  factions?: Record<
    string,
    { id: string; name: string; description?: string; visualDescription?: string }
  >;
};

const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  archetype: {
    imageRole: "portrait",
    template: "portrait",
    resolution: "portrait",
    filenamePrefix: "archetype",
    getEntities: (p) => (p.archetypes ? Object.values(p.archetypes) : []),
  },
  npc: {
    imageRole: "portrait",
    template: "portrait",
    resolution: "portrait",
    filenamePrefix: "npc",
    getEntities: (p) => (p.npcs ? Object.values(p.npcs) : []),
  },
  monster: {
    imageRole: "portrait",
    template: "portrait",
    resolution: "portrait",
    filenamePrefix: "monster",
    getEntities: (p) => (p.monsters ? Object.values(p.monsters) : []),
  },
  location: {
    imageRole: "scene",
    template: "scene",
    resolution: "scene",
    filenamePrefix: "location",
    getEntities: (p) => (p.locations ? Object.values(p.locations) : []),
  },
  item: {
    imageRole: "icon",
    template: "item",
    resolution: "icon",
    filenamePrefix: "item",
    getEntities: (p) => (p.items ? Object.values(p.items) : []),
  },
  faction: {
    imageRole: "banner",
    template: "scene",
    resolution: "banner",
    filenamePrefix: "faction",
    getEntities: (p) => (p.factions ? Object.values(p.factions) : []),
  },
};

/**
 * Generate world images tool definition
 */
export const generateWorldImagesTool = defineSharedTool({
  name: "generate_world_images",
  description:
    "Generate images for world pack entities (all entity types by default). Run after assemble_world_pack to pre-bake character select images.",
  inputSchema: GenerateWorldImagesInputSchema,

  handler: async (input, ctx): Promise<GenerateWorldImagesOutput> => {
    const worldPack = await ctx.worldPacks.get(input.packId);
    if (!worldPack) {
      throw new Error(`World pack not found: ${input.packId}`);
    }

    const pack = worldPack as WorldPackShape;

    const worldVisualStyle = pack.meta?.aesthetic?.visualStyle;
    const worldTone = pack.meta?.aesthetic?.tone;

    const details: GenerateWorldImagesDetail[] = [];
    let generated = 0;
    let cached = 0;
    let failed = 0;

    const entityTypes = input.entityTypes;

    for (const entityType of entityTypes) {
      const config = ENTITY_CONFIGS[entityType];
      if (!config) continue;

      const entities = config.getEntities(pack);

      for (const entity of entities) {
        const entityId = entity.id;

        // 1. Check cache
        if (ctx.worldMedia) {
          try {
            const existing = await ctx.worldMedia.listByEntity(input.packId, entityType, entityId);
            const match = existing.find((e) => e.role === config.imageRole);
            if (match) {
              cached++;
              details.push({
                entityType,
                entityId,
                status: "cached",
                imageUrl: `/api/media/world/${input.packId}/${match.filename}`,
              });
              continue;
            }
          } catch (err) {
            console.debug(
              `generate_world_images: cache check failed for ${entityType}/${entityId}:`,
              err instanceof Error ? err.message : String(err)
            );
          }
        }

        // 2. Build prompt and generate
        try {
          // For locations, prefer atmosphere over description when no visualDescription
          const visualSource =
            entity.visualDescription ??
            (entityType === "location" ? entity.atmosphere : undefined) ??
            entity.description;

          const prompt = compileImagePrompt(config.template, {
            STYLE_PREFIX: resolveStylePrefix(undefined, worldVisualStyle),
            SUBJECT: entity.name,
            DESCRIPTION: extractVisualDescription(visualSource),
            TONE_KEYWORDS: worldTone,
            // For items, include rarity effect
            ...(entityType === "item" && entity.rarity
              ? { RARITY_EFFECT: RARITY_EFFECTS[entity.rarity] ?? "" }
              : {}),
          });
          const negativePrompt = getImageNegativePrompt(config.template);

          // 3. Generate
          const seed = Math.floor(Math.random() * 2 ** 31);
          const result = await callPixelgen({
            prompt,
            negativePrompt,
            width: RESOLUTION_PRESETS[config.resolution].width,
            height: RESOLUTION_PRESETS[config.resolution].height,
            seed,
          });
          const imageBuffer = result.imageBuffer;

          // 4. Save
          const mediaId = randomUUID();
          const filename = `${config.filenamePrefix}_${entityId.slice(0, 16)}_${seed}.png`;
          let imageUrl: string | undefined;

          if (ctx.worldMedia) {
            await ctx.worldMedia.save(
              input.packId,
              {
                id: mediaId,
                filename,
                mimeType: "image/png",
                entityType,
                entityId,
                role: config.imageRole,
                sizeBytes: imageBuffer.byteLength,
                createdAt: new Date().toISOString(),
              },
              imageBuffer
            );
            imageUrl = `/api/media/world/${input.packId}/${filename}`;

            ctx.onImageGenerated?.({
              type: config.template,
              prompt,
              negativePrompt,
              entityId,
              generationTimeMs: result.generationTimeMs,
              seed: result.seed,
            });

            generated++;
            details.push({ entityType, entityId, status: "generated", imageUrl });
          } else {
            // No storage available — image generated but not persisted
            failed++;
            details.push({ entityType, entityId, status: "failed" });
          }
        } catch (err) {
          console.error(
            `generate_world_images: failed for ${entityType}/${entityId}:`,
            err instanceof Error ? err.message : String(err)
          );
          failed++;
          details.push({ entityType, entityId, status: "failed" });
        }
      }
    }

    return { generated, cached, failed, details };
  },
});
