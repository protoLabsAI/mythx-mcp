/**
 * Get Character Tool (Shared)
 *
 * Get a character's full details.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for get_character
 */
export const GetCharacterInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID"),
});

export type GetCharacterInput = z.infer<typeof GetCharacterInputSchema>;

/**
 * Output type for get_character
 */
export interface GetCharacterOutput {
  id: string;
  name: string;
  archetypeId: string;
  abilities: {
    STR: number;
    AGI: number;
    WIT: number;
    CON: number;
  };
  hp: { current: number; max: number };
  equipment: {
    weapons: string[];
    armor: string | null;
    gear: string[];
  };
  conditions: Array<{ id: string; name: string; description: string }>;
  flags: string[];
  personality: string[];
  background: string;
  stress?: { current: number; max: number };
}

/**
 * Get character tool definition
 */
export const getCharacterTool = defineSharedTool({
  name: "get_character",
  description: "Get a character's full details",
  inputSchema: GetCharacterInputSchema,

  handler: async (input, ctx): Promise<GetCharacterOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    return {
      id: character.id,
      name: character.name,
      archetypeId: character.archetypeId,
      abilities: character.abilities,
      hp: character.hp,
      equipment: character.equipment,
      conditions: character.conditions.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
      flags: character.flags,
      personality: character.personality,
      background: character.background,
      ...(character.stress && { stress: character.stress }),
    };
  },
});
