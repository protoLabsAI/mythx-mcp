/**
 * Update Relationship Tool (Shared)
 *
 * Record an interaction and update NPC relationship.
 */

import { z } from "zod";
import { defineSharedTool, type NPCRelationship } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";

/**
 * Attitude levels
 */
const ATTITUDES = ["hostile", "unfriendly", "neutral", "friendly", "allied"] as const;
type Attitude = (typeof ATTITUDES)[number];

/**
 * Impact levels
 */
const IMPACTS = ["very_negative", "negative", "neutral", "positive", "very_positive"] as const;
type Impact = (typeof IMPACTS)[number];

/**
 * Input schema for update_relationship
 */
export const UpdateRelationshipInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  npcId: z.string().describe("NPC ID"),
  interaction: z.string().describe("Description of what happened"),
  impact: z.enum(IMPACTS).describe("How this affected the relationship"),
  actingCharacterId: z
    .string()
    .optional()
    .describe("Character ID of the PC who caused this interaction (tracks per-PC attitudes)"),
  attitudeChange: z.enum(ATTITUDES).optional().describe("Explicit attitude override (optional)"),
  addKnows: z.array(z.string()).optional().describe("Add to what NPC knows"),
  addOwes: z.array(z.string()).optional().describe("Add debts/favors"),
  addFears: z.array(z.string()).optional().describe("Add fears"),
  addWants: z.array(z.string()).optional().describe("Add wants"),
  removeKnows: z.array(z.string()).optional().describe("Remove from knows"),
  removeOwes: z.array(z.string()).optional().describe("Remove debts"),
  removeFears: z.array(z.string()).optional().describe("Remove fears"),
  removeWants: z.array(z.string()).optional().describe("Remove wants"),
});

export type UpdateRelationshipInput = z.infer<typeof UpdateRelationshipInputSchema>;

/**
 * Calculate attitude shift from impact
 */
function calculateAttitudeShift(currentAttitude: Attitude, impact: Impact): Attitude {
  const attitudeIndex = ATTITUDES.indexOf(currentAttitude);

  let shift = 0;
  switch (impact) {
    case "very_negative":
      shift = -2;
      break;
    case "negative":
      shift = -1;
      break;
    case "neutral":
      shift = 0;
      break;
    case "positive":
      shift = 1;
      break;
    case "very_positive":
      shift = 2;
      break;
  }

  const newIndex = Math.max(0, Math.min(ATTITUDES.length - 1, attitudeIndex + shift));
  return ATTITUDES[newIndex];
}

/**
 * Get relationship summary text
 */
function getAttitudeSummary(attitude: Attitude): string {
  switch (attitude) {
    case "hostile":
      return "Actively antagonistic, may attack or sabotage";
    case "unfriendly":
      return "Distrustful, uncooperative, may withhold help";
    case "neutral":
      return "No strong feelings, will deal fairly";
    case "friendly":
      return "Positive disposition, inclined to help";
    case "allied":
      return "Strong bond, will go out of their way to assist";
  }
}

/**
 * Output type for update_relationship
 */
export interface UpdateRelationshipOutput {
  message: string;
  npcId: string;
  npcName: string;
  interaction: string;
  impact: Impact;
  attitudeChange: {
    from: Attitude;
    to: Attitude;
    summary: string;
  } | null;
  currentAttitude: {
    level: Attitude;
    summary: string;
  };
  totalInteractions: number;
}

/**
 * Update relationship tool definition
 */
export const updateRelationshipTool = defineSharedTool({
  name: "update_relationship",
  description:
    "Record an interaction and update NPC relationship. Automatically adjusts attitude based on impact.",
  inputSchema: UpdateRelationshipInputSchema,
  emits: [EventTypes.RELATIONSHIP_UPDATED],

  handler: async (input, ctx): Promise<UpdateRelationshipOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Initialize relationships if needed
    if (!session.relationships) {
      session.relationships = {};
    }

    // Get or create relationship
    let rel = session.relationships[input.npcId];
    let isNew = false;

    if (!rel) {
      // Try to get NPC name from session NPCs
      const npc = session.npcs?.[input.npcId];
      const npcName = npc?.name || input.npcId;

      rel = {
        npcId: input.npcId,
        npcName: npcName,
        attitude: "neutral",
        history: [],
        knows: [],
        owes: [],
        fears: [],
        wants: [],
      } as NPCRelationship;
      session.relationships[input.npcId] = rel;
      isNew = true;
    }

    const previousAttitude = rel.attitude;

    // Calculate new attitude
    const newAttitude = input.attitudeChange || calculateAttitudeShift(rel.attitude, input.impact);
    rel.attitude = newAttitude;

    // Add history entry
    rel.history.push({
      timestamp: { ...session.gameTime },
      interaction: input.interaction,
      impact: input.impact,
      ...(input.actingCharacterId ? { actingCharacterId: input.actingCharacterId } : {}),
    });

    // Update per-character attitude if a specific PC caused this
    if (input.actingCharacterId) {
      if (!rel.characterAttitudes) {
        rel.characterAttitudes = {};
      }
      const currentCharAttitude = rel.characterAttitudes[input.actingCharacterId] ?? rel.attitude;
      const newCharAttitude =
        input.attitudeChange ?? calculateAttitudeShift(currentCharAttitude, input.impact);
      rel.characterAttitudes[input.actingCharacterId] = newCharAttitude;
    }

    // Update lists
    if (input.addKnows) {
      rel.knows.push(...input.addKnows.filter((k) => !rel.knows.includes(k)));
    }
    if (input.addOwes) {
      rel.owes.push(...input.addOwes.filter((o) => !rel.owes.includes(o)));
    }
    if (input.addFears) {
      rel.fears.push(...input.addFears.filter((f) => !rel.fears.includes(f)));
    }
    if (input.addWants) {
      rel.wants.push(...input.addWants.filter((w) => !rel.wants.includes(w)));
    }
    if (input.removeKnows) {
      rel.knows = rel.knows.filter((k) => !input.removeKnows!.includes(k));
    }
    if (input.removeOwes) {
      rel.owes = rel.owes.filter((o) => !input.removeOwes!.includes(o));
    }
    if (input.removeFears) {
      rel.fears = rel.fears.filter((f) => !input.removeFears!.includes(f));
    }
    if (input.removeWants) {
      rel.wants = rel.wants.filter((w) => !input.removeWants!.includes(w));
    }

    await ctx.sessions.save(session);

    const attitudeChanged = previousAttitude !== newAttitude;

    // Emit relationship updated event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.RELATIONSHIP_UPDATED,
      {
        npcId: rel.npcId,
        npcName: rel.npcName,
        previousAttitude,
        newAttitude,
        impact: input.impact,
      },
      "update_relationship",
      ctx.currentTurnId
    );

    return {
      message: isNew
        ? `Relationship created and updated for ${rel.npcName}`
        : `Relationship updated for ${rel.npcName}`,
      npcId: rel.npcId,
      npcName: rel.npcName,
      interaction: input.interaction,
      impact: input.impact,
      attitudeChange: attitudeChanged
        ? {
            from: previousAttitude,
            to: newAttitude,
            summary: getAttitudeSummary(newAttitude),
          }
        : null,
      currentAttitude: {
        level: rel.attitude,
        summary: getAttitudeSummary(rel.attitude),
      },
      totalInteractions: rel.history.length,
    };
  },
});
