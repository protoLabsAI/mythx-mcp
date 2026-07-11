/**
 * Get Discovered Leads Tool (Shared)
 *
 * List all leads that players have discovered.
 */

import { z } from "zod";
import { defineSharedTool, type GameTime } from "@mythxengine/types";
import { resolveRawSituations } from "../situations/index.js";

/**
 * Input schema for get_discovered_leads
 */
export const GetDiscoveredLeadsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type GetDiscoveredLeadsInput = z.infer<typeof GetDiscoveredLeadsInputSchema>;

/**
 * Situation type from generated content
 */
interface Situation {
  id: string;
  name: string;
}

/**
 * Output type for get_discovered_leads
 */
export interface GetDiscoveredLeadsOutput {
  message: string;
  leads: Array<{
    id: string;
    information: string;
    targetSituation: {
      id: string;
      name: string;
    };
    discoveredAt: string;
    discoveryMethod: string;
    discoveryContext?: string;
  }>;
}

/**
 * Format game time as human-readable string
 */
function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}

/**
 * Get discovered leads tool definition
 */
export const getDiscoveredLeadsTool = defineSharedTool({
  name: "get_discovered_leads",
  description: "List all leads that players have discovered.",
  inputSchema: GetDiscoveredLeadsInputSchema,

  handler: async (input, ctx): Promise<GetDiscoveredLeadsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.discoveredLeads || session.discoveredLeads.length === 0) {
      return {
        message: "No leads discovered yet",
        leads: [],
      };
    }

    const situations = (await resolveRawSituations(ctx, session)) as Situation[];
    const situationMap = new Map(situations.map((s) => [s.id, s.name]));

    const leads = session.discoveredLeads.map((d) => ({
      id: d.leadId,
      information: d.information,
      targetSituation: {
        id: d.targetSituationId,
        name: situationMap.get(d.targetSituationId) || "Unknown",
      },
      discoveredAt: formatGameTime(d.discoveredAt),
      discoveryMethod: d.discoveryMethod,
      discoveryContext: d.discoveryContext,
    }));

    return {
      message: `${leads.length} lead(s) discovered`,
      leads,
    };
  },
});
