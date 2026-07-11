/**
 * Modify Gold Tool
 *
 * Add or subtract gold from a character's inventory.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  type CharacterInventory,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";
import { requireSkill } from "../skills/load-skill.js";

/**
 * Input schema for modify_gold
 */
export const ModifyGoldInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID"),
  amount: z.number().int().describe("Amount to add (positive) or subtract (negative)"),
  reason: z.string().optional().describe("Reason for the gold change (for logging)"),
});

export type ModifyGoldInput = z.infer<typeof ModifyGoldInputSchema>;

/**
 * Output type for modify_gold
 */
export interface ModifyGoldOutput {
  message: string;
  gold: {
    previous: number;
    change: number;
    current: number;
  };
}

/**
 * Modify gold tool definition
 */
export const modifyGoldTool = defineSharedTool({
  name: "modify_gold",
  description:
    "Add or subtract gold from a character's inventory. Use positive amount to add, negative to subtract. Requires itemized inventory mode.",
  inputSchema: ModifyGoldInputSchema,
  emits: [EventTypes.GOLD_CHANGED],

  // Gate: engine-flows skill required — gold modifications are part
  // of the documented shop / reward flow.
  gate: requireSkill("engine-flows"),

  handler: async (input, ctx): Promise<ModifyGoldOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    // Require itemized inventory
    if (!hasItemizedInventory(character)) {
      throw new Error(
        `Character '${character.name}' is in narrative inventory mode. Use upgrade_inventory first.`
      );
    }

    const inventory = character.inventory as CharacterInventory;
    const previousGold = inventory.gold;
    const newGold = previousGold + input.amount;

    // Prevent going negative
    if (newGold < 0) {
      throw new Error(
        `Insufficient gold: have ${previousGold}, tried to subtract ${Math.abs(input.amount)}`
      );
    }

    // Apply change
    inventory.gold = newGold;

    // Save session
    await ctx.sessions.save(session);

    // Emit event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.GOLD_CHANGED,
      {
        characterId: input.characterId,
        characterName: character.name,
        previousGold,
        change: input.amount,
        currentGold: newGold,
        reason: input.reason,
      },
      "modify_gold"
    );

    const action = input.amount >= 0 ? "gained" : "spent";
    const absAmount = Math.abs(input.amount);

    return {
      message: `${character.name} ${action} ${absAmount} gold${input.reason ? ` (${input.reason})` : ""}`,
      gold: {
        previous: previousGold,
        change: input.amount,
        current: newGold,
      },
    };
  },
});
