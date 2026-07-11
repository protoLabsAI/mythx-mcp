/**
 * Initialize Relationship Tool (Shared)
 *
 * Start tracking a relationship with an NPC.
 */

import { z } from "zod";
import { defineSharedTool, type NPCRelationship } from "@mythxengine/types";

/**
 * Attitude levels
 */
const ATTITUDES = ["hostile", "unfriendly", "neutral", "friendly", "allied"] as const;
type Attitude = (typeof ATTITUDES)[number];

/**
 * Input schema for initialize_relationship
 */
export const InitializeRelationshipInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  npcId: z.string().describe("NPC ID"),
  npcName: z.string().describe("NPC name for display"),
  initialAttitude: z
    .enum(ATTITUDES)
    .optional()
    .default("neutral")
    .describe("Starting attitude (default: neutral)"),
  knows: z.array(z.string()).optional().describe("What the NPC knows about the party"),
  wants: z.array(z.string()).optional().describe("What the NPC wants from the party"),
});

export type InitializeRelationshipInput = z.infer<typeof InitializeRelationshipInputSchema>;

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
 * Output type for initialize_relationship
 */
export interface InitializeRelationshipOutput {
  message: string;
  exists?: boolean;
  relationship: {
    npcId: string;
    npcName: string;
    attitude: Attitude;
    attitudeSummary: string;
    knows: string[];
    wants: string[];
  };
}

/**
 * Initialize relationship tool definition
 */
export const initializeRelationshipTool = defineSharedTool({
  name: "initialize_relationship",
  description: "Start tracking a relationship with an NPC.",
  inputSchema: InitializeRelationshipInputSchema,

  handler: async (input, ctx): Promise<InitializeRelationshipOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Initialize relationships if needed
    if (!session.relationships) {
      session.relationships = {};
    }

    // Check if already exists
    if (session.relationships[input.npcId]) {
      const existing = session.relationships[input.npcId];
      return {
        message: `Relationship already exists for ${input.npcName}`,
        exists: true,
        relationship: {
          npcId: existing.npcId,
          npcName: existing.npcName,
          attitude: existing.attitude,
          attitudeSummary: getAttitudeSummary(existing.attitude),
          knows: existing.knows,
          wants: existing.wants,
        },
      };
    }

    // Create new relationship
    const relationship: NPCRelationship = {
      npcId: input.npcId,
      npcName: input.npcName,
      attitude: input.initialAttitude,
      history: [],
      knows: input.knows || [],
      owes: [],
      fears: [],
      wants: input.wants || [],
    };

    session.relationships[input.npcId] = relationship;
    await ctx.sessions.save(session);

    return {
      message: `Relationship initialized for ${input.npcName}`,
      relationship: {
        npcId: relationship.npcId,
        npcName: relationship.npcName,
        attitude: relationship.attitude,
        attitudeSummary: getAttitudeSummary(relationship.attitude),
        knows: relationship.knows,
        wants: relationship.wants,
      },
    };
  },
});
