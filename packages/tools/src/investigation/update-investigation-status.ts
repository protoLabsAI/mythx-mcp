/**
 * Update Investigation Status Tool (Shared)
 *
 * Mark an investigation as solved, cold, or abandoned.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { INVESTIGATION_STATUS, getInvestigations, saveInvestigations } from "./types.js";

/**
 * Input schema for update_investigation_status
 */
export const UpdateInvestigationStatusInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  investigationId: z.string().describe("Investigation ID"),
  status: z.enum(INVESTIGATION_STATUS).describe("New status"),
});

export type UpdateInvestigationStatusInput = z.infer<typeof UpdateInvestigationStatusInputSchema>;

/**
 * Output type for update_investigation_status
 */
export interface UpdateInvestigationStatusOutput {
  message: string;
  investigation: {
    id: string;
    name: string;
    status: string;
  };
  summary: {
    evidenceCollected: number;
    hypothesesTested: number;
    keyFactsDiscovered: number;
  };
}

/**
 * update_investigation_status tool definition
 */
export const updateInvestigationStatusTool = defineSharedTool({
  name: "update_investigation_status",
  description: "Mark an investigation as solved, cold, or abandoned.",
  inputSchema: UpdateInvestigationStatusInputSchema,

  handler: async (input, ctx): Promise<UpdateInvestigationStatusOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const investigations = getInvestigations(session);
    const investigation = investigations.find((i) => i.id === input.investigationId);

    if (!investigation) {
      throw new Error(`Investigation not found: ${input.investigationId}`);
    }

    const previousStatus = investigation.status;
    investigation.status = input.status;

    saveInvestigations(session, investigations);
    await ctx.sessions.save(session);

    return {
      message: `Investigation status updated: ${previousStatus} → ${input.status}`,
      investigation: {
        id: investigation.id,
        name: investigation.name,
        status: investigation.status,
      },
      summary: {
        evidenceCollected: investigation.evidence.length,
        hypothesesTested: investigation.hypotheses.filter((h) => h.tests.length > 0).length,
        keyFactsDiscovered: investigation.truth.keyFacts.filter((fact) =>
          investigation.evidence.some((e) =>
            e.description.toLowerCase().includes(fact.toLowerCase())
          )
        ).length,
      },
    };
  },
});
