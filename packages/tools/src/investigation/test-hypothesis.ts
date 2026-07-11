/**
 * Test Hypothesis Tool (Shared)
 *
 * Record the result of testing a hypothesis.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { TEST_RESULTS, getInvestigations, saveInvestigations } from "./types.js";

/**
 * Input schema for test_hypothesis
 */
export const TestHypothesisInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  investigationId: z.string().describe("Investigation ID"),
  hypothesisId: z.string().describe("Hypothesis ID"),
  test: z.string().describe("What was done to test it"),
  result: z.enum(TEST_RESULTS).describe("Result: supports, refutes, or inconclusive"),
});

export type TestHypothesisInput = z.infer<typeof TestHypothesisInputSchema>;

/**
 * Output type for test_hypothesis
 */
export interface TestHypothesisOutput {
  message: string;
  hypothesis: {
    id: string;
    statement: string;
    status: string;
    testCount: number;
    supports: number;
    refutes: number;
  };
  tip?: string;
}

/**
 * test_hypothesis tool definition
 */
export const testHypothesisTool = defineSharedTool({
  name: "test_hypothesis",
  description: "Record the result of testing a hypothesis. Supports the 'null result' principle.",
  inputSchema: TestHypothesisInputSchema,

  handler: async (input, ctx): Promise<TestHypothesisOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const investigations = getInvestigations(session);
    const investigation = investigations.find((i) => i.id === input.investigationId);

    if (!investigation) {
      throw new Error(`Investigation not found: ${input.investigationId}`);
    }

    const hypothesis = investigation.hypotheses.find((h) => h.id === input.hypothesisId);
    if (!hypothesis) {
      throw new Error(`Hypothesis not found: ${input.hypothesisId}`);
    }

    // Add test result
    hypothesis.tests.push({
      description: input.test,
      result: input.result,
    });

    // Update hypothesis status based on results
    const supports = hypothesis.tests.filter((t) => t.result === "supports").length;
    const refutes = hypothesis.tests.filter((t) => t.result === "refutes").length;

    if (refutes >= 2 || (refutes >= 1 && supports === 0)) {
      hypothesis.status = "refuted";
    } else if (supports >= 3 && refutes === 0) {
      hypothesis.status = "confirmed";
    }

    saveInvestigations(session, investigations);
    await ctx.sessions.save(session);

    return {
      message: `Hypothesis test recorded: ${input.result}`,
      hypothesis: {
        id: hypothesis.id,
        statement: hypothesis.statement,
        status: hypothesis.status,
        testCount: hypothesis.tests.length,
        supports,
        refutes,
      },
      tip:
        input.result === "refutes"
          ? "Null results help players eliminate false theories - this is good investigation design."
          : undefined,
    };
  },
});
