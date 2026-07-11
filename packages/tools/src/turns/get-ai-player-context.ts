/**
 * Get AI Player Context Tool (Shared)
 *
 * Get full context for an AI player to make a decision.
 * Critical for the ai-player subagent.
 */

import { z } from "zod";
import { defineSharedTool, type Character, type GameTime } from "@mythxengine/types";
import { requireSkill } from "../skills/load-skill.js";

/**
 * Input schema for get_ai_player_context
 */
export const GetAIPlayerContextInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  playerId: z.string().describe("AI player ID"),
});

export type GetAIPlayerContextInput = z.infer<typeof GetAIPlayerContextInputSchema>;

/**
 * Output type for get_ai_player_context
 */
export interface GetAIPlayerContextOutput {
  player: {
    id: string;
    name: string;
    aiPersona?: {
      playstyle?: "tactical" | "roleplay" | "cautious" | "reckless";
      talkativeness?: number;
      personalityNotes?: string;
    };
  };
  character: Character | null;
  partyMembers: Array<{
    playerId: string;
    playerName: string;
    characterId: string;
    characterName: string;
    hp: { current: number; max: number };
    conditions: string[];
  }>;
  combat: {
    active: true;
    round: number;
    currentTurnId: string;
    enemies: Array<{
      id: string;
      name: string;
      hp: { current: number; max: number };
      conditions: string[];
    }>;
  } | null;
  gameTime: GameTime;
  recentNotes: Array<{
    content: string;
    tags: string[];
  }>;
  turnState: {
    round: number;
    strategy: string;
  } | null;
}

/**
 * Get AI player context tool definition
 */
export const getAIPlayerContextTool = defineSharedTool({
  name: "get_ai_player_context",
  description: "Get full context for an AI player to make a decision",
  inputSchema: GetAIPlayerContextInputSchema,

  // Gate: companion-intelligence skill required. The skill body
  // documents the four playstyle decision rules and the per-turn
  // get_context → playstyle-apply → submit_action sequence. Calling
  // this without the skill leads to companions narrated without
  // grounding in their tactical/roleplay/cautious/reckless persona.
  gate: requireSkill("companion-intelligence"),

  handler: async (input, ctx): Promise<GetAIPlayerContextOutput> => {
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

    // Get linked character
    let character: Character | null = null;
    if (player.characterId && session.characters[player.characterId]) {
      character = session.characters[player.characterId];
    }

    // Get other party members
    const partyMembers = Object.values(players)
      .filter((p) => p.id !== player.id && p.role === "pc" && p.characterId)
      .map((p) => {
        const c = session.characters[p.characterId!];
        return c
          ? {
              playerId: p.id,
              playerName: p.name,
              characterId: c.id,
              characterName: c.name,
              hp: c.hp,
              conditions: (c.conditions ?? []).map((cond) => cond.name),
            }
          : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    // Get combat state if active
    let combat: GetAIPlayerContextOutput["combat"] = null;
    if (session.combat?.active) {
      const enemies = (session.combat.turnOrder ?? [])
        .filter((id) => session.enemies[id])
        .map((id) => {
          const e = session.enemies[id];
          return {
            id: e.id,
            name: e.name,
            hp: e.hp,
            conditions: (e.conditions ?? []).map((c) => c.name),
          };
        });

      combat = {
        active: true,
        round: session.combat.round,
        currentTurnId: session.combat.currentTurnId,
        enemies,
      };
    }

    // Get recent notes for context (guard against undefined)
    const recentNotes = (session.notes ?? []).slice(-5).map((n) => ({
      content: n.content,
      tags: n.tags,
    }));

    return {
      player: {
        id: player.id,
        name: player.name,
        aiPersona: player.aiPersona,
      },
      character,
      partyMembers,
      combat,
      gameTime: session.gameTime,
      recentNotes,
      turnState: session.turns
        ? {
            round: session.turns.round,
            strategy: session.turns.strategy,
          }
        : null,
    };
  },
});
