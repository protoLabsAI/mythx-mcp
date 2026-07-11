/**
 * List Inventory Tool
 *
 * List all items in a character's inventory with equipped status.
 * Works for both narrative and itemized inventory modes.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  getEquippedItems,
  getEncumbranceStatus,
  calculateInventoryWeight,
  type Item,
  type EquipmentSlot,
} from "@mythxengine/types";
import { EQUIPMENT_SLOTS, findEquippedSlotForItem } from "./helpers.js";

/**
 * Input schema for list_inventory
 */
export const ListInventoryInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID"),
});

export type ListInventoryInput = z.infer<typeof ListInventoryInputSchema>;

/**
 * Item summary for output
 */
export interface ItemSummary {
  id: string;
  name: string;
  type: string;
  quantity: number;
  equipped: boolean;
  equippedSlot?: EquipmentSlot;
  weight?: number;
  rarity?: string;
  description?: string;
}

/**
 * Narrative equipment summary
 */
export interface NarrativeEquipmentSummary {
  weapons: string[];
  armor: string | null;
  gear: string[];
}

/**
 * Output type for list_inventory
 */
export interface ListInventoryOutput {
  characterId: string;
  characterName: string;
  mode: "narrative" | "itemized";

  // Narrative mode output
  narrative?: NarrativeEquipmentSummary;

  // Itemized mode output
  items?: ItemSummary[];
  equipped?: {
    slot: EquipmentSlot;
    itemId: string;
    itemName: string;
  }[];
  gold?: number;
  weight?: {
    current: number;
    max: number;
    status: string;
  };
  slots?: {
    used: number;
    max: number;
  };
}

/**
 * List inventory tool definition
 */
export const listInventoryTool = defineSharedTool({
  name: "list_inventory",
  description:
    "List all items in a character's inventory. Shows equipped status, weight, and gold for itemized mode, or simple equipment list for narrative mode.",
  inputSchema: ListInventoryInputSchema,
  emits: [],

  handler: async (input, ctx): Promise<ListInventoryOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    // Check inventory mode
    if (hasItemizedInventory(character)) {
      const inventory = character.inventory!;
      const equippedItems = getEquippedItems(inventory);
      const equippedIds = new Set(equippedItems.map((i) => i.id));

      // Build item summaries
      const items: ItemSummary[] = inventory.items.map((item: Item) => {
        const equippedSlot = findEquippedSlotForItem(inventory, item.id);
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          quantity: item.quantity ?? 1,
          equipped: equippedIds.has(item.id),
          equippedSlot,
          weight: item.weight,
          rarity: item.rarity,
          description: item.description,
        };
      });

      // Build equipped list
      const equipped: { slot: EquipmentSlot; itemId: string; itemName: string }[] = [];
      for (const slot of EQUIPMENT_SLOTS) {
        const itemId = inventory.equipped[slot];
        if (itemId) {
          const item = inventory.items.find((i: Item) => i.id === itemId);
          if (item) {
            equipped.push({ slot, itemId, itemName: item.name });
          }
        }
      }

      // Calculate weight
      const currentWeight = calculateInventoryWeight(inventory);
      const maxWeight = inventory.weight?.max ?? 100;

      // Calculate slots used
      const usedSlots = inventory.items.filter((i: Item) => !i.stackable).length;
      const stackedSlots = new Set(
        inventory.items.filter((i: Item) => i.stackable).map((i: Item) => i.templateId ?? i.id)
      ).size;

      return {
        characterId: input.characterId,
        characterName: character.name,
        mode: "itemized",
        items,
        equipped,
        gold: inventory.gold,
        weight: {
          current: currentWeight,
          max: maxWeight,
          status: getEncumbranceStatus(inventory),
        },
        slots: {
          used: usedSlots + stackedSlots,
          max: inventory.maxSlots,
        },
      };
    } else {
      // Narrative mode - return simple equipment
      const equipment = character.inventory?.narrative ?? character.equipment;

      return {
        characterId: input.characterId,
        characterName: character.name,
        mode: "narrative",
        narrative: {
          weapons: equipment.weapons,
          armor: equipment.armor,
          gear: equipment.gear,
        },
      };
    }
  },
});
