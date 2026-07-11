/**
 * Reveal Lead Tool (Shared)
 *
 * Mark a lead as discovered by the players.
 */

import { z } from "zod";
import { defineSharedTool, type DiscoveredLead } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";
import { getSituations, getAllLeads, formatGameTime } from "./helpers.js";

/**
 * Input schema for reveal_lead
 */
export const RevealLeadInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  leadId: z.string().describe("Lead ID to reveal"),
  discoveryMethod: z.string().describe("How it was discovered"),
  discoveryContext: z.string().optional().describe("Additional context about discovery"),
  discoveredByPlayerId: z
    .string()
    .optional()
    .describe("Player ID of the PC who discovered this lead (for asymmetric knowledge)"),
});

export type RevealLeadInput = z.infer<typeof RevealLeadInputSchema>;

/**
 * Output type for reveal_lead
 */
export interface RevealLeadOutput {
  message: string;
  lead: {
    id: string;
    information: string;
    targetSituation?: {
      id: string;
      name: string;
    };
  };
  discoveredAt?: string;
  discoveryMethod?: string;
  totalDiscovered?: number;
  alreadyDiscovered?: boolean;
}

/**
 * Reveal lead tool definition
 */
export const revealLeadTool = defineSharedTool({
  name: "reveal_lead",
  description: "Mark a lead as discovered by the players.",
  inputSchema: RevealLeadInputSchema,
  emits: [EventTypes.LEAD_REVEALED],

  handler: async (input, ctx): Promise<RevealLeadOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const situations = await getSituations(ctx, session);
    const allLeads = getAllLeads(situations);
    const lead = allLeads.find((l) => l.id === input.leadId);

    if (!lead) {
      throw new Error(`Lead not found: ${input.leadId}`);
    }

    // Initialize discoveredLeads if needed
    if (!session.discoveredLeads) {
      session.discoveredLeads = [];
    }

    // Check if already discovered
    if (session.discoveredLeads.some((d) => d.leadId === input.leadId)) {
      return {
        message: "Lead already discovered",
        lead: {
          id: lead.id,
          information: lead.information,
        },
        alreadyDiscovered: true,
      };
    }

    // Record discovery
    const discovered: DiscoveredLead = {
      leadId: lead.id,
      targetSituationId: lead.targetSituationId,
      discoveredAt: { ...session.gameTime },
      discoveryMethod: input.discoveryMethod,
      discoveryContext: input.discoveryContext,
      information: lead.information,
      ...(input.discoveredByPlayerId
        ? {
            discoveredByPlayerId: input.discoveredByPlayerId,
            sharedWithPlayerIds: [],
          }
        : {}),
    };

    session.discoveredLeads.push(discovered);
    await ctx.sessions.save(session);

    // Get target situation name
    const targetSituation = situations.find((s) => s.id === lead.targetSituationId);

    // Emit lead revealed event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.LEAD_REVEALED,
      {
        leadId: lead.id,
        targetSituationId: lead.targetSituationId,
        discoveryMethod: input.discoveryMethod,
      },
      "reveal_lead",
      ctx.currentTurnId
    );

    return {
      message: "Lead discovered!",
      lead: {
        id: lead.id,
        information: lead.information,
        targetSituation: {
          id: lead.targetSituationId,
          name: targetSituation?.name || "Unknown",
        },
      },
      discoveredAt: formatGameTime(session.gameTime),
      discoveryMethod: input.discoveryMethod,
      totalDiscovered: session.discoveredLeads.length,
    };
  },
});
