/**
 * Suggest Investigation Steps Tool (Shared)
 *
 * Get suggestions for moving the investigation forward.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { getInvestigations } from "./types.js";

/**
 * Input schema for suggest_investigation_steps
 */
export const SuggestInvestigationStepsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  investigationId: z.string().describe("Investigation ID"),
});

export type SuggestInvestigationStepsInput = z.infer<typeof SuggestInvestigationStepsInputSchema>;

/**
 * Output type for suggest_investigation_steps
 */
export interface SuggestInvestigationStepsOutput {
  investigation: {
    id: string;
    name: string;
  };
  suggestions: string[];
  openQuestions: string[];
  hypothesesToTest: string[];
  status: {
    evidenceCount: number;
    activeHypotheses: number;
    remainingKeyFacts: number;
  };
}

/**
 * suggest_investigation_steps tool definition
 */
export const suggestInvestigationStepsTool = defineSharedTool({
  name: "suggest_investigation_steps",
  description: "Get suggestions for moving the investigation forward.",
  inputSchema: SuggestInvestigationStepsInputSchema,

  handler: async (input, ctx): Promise<SuggestInvestigationStepsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const investigations = getInvestigations(session);
    const investigation = investigations.find((i) => i.id === input.investigationId);

    if (!investigation) {
      throw new Error(`Investigation not found: ${input.investigationId}`);
    }

    const suggestions: string[] = [];
    const questions: string[] = [];
    const tests: string[] = [];

    // Suggest based on undiscovered key facts
    const undiscoveredFacts = investigation.truth.keyFacts.filter((fact) => {
      const factLower = fact.toLowerCase();
      return !investigation.evidence.some((e) => e.description.toLowerCase().includes(factLower));
    });

    if (undiscoveredFacts.length > 0) {
      suggestions.push(
        `Key fact still hidden: Consider placing a clue about "${undiscoveredFacts[0]}"`
      );
    }

    // Suggest based on active hypotheses needing tests
    const untestedHypotheses = investigation.hypotheses.filter(
      (h) => h.status === "active" && h.tests.length === 0
    );
    for (const h of untestedHypotheses.slice(0, 2)) {
      tests.push(`Test hypothesis: "${h.statement}" - what would prove or disprove this?`);
    }

    // Add open questions
    questions.push(...investigation.openQuestions.slice(0, 3));

    // Suggest connections if evidence is disconnected
    const unconnectedEvidence = investigation.evidence.filter(
      (e) => !e.connects || e.connects.length === 0
    );
    if (unconnectedEvidence.length > 2) {
      suggestions.push(
        "Consider how evidence pieces connect - players may need help seeing patterns."
      );
    }

    // If many null results, players might be stuck
    if (investigation.nullResults.length >= 3) {
      suggestions.push("Multiple null results recorded - consider providing a more obvious lead.");
    }

    // Three Clue Rule check
    if (investigation.evidence.length < 3 && undiscoveredFacts.length > 0) {
      suggestions.push("Three Clue Rule: Ensure there are multiple paths to remaining key facts.");
    }

    return {
      investigation: {
        id: investigation.id,
        name: investigation.name,
      },
      suggestions,
      openQuestions: questions,
      hypothesesToTest: tests,
      status: {
        evidenceCount: investigation.evidence.length,
        activeHypotheses: investigation.hypotheses.filter((h) => h.status === "active").length,
        remainingKeyFacts: undiscoveredFacts.length,
      },
    };
  },
});
