/**
 * Request Player Input Tool (Shared)
 *
 * Mark a human player as awaiting input for their turn.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";

/**
 * Input schema for request_player_input
 */
export const RequestPlayerInputInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  playerId: z.string().describe("Player ID"),
  prompt: z.string().describe("What we're asking the player to decide"),
  choices: z.array(z.string()).optional().describe("Optional preset choices"),
  context: z.string().optional().describe("Additional context (scene, situation)"),
});

export type RequestPlayerInputInput = z.infer<typeof RequestPlayerInputInputSchema>;

/**
 * Output type for request_player_input
 */
export interface RequestPlayerInputOutput {
  message: string;
  player: {
    id: string;
    name: string;
  };
  pendingAction: {
    prompt: string;
    choices?: string[];
    context?: string;
    requestedAt: string;
  };
}

/**
 * Request player input tool definition
 */
export const requestPlayerInputTool = defineSharedTool({
  name: "request_player_input",
  description: "Mark a human player as awaiting input for their turn",
  inputSchema: RequestPlayerInputInputSchema,
  emits: [EventTypes.PLAYER_INPUT_REQUESTED],

  handler: async (input, ctx): Promise<RequestPlayerInputOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const players = session.players || {};
    const player = players[input.playerId];
    if (!player) {
      throw new Error(`Player not found: ${input.playerId}`);
    }

    if (player.controlType !== "human") {
      throw new Error(`Player '${player.name}' is AI-controlled, not human`);
    }

    player.status = "waiting_for_input";
    player.pendingAction = {
      prompt: input.prompt,
      choices: input.choices,
      context: input.context,
      requestedAt: new Date().toISOString(),
    };

    if (session.turns) {
      session.turns.waitingForHumanInput = true;
    }

    await ctx.sessions.save(session);

    return {
      message: `Awaiting input from ${player.name}`,
      player: {
        id: player.id,
        name: player.name,
      },
      pendingAction: player.pendingAction,
    };
  },
});
