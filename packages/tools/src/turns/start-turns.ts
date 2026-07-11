/**
 * Start Turns Tool (Shared)
 *
 * Begin turn-based coordination for multi-player gameplay.
 */

import { z } from "zod";
import { defineSharedTool, createTurnState, type Player } from "@mythxengine/types";

/**
 * Input schema for start_turns
 */
export const StartTurnsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  strategy: z
    .enum(["round_robin", "gm_directed", "free_form"])
    .optional()
    .default("round_robin")
    .describe("Turn strategy (default: round_robin)"),
  playerIds: z
    .array(z.string())
    .optional()
    .describe("Specific player IDs for turn order (default: all PC players)"),
});

export type StartTurnsInput = z.infer<typeof StartTurnsInputSchema>;

/**
 * Output type for start_turns
 */
export interface StartTurnsOutput {
  message: string;
  turns: {
    strategy: string;
    round: number;
    turnOrder: Array<{
      playerId: string;
      playerName: string;
      controlType: string;
    }>;
    currentPlayer: {
      id: string;
      name: string;
      controlType: string;
    };
  };
}

/**
 * Get PC players (excluding GM and spectators)
 */
function getPCPlayers(players: Record<string, Player>): Player[] {
  return Object.values(players).filter((p) => p.role === "pc" && p.status === "active");
}

/**
 * Start turns tool definition
 */
export const startTurnsTool = defineSharedTool({
  name: "start_turns",
  description: "Begin turn-based coordination for multi-player gameplay",
  inputSchema: StartTurnsInputSchema,

  handler: async (input, ctx): Promise<StartTurnsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (session.turns) {
      throw new Error("Turns already active. Call end_turns first.");
    }

    const players = session.players || {};

    // Determine turn order
    let turnOrder: string[];
    if (input.playerIds && input.playerIds.length > 0) {
      // Validate all player IDs exist
      for (const id of input.playerIds) {
        if (!players[id]) {
          throw new Error(`Player not found: ${id}`);
        }
      }

      // Check for duplicate IDs
      const uniqueIds = new Set(input.playerIds);
      if (uniqueIds.size !== input.playerIds.length) {
        // Find the first duplicate
        const seen = new Set<string>();
        for (const id of input.playerIds) {
          if (seen.has(id)) {
            throw new Error(`Duplicate player ID in custom turn order: ${id}`);
          }
          seen.add(id);
        }
      }

      turnOrder = input.playerIds;
    } else {
      // Default to all PC players
      turnOrder = getPCPlayers(players).map((p) => p.id);
    }

    if (turnOrder.length === 0) {
      throw new Error("No players available for turn order. Create players first.");
    }

    session.turns = createTurnState(input.strategy, turnOrder);
    await ctx.sessions.save(session);

    const currentPlayer = players[session.turns.currentPlayerId!];

    return {
      message: `Turns started with ${input.strategy} strategy`,
      turns: {
        strategy: session.turns.strategy,
        round: session.turns.round,
        turnOrder: turnOrder.map((id) => ({
          playerId: id,
          playerName: players[id].name,
          controlType: players[id].controlType,
        })),
        currentPlayer: {
          id: currentPlayer.id,
          name: currentPlayer.name,
          controlType: currentPlayer.controlType,
        },
      },
    };
  },
});
