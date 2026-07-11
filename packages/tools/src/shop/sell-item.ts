/**
 * Sell Item Tool
 *
 * Sell an item from the character's inventory for gold.
 * Sell price is 50% of buy price by default.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  type CharacterInventory,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";
import { upgradeCharacterToItemized } from "../inventory/helpers.js";
import { requireSkill } from "../skills/load-skill.js";

export const SellItemInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character who is selling"),
  inventoryItemId: z.string().describe("ID of the item in the character's inventory"),
  quantity: z.number().int().positive().optional().default(1).describe("Quantity to sell"),
  sellPriceOverride: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Override sell price per unit (default: 50% of item value)"),
});

export type SellItemInput = z.infer<typeof SellItemInputSchema>;

export interface SellItemOutput {
  message: string;
  sold: {
    itemName: string;
    quantity: number;
    pricePerUnit: number;
    totalGold: number;
  };
  gold: {
    previous: number;
    earned: number;
    current: number;
  };
}

export const sellItemTool = defineSharedTool({
  name: "sell_item",
  description:
    "Sell an item from the character's inventory for gold. Default sell price is 50% of item value.",
  inputSchema: SellItemInputSchema,
  emits: [EventTypes.ITEM_SOLD, EventTypes.GOLD_CHANGED],

  // Gate: engine-flows skill required (same flow as buy_item).
  gate: requireSkill("engine-flows"),

  handler: async (input, ctx): Promise<SellItemOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    // Auto-upgrade narrative inventories to itemized mode so shopping
    // works out of the box for characters created via create_character.
    if (!hasItemizedInventory(character)) {
      upgradeCharacterToItemized(character);
      await ctx.sessions.save(session);
    }

    const inventory = character.inventory as CharacterInventory;

    // Find the item
    const itemIndex = inventory.items.findIndex((i) => i.id === input.inventoryItemId);
    if (itemIndex === -1) {
      throw new Error(`Item not found in ${character.name}'s inventory: ${input.inventoryItemId}`);
    }

    const item = inventory.items[itemIndex];

    // Check equipped state - item is equipped if its ID is in any slot
    const isEquipped = Object.values(inventory.equipped).some(
      (slotItemId) => slotItemId === item.id
    );
    if (isEquipped) {
      throw new Error(`Cannot sell equipped item '${item.name}'. Unequip it first.`);
    }

    // Check quantity for stackable items
    const itemQty = item.quantity ?? 1;
    if (input.quantity > itemQty) {
      throw new Error(
        `Not enough to sell: have ${itemQty}x ${item.name}, tried to sell ${input.quantity}`
      );
    }

    // Calculate sell price (50% of value by default)
    const pricePerUnit = input.sellPriceOverride ?? Math.max(1, Math.floor((item.value ?? 0) / 2));
    const totalGold = pricePerUnit * input.quantity;

    const previousGold = inventory.gold;

    // Remove/reduce item
    if (input.quantity >= itemQty) {
      // Remove entirely
      inventory.items.splice(itemIndex, 1);
    } else {
      // Reduce stack
      item.quantity = itemQty - input.quantity;
    }

    // Add gold
    inventory.gold += totalGold;

    await ctx.sessions.save(session);

    // Emit sold event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.ITEM_SOLD,
      {
        characterId: input.characterId,
        characterName: character.name,
        itemName: item.name,
        quantity: input.quantity,
        pricePerUnit,
        totalGold,
        goldNow: inventory.gold,
      },
      "sell_item"
    );

    return {
      message: `${character.name} sold ${input.quantity}x ${item.name} for ${totalGold}g`,
      sold: {
        itemName: item.name,
        quantity: input.quantity,
        pricePerUnit,
        totalGold,
      },
      gold: {
        previous: previousGold,
        earned: totalGold,
        current: inventory.gold,
      },
    };
  },
});
