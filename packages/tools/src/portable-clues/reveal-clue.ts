/**
 * Reveal Clue Tool (Shared)
 *
 * Mark a portable clue as discovered.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { getClues, saveClues, formatGameTime } from "./types.js";

/**
 * Input schema for reveal_clue
 */
export const RevealClueInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  clueId: z.string().describe("Clue ID to reveal"),
  via: z.string().describe("How it was revealed (description)"),
});

export type RevealClueInput = z.infer<typeof RevealClueInputSchema>;

/**
 * Output type for reveal_clue
 */
export interface RevealClueOutput {
  message: string;
  clue: {
    id: string;
    information: string;
    significance?: string;
    revealedAt?: string;
    revealedVia?: string;
  };
  flagsSet?: string[];
  revealsLeadTo?: string;
  alreadyRevealed?: boolean;
}

/**
 * reveal_clue tool definition
 */
export const revealClueTool = defineSharedTool({
  name: "reveal_clue",
  description: "Mark a portable clue as discovered.",
  inputSchema: RevealClueInputSchema,

  handler: async (input, ctx): Promise<RevealClueOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const clues = getClues(session);
    const clue = clues.find((c) => c.id === input.clueId);

    if (!clue) {
      throw new Error(`Clue not found: ${input.clueId}`);
    }

    if (clue.revealed) {
      return {
        message: "Clue was already revealed",
        clue: {
          id: clue.id,
          information: clue.information,
          revealedAt: clue.revealedAt ? formatGameTime(clue.revealedAt) : undefined,
          revealedVia: clue.revealedVia,
        },
        alreadyRevealed: true,
      };
    }

    // Mark as revealed
    clue.revealed = true;
    clue.revealedAt = { ...session.gameTime };
    clue.revealedVia = input.via;

    // Set any flags
    if (clue.setsFlags) {
      for (const flag of clue.setsFlags) {
        if (!session.flags.includes(flag)) {
          session.flags.push(flag);
        }
      }
    }

    saveClues(session, clues);
    await ctx.sessions.save(session);

    return {
      message: "Clue revealed!",
      clue: {
        id: clue.id,
        information: clue.information,
        significance: clue.significance,
        revealedAt: formatGameTime(session.gameTime),
        revealedVia: input.via,
      },
      flagsSet: clue.setsFlags || [],
      revealsLeadTo: clue.revealsLeadTo,
    };
  },
});
