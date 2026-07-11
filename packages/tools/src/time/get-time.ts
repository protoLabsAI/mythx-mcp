/**
 * Get Time Tool (Shared)
 *
 * Returns current game time and active deadlines.
 */

import { z } from "zod";
import {
  defineSharedTool,
  createInitialGameTime,
  type GameTime,
  type Deadline,
} from "@mythxengine/types";
import { minutesUntil, formatDuration } from "@mythxengine/engine";

/**
 * Input schema for get_time
 */
export const GetTimeInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type GetTimeInput = z.infer<typeof GetTimeInputSchema>;

/**
 * Deadline status in output
 */
export interface DeadlineStatus {
  id: string;
  name: string;
  description: string;
  expiresAt: string;
  minutesRemaining: number;
  timeRemaining: string;
  isExpired: boolean;
  isApproaching: boolean;
}

/**
 * Output type for get_time
 */
export interface GetTimeOutput {
  day: number;
  hour: number;
  minute: number;
  formatted: string;
  deadlines: DeadlineStatus[];
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
 * Get deadline status info
 */
function getDeadlineStatus(deadline: Deadline, currentTime: GameTime): DeadlineStatus {
  const remaining = minutesUntil(currentTime, deadline.expiresAt);
  return {
    id: deadline.id,
    name: deadline.name,
    description: deadline.description,
    expiresAt: formatGameTime(deadline.expiresAt),
    minutesRemaining: remaining,
    timeRemaining: formatDuration(remaining),
    isExpired: remaining <= 0,
    isApproaching: remaining > 0 && remaining <= 60 && deadline.warnOnApproach,
  };
}

/**
 * Get time tool definition
 */
export const getTimeTool = defineSharedTool({
  name: "get_time",
  description: "Returns current game time for session",
  inputSchema: GetTimeInputSchema,

  handler: async (input, ctx): Promise<GetTimeOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Handle sessions created before gameTime was added
    if (!session.gameTime) {
      session.gameTime = createInitialGameTime();
      await ctx.sessions.save(session);
    }

    // Handle sessions created before deadlines was added
    if (!session.deadlines) {
      session.deadlines = [];
    }

    // Get deadline statuses
    const deadlines = session.deadlines.map((d) => getDeadlineStatus(d, session.gameTime));

    return {
      day: session.gameTime.day,
      hour: session.gameTime.hour,
      minute: session.gameTime.minute,
      formatted: formatGameTime(session.gameTime),
      deadlines,
    };
  },
});
