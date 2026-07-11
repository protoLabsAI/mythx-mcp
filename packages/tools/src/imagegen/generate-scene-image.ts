/**
 * Generate Scene Image Tool (Shared)
 *
 * Agent-callable tool that triggers scene image generation via the SDXL pipeline.
 * Builds an image prompt from location data and world aesthetic, then emits
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
 * Input schema for generate_scene_image
 */
export const GenerateSceneImageInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  locationId: z
    .string()
    .optional()
    .describe("Location ID from world pack (uses location description for prompt)"),
  prompt: z.string().optional().describe("Custom image prompt (overrides auto-generated prompt)"),
  style: z
    .string()
    .optional()
    .describe("Visual style hint (e.g. '16-bit pixel art', 'watercolor')"),
  quality: z
    .enum(["lightning"])
    .optional()
    .default("lightning")
    .describe("Image quality preset (lightning only — ~0.25s via pixelgen)"),
  caption: z.string().optional().describe("Caption to display with the image"),
});

export type GenerateSceneImageInput = z.infer<typeof GenerateSceneImageInputSchema>;

/**
 * Output type for generate_scene_image
 */
export interface GenerateSceneImageOutput {
  requestId: string;
  prompt: string;
  quality: string;
  message: string;
  imageUrl?: string;
}

/**
 * Get location from session's generated content
 */
function getLocation(
  session: {
    generation?: {
      generatedContent: { locations: unknown[] };
    };
  },
  locationId: string
): {
  id: string;
  name: string;
  description: string;
  atmosphere: string;
  type: string;
  features: string[];
} | null {
  if (!session.generation?.generatedContent?.locations) {
    return null;
  }
  const locations = session.generation.generatedContent.locations as Array<{
    id: string;
    name: string;
    description: string;
    atmosphere: string;
    type: string;
    features: string[];
  }>;
  return locations.find((l) => l.id === locationId) || null;
}

/**
 * Generate scene image tool definition
 */
export const generateSceneImageTool = defineSharedTool({
  name: "generate_scene_image",
  description:
    "Generate a scene image for the current location. Triggers SDXL image generation and displays the result in the chat. Use when the party arrives at a new location or during dramatic scene transitions.",
  inputSchema: GenerateSceneImageInputSchema,

  // Gate: image-generation skill required. The skill body documents
  // when mid-scene scene images add value (storms, building collapse,
  // boss reveals) vs. when frame_scene's bundled image already
  // covers the moment.
  gate: requireSkill("image-generation"),

  handler: async (input, ctx): Promise<GenerateSceneImageOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Check world pack media cache
    const worldPackId = session.worldPackId;
    if (worldPackId && input.locationId && ctx.worldMedia) {
      const cached = await ctx.worldMedia.listByEntity(worldPackId, "location", input.locationId);
      const match = cached.find((e) => e.role === "scene");
      if (match) {
        return {
          requestId: randomUUID(),
          prompt: "(cached)",
          quality: "lightning",
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
      let locationName = "mysterious location";
      let descParts = "";

      if (input.locationId) {
        const location = getLocation(session, input.locationId);
        if (location) {
          locationName = location.name;
          descParts = [
            extractVisualDescription(location.description),
            location.atmosphere ? `${location.atmosphere} atmosphere` : "",
            location.features?.slice(0, 3).join(", ") || "",
          ]
            .filter(Boolean)
            .join(", ");
        } else {
          locationName = input.locationId;
        }
      }

      const stylePrefix = resolveStylePrefix(input.style, worldVisualStyle);
      imagePrompt = compileImagePrompt("scene", {
        STYLE_PREFIX: stylePrefix,
        SUBJECT: locationName,
        DESCRIPTION: descParts,
        TONE_KEYWORDS: worldTone,
      });
    }

    const requestId = randomUUID();
    const quality = input.quality || "lightning";
    const negativePrompt = getImageNegativePrompt("scene");

    // Call pixelgen directly and save the result
    try {
      const result = await generateAndSave(
        {
          prompt: imagePrompt,
          negativePrompt,
          width: RESOLUTION_PRESETS.scene.width,
          height: RESOLUTION_PRESETS.scene.height,
          worldPackId: worldPackId || undefined,
          sessionId: input.sessionId,
          entityType: input.locationId ? "location" : undefined,
          entityId: input.locationId,
          imageRole: "scene",
          filenamePrefix: "scene",
        },
        { worldMedia: ctx.worldMedia, sessionMedia: ctx.sessionMedia }
      );

      ctx.onImageGenerated?.({
        type: "scene",
        prompt: imagePrompt,
        negativePrompt,
        entityId: input.locationId,
        generationTimeMs: result.generationTimeMs,
        seed: result.seed,
      });

      return {
        requestId,
        prompt: imagePrompt,
        quality,
        message: `Scene image generated.`,
        imageUrl: result.imageUrl,
      };
    } catch (err) {
      // Generation failed — return without image, don't break the game
      console.error(
        "[generate_scene_image] pixelgen failed:",
        err instanceof Error ? err.message : err
      );
      return {
        requestId,
        prompt: imagePrompt,
        quality,
        message: `Scene image generation failed — continuing without image.`,
      };
    }
  },
});
