/**
 * Reveal Clock Tool (Shared)
 *
 * Make a hidden situation clock visible to players. Clocks are
 * GM-state by default — showing them all at session start spoils the
 * threats. This tool flips `playerVisible` on, at the moment the
 * fiction reveals the threat/deadline to the players.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";

/**
 * Input schema for reveal_clock
 */
export const RevealClockInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  clockId: z.string().describe("Clock ID to reveal to players"),
});

export type RevealClockInput = z.infer<typeof RevealClockInputSchema>;

/**
 * Output type for reveal_clock
 */
export interface RevealClockOutput {
  message: string;
  clock: {
    id: string;
    name: string;
    playerVisible: boolean;
    currentStage: number;
    totalStages: number;
  };
}

/**
 * Reveal clock tool definition
 */
export const revealClockTool = defineSharedTool({
  name: "reveal_clock",
  description:
    "Make a hidden situation clock visible to players on their HUD. Call this exactly when your narration reveals the threat or deadline to the players — not before. Until revealed, clocks are GM-only state and may tick in secret.",
  inputSchema: RevealClockInputSchema,
  emits: [EventTypes.CLOCK_REVEALED],

  handler: async (input, ctx): Promise<RevealClockOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.activeClocks || session.activeClocks.length === 0) {
      throw new Error("No active clocks in session");
    }

    const clock = session.activeClocks.find((c) => c.clockId === input.clockId);
    if (!clock) {
      const available = session.activeClocks.map((c) => `"${c.clockId}"`).join(", ");
      throw new Error(`Clock not found: "${input.clockId}". Available: ${available}`);
    }

    const alreadyVisible = clock.playerVisible;
    clock.playerVisible = true;
    await ctx.sessions.save(session);

    if (!alreadyVisible) {
      emitGMEvent(
        ctx.eventBus,
        input.sessionId,
        EventTypes.CLOCK_REVEALED,
        {
          clockId: clock.clockId,
          clockName: clock.name,
        },
        "reveal_clock",
        ctx.currentTurnId
      );
    }

    return {
      message: alreadyVisible
        ? `Clock '${clock.name}' was already visible to players`
        : `Clock '${clock.name}' is now visible to players`,
      clock: {
        id: clock.clockId,
        name: clock.name,
        playerVisible: true,
        currentStage: clock.currentStage + 1,
        totalStages: clock.totalStages,
      },
    };
  },
});
