/**
 * Get Active Clocks Tool (Shared)
 *
 * List all active situation clocks with their current status.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { gameTimeToMinutes, formatDuration } from "@mythxengine/engine";
import { formatGameTime } from "./helpers.js";

/**
 * Input schema for get_active_clocks
 */
export const GetActiveClocksInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type GetActiveClocksInput = z.infer<typeof GetActiveClocksInputSchema>;

/**
 * Output type for get_active_clocks
 */
export interface GetActiveClocksOutput {
  message: string;
  currentTime?: string;
  clocks: Array<{
    id: string;
    name: string;
    situationId: string;
    doom: string;
    startedAt: string;
    minutesSinceStart: number;
    timeSinceStart: string;
    currentStage: number;
    totalStages: number;
    currentStageName: string;
    stagesRemaining: number;
    paused: boolean;
    /** false = hidden from players (GM-only); reveal via reveal_clock. */
    playerVisible: boolean;
  }>;
}

/**
 * Get active clocks tool definition
 */
export const getActiveClocksTool = defineSharedTool({
  name: "get_active_clocks",
  description: "List all active situation clocks with their current status.",
  inputSchema: GetActiveClocksInputSchema,

  handler: async (input, ctx): Promise<GetActiveClocksOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.activeClocks || session.activeClocks.length === 0) {
      return {
        message: "No active clocks",
        clocks: [],
      };
    }

    const clocks = session.activeClocks.map((clock) => {
      const currentStageDef = clock.stages[clock.currentStage];
      const minutesSinceStart =
        gameTimeToMinutes(session.gameTime) - gameTimeToMinutes(clock.startedAt);

      return {
        id: clock.clockId,
        name: clock.name,
        situationId: clock.situationId,
        doom: clock.doom,
        startedAt: formatGameTime(clock.startedAt),
        minutesSinceStart,
        timeSinceStart: formatDuration(minutesSinceStart),
        currentStage: clock.currentStage + 1,
        totalStages: clock.totalStages,
        currentStageName: currentStageDef?.name || "Unknown",
        stagesRemaining: clock.totalStages - clock.currentStage - 1,
        paused: clock.paused,
        playerVisible: clock.playerVisible,
      };
    });

    return {
      message: `${clocks.length} active clock(s)`,
      currentTime: formatGameTime(session.gameTime),
      clocks,
    };
  },
});
