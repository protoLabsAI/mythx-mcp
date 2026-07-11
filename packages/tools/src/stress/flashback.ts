/**
 * Flashback Tool (Shared)
 *
 * Spend stress for retroactive preparation.
 */

import { z } from "zod";
import { defineSharedTool, type Trauma, BASE_STRESS } from "@mythxengine/types";
import { executeFlashback as engineFlashback, ensureStressTracker } from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitStressChanged, emitTraumaGained } from "../events/emitters.js";

/**
 * Input schema for flashback
 */
export const FlashbackInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character using flashback"),
  description: z.string().describe("Description of what the character prepared"),
});

export type FlashbackInput = z.infer<typeof FlashbackInputSchema>;

/**
 * Output type for flashback
 */
export interface FlashbackOutput {
  characterId: string;
  characterName: string;
  description: string;
  stress: {
    previous: number;
    current: number;
    max: number;
    cost: number;
  };
  traumaTriggered: boolean;
  trauma?: string;
}

/**
 * Flashback tool definition
 */
export const flashbackTool = defineSharedTool({
  name: "flashback",
  description: `Execute a flashback to establish retroactive preparation. Costs ${BASE_STRESS.flashbackCost} stress (default; world-overridable).`,
  inputSchema: FlashbackInputSchema,
  emits: [EventTypes.STRESS_CHANGED, EventTypes.TRAUMA_GAINED],

  handler: async (input, ctx): Promise<FlashbackOutput> => {
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

    // Execute flashback using engine function
    const result = engineFlashback({
      character,
    });

    // Update character stress
    if (!character.stress) {
      character.stress = { current: 0, max: stress.max };
    }
    character.stress.current = result.newStress;

    // Handle trauma if triggered
    let traumaName: string | undefined;
    if (result.traumaTriggered) {
      traumaName = "Haunted by the Past";
      if (!character.trauma) {
        character.trauma = [];
      }
      const newTrauma: Trauma = {
        id: `trauma-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: traumaName,
        description: `Trauma from flashback: ${traumaName}`,
        acquiredAt: new Date().toISOString(),
      };
      character.trauma.push(newTrauma);
    }

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
        reason: "flashback",
        cost: result.stressCost,
      },
      "flashback"
    );

    // Emit trauma event if triggered
    if (result.traumaTriggered && traumaName) {
      emitTraumaGained(
        ctx.eventBus,
        input.sessionId,
        {
          characterId: input.characterId,
          characterName: character.name,
          trauma: traumaName,
          totalTraumas: character.trauma?.length ?? 1,
          triggerReason: "flashback",
        },
        "flashback"
      );
    }

    return {
      characterId: input.characterId,
      characterName: character.name,
      description: input.description,
      stress: {
        previous: previousStress,
        current: result.newStress,
        max: stress.max,
        cost: result.stressCost,
      },
      traumaTriggered: result.traumaTriggered,
      trauma: traumaName,
    };
  },
});
