/**
 * List Characters Tool (Shared)
 *
 * List all characters in a session.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for list_characters
 */
export const ListCharactersInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type ListCharactersInput = z.infer<typeof ListCharactersInputSchema>;

/**
 * Character summary in list output
 */
export interface CharacterSummary {
  id: string;
  name: string;
  hp: { current: number; max: number };
  conditions: string[];
}

/**
 * Output type for list_characters
 */
export interface ListCharactersOutput {
  sessionId: string;
  count: number;
  characters: CharacterSummary[];
}

/**
 * List characters tool definition
 */
export const listCharactersTool = defineSharedTool({
  name: "list_characters",
  description: "List all characters in a session",
  inputSchema: ListCharactersInputSchema,

  handler: async (input, ctx): Promise<ListCharactersOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const characters = Object.values(session.characters).map((c) => ({
      id: c.id,
      name: c.name,
      hp: c.hp,
      conditions: c.conditions.map((cond) => cond.name),
    }));

    return {
      sessionId: input.sessionId,
      count: characters.length,
      characters,
    };
  },
});
