/**
 * Submit Player Action Tool (Shared)
 *
 * Record a human player's chosen action.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";

/**
 * Input schema for submit_player_action
 */
export const SubmitPlayerActionInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  playerId: z.string().describe("Player ID"),
  action: z.string().describe("The action the player chose"),
});

export type SubmitPlayerActionInput = z.infer<typeof SubmitPlayerActionInputSchema>;

/**
 * Output type for submit_player_action
 */
export interface SubmitPlayerActionOutput {
  message: string;
  player: {
    id: string;
    name: string;
  };
  action: string;
  previousPrompt?: string;
}

/**
 * Submit player action tool definition
 */
export const submitPlayerActionTool = defineSharedTool({
  name: "submit_player_action",
  description: "Record a human player's chosen action",
  inputSchema: SubmitPlayerActionInputSchema,
  emits: [EventTypes.PLAYER_ACTION_SUBMITTED],

  handler: async (input, ctx): Promise<SubmitPlayerActionOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const players = session.players || {};
    const player = players[input.playerId];
    if (!player) {
      throw new Error(`Player not found: ${input.playerId}`);
    }

    // Clear pending action and update status
    const previousPrompt = player.pendingAction?.prompt;
    delete player.pendingAction;
    player.status = "active";
    player.lastActiveAt = new Date().toISOString();

    if (session.turns) {
      session.turns.waitingForHumanInput = false;
    }

    await ctx.sessions.save(session);

    return {
      message: `${player.name} chose: ${input.action}`,
      player: {
        id: player.id,
        name: player.name,
      },
      action: input.action,
      previousPrompt,
    };
  },
});
