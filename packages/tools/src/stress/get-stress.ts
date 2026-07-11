/**
 * Get Stress Tool (Shared)
 *
 * Get a character's current stress level.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { ensureStressTracker } from "@mythxengine/engine";

/**
 * Input schema for get_stress
 */
export const GetStressInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID"),
});

export type GetStressInput = z.infer<typeof GetStressInputSchema>;

/**
 * Output type for get_stress
 */
export interface GetStressOutput {
  character: string;
  stress: {
    current: number;
    max: number;
  };
  trauma: string[];
  atRisk: boolean;
  canPushSafely: boolean;
  hint: string;
}

/**
 * Get stress tool definition
 */
export const getStressTool = defineSharedTool({
  name: "get_stress",
  description:
    "Get a character's current stress level, trauma status, and whether they can safely push.",
  inputSchema: GetStressInputSchema,
  emits: [],

  handler: async (input, ctx): Promise<GetStressOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    // Ensure stress tracker exists
    const stress = ensureStressTracker(character);

    // Check if pushing would trigger trauma (cost is 2)
    const canPushSafely = stress.current + 2 <= stress.max;
    // At risk if at max stress
    const atRisk = stress.current >= stress.max;
    const traumaObjects = character.trauma ?? [];
    const traumaNames = traumaObjects.map((t) => t.name);

    // Generate human-readable hint
    let hint: string;
    if (atRisk) {
      hint = `${character.name} is at maximum stress! Any stress gain will trigger trauma.`;
    } else if (stress.current >= 7) {
      hint = `${character.name} is under severe stress (${stress.current}/${stress.max}). Pushing is risky.`;
    } else if (stress.current >= 4) {
      hint = `${character.name} is feeling the pressure (${stress.current}/${stress.max}).`;
    } else if (stress.current > 0) {
      hint = `${character.name} has some stress (${stress.current}/${stress.max}).`;
    } else {
      hint = `${character.name} is calm and composed.`;
    }

    if (traumaNames.length > 0) {
      hint += ` Traumas: ${traumaNames.join(", ")}.`;
    }

    return {
      character: character.name,
      stress: {
        current: stress.current,
        max: stress.max,
      },
      trauma: traumaNames,
      atRisk,
      canPushSafely,
      hint,
    };
  },
});
