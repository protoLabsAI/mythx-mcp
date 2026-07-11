/**
 * Roll Dice Tool (Shared)
 *
 * Roll any dice expression using standard notation.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { createRNG, rollDice } from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitDiceRolled } from "../events/emitters.js";

/**
 * Input schema for roll_dice
 */
export const RollDiceInputSchema = z.object({
  expression: z.string().describe("Dice expression like '2d6+3', 'd20', '1d8-1'"),
  sessionId: z
    .string()
    .optional()
    .describe("Optional session ID to use session RNG for determinism"),
});

export type RollDiceInput = z.infer<typeof RollDiceInputSchema>;

/**
 * Output type for roll_dice.
 *
 * Note: this raw-dice tool intentionally does not return a critical
 * discriminator — that's a function of a world's CriticalsConfig and
 * lives at the resolution layer. Use `roll_test` / `attack` for any
 * roll where critical status matters.
 */
export interface RollDiceOutput {
  expression: string;
  rolls: number[];
  modifier: number;
  natural: number;
  total: number;
}

/**
 * Roll dice tool definition
 */
export const rollDiceTool = defineSharedTool({
  name: "roll_dice",
  description:
    "Roll dice using standard notation (e.g., '2d6+3', 'd20', '4d6'). Optionally use session RNG for determinism.",
  inputSchema: RollDiceInputSchema,
  emits: [EventTypes.DICE_ROLLED],

  handler: async (input, ctx): Promise<RollDiceOutput> => {
    let rng;
    let session = null;

    if (input.sessionId) {
      session = await ctx.sessions.get(input.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${input.sessionId}`);
      }
      rng = createRNG(session.rng);
    } else {
      // Use random seed for one-off rolls
      rng = createRNG(Date.now());
    }

    const result = rollDice(input.expression, rng);

    // Update session RNG if used
    if (session) {
      session.rng = rng.getState();
      await ctx.sessions.save(session);

      // Emit event for real-time sync — `ctx.currentTurnId` groups
      // this row under the parent chat turn in gameplay_events.
      emitDiceRolled(
        ctx.eventBus,
        input.sessionId!,
        {
          expression: input.expression,
          rolls: result.rolls,
          total: result.total,
        },
        "roll_dice",
        ctx.currentTurnId
      );
    }

    return {
      expression: result.expression,
      rolls: result.rolls,
      modifier: result.modifier,
      natural: result.natural,
      total: result.total,
    };
  },
});
