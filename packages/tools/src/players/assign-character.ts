/**
 * Assign Character Tool (Shared)
 *
 * Link a player to a character.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for assign_character
 */
export const AssignCharacterInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  playerId: z.string().describe("Player ID"),
  characterId: z.string().describe("Character ID to assign"),
});

export type AssignCharacterInput = z.infer<typeof AssignCharacterInputSchema>;

/**
 * Output type for assign_character
 */
export interface AssignCharacterOutput {
  message: string;
  player: {
    id: string;
    name: string;
  };
  character: {
    id: string;
    name: string;
  };
}

/**
 * Assign character tool definition
 */
export const assignCharacterTool = defineSharedTool({
  name: "assign_character",
  description: "Link a player to a character",
  inputSchema: AssignCharacterInputSchema,

  handler: async (input, ctx): Promise<AssignCharacterOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const players = session.players || {};
    const player = players[input.playerId];
    if (!player) {
      throw new Error(`Player not found: ${input.playerId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    player.characterId = input.characterId;
    player.lastActiveAt = new Date().toISOString();
    await ctx.sessions.save(session);

    return {
      message: `Player '${player.name}' now controls character '${character.name}'`,
      player: {
        id: player.id,
        name: player.name,
      },
      character: {
        id: character.id,
        name: character.name,
      },
    };
  },
});
