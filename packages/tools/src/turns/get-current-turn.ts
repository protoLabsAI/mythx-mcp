/**
 * Get Current Turn Tool (Shared)
 *
 * Get the current turn state and active player.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for get_current_turn
 */
export const GetCurrentTurnInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type GetCurrentTurnInput = z.infer<typeof GetCurrentTurnInputSchema>;

/**
 * Output type for get_current_turn
 */
export interface GetCurrentTurnOutput {
  active: boolean;
  message?: string;
  strategy?: string;
  round?: number;
  turnIndex?: number;
  totalPlayers?: number;
  waitingForHumanInput?: boolean;
  currentPlayer?: {
    id: string;
    name: string;
    controlType: string;
    status: string;
    pendingAction?: {
      prompt: string;
      choices?: string[];
      context?: string;
      requestedAt: string;
    };
    character?: {
      id: string;
      name: string;
      hp: { current: number; max: number };
      conditions: string[];
    };
  };
  turnOrder?: Array<{
    playerId: string;
    playerName: string;
    controlType: string;
    isCurrent: boolean;
  }>;
}

/**
 * Get current turn tool definition
 */
export const getCurrentTurnTool = defineSharedTool({
  name: "get_current_turn",
  description: "Get the current turn state and active player",
  inputSchema: GetCurrentTurnInputSchema,

  handler: async (input, ctx): Promise<GetCurrentTurnOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.turns) {
      return {
        active: false,
        message: "No turn coordination active",
      };
    }

    const players = session.players || {};
    const currentPlayer = session.turns.currentPlayerId
      ? players[session.turns.currentPlayerId]
      : null;

    let character:
      | {
          id: string;
          name: string;
          hp: { current: number; max: number };
          conditions: string[];
        }
      | undefined = undefined;
    if (currentPlayer?.characterId && session.characters[currentPlayer.characterId]) {
      const c = session.characters[currentPlayer.characterId];
      character = {
        id: c.id,
        name: c.name,
        hp: c.hp,
        conditions: c.conditions.map((cond) => cond.name),
      };
    }

    return {
      active: true,
      strategy: session.turns.strategy,
      round: session.turns.round,
      turnIndex: session.turns.turnIndex,
      totalPlayers: session.turns.turnOrder.length,
      waitingForHumanInput: session.turns.waitingForHumanInput,
      currentPlayer: currentPlayer
        ? {
            id: currentPlayer.id,
            name: currentPlayer.name,
            controlType: currentPlayer.controlType,
            status: currentPlayer.status,
            pendingAction: currentPlayer.pendingAction,
            character,
          }
        : undefined,
      turnOrder: session.turns.turnOrder.map((id, idx) => ({
        playerId: id,
        playerName: players[id]?.name || "Unknown",
        controlType: players[id]?.controlType || "unknown",
        isCurrent: idx === session.turns!.turnIndex,
      })),
    };
  },
});
