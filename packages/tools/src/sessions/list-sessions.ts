/**
 * List Sessions Tool
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

export const ListSessionsInputSchema = z.object({
  worldPackId: z.string().optional().describe("Filter by world pack ID"),
});

export interface SessionSummary {
  id: string;
  name: string;
  worldPackId: string | null;
  createdAt: string;
  updatedAt: string;
  characterCount: number;
  hasActiveCombat: boolean;
}

export interface ListSessionsOutput {
  count: number;
  sessions: SessionSummary[];
}

export const listSessionsTool = defineSharedTool({
  name: "list_sessions",
  description: "List all game sessions. Optionally filter by world pack ID.",
  inputSchema: ListSessionsInputSchema,
  handler: async (input, ctx): Promise<ListSessionsOutput> => {
    const sessionIds = await ctx.sessions.list();

    const sessions: SessionSummary[] = [];
    for (const id of sessionIds) {
      const session = await ctx.sessions.get(id);
      if (!session) continue;

      // Filter by worldPackId if specified
      if (input.worldPackId && session.worldPackId !== input.worldPackId) {
        continue;
      }

      sessions.push({
        id: session.metadata.id,
        name: session.metadata.name,
        worldPackId: session.worldPackId ?? null,
        createdAt: session.metadata.createdAt,
        updatedAt: session.metadata.updatedAt,
        characterCount: Object.keys(session.characters).length,
        hasActiveCombat: session.combat?.active ?? false,
      });
    }

    // Sort by updatedAt descending (most recent first)
    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return {
      count: sessions.length,
      sessions,
    };
  },
});
