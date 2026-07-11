/**
 * Shared Inventory Helpers
 *
 * Common utility functions used across inventory tools.
 */

import {
  createItemizedInventory,
  type Character,
  type CharacterInventory,
  type EquipmentSlot,
} from "@mythxengine/types";

/**
 * All equipment slots in canonical order
 */
export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "mainHand",
  "offHand",
  "head",
  "body",
  "hands",
  "feet",
  "accessory1",
  "accessory2",
];

/**
 * Options for upgrading a character to itemized inventory mode
 */
export interface UpgradeToItemizedOptions {
  startingGold?: number;
  maxSlots?: number;
  maxWeight?: number;
  /** Keep narrative equipment as reference (stored in narrative field). Default true. */
  preserveNarrative?: boolean;
}

/**
 * Upgrade a character from narrative to itemized inventory mode, in place.
 *
 * Shared by the `upgrade_inventory` tool and by shop tools that
 * auto-upgrade on first use. The caller is responsible for persisting
 * the session afterwards.
 */
export function upgradeCharacterToItemized(
  character: Character,
  options: UpgradeToItemizedOptions = {}
): CharacterInventory {
  const inventory = createItemizedInventory({
    gold: options.startingGold ?? 0,
    maxSlots: options.maxSlots ?? 20,
    maxWeight: options.maxWeight ?? 100,
  });

  // Optionally preserve narrative equipment for reference
  if ((options.preserveNarrative ?? true) && character.equipment) {
    inventory.narrative = {
      weapons: [...character.equipment.weapons],
      armor: character.equipment.armor,
      armorValue: character.equipment.armorValue,
      gear: [...character.equipment.gear],
    };
  }

  character.inventory = inventory;
  return inventory;
}

/**
 * Find the slot where an item is equipped by iterating inventory.equipped keys.
 * Returns undefined if the item is not equipped in any slot.
 */
export function findEquippedSlotForItem(
  inventory: CharacterInventory,
  itemId: string
): EquipmentSlot | undefined {
  for (const key of Object.keys(inventory.equipped)) {
    const slot = key as EquipmentSlot;
    if (inventory.equipped[slot] === itemId) {
      return slot;
    }
  }
  return undefined;
}

/**
 * Generate a unique item instance ID using crypto.randomUUID
 */
export function generateItemId(): string {
  return `item_${crypto.randomUUID()}`;
}

/**
 * Check if an item can merge into an existing stack in the inventory.
 * Returns the existing item if a compatible stack exists, undefined otherwise.
 */
export function findStackableMatch(
  inventory: CharacterInventory,
  item: { stackable?: boolean; templateId?: string; id: string }
): { id: string; quantity?: number; maxStack?: number } | undefined {
  if (!item.stackable) {
    return undefined;
  }
  // Look for an existing item with the same templateId or id
  const matchId = item.templateId ?? item.id;
  return inventory.items.find(
    (existing) => existing.stackable && (existing.templateId === matchId || existing.id === matchId)
  );
}
