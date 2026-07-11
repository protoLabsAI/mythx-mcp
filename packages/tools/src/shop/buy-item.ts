/**
 * Buy Item Tool
 *
 * Purchase an item from a shop. Deducts gold and adds the item
 * to the character's inventory.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  type CharacterInventory,
  type Item,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";
import { upgradeCharacterToItemized } from "../inventory/helpers.js";
import { requireSkill } from "../skills/load-skill.js";

export const BuyItemInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character who is buying"),
  itemId: z.string().describe("World pack item ID to buy"),
  quantity: z.number().int().positive().optional().default(1).describe("Quantity to buy"),
  price: z.number().int().nonnegative().describe("Price per unit in gold"),
  itemName: z.string().describe("Display name of the item"),
  itemDescription: z.string().optional().default("").describe("Item description"),
  itemCategory: z
    .string()
    .optional()
    .default("misc")
    .describe("Item category (weapon, armor, consumable, misc)"),
});

export type BuyItemInput = z.infer<typeof BuyItemInputSchema>;

export interface BuyItemOutput {
  message: string;
  purchased: {
    itemId: string;
    name: string;
    quantity: number;
    totalCost: number;
  };
  gold: {
    previous: number;
    spent: number;
    current: number;
  };
}

export const buyItemTool = defineSharedTool({
  name: "buy_item",
  description:
    "Purchase an item from a shop. Deducts gold from the character and adds the item to their inventory.",
  inputSchema: BuyItemInputSchema,
  emits: [EventTypes.ITEM_PURCHASED, EventTypes.GOLD_CHANGED],

  // Gate: engine-flows skill must be loaded. See browse_shop for the
  // rationale — the skill body explains the call-ordering contract.
  gate: requireSkill("engine-flows"),

  handler: async (input, ctx): Promise<BuyItemOutput> => {
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
    const totalCost = input.price * input.quantity;

    // Check gold
    if (inventory.gold < totalCost) {
      throw new Error(
        `Insufficient gold: ${character.name} has ${inventory.gold}g, needs ${totalCost}g`
      );
    }

    const previousGold = inventory.gold;

    // Deduct gold
    inventory.gold -= totalCost;

    // Add item(s) to inventory
    for (let i = 0; i < input.quantity; i++) {
      // Check for stackable existing item first
      const existingItem = inventory.items.find(
        (item) =>
          item.templateId === input.itemId &&
          (item.type === "consumable" || item.type === "material")
      );

      if (existingItem && existingItem.quantity !== undefined) {
        existingItem.quantity += 1;
      } else {
        // Construct item with common fields; use `as unknown as Item` matching add-item pattern
        const newItem = {
          id: `${input.itemId}-${Date.now()}-${i}`,
          templateId: input.itemId,
          name: input.itemName,
          description: input.itemDescription ?? "",
          type: input.itemCategory as Item["type"],
          quantity: 1,
          stackable: input.itemCategory === "consumable" || input.itemCategory === "material",
          maxStack: 99,
          weight: 1,
          value: input.price,
          rarity: "common" as const,
          usable: false,
        } as unknown as Item;

        inventory.items.push(newItem);
      }
    }

    await ctx.sessions.save(session);

    // Emit purchase event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.ITEM_PURCHASED,
      {
        characterId: input.characterId,
        characterName: character.name,
        itemId: input.itemId,
        itemName: input.itemName,
        quantity: input.quantity,
        totalCost,
        goldRemaining: inventory.gold,
      },
      "buy_item"
    );

    return {
      message: `${character.name} purchased ${input.quantity}x ${input.itemName} for ${totalCost}g`,
      purchased: {
        itemId: input.itemId,
        name: input.itemName,
        quantity: input.quantity,
        totalCost,
      },
      gold: {
        previous: previousGold,
        spent: totalCost,
        current: inventory.gold,
      },
    };
  },
});
