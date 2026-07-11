/**
 * Import Leads as Clues Tool (Shared)
 *
 * Convert situation leads into portable clues for flexible delivery.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { resolveRawSituations } from "../situations/index.js";
import {
  type PortableClue,
  type SourceType,
  type SignificanceLevel,
  getClues,
  saveClues,
} from "./types.js";

/**
 * Input schema for import_leads_as_clues
 */
export const ImportLeadsAsCluesInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  situationId: z.string().describe("Situation ID to import leads from"),
});

export type ImportLeadsAsCluesInput = z.infer<typeof ImportLeadsAsCluesInputSchema>;

/**
 * Output type for import_leads_as_clues
 */
export interface ImportLeadsAsCluesOutput {
  message: string;
  situation?: {
    id: string;
    name: string;
  };
  imported: number;
  clueIds?: string[];
  tip?: string;
}

/**
 * import_leads_as_clues tool definition
 */
export const importLeadsAsCluesTool = defineSharedTool({
  name: "import_leads_as_clues",
  description: "Convert situation leads into portable clues for flexible delivery.",
  inputSchema: ImportLeadsAsCluesInputSchema,

  handler: async (input, ctx): Promise<ImportLeadsAsCluesOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Get situation
    const situations = (await resolveRawSituations(ctx, session)) as Array<{
      id: string;
      name: string;
      outgoingLeads: Array<{
        id: string;
        information: string;
        targetSituationId: string;
        discovery: {
          method: string;
          sourceId?: string;
          description: string;
        };
        prominence: string;
      }>;
    }>;

    const situation = situations.find((s) => s.id === input.situationId);
    if (!situation) {
      throw new Error(`Situation not found: ${input.situationId}`);
    }

    if (!situation.outgoingLeads || situation.outgoingLeads.length === 0) {
      return {
        message: "Situation has no outgoing leads to import.",
        imported: 0,
      };
    }

    const clues = getClues(session);
    const imported: string[] = [];

    for (const lead of situation.outgoingLeads) {
      // Check if already imported
      if (clues.some((c) => c.gmNotes?.includes(lead.id))) {
        continue;
      }

      // Map lead method to source type
      const sourceType = (
        lead.discovery.method === "npc"
          ? "npc"
          : lead.discovery.method === "location"
            ? "location"
            : lead.discovery.method === "document"
              ? "document"
              : lead.discovery.method === "item"
                ? "item"
                : "observation"
      ) as SourceType;

      // Determine significance from prominence
      const significance = (
        lead.prominence === "obvious"
          ? "minor"
          : lead.prominence === "available"
            ? "moderate"
            : lead.prominence === "hidden"
              ? "major"
              : "critical"
      ) as SignificanceLevel;

      const clue: PortableClue = {
        id: `clue:from-lead-${lead.id}-${Date.now()}`,
        information: lead.information,
        significance,
        suggestedSources: [
          {
            type: sourceType,
            id: lead.discovery.sourceId,
            description: lead.discovery.description,
          },
        ],
        revealsLeadTo: lead.targetSituationId,
        revealed: false,
        gmNotes: `Imported from lead: ${lead.id}`,
      };

      clues.push(clue);
      imported.push(clue.id);
    }

    saveClues(session, clues);
    await ctx.sessions.save(session);

    return {
      message: `Imported ${imported.length} lead(s) as portable clues`,
      situation: {
        id: situation.id,
        name: situation.name,
      },
      imported: imported.length,
      clueIds: imported,
      tip: "These clues can now be delivered flexibly through any appropriate source.",
    };
  },
});
