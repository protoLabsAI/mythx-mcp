/**
 * Delete Character Tool (Shared)
 *
 * Delete a character from the session.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for delete_character
 */
export const DeleteCharacterInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID to delete"),
});

export type DeleteCharacterInput = z.infer<typeof DeleteCharacterInputSchema>;

/**
 * Output type for delete_character
 */
export interface DeleteCharacterOutput {
  message: string;
  characterId: string;
}

/**
 * Delete character tool definition
 */
export const deleteCharacterTool = defineSharedTool({
  name: "delete_character",
  description: "Delete a character from the session",
  inputSchema: DeleteCharacterInputSchema,

  handler: async (input, ctx): Promise<DeleteCharacterOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    const characterName = character.name;
    delete session.characters[input.characterId];
    await ctx.sessions.save(session);

    return {
      message: `Character '${characterName}' deleted`,
      characterId: input.characterId,
    };
  },
});
