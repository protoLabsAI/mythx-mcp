/**
 * Resume Clock Tool (Shared)
 *
 * Resume a paused clock.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";

/**
 * Input schema for resume_clock
 */
export const ResumeClockInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  clockId: z.string().describe("Clock ID to resume"),
});

export type ResumeClockInput = z.infer<typeof ResumeClockInputSchema>;

/**
 * Output type for resume_clock
 */
export interface ResumeClockOutput {
  message: string;
  clock: {
    id: string;
    name: string;
    paused: boolean;
    currentStage: number;
    totalStages: number;
    doom: string;
  };
}

/**
 * Resume clock tool definition
 */
export const resumeClockTool = defineSharedTool({
  name: "resume_clock",
  description: "Resume a paused clock.",
  inputSchema: ResumeClockInputSchema,
  emits: [EventTypes.CLOCK_RESUMED],

  handler: async (input, ctx): Promise<ResumeClockOutput> => {
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

    clock.paused = false;
    await ctx.sessions.save(session);

    // Emit resumed event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.CLOCK_RESUMED,
      {
        clockId: clock.clockId,
        clockName: clock.name,
      },
      "resume_clock",
      ctx.currentTurnId
    );

    return {
      message: `Clock '${clock.name}' resumed`,
      clock: {
        id: clock.clockId,
        name: clock.name,
        paused: false,
        currentStage: clock.currentStage + 1,
        totalStages: clock.totalStages,
        doom: clock.doom,
      },
    };
  },
});
