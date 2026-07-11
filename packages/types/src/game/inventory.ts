/**
 * Unified Character Inventory System
 *
 * Bridges the narrative (string-based) and itemized (object-based) inventory systems.
 * Characters can operate in either mode, allowing gradual migration and different
 * play styles (narrative-first vs. crunchy mechanics).
 */

import { z } from "zod";
import type { CharacterEquipment } from "./character.js";
import {
  ItemSchema,
  EquipmentLoadoutSchema,
  EquipmentSlotSchema,
  type Item,
  type EquipmentLoadout,
  type EquipmentSlot,
} from "./items.js";

/**
 * Inventory mode determines how equipment is stored and resolved
 * - narrative: Simple string-based equipment (backwards compatible)
 * - itemized: Full item objects with stats, slots, and mechanics
 */
export const InventoryModeSchema = z.enum(["narrative", "itemized"]);
export type InventoryMode = z.infer<typeof InventoryModeSchema>;

/**
 * Weight/encumbrance tracking for itemized inventory
 */
export const WeightTrackerSchema = z.object({
  current: z.number().nonnegative().default(0),
  max: z.number().positive().default(100),
});
export type WeightTracker = z.infer<typeof WeightTrackerSchema>;

/**
 * Encumbrance status derived from weight
 */
export const EncumbranceStatusSchema = z.enum([
  "light",
  "normal",
  "heavy",
  "overloaded",
]);
export type EncumbranceStatus = z.infer<typeof EncumbranceStatusSchema>;

/**
 * Character Inventory - unified structure supporting both modes
 *
 * In narrative mode, uses the existing CharacterEquipment structure.
 * In itemized mode, uses full Item objects with equipment slots.
 */
export const CharacterInventorySchema = z.object({
  /** Mode determines how equipment is interpreted */
  mode: InventoryModeSchema,

  /**
   * Narrative mode equipment (backwards compatible)
   * Only used when mode === "narrative"
   */
  narrative: z
    .object({
      weapons: z.array(z.string()).default([]),
      armor: z.string().nullable().default(null),
      armorValue: z.number().optional(),
      gear: z.array(z.string()).default([]),
    })
    .optional(),

  /**
   * Itemized mode - full item objects
   * Only used when mode === "itemized"
   */
  items: z.array(ItemSchema).default([]),

  /** Equipment loadout - maps slots to item IDs */
  equipped: EquipmentLoadoutSchema.default({
    mainHand: null,
    offHand: null,
    head: null,
    body: null,
    hands: null,
    feet: null,
    accessory1: null,
    accessory2: null,
  }),

  /** Currency */
  gold: z.number().int().nonnegative().default(0),

  /** Inventory capacity */
  maxSlots: z.number().int().positive().default(20),

  /** Weight tracking (optional, itemized mode) */
  weight: WeightTrackerSchema.optional(),
});
export type CharacterInventory = z.infer<typeof CharacterInventorySchema>;

/**
 * Narrowed type for itemized inventory
 */
export type ItemizedInventory = CharacterInventory & { mode: "itemized" };

/**
 * Narrowed type for narrative inventory
 */
export type NarrativeInventory = CharacterInventory & { mode: "narrative" };

/**
 * Create a new narrative-mode inventory from existing CharacterEquipment
 */
export function createNarrativeInventory(
  equipment: CharacterEquipment
): CharacterInventory {
  return {
    mode: "narrative",
    narrative: {
      weapons: [...equipment.weapons],
      armor: equipment.armor,
      armorValue: equipment.armorValue,
      gear: [...equipment.gear],
    },
    items: [],
    equipped: {
      mainHand: null,
      offHand: null,
      head: null,
      body: null,
      hands: null,
      feet: null,
      accessory1: null,
      accessory2: null,
    },
    gold: 0,
    maxSlots: 20,
  };
}

/**
 * Create a new empty itemized inventory
 */
export function createItemizedInventory(options?: {
  gold?: number;
  maxSlots?: number;
  maxWeight?: number;
}): CharacterInventory {
  return {
    mode: "itemized",
    items: [],
    equipped: {
      mainHand: null,
      offHand: null,
      head: null,
      body: null,
      hands: null,
      feet: null,
      accessory1: null,
      accessory2: null,
    },
    gold: options?.gold ?? 0,
    maxSlots: options?.maxSlots ?? 20,
    weight: {
      current: 0,
      max: options?.maxWeight ?? 100,
    },
  };
}

/**
 * Check if inventory is in itemized mode (type predicate for narrowing)
 */
export function isItemizedInventory(
  inventory: CharacterInventory
): inventory is ItemizedInventory {
  return inventory.mode === "itemized";
}

/**
 * Check if inventory is in narrative mode (type predicate for narrowing)
 */
export function isNarrativeInventory(
  inventory: CharacterInventory
): inventory is NarrativeInventory {
  return inventory.mode === "narrative";
}

/**
 * Get an item from inventory by ID
 */
export function getInventoryItem(
  inventory: CharacterInventory,
  itemId: string
): Item | undefined {
  if (inventory.mode !== "itemized") {
    return undefined;
  }
  return inventory.items.find((item) => item.id === itemId);
}

/**
 * Get equipped item for a slot
 */
export function getEquippedItem(
  inventory: CharacterInventory,
  slot: EquipmentSlot
): Item | undefined {
  if (inventory.mode !== "itemized") {
    return undefined;
  }
  const itemId = inventory.equipped[slot];
  if (!itemId) {
    return undefined;
  }
  return getInventoryItem(inventory, itemId);
}

/**
 * Get all equipped items (deduplicated by item ID)
 */
export function getEquippedItems(inventory: CharacterInventory): Item[] {
  if (inventory.mode !== "itemized") {
    return [];
  }
  const items: Item[] = [];
  const seenIds = new Set<string>();
  for (const slot of Object.keys(inventory.equipped) as EquipmentSlot[]) {
    const item = getEquippedItem(inventory, slot);
    if (item && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      items.push(item);
    }
  }
  return items;
}

/**
 * Calculate current encumbrance status
 */
export function getEncumbranceStatus(
  inventory: CharacterInventory
): EncumbranceStatus {
  if (!inventory.weight) {
    return "normal";
  }
  const ratio = inventory.weight.current / inventory.weight.max;
  if (ratio <= 0.33) return "light";
  if (ratio <= 0.66) return "normal";
  if (ratio <= 1.0) return "heavy";
  return "overloaded";
}

/**
 * Calculate total weight of all items in inventory
 */
export function calculateInventoryWeight(inventory: CharacterInventory): number {
  if (inventory.mode !== "itemized") {
    return 0;
  }
  return inventory.items.reduce((total, item) => {
    const itemWeight = item.weight ?? 0;
    const quantity = item.quantity ?? 1;
    return total + itemWeight * quantity;
  }, 0);
}

/**
 * Check if inventory has space for more items.
 * When templateId is provided and the item is stackable, checks if it can merge
 * into an existing stack (consuming 0 additional slots).
 */
export function hasInventorySpace(
  inventory: CharacterInventory,
  count: number = 1,
  templateId?: string
): boolean {
  if (inventory.mode !== "itemized") {
    return true; // Narrative mode has no slot limits
  }

  // If a templateId is provided, check if stackable item can merge into existing stack
  if (templateId) {
    const existingStack = inventory.items.find(
      (item) =>
        item.stackable &&
        (item.templateId === templateId || item.id === templateId)
    );
    if (existingStack) {
      // Item can merge into existing stack, no new slot needed
      return true;
    }
  }

  // Count non-stacked items (each takes a slot)
  const usedSlots = inventory.items.filter((item) => !item.stackable).length;
  // Stackable items that exist take one slot each
  const stackedSlots = new Set(
    inventory.items.filter((item) => item.stackable).map((item) => item.templateId ?? item.id)
  ).size;
  const totalUsed = usedSlots + stackedSlots;
  return totalUsed + count <= inventory.maxSlots;
}

/**
 * Find item by template ID (for stacking)
 */
export function findItemByTemplate(
  inventory: CharacterInventory,
  templateId: string
): Item | undefined {
  if (inventory.mode !== "itemized") {
    return undefined;
  }
  return inventory.items.find((item) => item.templateId === templateId);
}

/**
 * Check if a slot is valid for an item type.
 * Respects explicit equipSlot property when present.
 */
export function isValidSlotForItem(item: Item, slot: EquipmentSlot): boolean {
  switch (item.type) {
    case "weapon":
      return slot === "mainHand" || slot === "offHand";
    case "armor":
      // Shields can only go in offHand
      if ("armorCategory" in item && item.armorCategory === "shield") {
        return slot === "offHand";
      }
      // If item has explicit equipSlot, require exact match
      if ("equipSlot" in item && item.equipSlot) {
        return slot === item.equipSlot;
      }
      // Default: allow body, head, hands, feet
      return slot === "body" || slot === "head" || slot === "hands" || slot === "feet";
    case "accessory":
      return slot === "accessory1" || slot === "accessory2";
    default:
      return false; // Non-equipment items can't be equipped
  }
}

/**
 * Get the primary slot for an item (for auto-equip)
 */
export function getPrimarySlotForItem(item: Item): EquipmentSlot | null {
  switch (item.type) {
    case "weapon":
      return "mainHand";
    case "armor":
      if ("armorCategory" in item && item.armorCategory === "shield") {
        return "offHand";
      }
      // Only return equipSlot if it exists and is truthy
      if ("equipSlot" in item && item.equipSlot) {
        return item.equipSlot;
      }
      return "body";
    case "accessory":
      return "accessory1";
    default:
      return null;
  }
}

// Re-export commonly used types from items.ts for convenience
export {
  ItemSchema,
  EquipmentLoadoutSchema,
  EquipmentSlotSchema,
  type Item,
  type EquipmentLoadout,
  type EquipmentSlot,
};
