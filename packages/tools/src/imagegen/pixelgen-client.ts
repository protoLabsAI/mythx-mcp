/**
 * Pixelgen HTTP client — shared by all imagegen tools.
 *
 * Prefers IMAGE_API_URL (OpenAI-compatible /v1/images/generations endpoint,
 * e.g. the LiteLLM gateway) when set. Falls back to direct pixelgen custom API.
 */

import { randomUUID } from "crypto";
import type { IWorldMediaManager, ISessionMediaManager } from "@mythxengine/types";

const IMAGE_API_URL = process.env.IMAGE_API_URL;
const IMAGE_MODEL = process.env.IMAGE_MODEL || "pixel-art";
const IMAGE_API_KEY = process.env.IMAGE_API_KEY || "none";
const PIXELGEN_URL = process.env.PIXELGEN_URL || "http://localhost:7863";

export interface PixelgenParams {
  prompt: string;
  /**
   * Negative prompt for SDXL guidance. Optional — defaults to empty string
   * (no negative constraints). Callers should pass getImageNegativePrompt(type)
   * from prompt-loader for template-driven negatives.
   */
  negativePrompt?: string;
  width: number;
  height: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  pixelCleanup?: boolean;
  pixelUpscale?: number;
}

export interface PixelgenResult {
  imageBuffer: Buffer;
  seed: number;
  generationTimeMs: number;
}

/**
 * Call the configured image backend and return the image buffer + metadata.
 * Uses OpenAI /v1/images/generations when IMAGE_API_URL is set (gateway path),
 * otherwise falls back to direct pixelgen custom API. Throws on failure. 30s timeout.
 */
export async function callPixelgen(params: PixelgenParams): Promise<PixelgenResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    if (IMAGE_API_URL) {
      const response = await fetch(`${IMAGE_API_URL}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${IMAGE_API_KEY}`,
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt: params.prompt,
          n: 1,
          size: `${params.width}x${params.height}`,
          response_format: "b64_json",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`image API HTTP ${response.status}: ${text}`);
      }

      const data = (await response.json()) as { data: Array<{ b64_json: string }> };
      const imageBuffer = Buffer.from(data.data[0].b64_json, "base64");
      return { imageBuffer, seed: params.seed || 0, generationTimeMs: 0 };
    }

    // Direct pixelgen path
    const response = await fetch(`${PIXELGEN_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: params.prompt,
        // Empty string = no negative constraints. Callers should pass explicit per-type negatives.
        negative_prompt: params.negativePrompt || "",
        width: params.width,
        height: params.height,
        steps: params.steps || 4,
        cfg_scale: params.cfgScale || 1.5,
        quality: "lightning",
        pixel_cleanup: params.pixelCleanup ?? true,
        upscale_factor: params.pixelUpscale ?? 4,
        seed: params.seed,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`pixelgen HTTP ${response.status}: ${text}`);
    }

    const seed = parseInt(response.headers.get("X-Seed") || String(params.seed || 0), 10);
    const generationTimeMs = parseInt(response.headers.get("X-Generation-Time-Ms") || "0", 10);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    return { imageBuffer, seed, generationTimeMs };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate an image, save to world or session media, return the public URL.
 *
 * If worldPackId + entityId are provided, saves to world media (lazy-cache).
 * Otherwise saves to session media (runtime).
 */
export async function generateAndSave(
  params: PixelgenParams & {
    worldPackId?: string;
    sessionId: string;
    entityType?: string;
    entityId?: string;
    imageRole?: string;
    filenamePrefix?: string;
  },
  ctx: {
    worldMedia?: IWorldMediaManager;
    sessionMedia?: ISessionMediaManager;
  }
): Promise<{ imageUrl?: string; seed: number; generationTimeMs: number }> {
  const result = await callPixelgen(params);

  const mediaId = randomUUID();
  const prefix = params.filenamePrefix || "gen";
  const filename = `${prefix}_${mediaId.slice(0, 8)}_${result.seed}.png`;

  const entry = {
    id: mediaId,
    filename,
    mimeType: "image/png",
    entityType: params.entityType,
    entityId: params.entityId,
    role: params.imageRole,
    sizeBytes: result.imageBuffer.length,
    createdAt: new Date().toISOString(),
  };

  const isWorldEntity = params.worldPackId && params.entityId;

  if (isWorldEntity && ctx.worldMedia) {
    await ctx.worldMedia.save(params.worldPackId!, entry, result.imageBuffer);
    return {
      imageUrl: `/api/media/world/${params.worldPackId}/${filename}`,
      seed: result.seed,
      generationTimeMs: result.generationTimeMs,
    };
  }

  // Session media fallback
  if (ctx.sessionMedia) {
    await ctx.sessionMedia.save(params.sessionId, entry, result.imageBuffer);
    return {
      imageUrl: `/api/media/${params.sessionId}/${filename}`,
      seed: result.seed,
      generationTimeMs: result.generationTimeMs,
    };
  }

  // No storage available — return without imageUrl (callers handle gracefully)
  return {
    seed: result.seed,
    generationTimeMs: result.generationTimeMs,
  };
}
