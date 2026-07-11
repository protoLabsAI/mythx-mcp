/**
 * Transfer Item Tool
 *
 * Transfer an item between characters or to/from party inventory.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  hasInventorySpace,
  type CharacterInventory,
  type Item,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";
import { findEquippedSlotForItem, generateItemId } from "./helpers.js";

/**
 * Input schema for transfer_item
 */
export const TransferItemInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  fromCharacterId: z
    .string()
    .nullable()
    .describe("Source character ID (null = from party inventory)"),
  toCharacterId: z
    .string()
    .nullable()
    .describe("Destination character ID (null = to party inventory)"),
  itemId: z.string().describe("Item instance ID to transfer"),
  quantity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Quantity to transfer (for stackable items). Transfers all if not specified."),
});

export type TransferItemInput = z.infer<typeof TransferItemInputSchema>;

/**
 * Output type for transfer_item
 */
export interface TransferItemOutput {
  message: string;
  transferred: {
    itemId: string;
    itemName: string;
    quantity: number;
  };
  from: {
    type: "character" | "party";
    id?: string;
    name?: string;
  };
  to: {
    type: "character" | "party";
    id?: string;
    name?: string;
  };
}

/**
 * Transfer item tool definition
 */
export const transferItemTool = defineSharedTool({
  name: "transfer_item",
  description:
    "Transfer an item between characters or to/from party inventory. Automatically unequips if the item is equipped.",
  inputSchema: TransferItemInputSchema,
  emits: [EventTypes.ITEM_TRANSFERRED, EventTypes.ITEM_UNEQUIPPED],

  handler: async (input, ctx): Promise<TransferItemOutput> => {
    // Validate input
    if (input.fromCharacterId === null && input.toCharacterId === null) {
      throw new Error("Cannot transfer from party to party");
    }
    if (input.fromCharacterId === input.toCharacterId) {
      throw new Error("Source and destination cannot be the same");
    }

    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Initialize party inventory if needed
    if (!session.partyInventory) {
      session.partyInventory = {
        items: [],
        gold: 0,
      };
    }

    let sourceInventory: { items: Item[] };
    let sourceName: string;
    let sourceType: "character" | "party";
    let sourceCharacter: { name: string; inventory?: CharacterInventory } | null = null;

    // Get source
    if (input.fromCharacterId) {
      const char = session.characters[input.fromCharacterId];
      if (!char) {
        throw new Error(`Source character not found: ${input.fromCharacterId}`);
      }
      if (!hasItemizedInventory(char)) {
        throw new Error(
          `Source character '${char.name}' is in narrative inventory mode. Use upgrade_inventory first.`
        );
      }
      sourceInventory = char.inventory as CharacterInventory;
      sourceName = char.name;
      sourceType = "character";
      sourceCharacter = char;
    } else {
      sourceInventory = session.partyInventory;
      sourceName = "Party Inventory";
      sourceType = "party";
    }

    // Find the item in source
    const item = sourceInventory.items.find((i) => i.id === input.itemId);
    if (!item) {
      throw new Error(`Item not found in ${sourceName}: ${input.itemId}`);
    }

    const currentQuantity = item.quantity ?? 1;
    const transferQuantity = input.quantity ?? currentQuantity;

    if (transferQuantity > currentQuantity) {
      throw new Error(
        `Cannot transfer ${transferQuantity} - only have ${currentQuantity} ${item.name}`
      );
    }

    // Get destination
    let destInventory: { items: Item[]; maxSlots?: number };
    let destName: string;
    let destType: "character" | "party";

    if (input.toCharacterId) {
      const char = session.characters[input.toCharacterId];
      if (!char) {
        throw new Error(`Destination character not found: ${input.toCharacterId}`);
      }
      if (!hasItemizedInventory(char)) {
        throw new Error(
          `Destination character '${char.name}' is in narrative inventory mode. Use upgrade_inventory first.`
        );
      }
      const charInv = char.inventory as CharacterInventory;

      // Check destination has space - stackable items may merge into existing stacks
      const canMergeIntoStack =
        item.stackable &&
        charInv.items.some(
          (existing) =>
            existing.stackable &&
            (existing.templateId === item.templateId ||
              existing.templateId === item.id ||
              existing.id === item.templateId)
        );
      const requiredSlots = canMergeIntoStack ? 0 : 1;

      if (!hasInventorySpace(charInv, requiredSlots)) {
        throw new Error(`${char.name}'s inventory is full`);
      }

      destInventory = charInv;
      destName = char.name;
      destType = "character";
    } else {
      destInventory = session.partyInventory;
      destName = "Party Inventory";
      destType = "party";
    }

    // Unequip if equipped (only for character sources)
    if (sourceType === "character" && sourceCharacter?.inventory) {
      const inv = sourceCharacter.inventory as CharacterInventory;
      const equippedSlot = findEquippedSlotForItem(inv, input.itemId);
      if (equippedSlot) {
        inv.equipped[equippedSlot] = null;

        emitInventoryEvent(
          ctx.eventBus,
          input.sessionId,
          EventTypes.ITEM_UNEQUIPPED,
          {
            characterId: input.fromCharacterId,
            characterName: sourceName,
            itemId: item.id,
            itemName: item.name,
            slot: equippedSlot,
            reason: "transferred",
          },
          "transfer_item"
        );
      }
    }

    const fullyTransferred = transferQuantity >= currentQuantity;

    // Find existing stack to merge into (if item is stackable)
    const findExistingStack = (): Item | undefined => {
      if (!item.stackable) return undefined;
      const matchId = item.templateId ?? item.id;
      return destInventory.items.find(
        (existing) =>
          existing.stackable &&
          (existing.templateId === matchId ||
            existing.id === matchId ||
            existing.templateId === item.id ||
            existing.id === item.templateId)
      );
    };

    if (fullyTransferred) {
      // Remove from source entirely
      const sourceIndex = sourceInventory.items.findIndex((i) => i.id === input.itemId);
      if (sourceIndex !== -1) {
        sourceInventory.items.splice(sourceIndex, 1);
      }

      // Update source weight if character
      if (sourceType === "character" && sourceCharacter?.inventory) {
        const inv = sourceCharacter.inventory as CharacterInventory;
        if (inv.weight) {
          inv.weight.current -= (item.weight ?? 0) * currentQuantity;
          inv.weight.current = Math.max(0, inv.weight.current);
        }
      }

      // Add to destination - try to merge into existing stack first
      const existingStack = findExistingStack();
      if (existingStack) {
        existingStack.quantity = (existingStack.quantity ?? 1) + currentQuantity;
      } else {
        destInventory.items.push(item);
      }

      // Update destination weight if character
      if (destType === "character" && input.toCharacterId) {
        const destChar = session.characters[input.toCharacterId];
        if (destChar?.inventory) {
          const inv = destChar.inventory as CharacterInventory;
          if (inv.weight) {
            inv.weight.current += (item.weight ?? 0) * currentQuantity;
          }
        }
      }
    } else {
      // Split stack - reduce source quantity
      item.quantity = currentQuantity - transferQuantity;

      // Update source weight if character
      if (sourceType === "character" && sourceCharacter?.inventory) {
        const inv = sourceCharacter.inventory as CharacterInventory;
        if (inv.weight) {
          inv.weight.current -= (item.weight ?? 0) * transferQuantity;
          inv.weight.current = Math.max(0, inv.weight.current);
        }
      }

      // Add to destination - try to merge into existing stack first
      const existingStack = findExistingStack();
      if (existingStack) {
        existingStack.quantity = (existingStack.quantity ?? 1) + transferQuantity;
      } else {
        // Create new item for destination with transferred quantity
        const newItem: Item = {
          ...item,
          id: generateItemId(),
          quantity: transferQuantity,
        };
        destInventory.items.push(newItem);
      }

      // Update destination weight if character
      if (destType === "character" && input.toCharacterId) {
        const destChar = session.characters[input.toCharacterId];
        if (destChar?.inventory) {
          const inv = destChar.inventory as CharacterInventory;
          if (inv.weight) {
            inv.weight.current += (item.weight ?? 0) * transferQuantity;
          }
        }
      }
    }

    // Save session
    await ctx.sessions.save(session);

    // Emit transfer event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.ITEM_TRANSFERRED,
      {
        itemId: item.id,
        itemName: item.name,
        quantity: transferQuantity,
        fromType: sourceType,
        fromId: input.fromCharacterId,
        fromName: sourceName,
        toType: destType,
        toId: input.toCharacterId,
        toName: destName,
      },
      "transfer_item"
    );

    return {
      message: `Transferred ${transferQuantity > 1 ? `${transferQuantity}x ` : ""}${item.name} from ${sourceName} to ${destName}`,
      transferred: {
        itemId: item.id,
        itemName: item.name,
        quantity: transferQuantity,
      },
      from: {
        type: sourceType,
        id: input.fromCharacterId ?? undefined,
        name: sourceName,
      },
      to: {
        type: destType,
        id: input.toCharacterId ?? undefined,
        name: destName,
      },
    };
  },
});
