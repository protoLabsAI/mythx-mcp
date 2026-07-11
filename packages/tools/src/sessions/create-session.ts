/**
 * Create Session Tool
 */

import { z } from "zod";
import { defineSharedTool, createEmptySession } from "@mythxengine/types";

export const CreateSessionInputSchema = z.object({
  sessionId: z.string().describe("Unique session ID"),
  name: z.string().describe("Session name"),
  worldPackId: z
    .string()
    .describe("World pack ID (required - every session must belong to a world)"),
  seed: z.number().optional().describe("RNG seed for determinism"),
});

export interface CreateSessionOutput {
  sessionId: string;
  name: string;
  worldPackId: string;
  createdAt: string;
  rngSeed: number;
}

export const createSessionTool = defineSharedTool({
  name: "create_session",
  description: "Create a new game session, optionally associated with a world pack.",
  inputSchema: CreateSessionInputSchema,
  handler: async (input, ctx): Promise<CreateSessionOutput> => {
    // Check if session already exists
    const existing = await ctx.sessions.get(input.sessionId);
    if (existing) {
      throw new Error(`Session already exists: ${input.sessionId}`);
    }

    // Verify world pack exists
    const pack = await ctx.worldPacks.get(input.worldPackId);
    if (!pack) {
      throw new Error(`World pack not found: ${input.worldPackId}`);
    }

    // Create new session linked to world
    const session = createEmptySession(input.sessionId, input.name);
    session.worldPackId = input.worldPackId;

    // Set custom seed if provided
    if (input.seed !== undefined) {
      session.rng.seed = input.seed;
      session.rng.cursor = 0;
    }

    await ctx.sessions.save(session);

    return {
      sessionId: session.metadata.id,
      name: session.metadata.name,
      worldPackId: input.worldPackId,
      createdAt: session.metadata.createdAt,
      rngSeed: session.rng.seed,
    };
  },
});
