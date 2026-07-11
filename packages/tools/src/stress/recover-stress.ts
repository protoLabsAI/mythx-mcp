/**
 * Recover Stress Tool (Shared)
 *
 * Recover stress during rest.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { recoverStress as engineRecover, ensureStressTracker } from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitStressChanged } from "../events/emitters.js";

/**
 * Input schema for recover_stress
 */
export const RecoverStressInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character recovering stress"),
  restType: z.enum(["short", "long"]).describe("Type of rest (short=2 stress, long=all stress)"),
  bonuses: z
    .number()
    .optional()
    .describe("Additional recovery from abilities, conditions, or circumstances"),
});

export type RecoverStressInput = z.infer<typeof RecoverStressInputSchema>;

/**
 * Output type for recover_stress
 */
export interface RecoverStressOutput {
  characterId: string;
  characterName: string;
  restType: "short" | "long";
  stress: {
    previous: number;
    current: number;
    max: number;
    recovered: number;
  };
}

/**
 * Recover stress tool definition
 */
export const recoverStressTool = defineSharedTool({
  name: "recover_stress",
  description:
    "Recover stress during rest. Short rest recovers 2 stress, long rest recovers all stress.",
  inputSchema: RecoverStressInputSchema,
  emits: [EventTypes.STRESS_CHANGED],

  handler: async (input, ctx): Promise<RecoverStressOutput> => {
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
    const previousStress = stress.current;

    // Execute recovery using engine function
    const result = engineRecover({
      character,
      restType: input.restType,
      bonuses: input.bonuses,
    });

    // Update character stress
    if (!character.stress) {
      character.stress = { current: 0, max: stress.max };
    }
    character.stress.current = result.newStress;

    // Save session
    await ctx.sessions.save(session);

    // Emit stress changed event
    emitStressChanged(
      ctx.eventBus,
      input.sessionId,
      {
        characterId: input.characterId,
        characterName: character.name,
        previousStress,
        newStress: result.newStress,
        maxStress: stress.max,
        reason: "recovery",
        recovered: result.recovered,
      },
      "recover_stress"
    );

    return {
      characterId: input.characterId,
      characterName: character.name,
      restType: input.restType,
      stress: {
        previous: previousStress,
        current: result.newStress,
        max: stress.max,
        recovered: result.recovered,
      },
    };
  },
});
