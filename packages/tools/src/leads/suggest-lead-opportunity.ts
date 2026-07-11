/**
 * Suggest Lead Opportunity Tool (Shared)
 *
 * Suggest ways to naturally surface leads pointing to a target situation.
 * Supports the Three Clue Rule.
 */

import { z } from "zod";
import { defineSharedTool, type GameTime } from "@mythxengine/types";
import { resolveRawSituations } from "../situations/index.js";

/**
 * Input schema for suggest_lead_opportunity
 */
export const SuggestLeadOpportunityInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  targetSituationId: z.string().describe("Situation ID to find leads for"),
});

export type SuggestLeadOpportunityInput = z.infer<typeof SuggestLeadOpportunityInputSchema>;

/**
 * Lead type from generated content
 */
interface Lead {
  id: string;
  information: string;
  targetSituationId: string;
  discovery: {
    method: string;
    description: string;
  };
  prominence: string;
  prerequisites?: {
    requiredFlags?: string[];
    blockedByFlags?: string[];
    timeWindow?: {
      after?: { day: number; hour: number };
      before?: { day: number; hour: number };
    };
  };
}

/**
 * Situation type from generated content
 */
interface Situation {
  id: string;
  name: string;
  outgoingLeads: Lead[];
  entryPoints: {
    incomingLeadIds: string[];
    directDiscovery: Array<{
      method: string;
      description: string;
      locationId?: string;
      npcId?: string;
    }>;
    minimumLeadsTarget: number;
  };
}

/**
 * Output type for suggest_lead_opportunity
 */
export interface SuggestLeadOpportunityOutput {
  targetSituation: {
    id: string;
    name: string;
  };
  threeClueRule: {
    status: "satisfied" | "adequate" | "at_risk";
    availableEntryPoints: number;
    minimumTarget: number;
    message: string;
  };
  leads: Array<{
    id: string;
    fromSituation: string;
    prominence: string;
    discoveryMethod: string;
    discoveryDescription: string;
    status: "discovered" | "available" | "blocked";
    blockReason?: string;
  }>;
  directDiscovery: Array<{
    method: string;
    description: string;
    locationId?: string;
    npcId?: string;
  }>;
  suggestions: string[];
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

  if (lead.prerequisites.requiredFlags) {
    for (const flag of lead.prerequisites.requiredFlags) {
      if (!flags.includes(flag)) {
        return { available: false, reason: `Missing required flag: ${flag}` };
      }
    }
  }

  if (lead.prerequisites.blockedByFlags) {
    for (const flag of lead.prerequisites.blockedByFlags) {
      if (flags.includes(flag)) {
        return { available: false, reason: `Blocked by flag: ${flag}` };
      }
    }
  }

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
 * Suggest lead opportunity tool definition
 */
export const suggestLeadOpportunityTool = defineSharedTool({
  name: "suggest_lead_opportunity",
  description:
    "Suggest ways to naturally surface leads pointing to a target situation. Supports the Three Clue Rule.",
  inputSchema: SuggestLeadOpportunityInputSchema,

  handler: async (input, ctx): Promise<SuggestLeadOpportunityOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const situations = (await resolveRawSituations(ctx, session)) as Situation[];
    const targetSituation = situations.find((s) => s.id === input.targetSituationId);

    if (!targetSituation) {
      throw new Error(`Situation not found: ${input.targetSituationId}`);
    }

    const discoveredIds = (session.discoveredLeads || []).map((d) => d.leadId);

    // Find all leads pointing to this situation
    const leadsToTarget: Array<{
      lead: Lead;
      sourceSituation: Situation;
      status: "discovered" | "available" | "blocked";
      blockReason?: string;
    }> = [];

    for (const situation of situations) {
      for (const lead of situation.outgoingLeads || []) {
        if (lead.targetSituationId === input.targetSituationId) {
          const isDiscovered = discoveredIds.includes(lead.id);
          const prereqCheck = checkPrerequisites(lead, session.flags, session.gameTime);

          leadsToTarget.push({
            lead,
            sourceSituation: situation,
            status: isDiscovered ? "discovered" : prereqCheck.available ? "available" : "blocked",
            blockReason: prereqCheck.reason,
          });
        }
      }
    }

    // Also include direct discovery methods
    const directDiscovery = targetSituation.entryPoints.directDiscovery.map((d) => ({
      method: d.method,
      description: d.description,
      locationId: d.locationId,
      npcId: d.npcId,
    }));

    // Calculate Three Clue Rule status
    const availableEntryPoints =
      leadsToTarget.filter((l) => l.status === "available").length + directDiscovery.length;
    const threeClueStatus =
      availableEntryPoints >= 3 ? "satisfied" : availableEntryPoints >= 2 ? "adequate" : "at_risk";

    // Generate suggestions
    const suggestions: string[] = [];

    // Suggest available leads
    const availableLeads = leadsToTarget.filter((l) => l.status === "available");
    for (const { lead, sourceSituation } of availableLeads.slice(0, 3)) {
      if (lead.discovery.method === "npc") {
        suggestions.push(`NPC can mention: "${lead.information}" (from ${sourceSituation.name})`);
      } else if (lead.discovery.method === "location") {
        suggestions.push(`At location, players can find: ${lead.discovery.description}`);
      } else if (lead.discovery.method === "observation") {
        suggestions.push(`Players might notice: ${lead.discovery.description}`);
      } else {
        suggestions.push(`Via ${lead.discovery.method}: ${lead.discovery.description}`);
      }
    }

    // Suggest direct discovery
    for (const d of directDiscovery.slice(0, 2)) {
      suggestions.push(`Direct discovery via ${d.method}: ${d.description}`);
    }

    return {
      targetSituation: {
        id: targetSituation.id,
        name: targetSituation.name,
      },
      threeClueRule: {
        status: threeClueStatus,
        availableEntryPoints,
        minimumTarget: targetSituation.entryPoints.minimumLeadsTarget,
        message:
          threeClueStatus === "satisfied"
            ? "Three Clue Rule satisfied - multiple paths to discovery"
            : threeClueStatus === "adequate"
              ? "Two entry points available - consider adding another"
              : "At risk - players may get stuck without more leads",
      },
      leads: leadsToTarget.map(({ lead, sourceSituation, status, blockReason }) => ({
        id: lead.id,
        fromSituation: sourceSituation.name,
        prominence: lead.prominence,
        discoveryMethod: lead.discovery.method,
        discoveryDescription: lead.discovery.description,
        status,
        blockReason,
      })),
      directDiscovery,
      suggestions,
    };
  },
});
