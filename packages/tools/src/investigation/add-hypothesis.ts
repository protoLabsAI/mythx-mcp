/**
 * Add Hypothesis Tool (Shared)
 *
 * Record a player theory about the mystery.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { getInvestigations, saveInvestigations } from "./types.js";

/**
 * Input schema for add_hypothesis
 */
export const AddHypothesisInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  investigationId: z.string().describe("Investigation ID"),
  statement: z.string().describe("The hypothesis (e.g., 'The butler did it')"),
  supportingEvidence: z.array(z.string()).optional().describe("Evidence IDs that support this"),
});

export type AddHypothesisInput = z.infer<typeof AddHypothesisInputSchema>;

/**
 * Output type for add_hypothesis
 */
export interface AddHypothesisOutput {
  message: string;
  hypothesis: {
    id: string;
    statement: string;
    status: string;
    supportingEvidence: string[];
  };
  totalHypotheses: number;
  gmNote?: string;
}

/**
 * add_hypothesis tool definition
 */
export const addHypothesisTool = defineSharedTool({
  name: "add_hypothesis",
  description: "Record a player theory about the mystery.",
  inputSchema: AddHypothesisInputSchema,

  handler: async (input, ctx): Promise<AddHypothesisOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const investigations = getInvestigations(session);
    const investigation = investigations.find((i) => i.id === input.investigationId);

    if (!investigation) {
      throw new Error(`Investigation not found: ${input.investigationId}`);
    }

    const hypothesisId = `hypothesis-${investigation.hypotheses.length + 1}`;

    investigation.hypotheses.push({
      id: hypothesisId,
      statement: input.statement,
      status: "active",
      supportingEvidence: input.supportingEvidence || [],
      contradictingEvidence: [],
      tests: [],
    });

    saveInvestigations(session, investigations);
    await ctx.sessions.save(session);

    // Check if hypothesis aligns with truth
    const truth = investigation.truth;
    const statementLower = input.statement.toLowerCase();
    let alignmentHint = "";

    if (truth.perpetrator && statementLower.includes(truth.perpetrator.toLowerCase())) {
      alignmentHint = "This hypothesis touches on the truth.";
    } else if (truth.motive && statementLower.includes(truth.motive.toLowerCase())) {
      alignmentHint = "This hypothesis relates to the motive.";
    } else if (truth.method && statementLower.includes(truth.method.toLowerCase())) {
      alignmentHint = "This hypothesis relates to the method.";
    }

    return {
      message: "Hypothesis recorded",
      hypothesis: {
        id: hypothesisId,
        statement: input.statement,
        status: "active",
        supportingEvidence: input.supportingEvidence || [],
      },
      totalHypotheses: investigation.hypotheses.length,
      gmNote: alignmentHint || undefined,
    };
  },
});
