/**
 * Search Leads Tool (Shared)
 *
 * Search for leads by keyword across all lead information.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { getSituations, getAllLeads } from "./helpers.js";

/**
 * Input schema for search_leads
 */
export const SearchLeadsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  query: z.string().describe("Search query"),
});

export type SearchLeadsInput = z.infer<typeof SearchLeadsInputSchema>;

/**
 * Output type for search_leads
 */
export interface SearchLeadsOutput {
  message: string;
  results: Array<{
    id: string;
    information: string;
    targetSituation: {
      id: string;
      name: string;
    };
    prominence: string;
    discoveryMethod: string;
    alreadyDiscovered: boolean;
  }>;
}

/**
 * Search leads tool definition
 */
export const searchLeadsTool = defineSharedTool({
  name: "search_leads",
  description: "Search for leads by keyword across all lead information.",
  inputSchema: SearchLeadsInputSchema,

  handler: async (input, ctx): Promise<SearchLeadsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const situations = await getSituations(ctx, session);
    const allLeads = getAllLeads(situations);
    const discoveredIds = (session.discoveredLeads || []).map((d) => d.leadId);

    const queryLower = input.query.toLowerCase();

    const matches = allLeads.filter((lead) => {
      return (
        lead.information.toLowerCase().includes(queryLower) ||
        lead.discovery.description.toLowerCase().includes(queryLower) ||
        (lead.gmNotes && lead.gmNotes.toLowerCase().includes(queryLower))
      );
    });

    const situationMap = new Map(situations.map((s) => [s.id, s.name]));

    const results = matches.map((lead) => ({
      id: lead.id,
      information: lead.information,
      targetSituation: {
        id: lead.targetSituationId,
        name: situationMap.get(lead.targetSituationId) || "Unknown",
      },
      prominence: lead.prominence,
      discoveryMethod: lead.discovery.method,
      alreadyDiscovered: discoveredIds.includes(lead.id),
    }));

    return {
      message: `Found ${results.length} lead(s) matching '${input.query}'`,
      results,
    };
  },
});
