/**
 * Start Dialogue Tool
 *
 * Initiate a structured NPC dialogue from world pack data.
 * Sets the stage to "dialogue" with NPC portrait, initial greeting,
 * and context-appropriate response choices.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";

export const StartDialogueInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  npcId: z.string().describe("NPC ID from world pack"),
  greeting: z
    .string()
    .optional()
    .describe("Custom greeting text (overrides auto-generated greeting)"),
  responses: z
    .array(z.string())
    .optional()
    .describe("Custom response choices (overrides role-based defaults)"),
  context: z
    .string()
    .optional()
    .describe("Additional context for the encounter (e.g., 'player just saved them')"),
});

export type StartDialogueInput = z.infer<typeof StartDialogueInputSchema>;

export interface StartDialogueOutput {
  message: string;
  npcId: string;
  npcName: string;
  greeting: string;
  responses: string[];
  narrativeRole?: string;
  /** NPC portrait URL from world pack (pass to showDialogue) */
  portrait?: string;
}

/**
 * Generate default response choices based on NPC role
 */
function getDefaultResponses(narrativeRole?: string): string[] {
  switch (narrativeRole) {
    case "merchant":
      return ["Browse wares", "Ask about rumors", "Farewell"];
    case "quest_giver":
      return ["Tell me more", "I'll help", "Not interested", "Farewell"];
    case "information":
      return ["What do you know?", "Ask about this area", "Farewell"];
    case "ally":
      return ["How are things?", "Need any help?", "Let's talk strategy", "Farewell"];
    case "obstacle":
      return ["Step aside", "Let's negotiate", "I'll find another way"];
    case "antagonist":
      return ["State your business", "This ends now", "Walk away"];
    default:
      return ["Ask about this place", "Trade", "Farewell"];
  }
}

export const startDialogueTool = defineSharedTool({
  name: "start_dialogue",
  description:
    "Start a structured NPC dialogue. Loads NPC data from the world pack, sets the UI to dialogue stage with portrait and response choices.",
  inputSchema: StartDialogueInputSchema,
  emits: [EventTypes.DIALOGUE_STARTED],

  handler: async (input, ctx): Promise<StartDialogueOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Load NPC from world pack
    let npcName = "Unknown";
    let narrativeRole: string | undefined;
    let portrait: string | undefined;
    let greeting = input.greeting ?? "...";
    let responses = input.responses ?? [];

    if (session.worldPackId) {
      const rawPack = await ctx.worldPacks.get(session.worldPackId);
      // World pack collections are records keyed by id (see WorldContentPackSchema)
      const worldPack = rawPack as {
        npcs?: Record<
          string,
          {
            id: string;
            name: string;
            narrativeRole?: string;
            dialogueHints?: string[];
            images?: { portrait?: { url?: string } };
          }
        >;
      } | null;
      if (worldPack) {
        const npc = Object.values(worldPack.npcs ?? {}).find((n) => n.id === input.npcId);
        if (npc) {
          npcName = npc.name;
          narrativeRole = npc.narrativeRole;
          portrait = npc.images?.portrait?.url;

          // Auto-generate greeting from NPC data if not provided
          if (!input.greeting) {
            const hint = npc.dialogueHints?.[0] ?? `Greetings, traveler.`;
            greeting = hint;
          }

          // Auto-generate responses from role if not provided
          if (!input.responses || input.responses.length === 0) {
            responses = getDefaultResponses(npc.narrativeRole);
          }
        }
      }
    }

    // Also check session-generated NPCs (typed as unknown[])
    if (npcName === "Unknown" && session.generation?.generatedContent?.npcs) {
      const genNpcs = session.generation.generatedContent.npcs as Array<{
        id: string;
        name: string;
        narrativeRole?: string;
        dialogueHints?: string[];
      }>;
      const genNpc = genNpcs.find((n) => n.id === input.npcId);
      if (genNpc) {
        npcName = genNpc.name;
        narrativeRole = genNpc.narrativeRole;
        if (!input.greeting) {
          greeting = genNpc.dialogueHints?.[0] ?? "Greetings, traveler.";
        }
        if (!input.responses || input.responses.length === 0) {
          responses = getDefaultResponses(genNpc.narrativeRole);
        }
      }
    }

    // Emit dialogue started event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.DIALOGUE_STARTED,
      {
        npcId: input.npcId,
        npcName,
        narrativeRole,
        context: input.context,
      },
      "start_dialogue",
      ctx.currentTurnId
    );

    return {
      message: `Started dialogue with ${npcName}`,
      npcId: input.npcId,
      npcName,
      greeting,
      responses,
      narrativeRole,
      portrait,
    };
  },
});
