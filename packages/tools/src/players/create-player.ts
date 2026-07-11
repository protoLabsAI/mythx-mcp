/**
 * Create Player Tool (Shared)
 *
 * Add a player (human or AI) to the session.
 */

import { z } from "zod";
import { defineSharedTool, createPlayer, createDefaultAIPersona } from "@mythxengine/types";

/**
 * Input schema for create_player
 */
export const CreatePlayerInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  id: z.string().describe("Unique player ID"),
  name: z.string().describe("Display name"),
  role: z.enum(["gm", "pc", "spectator"]).describe("Player role (gm, pc, or spectator)"),
  controlType: z.enum(["human", "ai"]).describe("Human or AI controlled"),
  characterId: z.string().optional().describe("Character ID to link (optional)"),
  aiPersona: z
    .object({
      playstyle: z.enum(["tactical", "roleplay", "cautious", "reckless"]).describe("AI playstyle"),
      talkativeness: z
        .number()
        .min(0)
        .max(10)
        .optional()
        .default(5)
        .describe("How much the AI talks in-character (0-10)"),
      personalityNotes: z.string().optional().describe("Additional personality notes for the AI"),
    })
    .optional()
    .describe("AI persona configuration (for AI players)"),
});

export type CreatePlayerInput = z.infer<typeof CreatePlayerInputSchema>;

/**
 * Output type for create_player
 */
export interface CreatePlayerOutput {
  message: string;
  player: {
    id: string;
    name: string;
    role: string;
    controlType: string;
    characterId?: string;
    status: string;
  };
}

/**
 * Create player tool definition
 */
export const createPlayerTool = defineSharedTool({
  name: "create_player",
  description: "Add a player (human or AI) to the session",
  inputSchema: CreatePlayerInputSchema,

  handler: async (input, ctx): Promise<CreatePlayerOutput> => {
    const session = await ctx.sessions.getOrCreate(input.sessionId);

    // Ensure players map exists
    if (!session.players) {
      session.players = {};
    }

    if (session.players[input.id]) {
      throw new Error(`Player already exists: ${input.id}`);
    }

    const player = createPlayer(input.id, input.name, input.role, input.controlType);

    // Link character if provided
    if (input.characterId) {
      if (!session.characters[input.characterId]) {
        throw new Error(`Character not found: ${input.characterId}`);
      }
      player.characterId = input.characterId;
    }

    // Add AI persona if AI player
    if (input.controlType === "ai") {
      if (input.aiPersona) {
        player.aiPersona = {
          playstyle: input.aiPersona.playstyle,
          talkativeness: input.aiPersona.talkativeness ?? 5,
          personalityNotes: input.aiPersona.personalityNotes,
        };
      } else {
        player.aiPersona = createDefaultAIPersona();
      }
    }

    // Set GM player ID if this is the GM
    if (input.role === "gm" && !session.gmPlayerId) {
      session.gmPlayerId = input.id;
    }

    session.players[input.id] = player;
    await ctx.sessions.save(session);

    return {
      message: `Player '${input.name}' created (${input.controlType}, ${input.role})`,
      player: {
        id: player.id,
        name: player.name,
        role: player.role,
        controlType: player.controlType,
        characterId: player.characterId,
        status: player.status,
      },
    };
  },
});
