/**
 * Frame Scene Tool (Shared)
 *
 * Generate an opening description for a new scene. Uses location data and tone.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import type { GameTime, ToolContext } from "@mythxengine/types";
import { generateSceneImageTool } from "../imagegen/generate-scene-image.js";
import { EventTypes } from "../events/channels.js";
import { emitSceneFramed } from "../events/emitters.js";

/**
 * Input schema for frame_scene
 */
export const FrameSceneInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  locationId: z.string().optional().describe("Location ID from world pack"),
  locationName: z.string().optional().describe("Location name if no ID"),
  timeOfDay: z.string().optional().describe("Time context (optional)"),
  mood: z.string().optional().describe("Desired mood (optional)"),
  focusOn: z.array(z.string()).optional().describe("Elements to emphasize (optional)"),
  layout: z
    .enum(["splash", "exploration", "dialogue", "combat", "transition"])
    .optional()
    .default("exploration")
    .describe("Scene layout type (default: exploration)"),
});

export type FrameSceneInput = z.infer<typeof FrameSceneInputSchema>;

/**
 * Output type for frame_scene
 */
export interface FrameSceneOutput {
  framing: {
    location: string;
    timeContext: string;
    atmosphere: string;
    sensory: string[];
  };
  description: {
    opening: string;
    atmosphere: string;
    details: string;
    focus?: string;
  };
  promptForPlayers: string;
  tip: string;
  layout: "splash" | "exploration" | "dialogue" | "combat" | "transition";
  /** Auto-generated scene image URL (from integrated image generation) */
  imageUrl?: string;
}

/**
 * Format game time as human-readable string
 */
function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}

/**
 * Get time of day description
 */
function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 8) return "early morning";
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  if (hour >= 20 && hour < 23) return "night";
  return "late night";
}

/**
 * Pull a location entry out of the active world pack. Mirrors the
 * pattern in `set_party_location` (packages/tools/src/location/
 * set-party-location.ts:74) — the compiled pack is the canonical
 * source of location data, not session.generation (which is null for
 * any session created through the world-gen pipeline since the cc-
 * 2.18 refactor).
 *
 * Returns the location entry's relevant fields when found, or null
 * when the pack/location can't be resolved. The caller already
 * fallback-handles a null return (locationName from input, neutral
 * atmosphere, etc.), so a missing-pack scenario doesn't have to
 * throw.
 */
async function getLocation(
  ctx: ToolContext,
  worldPackId: string | null | undefined,
  locationId: string
): Promise<{
  name: string;
  description: string;
  atmosphere: string;
  type: string;
  features: string[];
} | null> {
  if (!worldPackId) return null;
  const pack = (await ctx.worldPacks.get(worldPackId)) as {
    locations?: Record<
      string,
      {
        name?: string;
        description?: string;
        atmosphere?: string;
        type?: string;
        features?: string[];
      }
    >;
  } | null;
  const entry = pack?.locations?.[locationId];
  if (!entry) return null;
  return {
    name: entry.name ?? locationId,
    description: entry.description ?? "",
    atmosphere: entry.atmosphere ?? "neutral",
    type: entry.type ?? "",
    features: Array.isArray(entry.features) ? entry.features : [],
  };
}

/**
 * Frame scene tool definition
 */
export const frameSceneTool = defineSharedTool({
  name: "frame_scene",
  description:
    "Generate an opening description for a new scene. Uses location data and tone to create engaging scene framing.",
  inputSchema: FrameSceneInputSchema,
  emits: [EventTypes.SCENE_FRAMED],

  handler: async (input, ctx): Promise<FrameSceneOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Get location details if ID provided
    let location: {
      name: string;
      description: string;
      atmosphere: string;
      type: string;
      features: string[];
    } | null = null;

    if (input.locationId) {
      location = await getLocation(ctx, session.worldPackId, input.locationId);
    }

    const locationName = location?.name || input.locationName || "the area";
    const timeOfDay = input.timeOfDay || getTimeOfDay(session.gameTime.hour);

    // Build sensory elements
    const sensoryDetails: string[] = [];

    if (location) {
      // Use location atmosphere
      sensoryDetails.push(`Atmosphere: ${location.atmosphere}`);

      // Add features
      if (location.features && location.features.length > 0) {
        sensoryDetails.push(`Features: ${location.features.slice(0, 3).join(", ")}`);
      }
    }

    // Add time-based sensory hints
    const timeDetails: Record<string, string> = {
      "early morning":
        "The air is cool, dew still clinging to surfaces. Early light casts long shadows.",
      morning: "Bright daylight illuminates the area. The day's activity is building.",
      midday: "The sun is high, shadows at their shortest. Heat radiates from exposed surfaces.",
      afternoon: "Golden afternoon light slants across the scene. The day begins to wind down.",
      evening: "Sunset colors paint the sky. Shadows lengthen as darkness approaches.",
      night: "Darkness has fallen. Torchlight or moonlight provides the only illumination.",
      "late night": "Deep night. The world is quiet, sounds carrying far in the stillness.",
    };

    if (timeDetails[timeOfDay]) {
      sensoryDetails.push(`Time: ${timeDetails[timeOfDay]}`);
    }

    // Build the framing components
    const framingElements = {
      location: locationName,
      timeContext: `${formatGameTime(session.gameTime)} - ${timeOfDay}`,
      atmosphere: location?.atmosphere || input.mood || "neutral",
      sensory: sensoryDetails,
    };

    // Generate description structure
    const descriptionTemplate = {
      opening: `You arrive at ${locationName} as ${timeOfDay} settles in.`,
      atmosphere: location?.atmosphere || "The atmosphere is expectant.",
      details: location?.features?.slice(0, 2).join(". ") || "Take in your surroundings.",
      focus: input.focusOn ? `You notice: ${input.focusOn.join(", ")}` : undefined,
    };

    // Generate prompt for players
    const prompts = [
      "What catches your attention first?",
      "How do you approach?",
      "What's your first move?",
    ];

    // Auto-generate a scene image (fire-and-forget, don't block on failure)
    let imageUrl: string | undefined;
    try {
      const imageResult = await generateSceneImageTool.handler(
        {
          sessionId: input.sessionId,
          locationId: input.locationId,
          quality: "lightning",
        },
        ctx
      );
      imageUrl = imageResult.imageUrl;
    } catch {
      // Image generation failed — continue without image
    }

    // Training-corpus emit. Flatten the structured description into
    // the single text blob the narrator-fine-tune wants. locationId
    // helps stratify by world geography; tone falls back to the
    // location's atmosphere when the caller didn't supply a mood.
    try {
      const descriptionText = [
        descriptionTemplate.opening,
        descriptionTemplate.atmosphere,
        descriptionTemplate.details,
        descriptionTemplate.focus,
      ]
        .filter(Boolean)
        .join(" ");
      emitSceneFramed(
        ctx.eventBus,
        input.sessionId,
        {
          ...(input.locationId ? { locationId: input.locationId } : {}),
          description: descriptionText,
          ...(input.mood
            ? { tone: input.mood }
            : location?.atmosphere
              ? { tone: location.atmosphere }
              : {}),
        },
        "frame_scene",
        ctx.currentTurnId
      );
    } catch {
      // EventBus unavailable — non-fatal
    }

    return {
      framing: framingElements,
      description: descriptionTemplate,
      promptForPlayers: prompts[Math.floor(Math.random() * prompts.length)],
      tip: "Establish the scene quickly, then ask what they do. Don't over-describe before players engage.",
      layout: input.layout,
      imageUrl,
    };
  },
});
