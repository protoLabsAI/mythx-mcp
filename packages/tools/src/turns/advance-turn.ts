/**
 * Advance Turn Tool (Shared)
 *
 * Move to the next player in turn order.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for advance_turn
 */
export const AdvanceTurnInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type AdvanceTurnInput = z.infer<typeof AdvanceTurnInputSchema>;

/**
 * Output type for advance_turn
 */
export interface AdvanceTurnOutput {
  message: string;
  newRound: boolean;
  round: number;
  currentPlayer: {
    id: string;
    name: string;
    controlType: string;
    character?: {
      id: string;
      name: string;
      hp: { current: number; max: number };
    };
  };
}

/**
 * Advance turn tool definition
 */
export const advanceTurnTool = defineSharedTool({
  name: "advance_turn",
  description: "Move to the next player in turn order",
  inputSchema: AdvanceTurnInputSchema,

  handler: async (input, ctx): Promise<AdvanceTurnOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.turns) {
      throw new Error("No turn coordination active. Call start_turns first.");
    }

    const players = session.players || {};

    // Clear any pending action from current player
    const currentPlayerId = session.turns.currentPlayerId;
    if (currentPlayerId && players[currentPlayerId]) {
      delete players[currentPlayerId].pendingAction;
      players[currentPlayerId].status = "active";
    }

    // Advance to next player
    session.turns.turnIndex = (session.turns.turnIndex + 1) % session.turns.turnOrder.length;

    // Check if we've completed a round
    const newRound = session.turns.turnIndex === 0;
    if (newRound) {
      session.turns.round++;
    }

    session.turns.currentPlayerId = session.turns.turnOrder[session.turns.turnIndex];
    session.turns.waitingForHumanInput = false;

    const newPlayer = players[session.turns.currentPlayerId];

    // Critical null check - player must exist in the session
    if (!newPlayer) {
      throw new Error(
        `Player not found: ${session.turns.currentPlayerId}. Turn order may be stale.`
      );
    }

    let character: { id: string; name: string; hp: { current: number; max: number } } | undefined;
    if (newPlayer.characterId && session.characters[newPlayer.characterId]) {
      const c = session.characters[newPlayer.characterId];
      character = {
        id: c.id,
        name: c.name,
        hp: c.hp,
      };
    }

    await ctx.sessions.save(session);

    return {
      message: newRound
        ? `Round ${session.turns.round} begins. ${newPlayer.name}'s turn.`
        : `${newPlayer.name}'s turn.`,
      newRound,
      round: session.turns.round,
      currentPlayer: {
        id: newPlayer.id,
        name: newPlayer.name,
        controlType: newPlayer.controlType,
        character,
      },
    };
  },
});
