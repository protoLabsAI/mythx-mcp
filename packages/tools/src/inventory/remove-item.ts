/**
 * Remove Item Tool
 *
 * Remove an item from a character's inventory.
 * Automatically unequips if the item is equipped.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  getInventoryItem,
  type CharacterInventory,
  type EquipmentSlot,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";
import { findEquippedSlotForItem } from "./helpers.js";

/**
 * Input schema for remove_item
 */
export const RemoveItemInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID"),
  itemId: z.string().describe("Item instance ID to remove"),
  quantity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Quantity to remove (for stackable items). Removes all if not specified."),
});

export type RemoveItemInput = z.infer<typeof RemoveItemInputSchema>;

/**
 * Output type for remove_item
 */
export interface RemoveItemOutput {
  message: string;
  removed: {
    itemId: string;
    itemName: string;
    quantity: number;
    fullyRemoved: boolean;
  };
  wasEquipped?: {
    slot: EquipmentSlot;
  };
  inventoryStats: {
    slotsUsed: number;
    maxSlots: number;
    weight: number;
    maxWeight: number;
  };
}

/**
 * Remove item tool definition
 */
export const removeItemTool = defineSharedTool({
  name: "remove_item",
  description:
    "Remove an item from a character's inventory. For stackable items, can remove a specific quantity. Automatically unequips if equipped.",
  inputSchema: RemoveItemInputSchema,
  emits: [EventTypes.ITEM_REMOVED, EventTypes.ITEM_UNEQUIPPED],

  handler: async (input, ctx): Promise<RemoveItemOutput> => {
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

    // Find the item
    const item = getInventoryItem(inventory, input.itemId);
    if (!item) {
      throw new Error(`Item not found: ${input.itemId}`);
    }

    const currentQuantity = item.quantity ?? 1;
    const removeQuantity = input.quantity ?? currentQuantity;

    if (removeQuantity > currentQuantity) {
      throw new Error(
        `Cannot remove ${removeQuantity} - only have ${currentQuantity} ${item.name}`
      );
    }

    // Check if equipped and unequip first
    const equippedSlot = findEquippedSlotForItem(inventory, input.itemId);
    if (equippedSlot) {
      inventory.equipped[equippedSlot] = null;

      emitInventoryEvent(
        ctx.eventBus,
        input.sessionId,
        EventTypes.ITEM_UNEQUIPPED,
        {
          characterId: input.characterId,
          characterName: character.name,
          itemId: item.id,
          itemName: item.name,
          slot: equippedSlot,
          reason: "item_removed",
        },
        "remove_item"
      );
    }

    const fullyRemoved = removeQuantity >= currentQuantity;
    const itemWeight = item.weight ?? 0;

    if (fullyRemoved) {
      // Remove item entirely
      const index = inventory.items.findIndex((i) => i.id === input.itemId);
      if (index !== -1) {
        inventory.items.splice(index, 1);
      }

      // Update weight
      if (inventory.weight) {
        inventory.weight.current -= itemWeight * currentQuantity;
        inventory.weight.current = Math.max(0, inventory.weight.current);
      }
    } else {
      // Reduce quantity
      item.quantity = currentQuantity - removeQuantity;

      // Update weight
      if (inventory.weight) {
        inventory.weight.current -= itemWeight * removeQuantity;
        inventory.weight.current = Math.max(0, inventory.weight.current);
      }
    }

    // Save session
    await ctx.sessions.save(session);

    // Emit event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.ITEM_REMOVED,
      {
        characterId: input.characterId,
        characterName: character.name,
        itemId: item.id,
        itemName: item.name,
        quantity: removeQuantity,
        fullyRemoved,
      },
      "remove_item"
    );

    return {
      message: fullyRemoved
        ? `Removed ${item.name} from ${character.name}'s inventory`
        : `Removed ${removeQuantity}x ${item.name} (${item.quantity} remaining)`,
      removed: {
        itemId: item.id,
        itemName: item.name,
        quantity: removeQuantity,
        fullyRemoved,
      },
      wasEquipped: equippedSlot ? { slot: equippedSlot } : undefined,
      inventoryStats: {
        slotsUsed: inventory.items.length,
        maxSlots: inventory.maxSlots,
        weight: inventory.weight?.current ?? 0,
        maxWeight: inventory.weight?.max ?? 100,
      },
    };
  },
});
