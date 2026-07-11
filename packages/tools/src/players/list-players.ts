/**
 * List Players Tool (Shared)
 *
 * List all players in a session.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for list_players
 */
export const ListPlayersInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type ListPlayersInput = z.infer<typeof ListPlayersInputSchema>;

/**
 * Player summary for list output
 */
export interface PlayerSummary {
  id: string;
  name: string;
  role: string;
  controlType: string;
  status: string;
  characterId?: string;
  characterName?: string;
}

/**
 * Output type for list_players
 */
export interface ListPlayersOutput {
  sessionId: string;
  count: number;
  gmPlayerId?: string;
  players: PlayerSummary[];
}

/**
 * List players tool definition
 */
export const listPlayersTool = defineSharedTool({
  name: "list_players",
  description: "List all players in a session",
  inputSchema: ListPlayersInputSchema,

  handler: async (input, ctx): Promise<ListPlayersOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const players = session.players || {};
    const playerList = Object.values(players).map((p) => {
      const character = p.characterId ? session.characters[p.characterId] : null;
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        controlType: p.controlType,
        status: p.status,
        characterId: p.characterId,
        characterName: character?.name,
      };
    });

    return {
      sessionId: input.sessionId,
      count: playerList.length,
      gmPlayerId: session.gmPlayerId,
      players: playerList,
    };
  },
});
