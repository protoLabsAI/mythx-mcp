/**
 * Update Player Tool (Shared)
 *
 * Update a player's status, name, or AI persona.
 */

import { z } from "zod";
import { defineSharedTool, createDefaultAIPersona, type PlayerAIPersona } from "@mythxengine/types";
import { emitPlayerUpdated } from "../events/emitters.js";
import { EventTypes } from "../events/channels.js";

/**
 * Input schema for update_player
 */
export const UpdatePlayerInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  playerId: z.string().describe("Player ID"),
  name: z.string().optional().describe("New display name"),
  status: z.enum(["active", "inactive", "waiting_for_input"]).optional().describe("New status"),
  characterId: z.string().nullable().optional().describe("New character ID (or null to unlink)"),
  controlType: z.enum(["human", "ai"]).optional().describe("Switch between human and AI control"),
  aiPersona: z
    .object({
      playstyle: z
        .enum(["tactical", "roleplay", "cautious", "reckless"])
        .optional()
        .describe("AI playstyle"),
      talkativeness: z
        .number()
        .min(0)
        .max(10)
        .optional()
        .describe("How much the AI talks in-character (0-10)"),
      personalityNotes: z.string().optional().describe("Additional personality notes"),
    })
    .optional()
    .describe("Update AI persona (for AI players)"),
});

export type UpdatePlayerInput = z.infer<typeof UpdatePlayerInputSchema>;

/**
 * Output type for update_player
 */
export interface UpdatePlayerOutput {
  player: string;
  changes: string[];
  currentState: {
    id: string;
    name: string;
    status: string;
    controlType: string;
    characterId?: string;
    aiPersona?: PlayerAIPersona;
  };
}

/**
 * Update player tool definition
 */
export const updatePlayerTool = defineSharedTool({
  name: "update_player",
  description: "Update a player's status, name, controlType, or AI persona",
  inputSchema: UpdatePlayerInputSchema,
  emits: [EventTypes.PLAYER_UPDATED],

  handler: async (input, ctx): Promise<UpdatePlayerOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const players = session.players || {};
    const player = players[input.playerId];
    if (!player) {
      throw new Error(`Player not found: ${input.playerId}`);
    }

    const changes: string[] = [];

    if (input.name !== undefined) {
      player.name = input.name;
      changes.push(`Name set to '${input.name}'`);
    }

    if (input.status !== undefined) {
      player.status = input.status;
      changes.push(`Status set to '${input.status}'`);
    }

    if (input.characterId !== undefined) {
      if (input.characterId === null) {
        delete player.characterId;
        changes.push("Character unlinked");
      } else {
        if (!session.characters[input.characterId]) {
          throw new Error(`Character not found: ${input.characterId}`);
        }
        player.characterId = input.characterId;
        changes.push(`Linked to character '${input.characterId}'`);
      }
    }

    if (input.controlType !== undefined && input.controlType !== player.controlType) {
      const previousControlType = player.controlType;
      player.controlType = input.controlType;

      if (input.controlType === "human") {
        // Switching AI -> human: clear AI persona, set status to waiting_for_player
        delete player.aiPersona;
        player.status = "waiting_for_input";
        changes.push(
          `Control switched from 'ai' to 'human'; aiPersona cleared, status set to 'waiting_for_input'`
        );
      } else {
        // Switching human -> AI: set AI persona (from input or defaults)
        if (input.aiPersona) {
          player.aiPersona = {
            playstyle: input.aiPersona.playstyle ?? "tactical",
            talkativeness: input.aiPersona.talkativeness ?? 5,
            personalityNotes: input.aiPersona.personalityNotes,
          };
        } else {
          player.aiPersona = createDefaultAIPersona();
        }
        changes.push(
          `Control switched from '${previousControlType}' to 'ai'; aiPersona initialized`
        );
      }
    }

    if (input.aiPersona && player.controlType === "ai") {
      if (!player.aiPersona) {
        player.aiPersona = createDefaultAIPersona();
      }
      if (input.aiPersona.playstyle !== undefined) {
        player.aiPersona.playstyle = input.aiPersona.playstyle;
        changes.push(`AI playstyle set to '${input.aiPersona.playstyle}'`);
      }
      if (input.aiPersona.talkativeness !== undefined) {
        player.aiPersona.talkativeness = input.aiPersona.talkativeness;
        changes.push(`AI talkativeness set to ${input.aiPersona.talkativeness}`);
      }
      if (input.aiPersona.personalityNotes !== undefined) {
        player.aiPersona.personalityNotes = input.aiPersona.personalityNotes;
        changes.push("AI personality notes updated");
      }
    }

    player.lastActiveAt = new Date().toISOString();
    await ctx.sessions.save(session);

    if (changes.length > 0 && ctx.eventBus) {
      emitPlayerUpdated(
        ctx.eventBus,
        input.sessionId,
        {
          playerId: player.id,
          playerName: player.name,
          changes: Object.fromEntries(changes.map((c, i) => [i, c])),
        },
        "update_player"
      );
    }

    return {
      player: player.name,
      changes,
      currentState: {
        id: player.id,
        name: player.name,
        status: player.status,
        controlType: player.controlType,
        characterId: player.characterId,
        aiPersona: player.aiPersona,
      },
    };
  },
});
