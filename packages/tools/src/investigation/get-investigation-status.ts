/**
 * Get Investigation Status Tool (Shared)
 *
 * Get the current state of an investigation.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import {
  getInvestigations,
  formatGameTime,
  type InvestigationTruth,
  type NullResult,
} from "./types.js";

/**
 * Input schema for get_investigation_status
 */
export const GetInvestigationStatusInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  investigationId: z.string().describe("Investigation ID"),
});

export type GetInvestigationStatusInput = z.infer<typeof GetInvestigationStatusInputSchema>;

/**
 * Output type for get_investigation_status
 */
export interface GetInvestigationStatusOutput {
  id: string;
  name: string;
  status: string;
  progress: {
    keyFactsTotal: number;
    keyFactsHinted: number;
    evidenceCount: number;
    hypothesesActive: number;
    hypothesesRefuted: number;
    nullResultsCount: number;
  };
  evidence: Array<{
    id: string;
    description: string;
    source: string;
    discoveredAt: string;
  }>;
  hypotheses: Array<{
    id: string;
    statement: string;
    status: string;
    testCount: number;
  }>;
  openQuestions: string[];
  gmInfo: {
    truth: InvestigationTruth;
    redHerrings: number;
    nullResults: NullResult[];
  };
}

/**
 * get_investigation_status tool definition
 */
export const getInvestigationStatusTool = defineSharedTool({
  name: "get_investigation_status",
  description:
    "Get the current state of an investigation including evidence, hypotheses, and progress.",
  inputSchema: GetInvestigationStatusInputSchema,

  handler: async (input, ctx): Promise<GetInvestigationStatusOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const investigations = getInvestigations(session);
    const investigation = investigations.find((i) => i.id === input.investigationId);

    if (!investigation) {
      throw new Error(`Investigation not found: ${input.investigationId}`);
    }

    // Calculate progress (how many key facts have been discovered)
    const keyFactsDiscovered = investigation.truth.keyFacts.filter((fact) => {
      const factLower = fact.toLowerCase();
      return investigation.evidence.some(
        (e) =>
          e.description.toLowerCase().includes(factLower) ||
          factLower.includes(e.description.toLowerCase())
      );
    });

    return {
      id: investigation.id,
      name: investigation.name,
      status: investigation.status,

      progress: {
        keyFactsTotal: investigation.truth.keyFacts.length,
        keyFactsHinted: keyFactsDiscovered.length,
        evidenceCount: investigation.evidence.length,
        hypothesesActive: investigation.hypotheses.filter((h) => h.status === "active").length,
        hypothesesRefuted: investigation.hypotheses.filter((h) => h.status === "refuted").length,
        nullResultsCount: investigation.nullResults.length,
      },

      evidence: investigation.evidence.map((e) => ({
        id: e.id,
        description: e.description,
        source: e.source,
        discoveredAt: formatGameTime(e.discoveredAt),
      })),

      hypotheses: investigation.hypotheses.map((h) => ({
        id: h.id,
        statement: h.statement,
        status: h.status,
        testCount: h.tests.length,
      })),

      openQuestions: investigation.openQuestions,

      // GM-only section
      gmInfo: {
        truth: investigation.truth,
        redHerrings: investigation.evidence.filter((e) => e.isRedHerring).length,
        nullResults: investigation.nullResults,
      },
    };
  },
});
