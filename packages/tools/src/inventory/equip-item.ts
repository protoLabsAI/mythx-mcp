/**
 * Equip Item Tool
 *
 * Equip an item from inventory to an equipment slot.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  getInventoryItem,
  isValidSlotForItem,
  type CharacterInventory,
  type EquipmentSlot,
  EquipmentSlotSchema,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";

/**
 * Input schema for equip_item
 */
export const EquipItemInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID"),
  itemId: z.string().describe("Item instance ID to equip"),
  slot: EquipmentSlotSchema.describe("Equipment slot to use"),
  unequipExisting: z
    .boolean()
    .optional()
    .default(true)
    .describe("Automatically unequip existing item in slot"),
});

export type EquipItemInput = z.infer<typeof EquipItemInputSchema>;

/**
 * Output type for equip_item
 */
export interface EquipItemOutput {
  message: string;
  equipped: {
    itemId: string;
    itemName: string;
    slot: EquipmentSlot;
  };
  unequipped?: {
    itemId: string;
    itemName: string;
  };
  offHandUnequipped?: {
    itemId: string;
    itemName: string;
  };
}

/**
 * Equip item tool definition
 */
export const equipItemTool = defineSharedTool({
  name: "equip_item",
  description:
    "Equip an item from inventory to an equipment slot. Automatically unequips existing item if slot is occupied (unless disabled).",
  inputSchema: EquipItemInputSchema,
  emits: [EventTypes.ITEM_EQUIPPED, EventTypes.ITEM_UNEQUIPPED],

  handler: async (input, ctx): Promise<EquipItemOutput> => {
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

    // Find the item
    const item = getInventoryItem(inventory, input.itemId);
    if (!item) {
      throw new Error(`Item not found in inventory: ${input.itemId}`);
    }

    // Validate slot is appropriate for item type
    if (!isValidSlotForItem(item, input.slot)) {
      throw new Error(`Cannot equip ${item.type} '${item.name}' to ${input.slot} slot`);
    }

    // Check for two-handed weapons
    if (item.type === "weapon" && "twoHanded" in item && item.twoHanded) {
      // Two-handed weapons cannot be equipped to off-hand
      if (input.slot === "offHand") {
        throw new Error(
          `Cannot equip two-handed weapon '${item.name}' to off-hand. Equip to mainHand instead.`
        );
      }
      // Two-handed weapons need both mainHand and offHand clear
      if (input.slot === "mainHand" && inventory.equipped.offHand) {
        if (!input.unequipExisting) {
          throw new Error(
            "Two-handed weapon requires empty off-hand. Set unequipExisting=true or unequip off-hand first."
          );
        }
        // Will unequip off-hand below
      }
    }

    let unequippedItem: { itemId: string; itemName: string } | undefined;
    let offHandUnequippedItem: { itemId: string; itemName: string } | undefined;

    // Check if slot is occupied
    const existingItemId = inventory.equipped[input.slot];
    if (existingItemId) {
      if (!input.unequipExisting) {
        throw new Error(
          `Slot ${input.slot} is occupied. Set unequipExisting=true or unequip first.`
        );
      }

      // Unequip existing item
      const existingItem = getInventoryItem(inventory, existingItemId);
      inventory.equipped[input.slot] = null;

      if (existingItem) {
        unequippedItem = {
          itemId: existingItemId,
          itemName: existingItem.name,
        };

        emitInventoryEvent(
          ctx.eventBus,
          input.sessionId,
          EventTypes.ITEM_UNEQUIPPED,
          {
            characterId: input.characterId,
            characterName: character.name,
            itemId: existingItemId,
            itemName: existingItem.name,
            slot: input.slot,
            reason: "replaced",
          },
          "equip_item"
        );
      }
    }

    // Handle two-handed: also unequip off-hand if equipping to main hand
    if (
      item.type === "weapon" &&
      "twoHanded" in item &&
      item.twoHanded &&
      input.slot === "mainHand"
    ) {
      const offHandItemId = inventory.equipped.offHand;
      if (offHandItemId) {
        const offHandItem = getInventoryItem(inventory, offHandItemId);
        inventory.equipped.offHand = null;

        if (offHandItem) {
          offHandUnequippedItem = {
            itemId: offHandItemId,
            itemName: offHandItem.name,
          };

          emitInventoryEvent(
            ctx.eventBus,
            input.sessionId,
            EventTypes.ITEM_UNEQUIPPED,
            {
              characterId: input.characterId,
              characterName: character.name,
              itemId: offHandItemId,
              itemName: offHandItem.name,
              slot: "offHand",
              reason: "two_handed_weapon",
            },
            "equip_item"
          );
        }
      }
    }

    // Equip the item
    inventory.equipped[input.slot] = input.itemId;

    // Save session
    await ctx.sessions.save(session);

    // Emit equip event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.ITEM_EQUIPPED,
      {
        characterId: input.characterId,
        characterName: character.name,
        itemId: input.itemId,
        itemName: item.name,
        slot: input.slot,
      },
      "equip_item"
    );

    return {
      message: `${character.name} equipped ${item.name} to ${input.slot}`,
      equipped: {
        itemId: input.itemId,
        itemName: item.name,
        slot: input.slot,
      },
      unequipped: unequippedItem,
      offHandUnequipped: offHandUnequippedItem,
    };
  },
});
