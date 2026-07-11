/**
 * Add Note Tool
 */

import { z } from "zod";
import { defineSharedTool, type SessionNote } from "@mythxengine/types";
import { randomUUID } from "crypto";

export const AddNoteInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  content: z.string().describe("Note content"),
  tags: z.array(z.string()).optional().default([]).describe("Tags for the note"),
});

export interface AddNoteOutput {
  message: string;
  note: {
    id: string;
    timestamp: string;
    tags: string[];
  };
}

export const addNoteTool = defineSharedTool({
  name: "add_note",
  description: "Add a timestamped note to the session",
  inputSchema: AddNoteInputSchema,
  handler: async (input, ctx): Promise<AddNoteOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const note: SessionNote = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      content: input.content,
      tags: input.tags,
    };

    session.notes.push(note);
    await ctx.sessions.save(session);

    return {
      message: "Note added",
      note: {
        id: note.id,
        timestamp: note.timestamp,
        tags: note.tags,
      },
    };
  },
});
