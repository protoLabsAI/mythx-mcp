/**
 * End Turns Tool (Shared)
 *
 * End turn-based coordination and return to free-form play.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for end_turns
 */
export const EndTurnsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type EndTurnsInput = z.infer<typeof EndTurnsInputSchema>;

/**
 * Output type for end_turns
 */
export interface EndTurnsOutput {
  message: string;
  totalRounds?: number;
  strategy?: string;
}

/**
 * End turns tool definition
 */
export const endTurnsTool = defineSharedTool({
  name: "end_turns",
  description: "End turn-based coordination and return to free-form play",
  inputSchema: EndTurnsInputSchema,

  handler: async (input, ctx): Promise<EndTurnsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.turns) {
      return {
        message: "No turn coordination was active",
      };
    }

    const summary = {
      totalRounds: session.turns.round,
      strategy: session.turns.strategy,
    };

    // Clear pending actions from all players
    const players = session.players || {};
    for (const player of Object.values(players)) {
      delete player.pendingAction;
      if (player.status === "waiting_for_input") {
        player.status = "active";
      }
    }

    session.turns = null;
    await ctx.sessions.save(session);

    return {
      message: `Turns ended after ${summary.totalRounds} rounds`,
      ...summary,
    };
  },
});
