/**
 * Generate Portrait Tool (Shared)
 *
 * Agent-callable tool that triggers NPC/character portrait generation
 * via the SDXL pipeline. Builds a portrait prompt from NPC data and
 * world aesthetic, then emits an IMAGEGEN_REQUEST event.
 */

import { randomUUID } from "crypto";
import { z } from "zod";
import { defineSharedTool, type Character, type NPC } from "@mythxengine/types";
import { requireSkill } from "../skills/load-skill.js";
import { RESOLUTION_PRESETS, resolveStylePrefix } from "./defaults.js";
import { generateAndSave } from "./pixelgen-client.js";
import {
  compileImagePrompt,
  getImageNegativePrompt,
  extractVisualDescription,
} from "./prompt-loader.js";

/**
 * Input schema for generate_portrait
 */
export const GeneratePortraitInputSchema = z
  .object({
    sessionId: z.string().describe("Session ID"),
    npcId: z
      .string()
      .optional()
      .describe("NPC ID from world pack (uses NPC description for prompt)"),
    characterId: z
      .string()
      .optional()
      .describe("Player character ID (for player portrait generation)"),
    name: z.string().optional().describe("Character name (used if no NPC/character ID)"),
    description: z
      .string()
      .optional()
      .describe("Character appearance description (used if no NPC/character ID)"),
    prompt: z
      .string()
      .optional()
      .describe("Custom portrait prompt (overrides auto-generated prompt)"),
    style: z.string().optional().describe("Visual style hint (e.g. '16-bit pixel art portrait')"),
    quality: z
      .enum(["lightning"])
      .optional()
      .default("lightning")
      .describe("Image quality preset (lightning only — ~0.25s via pixelgen)"),
  })
  // Mutually exclusive: passing both meant the prompt path used `npcId`
  // (and runtime-NPC routing) while `entityType`/`entityId` flipped to
  // archetype, leaving the response misreporting which entity got the
  // image. Reject the combo at the boundary instead of carrying the
  // ambiguity into the handler.
  .superRefine((value, ctx) => {
    if (value.npcId && value.characterId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["characterId"],
        message: "Provide either npcId or characterId, not both.",
      });
    }
  });

export type GeneratePortraitInput = z.infer<typeof GeneratePortraitInputSchema>;

/**
 * Output type for generate_portrait
 */
export interface GeneratePortraitOutput {
  requestId: string;
  prompt: string;
  quality: string;
  entityType: "npc" | "archetype";
  entityId?: string;
  entityName?: string;
  message: string;
  imageUrl?: string;
}

/**
 * Get NPC from session's generated content
 */
function getNPC(
  session: {
    generation?: {
      generatedContent: { npcs: unknown[] };
    };
  },
  npcId: string
): {
  id: string;
  name: string;
  description: string;
  role: string;
  species?: string;
} | null {
  if (!session.generation?.generatedContent?.npcs) {
    return null;
  }
  const npcs = session.generation.generatedContent.npcs as Array<{
    id: string;
    name: string;
    description: string;
    role: string;
    species?: string;
  }>;
  return npcs.find((n) => n.id === npcId) || null;
}

/**
 * Generate portrait tool definition
 */
export const generatePortraitTool = defineSharedTool({
  name: "generate_portrait",
  description:
    "Generate a portrait image for an NPC or character. Triggers SDXL image generation. Use when introducing a new NPC or when the player first meets a character.",
  inputSchema: GeneratePortraitInputSchema,

  // Gate: image-generation skill required. The skill body documents
  // portrait prompt construction (upper-body framing, visual keywords
  // over narrative lore) and the add_npc → generate_portrait →
  // showDialogue contract for fabricated NPCs. Calling without
  // loading it leads to scene-shaped prompts that SDXL renders as
  // wide shots instead of portraits.
  gate: requireSkill("image-generation"),

  handler: async (input, ctx): Promise<GeneratePortraitOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Determine entity type and ID
    let entityType: "npc" | "archetype" = "npc";
    let entityId = input.npcId;

    if (input.characterId) {
      entityType = "archetype";
      entityId = input.characterId;
    }

    // Runtime NPCs (registered via `add_npc`) live on `session.npcs`
    // rather than the world pack. We must NOT save their portraits to
    // world media — that pollutes the pack. Instead we route to session
    // media and write the URL back onto the runtime record so dialogue
    // lookups can find it.
    const runtimeNpc =
      input.npcId &&
      ((session.npcs as Record<string, NPC> | undefined)?.[input.npcId]?.runtime ?? false)
        ? (session.npcs as Record<string, NPC>)[input.npcId]
        : null;

    // Resolve display name once — used by every return path so the
    // server-display card has a label without needing the agent to
    // remember a follow-up `showPortrait` call.
    let entityName: string | undefined = input.name;
    if (!entityName) {
      if (input.npcId) {
        entityName = runtimeNpc?.name ?? getNPC(session, input.npcId)?.name;
      } else if (input.characterId) {
        const chars = session.characters as Record<string, Character> | undefined;
        entityName = chars?.[input.characterId]?.name;
      }
    }

    // If a runtime NPC already has a portrait URL, return it directly —
    // no regeneration. The agent re-calls generate_portrait when the
    // NPC is referenced again; we serve the cached session-media URL.
    if (runtimeNpc?.images?.portrait?.url) {
      return {
        requestId: randomUUID(),
        prompt: "(cached)",
        quality: "lightning",
        entityType,
        entityId,
        entityName,
        message: `Portrait already cached for runtime NPC.`,
        imageUrl: runtimeNpc.images.portrait.url,
      };
    }

    // Check world pack media cache (only for non-runtime entities).
    const worldPackId = session.worldPackId;
    if (!runtimeNpc && worldPackId && entityId && ctx.worldMedia) {
      const cached = await ctx.worldMedia.listByEntity(worldPackId, entityType, entityId);
      const match = cached.find((e) => e.role === "portrait");
      if (match) {
        return {
          requestId: randomUUID(),
          prompt: "(cached)",
          quality: "lightning",
          entityType,
          entityId,
          entityName,
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
      // Determine name and description from NPC data, character data, or input
      let name = input.name || "mysterious figure";
      let description = input.description;
      let role: string | undefined;

      if (runtimeNpc) {
        name = runtimeNpc.name;
        description = runtimeNpc.description || description;
        role = runtimeNpc.narrativeRole;
      } else if (input.npcId) {
        const npc = getNPC(session, input.npcId);
        if (npc) {
          name = npc.name;
          description = npc.description;
          role = npc.role;
        }
      } else if (input.characterId) {
        // Look up player character from session (name is on Character, visual description via input)
        const chars = session.characters as Record<string, Character> | undefined;
        const char = chars?.[input.characterId];
        if (char) {
          name = char.name;
        }
      }

      const stylePrefix = resolveStylePrefix(input.style, worldVisualStyle);
      const descParts = [role, extractVisualDescription(description)].filter(Boolean).join(", ");

      imagePrompt = compileImagePrompt("portrait", {
        STYLE_PREFIX: stylePrefix,
        SUBJECT: name,
        DESCRIPTION: descParts,
        TONE_KEYWORDS: worldTone,
      });
    }

    const requestId = randomUUID();
    const quality = input.quality || "lightning";
    const negativePrompt = getImageNegativePrompt("portrait");

    try {
      const result = await generateAndSave(
        {
          prompt: imagePrompt,
          negativePrompt,
          width: RESOLUTION_PRESETS.portrait.width,
          height: RESOLUTION_PRESETS.portrait.height,
          // Runtime NPCs route to session media (the world pack is
          // intentionally read-only at runtime). Passing `undefined`
          // here bypasses the world-entity branch in generateAndSave.
          worldPackId: runtimeNpc ? undefined : worldPackId || undefined,
          sessionId: input.sessionId,
          entityType,
          entityId,
          imageRole: "portrait",
          filenamePrefix: "portrait",
        },
        { worldMedia: ctx.worldMedia, sessionMedia: ctx.sessionMedia }
      );

      // Persist the URL back onto the runtime NPC record so
      // subsequent dialogue/portrait lookups find it without
      // re-querying media storage.
      if (runtimeNpc && result.imageUrl) {
        runtimeNpc.images = {
          ...(runtimeNpc.images ?? {}),
          portrait: { url: result.imageUrl, alt: runtimeNpc.name },
        };
        await ctx.sessions.save(session);
      }

      ctx.onImageGenerated?.({
        type: "portrait",
        prompt: imagePrompt,
        negativePrompt,
        entityId,
        generationTimeMs: result.generationTimeMs,
        seed: result.seed,
      });

      return {
        requestId,
        prompt: imagePrompt,
        quality,
        entityType,
        entityId,
        entityName,
        message: `Portrait generated for ${entityName || input.npcId || "character"}.`,
        imageUrl: result.imageUrl,
      };
    } catch (err) {
      console.error(
        "[generate_portrait] pixelgen failed:",
        err instanceof Error ? err.message : err
      );
      return {
        requestId,
        prompt: imagePrompt,
        quality,
        entityType,
        entityId,
        entityName,
        message: `Portrait generation failed — continuing without image.`,
      };
    }
  },
});
