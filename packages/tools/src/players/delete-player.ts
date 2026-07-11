/**
 * Delete Player Tool (Shared)
 *
 * Remove a player from the session.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for delete_player
 */
export const DeletePlayerInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  playerId: z.string().describe("Player ID to delete"),
});

export type DeletePlayerInput = z.infer<typeof DeletePlayerInputSchema>;

/**
 * Output type for delete_player
 */
export interface DeletePlayerOutput {
  message: string;
  playerId: string;
}

/**
 * Delete player tool definition
 */
export const deletePlayerTool = defineSharedTool({
  name: "delete_player",
  description: "Remove a player from the session",
  inputSchema: DeletePlayerInputSchema,

  handler: async (input, ctx): Promise<DeletePlayerOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const players = session.players || {};
    const player = players[input.playerId];
    if (!player) {
      throw new Error(`Player not found: ${input.playerId}`);
    }

    delete players[input.playerId];

    // Update GM if we deleted the GM
    if (session.gmPlayerId === input.playerId) {
      session.gmPlayerId = undefined;
    }

    // Remove from turn order if in turns
    if (session.turns && session.turns.turnOrder.includes(input.playerId)) {
      session.turns.turnOrder = session.turns.turnOrder.filter((id) => id !== input.playerId);
      if (session.turns.currentPlayerId === input.playerId) {
        // Move to next player
        if (session.turns.turnOrder.length > 0) {
          session.turns.turnIndex = session.turns.turnIndex % session.turns.turnOrder.length;
          session.turns.currentPlayerId = session.turns.turnOrder[session.turns.turnIndex];
        } else {
          session.turns.currentPlayerId = null;
        }
      }
    }

    await ctx.sessions.save(session);

    return {
      message: `Player '${player.name}' deleted`,
      playerId: input.playerId,
    };
  },
});
