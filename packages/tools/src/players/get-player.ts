/**
 * Get Player Tool (Shared)
 *
 * Get a player's full details.
 */

import { z } from "zod";
import { defineSharedTool, type Player } from "@mythxengine/types";

/**
 * Input schema for get_player
 */
export const GetPlayerInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  playerId: z.string().describe("Player ID"),
});

export type GetPlayerInput = z.infer<typeof GetPlayerInputSchema>;

/**
 * Output type for get_player
 */
export interface GetPlayerOutput extends Player {
  character?: {
    id: string;
    name: string;
    hp: { current: number; max: number };
    conditions: string[];
  } | null;
}

/**
 * Get player tool definition
 */
export const getPlayerTool = defineSharedTool({
  name: "get_player",
  description: "Get a player's full details",
  inputSchema: GetPlayerInputSchema,

  handler: async (input, ctx): Promise<GetPlayerOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const players = session.players || {};
    const player = players[input.playerId];
    if (!player) {
      throw new Error(`Player not found: ${input.playerId}`);
    }

    // Include linked character info if available
    let character = null;
    if (player.characterId && session.characters[player.characterId]) {
      const c = session.characters[player.characterId];
      character = {
        id: c.id,
        name: c.name,
        hp: c.hp,
        conditions: c.conditions.map((cond) => cond.name),
      };
    }

    return {
      ...player,
      character,
    };
  },
});
