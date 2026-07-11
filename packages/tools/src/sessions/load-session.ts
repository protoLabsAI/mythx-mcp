/**
 * Load Session Tool
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

export const LoadSessionInputSchema = z.object({
  sessionId: z.string().describe("Session ID to load"),
});

export interface LoadSessionOutput {
  sessionId: string;
  name: string;
  worldPackId: string | null;
  createdAt: string;
  updatedAt: string;
  characters: Array<{
    id: string;
    name: string;
    hp: number;
    maxHp: number;
  }>;
  hasActiveCombat: boolean;
  gameTime: {
    day: number;
    hour: number;
    minute: number;
  };
}

export const loadSessionTool = defineSharedTool({
  name: "load_session",
  description: "Load an existing game session by ID. Returns session state summary.",
  inputSchema: LoadSessionInputSchema,
  handler: async (input, ctx): Promise<LoadSessionOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    return {
      sessionId: session.metadata.id,
      name: session.metadata.name,
      worldPackId: session.worldPackId ?? null,
      createdAt: session.metadata.createdAt,
      updatedAt: session.metadata.updatedAt,
      characters: Object.values(session.characters).map((char) => ({
        id: char.id,
        name: char.name,
        hp: char.hp.current,
        maxHp: char.hp.max,
      })),
      hasActiveCombat: session.combat?.active ?? false,
      gameTime: {
        day: session.gameTime.day,
        hour: session.gameTime.hour,
        minute: session.gameTime.minute,
      },
    };
  },
});
