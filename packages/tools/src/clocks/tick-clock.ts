/**
 * Tick Clock Tool (Shared)
 *
 * Manually advance a clock to its next stage.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";

/**
 * Input schema for tick_clock
 */
export const TickClockInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  clockId: z.string().describe("Clock ID to advance"),
  reveal: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Also make the clock player-visible (tick-and-reveal in one call). Defaults to false — ticking does NOT reveal a hidden clock, so hidden doom can advance off-screen."
    ),
});

export type TickClockInput = z.infer<typeof TickClockInputSchema>;

/**
 * Output type for tick_clock
 */
export interface TickClockOutput {
  message: string;
  previousStage?: {
    /** 1-based stage number (stage N of totalStages), matching get_active_clocks. */
    stage: number;
    name: string;
  };
  currentStage?: {
    /** 1-based stage number (stage N of totalStages), matching get_active_clocks. */
    stage: number;
    name: string;
    description: string;
    narrative?: string;
  };
  stagesRemaining?: number;
  doom: string;
  flagsSet: string[];
  clockRemoved?: boolean;
  finalStage?: {
    name: string;
    description: string;
    narrative?: string;
  };
}

/**
 * Tick clock tool definition
 */
export const tickClockTool = defineSharedTool({
  name: "tick_clock",
  description:
    "Manually advance a clock to its next stage. Use for event-based triggers or GM override.",
  inputSchema: TickClockInputSchema,
  emits: [EventTypes.CLOCK_TICKED],

  // Gate: clock must exist on the session and not be paused. The
  // handler still validates these inside (and throws), but moving
  // the check to the gate gives the LLM a structured "this clock
  // doesn't exist / is paused" reply rather than a thrown error
  // mid-narration.
  gate: async (input, ctx) => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      return { allow: false, reason: `Session not found: ${input.sessionId}.` };
    }
    if (!session.activeClocks || session.activeClocks.length === 0) {
      return {
        allow: false,
        reason:
          "No active clocks on this session. Use `start_situation_clock` to start one before ticking.",
      };
    }
    const clock = session.activeClocks.find((c) => c.clockId === input.clockId);
    if (!clock) {
      const available = session.activeClocks.map((c) => `"${c.clockId}"`).join(", ");
      return {
        allow: false,
        reason: `Clock not found: "${input.clockId}". Available: ${available}.`,
      };
    }
    if (clock.paused) {
      return {
        allow: false,
        reason: `Clock "${clock.name}" is paused. Resume it with \`resume_clock\` before ticking.`,
      };
    }
    return { allow: true };
  },

  handler: async (input, ctx): Promise<TickClockOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.activeClocks) {
      throw new Error("No active clocks in session");
    }

    const clockIndex = session.activeClocks.findIndex((c) => c.clockId === input.clockId);
    if (clockIndex === -1) {
      throw new Error(`Clock not found: ${input.clockId}`);
    }

    const clock = session.activeClocks[clockIndex];

    if (clock.paused) {
      throw new Error(`Clock '${clock.name}' is paused`);
    }

    // Tick-and-reveal in one call. Ticking alone never reveals —
    // hidden doom may advance off-screen until the fiction surfaces it.
    if (input.reveal) {
      clock.playerVisible = true;
    }

    const previousStage = clock.currentStage;
    const previousStageDef = clock.stages[previousStage];

    // Check if already at final stage
    if (clock.currentStage >= clock.totalStages - 1) {
      // Clock has reached doom
      const finalStage = clock.stages[clock.totalStages - 1];

      // Apply consequences
      const consequences = finalStage.consequences as {
        setFlags?: string[];
        narrative?: string;
      };

      if (consequences.setFlags) {
        for (const flag of consequences.setFlags) {
          if (!session.flags.includes(flag)) {
            session.flags.push(flag);
          }
        }
      }

      // Remove clock from active list
      session.activeClocks.splice(clockIndex, 1);
      await ctx.sessions.save(session);

      // Emit doom event
      emitGMEvent(
        ctx.eventBus,
        input.sessionId,
        EventTypes.CLOCK_TICKED,
        {
          id: clock.clockId,
          name: clock.name,
          segments: clock.totalStages,
          filled: clock.totalStages,
          type: "countdown" as const,
          doom: true,
        },
        "tick_clock",
        ctx.currentTurnId
      );

      return {
        message: `DOOM: Clock '${clock.name}' has reached its conclusion!`,
        doom: clock.doom,
        finalStage: {
          name: finalStage.name,
          description: finalStage.description,
          narrative: consequences.narrative,
        },
        flagsSet: consequences.setFlags || [],
        clockRemoved: true,
      };
    }

    // Advance to next stage
    clock.currentStage++;
    const newStage = clock.stages[clock.currentStage];

    // Apply consequences of the new stage
    const consequences = newStage.consequences as {
      setFlags?: string[];
      removeFlags?: string[];
      narrative?: string;
    };

    if (consequences.setFlags) {
      for (const flag of consequences.setFlags) {
        if (!session.flags.includes(flag)) {
          session.flags.push(flag);
        }
      }
    }

    if (consequences.removeFlags) {
      session.flags = session.flags.filter((f) => !consequences.removeFlags!.includes(f));
    }

    await ctx.sessions.save(session);

    // Emit tick event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.CLOCK_TICKED,
      {
        id: clock.clockId,
        name: clock.name,
        segments: clock.totalStages,
        filled: clock.currentStage + 1,
        type: "countdown" as const,
      },
      "tick_clock",
      ctx.currentTurnId
    );

    return {
      message: `Clock '${clock.name}' advanced to stage ${clock.currentStage + 1}/${clock.totalStages}`,
      previousStage: {
        stage: previousStage + 1,
        name: previousStageDef.name,
      },
      currentStage: {
        stage: clock.currentStage + 1,
        name: newStage.name,
        description: newStage.description,
        narrative: consequences.narrative,
      },
      stagesRemaining: clock.totalStages - clock.currentStage - 1,
      doom: clock.doom,
      flagsSet: consequences.setFlags || [],
    };
  },
});
