/**
 * Delete Session Tool
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

export const DeleteSessionInputSchema = z.object({
  sessionId: z.string().describe("Session ID to delete"),
});

export interface DeleteSessionOutput {
  message: string;
  sessionId: string;
}

export const deleteSessionTool = defineSharedTool({
  name: "delete_session",
  description: "Delete a session and all its data",
  inputSchema: DeleteSessionInputSchema,
  handler: async (input, ctx): Promise<DeleteSessionOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    await ctx.sessions.delete(input.sessionId);

    return {
      message: `Session '${session.metadata.name}' deleted`,
      sessionId: input.sessionId,
    };
  },
});
