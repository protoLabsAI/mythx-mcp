/**
 * Get Available Leads Tool (Shared)
 *
 * List leads that are currently available for discovery.
 */

import { z } from "zod";
import { defineSharedTool, type GameTime } from "@mythxengine/types";
import { type Lead, getSituations, getAllLeads } from "./helpers.js";

/**
 * Input schema for get_available_leads
 */
export const GetAvailableLeadsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  locationId: z.string().optional().describe("Filter by location ID"),
  npcId: z.string().optional().describe("Filter by NPC source ID"),
  prominence: z
    .enum(["obvious", "available", "hidden", "obscured"])
    .optional()
    .describe("Filter by prominence level"),
});

export type GetAvailableLeadsInput = z.infer<typeof GetAvailableLeadsInputSchema>;

/**
 * Output type for get_available_leads
 */
export interface GetAvailableLeadsOutput {
  message: string;
  leads: Array<{
    id: string;
    targetSituation: {
      id: string;
      name: string;
    };
    information: string;
    prominence: string;
    discovery: {
      method: string;
      sourceId?: string;
      description: string;
      test?: {
        ability: string;
        difficulty: number;
        skill?: string;
      };
    };
    requiresTest: boolean;
  }>;
  discoveredCount: number;
  totalCount: number;
}

/**
 * Check if a lead's prerequisites are met
 */
function checkPrerequisites(
  lead: Lead,
  flags: string[],
  gameTime: GameTime
): { available: boolean; reason?: string } {
  if (!lead.prerequisites) {
    return { available: true };
  }

  // Check required flags
  if (lead.prerequisites.requiredFlags) {
    for (const flag of lead.prerequisites.requiredFlags) {
      if (!flags.includes(flag)) {
        return { available: false, reason: `Missing required flag: ${flag}` };
      }
    }
  }

  // Check blocked flags
  if (lead.prerequisites.blockedByFlags) {
    for (const flag of lead.prerequisites.blockedByFlags) {
      if (flags.includes(flag)) {
        return { available: false, reason: `Blocked by flag: ${flag}` };
      }
    }
  }

  // Check time window
  if (lead.prerequisites.timeWindow) {
    const { after, before } = lead.prerequisites.timeWindow;

    if (after) {
      if (gameTime.day < after.day || (gameTime.day === after.day && gameTime.hour < after.hour)) {
        return {
          available: false,
          reason: `Not yet available (after Day ${after.day}, ${after.hour}:00)`,
        };
      }
    }

    if (before) {
      if (
        gameTime.day > before.day ||
        (gameTime.day === before.day && gameTime.hour >= before.hour)
      ) {
        return {
          available: false,
          reason: `No longer available (before Day ${before.day}, ${before.hour}:00)`,
        };
      }
    }
  }

  return { available: true };
}

/**
 * Get available leads tool definition
 */
export const getAvailableLeadsTool = defineSharedTool({
  name: "get_available_leads",
  description:
    "List leads that are currently available for discovery. Filter by location, NPC, or prominence.",
  inputSchema: GetAvailableLeadsInputSchema,

  handler: async (input, ctx): Promise<GetAvailableLeadsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const situations = await getSituations(ctx, session);
    if (situations.length === 0) {
      return {
        message:
          "No situations found. The session needs a world pack with situations, or generated situations.",
        leads: [],
        discoveredCount: 0,
        totalCount: 0,
      };
    }

    const allLeads = getAllLeads(situations);
    const discoveredIds = (session.discoveredLeads || []).map((d) => d.leadId);

    // Filter leads
    const availableLeads = allLeads.filter((lead) => {
      // Skip already discovered
      if (discoveredIds.includes(lead.id)) {
        return false;
      }

      // Check prerequisites
      const prereqCheck = checkPrerequisites(lead, session.flags, session.gameTime);
      if (!prereqCheck.available) {
        return false;
      }

      // Apply filters
      if (input.prominence && lead.prominence !== input.prominence) {
        return false;
      }

      // Filter by location - simplified single conditional
      if (
        input.locationId &&
        (lead.discovery.method !== "location" || lead.discovery.sourceId !== input.locationId)
      ) {
        return false;
      }

      // Filter by NPC - simplified single conditional
      if (
        input.npcId &&
        (lead.discovery.method !== "npc" || lead.discovery.sourceId !== input.npcId)
      ) {
        return false;
      }

      return true;
    });

    // Get target situation names for context
    const situationMap = new Map(situations.map((s) => [s.id, s.name]));

    const leads = availableLeads.map((lead) => ({
      id: lead.id,
      targetSituation: {
        id: lead.targetSituationId,
        name: situationMap.get(lead.targetSituationId) || "Unknown",
      },
      information: lead.information,
      prominence: lead.prominence,
      discovery: lead.discovery,
      requiresTest: !!lead.discovery.test,
    }));

    return {
      message: `${leads.length} lead(s) available`,
      leads,
      discoveredCount: discoveredIds.length,
      totalCount: allLeads.length,
    };
  },
});
