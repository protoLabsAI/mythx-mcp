/**
 * Record Null Result Tool (Shared)
 *
 * Log a search that found nothing (critical for hypothesis testing).
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { getInvestigations, saveInvestigations, formatGameTime } from "./types.js";

/**
 * Input schema for record_null_result
 */
export const RecordNullResultInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  investigationId: z.string().describe("Investigation ID"),
  search: z.string().describe("What they searched for"),
  location: z.string().optional().describe("Where they searched"),
  meaning: z.string().describe("GM note: why nothing was found"),
});

export type RecordNullResultInput = z.infer<typeof RecordNullResultInputSchema>;

/**
 * Output type for record_null_result
 */
export interface RecordNullResultOutput {
  message: string;
  nullResult: {
    search: string;
    location?: string;
    timestamp: string;
  };
  totalNullResults: number;
  principle: string;
}

/**
 * record_null_result tool definition
 */
export const recordNullResultTool = defineSharedTool({
  name: "record_null_result",
  description: "Log a search that found nothing. Critical for hypothesis testing.",
  inputSchema: RecordNullResultInputSchema,

  handler: async (input, ctx): Promise<RecordNullResultOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const investigations = getInvestigations(session);
    const investigation = investigations.find((i) => i.id === input.investigationId);

    if (!investigation) {
      throw new Error(`Investigation not found: ${input.investigationId}`);
    }

    investigation.nullResults.push({
      search: input.search,
      location: input.location,
      timestamp: { ...session.gameTime },
      meaning: input.meaning,
    });

    saveInvestigations(session, investigations);
    await ctx.sessions.save(session);

    return {
      message: "Null result recorded",
      nullResult: {
        search: input.search,
        location: input.location,
        timestamp: formatGameTime(session.gameTime),
      },
      totalNullResults: investigation.nullResults.length,
      principle:
        "Null results are valuable - they help players eliminate false theories and narrow their focus.",
    };
  },
});
