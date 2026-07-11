/**
 * Set Time Tool (Shared)
 *
 * Sets game time (for initialization/GM override).
 */

import { z } from "zod";
import { defineSharedTool, createInitialGameTime, type GameTime } from "@mythxengine/types";

/**
 * Input schema for set_time
 */
export const SetTimeInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  day: z.coerce.number().min(1).optional().describe("Day number (1+)"),
  hour: z.coerce.number().min(0).max(23).optional().describe("Hour (0-23)"),
  minute: z.coerce.number().min(0).max(59).optional().describe("Minute (0-59)"),
});

export type SetTimeInput = z.infer<typeof SetTimeInputSchema>;

/**
 * Time snapshot for output
 */
export interface TimeSnapshot {
  day: number;
  hour: number;
  minute: number;
  formatted: string;
}

/**
 * Output type for set_time
 */
export interface SetTimeOutput {
  previous: TimeSnapshot;
  current: TimeSnapshot;
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
 * Set time tool definition
 */
export const setTimeTool = defineSharedTool({
  name: "set_time",
  description: "Sets game time (for initialization/GM override)",
  inputSchema: SetTimeInputSchema,

  handler: async (input, ctx): Promise<SetTimeOutput> => {
    if (input.day === undefined && input.hour === undefined && input.minute === undefined) {
      throw new Error(
        "set_time requires at least one of day, hour, or minute. " +
          "Pass them as flat top-level params (e.g. { sessionId, day, hour, minute }), " +
          "not nested under a `time` object."
      );
    }

    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Handle sessions created before gameTime was added
    if (!session.gameTime) {
      session.gameTime = createInitialGameTime();
    }

    const previous = { ...session.gameTime };

    // Update only provided fields
    if (input.day !== undefined) session.gameTime.day = input.day;
    if (input.hour !== undefined) session.gameTime.hour = input.hour;
    if (input.minute !== undefined) session.gameTime.minute = input.minute;

    await ctx.sessions.save(session);

    return {
      previous: {
        day: previous.day,
        hour: previous.hour,
        minute: previous.minute,
        formatted: formatGameTime(previous),
      },
      current: {
        day: session.gameTime.day,
        hour: session.gameTime.hour,
        minute: session.gameTime.minute,
        formatted: formatGameTime(session.gameTime),
      },
    };
  },
});
