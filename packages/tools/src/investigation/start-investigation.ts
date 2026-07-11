/**
 * Start Investigation Tool (Shared)
 *
 * Begin tracking a mystery with GM-defined truth for hypothesis testing.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { type Investigation, getInvestigations, saveInvestigations } from "./types.js";

/**
 * Input schema for start_investigation
 */
export const StartInvestigationInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  name: z.string().describe("Investigation name"),
  truth: z
    .object({
      summary: z.string().describe("What actually happened (GM-only)"),
      perpetrator: z.string().optional().describe("Who did it"),
      motive: z.string().optional().describe("Why they did it"),
      method: z.string().optional().describe("How they did it"),
      keyFacts: z.array(z.string()).describe("Key facts players should discover"),
    })
    .describe("The truth of the mystery (GM-only, used for hypothesis testing)"),
  situationIds: z.array(z.string()).optional().describe("Related situation IDs"),
  openQuestions: z.array(z.string()).optional().describe("Initial questions to answer"),
});

export type StartInvestigationInput = z.infer<typeof StartInvestigationInputSchema>;

/**
 * Output type for start_investigation
 */
export interface StartInvestigationOutput {
  message: string;
  investigation: {
    id: string;
    name: string;
    status: string;
    keyFactsToDiscover: number;
    openQuestions: string[];
  };
  tip: string;
}

/**
 * start_investigation tool definition
 */
export const startInvestigationTool = defineSharedTool({
  name: "start_investigation",
  description: "Begin tracking a mystery. Define the truth (GM-only) to enable hypothesis testing.",
  inputSchema: StartInvestigationInputSchema,

  handler: async (input, ctx): Promise<StartInvestigationOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const investigations = getInvestigations(session);

    // Generate ID
    const id = `investigation:${input.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

    // Check for duplicate
    if (investigations.some((i) => i.name === input.name)) {
      throw new Error(`Investigation '${input.name}' already exists`);
    }

    const investigation: Investigation = {
      id,
      name: input.name,
      status: "active",
      truth: input.truth,
      evidence: [],
      hypotheses: [],
      nullResults: [],
      openQuestions: input.openQuestions || [],
      situationIds: input.situationIds || [],
    };

    investigations.push(investigation);
    saveInvestigations(session, investigations);
    await ctx.sessions.save(session);

    return {
      message: `Investigation '${input.name}' started`,
      investigation: {
        id: investigation.id,
        name: investigation.name,
        status: investigation.status,
        keyFactsToDiscover: input.truth.keyFacts.length,
        openQuestions: investigation.openQuestions,
      },
      tip: "Players don't see the 'truth' - use it to evaluate hypotheses and guide clue placement.",
    };
  },
});
