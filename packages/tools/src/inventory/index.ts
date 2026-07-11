/**
 * Inventory Tools
 *
 * Tools for managing character inventories in both narrative and itemized modes.
 */

export {
  upgradeInventoryTool,
  type UpgradeInventoryInput,
  type UpgradeInventoryOutput,
} from "./upgrade-inventory.js";

export {
  listInventoryTool,
  type ListInventoryInput,
  type ListInventoryOutput,
  type ItemSummary,
  type NarrativeEquipmentSummary,
} from "./list-inventory.js";

export {
  addItemTool,
  type AddItemInput,
  type AddItemOutput,
} from "./add-item.js";

export {
  removeItemTool,
  type RemoveItemInput,
  type RemoveItemOutput,
} from "./remove-item.js";

export {
  modifyGoldTool,
  type ModifyGoldInput,
  type ModifyGoldOutput,
} from "./modify-gold.js";

export {
  equipItemTool,
  type EquipItemInput,
  type EquipItemOutput,
} from "./equip-item.js";

export {
  unequipItemTool,
  type UnequipItemInput,
  type UnequipItemOutput,
} from "./unequip-item.js";

export {
  useItemTool,
  type UseItemInput,
  type UseItemOutput,
  type ItemEffectResult,
} from "./use-item.js";

export {
  transferItemTool,
  type TransferItemInput,
  type TransferItemOutput,
} from "./transfer-item.js";

// Shared helpers
export {
  EQUIPMENT_SLOTS,
  findEquippedSlotForItem,
  generateItemId,
  findStackableMatch,
} from "./helpers.js";

import { upgradeInventoryTool } from "./upgrade-inventory.js";
import { listInventoryTool } from "./list-inventory.js";
import { addItemTool } from "./add-item.js";
import { removeItemTool } from "./remove-item.js";
import { modifyGoldTool } from "./modify-gold.js";
import { equipItemTool } from "./equip-item.js";
import { unequipItemTool } from "./unequip-item.js";
import { useItemTool } from "./use-item.js";
import { transferItemTool } from "./transfer-item.js";

/**
 * All inventory tools
 */
export const inventoryTools = [
  upgradeInventoryTool,
  listInventoryTool,
  addItemTool,
  removeItemTool,
  modifyGoldTool,
  equipItemTool,
  unequipItemTool,
  useItemTool,
  transferItemTool,
];
