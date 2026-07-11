/**
 * Search Notes Tool (Shared)
 *
 * Search session notes by keyword or tags.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for search_notes
 */
export const SearchNotesInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  query: z.string().describe("Search query (searches content)"),
  tags: z.array(z.string()).optional().describe("Filter by tags (optional)"),
});

export type SearchNotesInput = z.infer<typeof SearchNotesInputSchema>;

/**
 * Note result in output
 */
export interface NoteResult {
  id: string;
  timestamp: string;
  content: string;
  tags: string[];
}

/**
 * Output type for search_notes
 */
export interface SearchNotesOutput {
  query: string;
  tags?: string[];
  count: number;
  notes: NoteResult[];
}

/**
 * Search notes tool definition
 */
export const searchNotesTool = defineSharedTool({
  name: "search_notes",
  description: "Search session notes by keyword or tags",
  inputSchema: SearchNotesInputSchema,

  handler: async (input, ctx): Promise<SearchNotesOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const queryLower = input.query.toLowerCase();
    const results = session.notes.filter((note) => {
      const matchesQuery = note.content.toLowerCase().includes(queryLower);
      const matchesTags =
        !input.tags || input.tags.length === 0 || input.tags.some((tag) => note.tags.includes(tag));
      return matchesQuery && matchesTags;
    });

    return {
      query: input.query,
      tags: input.tags,
      count: results.length,
      notes: results.map((n) => ({
        id: n.id,
        timestamp: n.timestamp,
        content: n.content,
        tags: n.tags,
      })),
    };
  },
});
