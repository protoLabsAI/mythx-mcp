/**
 * Add Evidence Tool (Shared)
 *
 * Record evidence discovered during investigation.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { getInvestigations, saveInvestigations, formatGameTime } from "./types.js";

/**
 * Input schema for add_evidence
 */
export const AddEvidenceInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  investigationId: z.string().describe("Investigation ID"),
  description: z.string().describe("What was found"),
  source: z.string().describe("Where/how it was found"),
  connects: z.array(z.string()).optional().describe("Other evidence IDs this connects to"),
  isRedHerring: z.boolean().optional().describe("GM flag: is this misleading?"),
});

export type AddEvidenceInput = z.infer<typeof AddEvidenceInputSchema>;

/**
 * Output type for add_evidence
 */
export interface AddEvidenceOutput {
  message: string;
  evidence: {
    id: string;
    description: string;
    source: string;
    discoveredAt: string;
  };
  totalEvidence: number;
}

/**
 * add_evidence tool definition
 */
export const addEvidenceTool = defineSharedTool({
  name: "add_evidence",
  description: "Record evidence discovered during investigation.",
  inputSchema: AddEvidenceInputSchema,

  handler: async (input, ctx): Promise<AddEvidenceOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const investigations = getInvestigations(session);
    const investigation = investigations.find((i) => i.id === input.investigationId);

    if (!investigation) {
      throw new Error(`Investigation not found: ${input.investigationId}`);
    }

    const evidenceId = `evidence-${investigation.evidence.length + 1}`;

    investigation.evidence.push({
      id: evidenceId,
      description: input.description,
      source: input.source,
      discoveredAt: { ...session.gameTime },
      connects: input.connects,
      isRedHerring: input.isRedHerring,
    });

    saveInvestigations(session, investigations);
    await ctx.sessions.save(session);

    return {
      message: "Evidence recorded",
      evidence: {
        id: evidenceId,
        description: input.description,
        source: input.source,
        discoveredAt: formatGameTime(session.gameTime),
      },
      totalEvidence: investigation.evidence.length,
    };
  },
});
