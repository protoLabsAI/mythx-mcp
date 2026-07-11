/**
 * Generate Item Art Tool (Shared)
 *
 * Agent-callable tool that triggers item image generation via the SDXL pipeline.
 * Builds an item prompt from item data and world aesthetic, then emits
 * an IMAGEGEN_REQUEST event for the SDXL service to process.
 */

import { randomUUID } from "crypto";
import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { requireSkill } from "../skills/load-skill.js";
import { RESOLUTION_PRESETS, resolveStylePrefix } from "./defaults.js";
import { generateAndSave } from "./pixelgen-client.js";
import {
  compileImagePrompt,
  getImageNegativePrompt,
  extractVisualDescription,
} from "./prompt-loader.js";

/**
 * Input schema for generate_item_art
 */
export const GenerateItemArtInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  itemId: z
    .string()
    .optional()
    .describe("Item ID from world pack (uses item description for prompt)"),
  name: z.string().optional().describe("Item name (used if no item ID)"),
  description: z.string().optional().describe("Item appearance description (used if no item ID)"),
  itemType: z.string().optional().describe("Item type (weapon, armor, consumable, etc.)"),
  rarity: z.string().optional().describe("Item rarity (common, uncommon, rare, epic, legendary)"),
  prompt: z.string().optional().describe("Custom item prompt (overrides auto-generated prompt)"),
  style: z.string().optional().describe("Visual style hint (e.g. '16-bit pixel art icon')"),
  quality: z
    .enum(["lightning"])
    .optional()
    .default("lightning")
    .describe("Image quality preset (lightning only — ~0.25s via pixelgen)"),
});

export type GenerateItemArtInput = z.infer<typeof GenerateItemArtInputSchema>;

/**
 * Output type for generate_item_art
 */
export interface GenerateItemArtOutput {
  requestId: string;
  prompt: string;
  quality: string;
  entityType: "item";
  entityId?: string;
  entityName?: string;
  rarity?: string;
  message: string;
  imageUrl?: string;
}

/**
 * Quality preset configurations
 */

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
 * Get item from session's world pack
 */
function getItem(
  session: {
    generation?: {
      generatedContent: { items?: unknown[] };
    };
  },
  itemId: string
): {
  id: string;
  name: string;
  description: string;
  type?: string;
  rarity?: string;
} | null {
  if (!session.generation?.generatedContent?.items) {
    return null;
  }
  const items = session.generation.generatedContent.items as Array<{
    id: string;
    name: string;
    description: string;
    type?: string;
    rarity?: string;
  }>;
  return items.find((i) => i.id === itemId) || null;
}

/**
 * Generate item art tool definition
 */
export const generateItemArtTool = defineSharedTool({
  name: "generate_item_art",
  description:
    "Generate an icon/art image for an item. Triggers SDXL image generation. Use when the player discovers a significant item or views item details.",
  inputSchema: GenerateItemArtInputSchema,

  // Gate: image-generation skill required. The skill body documents
  // item-art prompt rules (object-only descriptions, visual keywords
  // over narrative lore) and the "common items stay in prose" scope.
  gate: requireSkill("image-generation"),

  handler: async (input, ctx): Promise<GenerateItemArtOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Resolve display name and rarity once — used by every return path
    // so the server-display card has a label without needing the agent
    // to remember a follow-up `showItemArt` call.
    let entityName: string | undefined = input.name;
    let resolvedRarity: string | undefined = input.rarity;
    if (input.itemId) {
      const item = getItem(session, input.itemId);
      if (item) {
        entityName = entityName || item.name;
        resolvedRarity = resolvedRarity || item.rarity;
      }
    }

    // Check world pack media cache
    const worldPackId = session.worldPackId;
    if (worldPackId && input.itemId && ctx.worldMedia) {
      const cached = await ctx.worldMedia.listByEntity(worldPackId, "item", input.itemId);
      const match = cached.find((e) => e.role === "icon");
      if (match) {
        return {
          requestId: randomUUID(),
          prompt: "(cached)",
          quality: "lightning",
          entityType: "item",
          entityId: input.itemId,
          entityName,
          rarity: resolvedRarity,
          message: `Image already cached.`,
          imageUrl: `/api/media/world/${worldPackId}/${match.filename}`,
        };
      }
    }

    // Load world aesthetic for style coherence
    let worldVisualStyle: string | undefined;
    let worldTone: string | undefined;
    if (worldPackId) {
      const worldPack = await ctx.worldPacks.get(worldPackId);
      const aesthetic = (
        worldPack as { meta?: { aesthetic?: { visualStyle?: string; tone?: string } } } | null
      )?.meta?.aesthetic;
      worldVisualStyle = aesthetic?.visualStyle;
      worldTone = aesthetic?.tone;
    }

    // Build prompt
    let imagePrompt: string;

    if (input.prompt) {
      imagePrompt = input.prompt;
    } else {
      let itemName = input.name || "mysterious item";
      let itemDesc = input.description;
      let itemType = input.itemType;
      let rarity = input.rarity;

      if (input.itemId) {
        const item = getItem(session, input.itemId);
        if (item) {
          itemName = item.name;
          itemDesc = item.description;
          itemType = item.type ?? input.itemType;
          rarity = item.rarity ?? input.rarity;
        }
      }

      const stylePrefix = resolveStylePrefix(input.style, worldVisualStyle);
      const descParts = [itemType, extractVisualDescription(itemDesc)].filter(Boolean).join(", ");

      imagePrompt = compileImagePrompt("item", {
        STYLE_PREFIX: stylePrefix,
        SUBJECT: itemName,
        DESCRIPTION: descParts,
        TONE_KEYWORDS: worldTone,
        RARITY_EFFECT: RARITY_EFFECTS[rarity ?? ""] || "",
      });
    }

    const requestId = randomUUID();
    const quality = input.quality || "lightning";
    const negativePrompt = getImageNegativePrompt("item");

    try {
      const result = await generateAndSave(
        {
          prompt: imagePrompt,
          negativePrompt,
          width: RESOLUTION_PRESETS.icon.width,
          height: RESOLUTION_PRESETS.icon.height,
          worldPackId: worldPackId || undefined,
          sessionId: input.sessionId,
          entityType: "item",
          entityId: input.itemId,
          imageRole: "icon",
          filenamePrefix: "item",
        },
        { worldMedia: ctx.worldMedia, sessionMedia: ctx.sessionMedia }
      );

      ctx.onImageGenerated?.({
        type: "item",
        prompt: imagePrompt,
        negativePrompt,
        entityId: input.itemId,
        generationTimeMs: result.generationTimeMs,
        seed: result.seed,
      });

      return {
        requestId,
        prompt: imagePrompt,
        quality,
        entityType: "item" as const,
        entityId: input.itemId,
        entityName,
        rarity: resolvedRarity,
        message: `Item art generated for ${entityName || input.itemId || "item"}.`,
        imageUrl: result.imageUrl,
      };
    } catch (err) {
      console.error(
        "[generate_item_art] pixelgen failed:",
        err instanceof Error ? err.message : err
      );
      return {
        requestId,
        prompt: imagePrompt,
        quality,
        entityType: "item" as const,
        entityId: input.itemId,
        entityName,
        rarity: resolvedRarity,
        message: `Item art generation failed — continuing without image.`,
      };
    }
  },
});
