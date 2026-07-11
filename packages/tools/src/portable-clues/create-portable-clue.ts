/**
 * Create Portable Clue Tool (Shared)
 *
 * Create a revelation that can be discovered through multiple sources.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import {
  SIGNIFICANCE_LEVELS,
  SOURCE_TYPES,
  type PortableClue,
  getClues,
  saveClues,
} from "./types.js";

/**
 * Input schema for create_portable_clue
 */
export const CreatePortableClueInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  information: z.string().describe("What the clue reveals"),
  significance: z.enum(SIGNIFICANCE_LEVELS).describe("How important this clue is"),
  suggestedSources: z
    .array(
      z.object({
        type: z.enum(SOURCE_TYPES),
        id: z.string().optional().describe("NPC/location/item ID"),
        description: z.string().describe("How to deliver via this source"),
      })
    )
    .describe("Ways this clue can be discovered"),
  prerequisites: z
    .object({
      requiredFlags: z.array(z.string()).optional(),
      requiredEvidence: z.array(z.string()).optional(),
      notBefore: z.object({ day: z.number(), hour: z.number() }).optional(),
    })
    .optional(),
  revealsLeadTo: z.string().optional().describe("Situation ID this clue points to"),
  setsFlags: z.array(z.string()).optional().describe("Flags to set when revealed"),
  gmNotes: z.string().optional().describe("GM-only notes"),
});

export type CreatePortableClueInput = z.infer<typeof CreatePortableClueInputSchema>;

/**
 * Output type for create_portable_clue
 */
export interface CreatePortableClueOutput {
  message: string;
  clue: {
    id: string;
    information: string;
    significance: string;
    sourceCount: number;
    hasPrerequisites: boolean;
  };
  tip: string;
}

/**
 * create_portable_clue tool definition
 */
export const createPortableClueTool = defineSharedTool({
  name: "create_portable_clue",
  description:
    "Create a revelation that can be discovered through multiple sources. The ultimate flexible clue.",
  inputSchema: CreatePortableClueInputSchema,

  handler: async (input, ctx): Promise<CreatePortableClueOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const clues = getClues(session);

    const id = `clue:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const clue: PortableClue = {
      id,
      information: input.information,
      significance: input.significance,
      suggestedSources: input.suggestedSources,
      prerequisites: input.prerequisites,
      revealsLeadTo: input.revealsLeadTo,
      setsFlags: input.setsFlags,
      revealed: false,
      gmNotes: input.gmNotes,
    };

    clues.push(clue);
    saveClues(session, clues);
    await ctx.sessions.save(session);

    return {
      message: "Portable clue created",
      clue: {
        id: clue.id,
        information: clue.information,
        significance: clue.significance,
        sourceCount: clue.suggestedSources.length,
        hasPrerequisites: !!clue.prerequisites,
      },
      tip: "This clue can now be revealed through any of its suggested sources, or improvised through other means.",
    };
  },
});
