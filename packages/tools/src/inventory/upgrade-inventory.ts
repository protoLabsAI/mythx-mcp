/**
 * Upgrade Inventory Tool
 *
 * Convert a character from narrative to itemized inventory mode.
 * This enables full item tracking with stats, slots, and weight.
 */

import { z } from "zod";
import { defineSharedTool, hasItemizedInventory } from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";
import { upgradeCharacterToItemized } from "./helpers.js";

/**
 * Input schema for upgrade_inventory
 */
export const UpgradeInventoryInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID to upgrade"),
  startingGold: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(0)
    .describe("Starting gold amount"),
  maxSlots: z.number().int().positive().optional().default(20).describe("Maximum inventory slots"),
  maxWeight: z.number().positive().optional().default(100).describe("Maximum carry weight"),
  preserveNarrative: z
    .boolean()
    .optional()
    .default(true)
    .describe("Keep narrative equipment as reference (stored in narrative field)"),
});

export type UpgradeInventoryInput = z.infer<typeof UpgradeInventoryInputSchema>;

/**
 * Output type for upgrade_inventory
 */
export interface UpgradeInventoryOutput {
  message: string;
  characterId: string;
  inventory: {
    mode: "itemized";
    gold: number;
    maxSlots: number;
    weight: { current: number; max: number };
    preservedNarrative?: {
      weapons: string[];
      armor: string | null;
      armorValue?: number;
      gear: string[];
    };
  };
}

/**
 * Upgrade inventory tool definition
 */
export const upgradeInventoryTool = defineSharedTool({
  name: "upgrade_inventory",
  description:
    "Convert a character from narrative to itemized inventory mode. Enables full item tracking with stats, equipment slots, gold, and weight/encumbrance.",
  inputSchema: UpgradeInventoryInputSchema,
  emits: [EventTypes.INVENTORY_UPGRADED],

  handler: async (input, ctx): Promise<UpgradeInventoryOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    // Check if already itemized
    if (hasItemizedInventory(character)) {
      throw new Error(`Character '${character.name}' already has itemized inventory`);
    }

    // Create new itemized inventory and assign it to the character
    const inventory = upgradeCharacterToItemized(character, {
      startingGold: input.startingGold,
      maxSlots: input.maxSlots,
      maxWeight: input.maxWeight,
      preserveNarrative: input.preserveNarrative,
    });

    // Save session
    await ctx.sessions.save(session);

    // Emit event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.INVENTORY_UPGRADED,
      {
        characterId: input.characterId,
        characterName: character.name,
        previousMode: "narrative",
        newMode: "itemized",
      },
      "upgrade_inventory"
    );

    // createItemizedInventory always sets weight, but provide fallback for type safety
    const weight = inventory.weight ?? { current: 0, max: input.maxWeight ?? 100 };

    return {
      message: `Upgraded '${character.name}' to itemized inventory mode`,
      characterId: input.characterId,
      inventory: {
        mode: "itemized",
        gold: inventory.gold,
        maxSlots: inventory.maxSlots,
        weight,
        preservedNarrative: input.preserveNarrative
          ? {
              weapons: character.equipment.weapons,
              armor: character.equipment.armor,
              armorValue: character.equipment.armorValue,
              gear: character.equipment.gear,
            }
          : undefined,
      },
    };
  },
});
