/**
 * Remove Deadline Tool (Shared)
 *
 * Remove a deadline by ID.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for remove_deadline
 */
export const RemoveDeadlineInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  deadlineId: z.string().describe("Deadline ID to remove"),
});

export type RemoveDeadlineInput = z.infer<typeof RemoveDeadlineInputSchema>;

/**
 * Output type for remove_deadline
 */
export interface RemoveDeadlineOutput {
  message: string;
  removedDeadline: {
    id: string;
    name: string;
  };
}

/**
 * Remove deadline tool definition
 */
export const removeDeadlineTool = defineSharedTool({
  name: "remove_deadline",
  description: "Remove a deadline by ID",
  inputSchema: RemoveDeadlineInputSchema,

  handler: async (input, ctx): Promise<RemoveDeadlineOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.deadlines) {
      session.deadlines = [];
    }

    const deadline = session.deadlines.find((d) => d.id === input.deadlineId);
    if (!deadline) {
      throw new Error(`Deadline not found: ${input.deadlineId}`);
    }

    session.deadlines = session.deadlines.filter((d) => d.id !== input.deadlineId);
    await ctx.sessions.save(session);

    return {
      message: `Deadline '${deadline.name}' removed`,
      removedDeadline: {
        id: deadline.id,
        name: deadline.name,
      },
    };
  },
});
