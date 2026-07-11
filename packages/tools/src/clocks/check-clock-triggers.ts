/**
 * Check Clock Triggers Tool (Shared)
 *
 * Check if any time-based clock stages have triggered based on current game time.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { gameTimeToMinutes, formatDuration } from "@mythxengine/engine";
import { formatGameTime } from "./helpers.js";

/**
 * Input schema for check_clock_triggers
 */
export const CheckClockTriggersInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type CheckClockTriggersInput = z.infer<typeof CheckClockTriggersInputSchema>;

/**
 * Output type for check_clock_triggers
 */
export interface CheckClockTriggersOutput {
  message: string;
  currentTime: string;
  triggered: Array<{
    clockId: string;
    clockName: string;
    stage: number;
    stageName: string;
    stageDescription: string;
  }>;
  approaching: Array<{
    clockId: string;
    clockName: string;
    nextStage: number;
    nextStageName: string;
    minutesUntilTrigger: number;
    timeUntilTrigger: string;
  }>;
  hint?: string;
}

/**
 * Time-based trigger type for clock stages
 */
interface TimeTrigger {
  type: "time";
  minutesFromStart: number;
}

/**
 * Type guard to check if a trigger is time-based
 */
function isTimeTrigger(trigger: unknown): trigger is TimeTrigger {
  if (typeof trigger !== "object" || trigger === null) {
    return false;
  }
  const obj = trigger as Record<string, unknown>;
  return obj.type === "time" && typeof obj.minutesFromStart === "number";
}

/**
 * Check clock triggers tool definition
 */
export const checkClockTriggersTool = defineSharedTool({
  name: "check_clock_triggers",
  description: "Check if any time-based clock stages have triggered based on current game time.",
  inputSchema: CheckClockTriggersInputSchema,

  handler: async (input, ctx): Promise<CheckClockTriggersOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.activeClocks || session.activeClocks.length === 0) {
      return {
        message: "No active clocks",
        currentTime: formatGameTime(session.gameTime),
        triggered: [],
        approaching: [],
      };
    }

    const currentMinutes = gameTimeToMinutes(session.gameTime);
    const triggered: CheckClockTriggersOutput["triggered"] = [];
    const approaching: CheckClockTriggersOutput["approaching"] = [];

    for (const clock of session.activeClocks) {
      if (clock.paused) continue;

      const startMinutes = gameTimeToMinutes(clock.startedAt);
      const elapsedMinutes = currentMinutes - startMinutes;

      // Check stages beyond current
      if (!clock.stages) continue;

      for (let i = clock.currentStage + 1; i < clock.stages.length; i++) {
        const stage = clock.stages[i];
        if (!stage) continue;

        // Use type guard instead of unsafe cast
        if (isTimeTrigger(stage.trigger)) {
          const minutesUntilTrigger = stage.trigger.minutesFromStart - elapsedMinutes;

          if (minutesUntilTrigger <= 0) {
            // This stage has triggered!
            triggered.push({
              clockId: clock.clockId,
              clockName: clock.name,
              stage: i + 1,
              stageName: stage.name,
              stageDescription: stage.description,
            });
          } else if (minutesUntilTrigger <= 60) {
            // Approaching within 1 hour
            approaching.push({
              clockId: clock.clockId,
              clockName: clock.name,
              nextStage: i + 1,
              nextStageName: stage.name,
              minutesUntilTrigger,
              timeUntilTrigger: formatDuration(minutesUntilTrigger),
            });
          }
          // Only check the next time-based stage
          break;
        }
      }
    }

    return {
      message:
        triggered.length > 0
          ? `${triggered.length} clock stage(s) have triggered!`
          : "No clock triggers at current time",
      currentTime: formatGameTime(session.gameTime),
      triggered,
      approaching,
      hint:
        triggered.length > 0
          ? "Use tick_clock to advance these clocks and apply consequences"
          : undefined,
    };
  },
});
