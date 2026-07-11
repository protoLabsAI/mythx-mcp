/**
 * Unequip Item Tool
 *
 * Unequip an item from an equipment slot back to inventory.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  getInventoryItem,
  type CharacterInventory,
  type EquipmentSlot,
  EquipmentSlotSchema,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";

/**
 * Input schema for unequip_item
 */
export const UnequipItemInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID"),
  slot: EquipmentSlotSchema.describe("Equipment slot to unequip from"),
});

export type UnequipItemInput = z.infer<typeof UnequipItemInputSchema>;

/**
 * Output type for unequip_item
 */
export interface UnequipItemOutput {
  message: string;
  unequipped: {
    itemId: string;
    itemName: string;
    slot: EquipmentSlot;
  };
}

/**
 * Unequip item tool definition
 */
export const unequipItemTool = defineSharedTool({
  name: "unequip_item",
  description: "Unequip an item from an equipment slot. The item remains in inventory.",
  inputSchema: UnequipItemInputSchema,
  emits: [EventTypes.ITEM_UNEQUIPPED],

  handler: async (input, ctx): Promise<UnequipItemOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    if (!hasItemizedInventory(character)) {
      throw new Error(
        `Character '${character.name}' is in narrative inventory mode. Use upgrade_inventory first.`
      );
    }

    const inventory = character.inventory as CharacterInventory;

    // Check if slot has an item
    const itemId = inventory.equipped[input.slot];
    if (!itemId) {
      throw new Error(`No item equipped in ${input.slot} slot`);
    }

    // Get item details
    const item = getInventoryItem(inventory, itemId);
    if (!item) {
      // Item was deleted but still referenced - clean up
      inventory.equipped[input.slot] = null;
      await ctx.sessions.save(session);
      throw new Error(`Equipped item no longer exists (cleaned up reference)`);
    }

    // Unequip
    inventory.equipped[input.slot] = null;

    // Save session
    await ctx.sessions.save(session);

    // Emit event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.ITEM_UNEQUIPPED,
      {
        characterId: input.characterId,
        characterName: character.name,
        itemId: item.id,
        itemName: item.name,
        slot: input.slot,
        reason: "manual",
      },
      "unequip_item"
    );

    return {
      message: `${character.name} unequipped ${item.name} from ${input.slot}`,
      unequipped: {
        itemId: item.id,
        itemName: item.name,
        slot: input.slot,
      },
    };
  },
});
