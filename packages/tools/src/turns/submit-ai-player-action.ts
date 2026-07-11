/**
 * Submit AI Player Action Tool (Shared)
 *
 * Record an AI player's decided action.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { requireSkill } from "../skills/load-skill.js";

/**
 * Input schema for submit_ai_player_action
 */
export const SubmitAIPlayerActionInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  playerId: z.string().describe("AI player ID"),
  action: z.string().describe("The action the AI decided on"),
  reasoning: z.string().optional().describe("Brief reasoning for the choice (optional)"),
});

export type SubmitAIPlayerActionInput = z.infer<typeof SubmitAIPlayerActionInputSchema>;

/**
 * Output type for submit_ai_player_action
 */
export interface SubmitAIPlayerActionOutput {
  message: string;
  player: {
    id: string;
    name: string;
    characterName?: string;
    aiPersona?: {
      playstyle?: "tactical" | "roleplay" | "cautious" | "reckless";
      talkativeness?: number;
      personalityNotes?: string;
    };
  };
  action: string;
  reasoning?: string;
}

/**
 * Submit AI player action tool definition
 */
export const submitAIPlayerActionTool = defineSharedTool({
  name: "submit_ai_player_action",
  description: "Record an AI player's decided action",
  inputSchema: SubmitAIPlayerActionInputSchema,
  emits: [EventTypes.PLAYER_ACTION_SUBMITTED],

  // Gate: companion-intelligence skill required — pair with
  // get_ai_player_context, which the skill body documents as the
  // load-bearing per-turn sequence for companion-driven actions.
  gate: requireSkill("companion-intelligence"),

  handler: async (input, ctx): Promise<SubmitAIPlayerActionOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const players = session.players || {};
    const player = players[input.playerId];
    if (!player) {
      throw new Error(`Player not found: ${input.playerId}`);
    }

    if (player.controlType !== "ai") {
      throw new Error(`Player '${player.name}' is human-controlled, not AI`);
    }

    player.status = "active";
    player.lastActiveAt = new Date().toISOString();

    await ctx.sessions.save(session);

    // Get character name for the response
    const characterName = player.characterId
      ? session.characters[player.characterId]?.name || undefined
      : undefined;

    return {
      message: `${characterName || player.name} (AI: ${player.name}) acts: ${input.action}`,
      player: {
        id: player.id,
        name: player.name,
        characterName,
        aiPersona: player.aiPersona,
      },
      action: input.action,
      reasoning: input.reasoning,
    };
  },
});
