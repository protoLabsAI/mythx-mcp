/**
 * Pause Clock Tool (Shared)
 *
 * Pause an active clock. Time-based triggers will not fire while paused.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";

/**
 * Input schema for pause_clock
 */
export const PauseClockInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  clockId: z.string().describe("Clock ID to pause"),
});

export type PauseClockInput = z.infer<typeof PauseClockInputSchema>;

/**
 * Output type for pause_clock
 */
export interface PauseClockOutput {
  message: string;
  clock: {
    id: string;
    name: string;
    paused: boolean;
    currentStage: number;
    totalStages: number;
  };
}

/**
 * Pause clock tool definition
 */
export const pauseClockTool = defineSharedTool({
  name: "pause_clock",
  description: "Pause an active clock. Time-based triggers will not fire while paused.",
  inputSchema: PauseClockInputSchema,
  emits: [EventTypes.CLOCK_PAUSED],

  handler: async (input, ctx): Promise<PauseClockOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.activeClocks || session.activeClocks.length === 0) {
      throw new Error("No active clocks in session");
    }

    const clock = session.activeClocks.find((c) => c.clockId === input.clockId);
    if (!clock) {
      throw new Error(`Clock not found: ${input.clockId}`);
    }

    clock.paused = true;
    await ctx.sessions.save(session);

    // Emit paused event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.CLOCK_PAUSED,
      {
        clockId: clock.clockId,
        clockName: clock.name,
      },
      "pause_clock",
      ctx.currentTurnId
    );

    return {
      message: `Clock '${clock.name}' paused`,
      clock: {
        id: clock.clockId,
        name: clock.name,
        paused: true,
        currentStage: clock.currentStage + 1,
        totalStages: clock.totalStages,
      },
    };
  },
});
