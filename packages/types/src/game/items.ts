/**
 * Item system types for RPG inventory management
 */

import { z } from "zod";

/**
 * Item rarity levels affecting visual treatment and drop rates
 */
export const ItemRaritySchema = z.enum([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);
export type ItemRarity = z.infer<typeof ItemRaritySchema>;

/**
 * Broad item type categories
 */
export const ItemTypeSchema = z.enum([
  "weapon",
  "armor",
  "consumable",
  "key",
  "quest",
  "misc",
  "material",
  "accessory",
]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

/**
 * Equipment slots for the paperdoll system
 */
export const EquipmentSlotSchema = z.enum([
  "mainHand",
  "offHand",
  "head",
  "body",
  "hands",
  "feet",
  "accessory1",
  "accessory2",
]);
export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>;

/**
 * Weapon subcategories
 */
export const WeaponCategorySchema = z.enum([
  "sword",
  "axe",
  "mace",
  "dagger",
  "spear",
  "bow",
  "crossbow",
  "staff",
  "wand",
]);
export type WeaponCategory = z.infer<typeof WeaponCategorySchema>;

/**
 * Armor subcategories
 */
export const ArmorCategorySchema = z.enum([
  "light",
  "medium",
  "heavy",
  "cloth",
  "shield",
]);
export type ArmorCategory = z.infer<typeof ArmorCategorySchema>;

/**
 * Stat modifier that an item can provide
 */
export const ItemStatModifierSchema = z.object({
  stat: z.string().describe("Stat key to modify (e.g., 'strength', 'armor')"),
  value: z.number().describe("Amount to add/subtract"),
  type: z
    .enum(["flat", "percent"])
    .default("flat")
    .describe("Whether the modifier is flat or percentage-based"),
});
export type ItemStatModifier = z.infer<typeof ItemStatModifierSchema>;

/**
 * Base item schema - all items have these fields
 */
export const BaseItemSchema = z.object({
  id: z.string().describe("Unique item instance ID"),
  templateId: z
    .string()
    .optional()
    .describe("Reference to item template/definition"),
  name: z.string().describe("Display name"),
  description: z.string().describe("Flavor text and mechanics description"),
  type: ItemTypeSchema,
  rarity: ItemRaritySchema.default("common"),
  icon: z.string().optional().describe("Icon identifier or emoji"),
  quantity: z.number().int().positive().default(1),
  stackable: z.boolean().default(false),
  maxStack: z.number().int().positive().default(99),
  value: z.number().int().nonnegative().default(0).describe("Base gold value"),
  weight: z.number().nonnegative().default(0).describe("Weight in pounds"),
});

/**
 * Equipment-specific fields
 */
export const EquipmentFieldsSchema = z.object({
  equipSlot: EquipmentSlotSchema,
  stats: z.array(ItemStatModifierSchema).default([]),
  requirements: z
    .record(z.string(), z.number())
    .optional()
    .describe("Stat requirements to equip"),
  twoHanded: z
    .boolean()
    .default(false)
    .describe("Whether weapon requires both hands"),
});

/**
 * Weapon-specific fields
 */
export const WeaponFieldsSchema = EquipmentFieldsSchema.extend({
  weaponCategory: WeaponCategorySchema.optional(),
  damage: z.string().describe("Damage dice expression (e.g., '1d8+2')"),
  damageType: z
    .enum(["physical", "fire", "ice", "lightning", "poison", "holy", "dark"])
    .default("physical"),
  range: z.enum(["melee", "ranged"]).default("melee"),
});

/**
 * Armor-specific fields
 */
export const ArmorFieldsSchema = EquipmentFieldsSchema.extend({
  armorCategory: ArmorCategorySchema.optional(),
  armorValue: z.number().int().nonnegative().default(0),
});

/**
 * Consumable-specific fields
 */
export const ConsumableFieldsSchema = z.object({
  uses: z.number().int().positive().default(1),
  maxUses: z.number().int().positive().default(1),
  effect: z
    .string()
    .optional()
    .describe("Effect key or description when used"),
  healAmount: z.number().int().optional().describe("HP restored if healing item"),
  cooldown: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Turns before can use again"),
});

/**
 * Full weapon item
 */
export const WeaponItemSchema = BaseItemSchema.merge(WeaponFieldsSchema).extend({
  type: z.literal("weapon"),
});
export type WeaponItem = z.infer<typeof WeaponItemSchema>;

/**
 * Full armor item
 */
export const ArmorItemSchema = BaseItemSchema.merge(ArmorFieldsSchema).extend({
  type: z.literal("armor"),
});
export type ArmorItem = z.infer<typeof ArmorItemSchema>;

/**
 * Full consumable item
 */
export const ConsumableItemSchema = BaseItemSchema.merge(
  ConsumableFieldsSchema
).extend({
  type: z.literal("consumable"),
});
export type ConsumableItem = z.infer<typeof ConsumableItemSchema>;

/**
 * Generic/simple item (key, quest, misc, material)
 */
export const SimpleItemSchema = BaseItemSchema.extend({
  type: z.enum(["key", "quest", "misc", "material"]),
  questId: z.string().optional().describe("Associated quest if quest item"),
  usable: z
    .boolean()
    .default(false)
    .describe("Whether item can be used from inventory"),
  effect: z.string().optional().describe("Effect when used"),
});
export type SimpleItem = z.infer<typeof SimpleItemSchema>;

/**
 * Accessory item (rings, amulets, etc.)
 */
export const AccessoryItemSchema = BaseItemSchema.merge(
  EquipmentFieldsSchema
).extend({
  type: z.literal("accessory"),
});
export type AccessoryItem = z.infer<typeof AccessoryItemSchema>;

/**
 * Union of all item types
 */
export const ItemSchema = z.discriminatedUnion("type", [
  WeaponItemSchema,
  ArmorItemSchema,
  ConsumableItemSchema,
  SimpleItemSchema,
  AccessoryItemSchema,
]);
export type Item = z.infer<typeof ItemSchema>;

/**
 * Equipment loadout - what a character has equipped
 */
export const EquipmentLoadoutSchema = z.object({
  mainHand: z.string().nullable().default(null).describe("Item ID or null"),
  offHand: z.string().nullable().default(null),
  head: z.string().nullable().default(null),
  body: z.string().nullable().default(null),
  hands: z.string().nullable().default(null),
  feet: z.string().nullable().default(null),
  accessory1: z.string().nullable().default(null),
  accessory2: z.string().nullable().default(null),
});
export type EquipmentLoadout = z.infer<typeof EquipmentLoadoutSchema>;

/**
 * Inventory container
 */
export const InventorySchema = z.object({
  items: z.array(ItemSchema).default([]),
  maxSlots: z.number().int().positive().default(20),
  gold: z.number().int().nonnegative().default(0),
  equipment: EquipmentLoadoutSchema.default({}),
});
export type Inventory = z.infer<typeof InventorySchema>;

/**
 * Item slot display state (for UI)
 */
export interface ItemSlotState {
  item: Item | null;
  slotIndex: number;
  isSelected: boolean;
  isHovered: boolean;
  isEmpty: boolean;
  isLocked?: boolean;
}

/**
 * Rarity color mapping for UI
 */
export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: "var(--foreground-muted)",
  uncommon: "#2ecc71", // Green
  rare: "#3498db", // Blue
  epic: "#9b59b6", // Purple
  legendary: "#f39c12", // Gold/Orange
};

/**
 * Rarity glow intensity for UI
 */
export const RARITY_GLOW: Record<ItemRarity, string> = {
  common: "none",
  uncommon: "0 0 4px #2ecc71",
  rare: "0 0 6px #3498db",
  epic: "0 0 8px #9b59b6",
  legendary: "0 0 10px #f39c12, 0 0 20px #f39c12",
};
