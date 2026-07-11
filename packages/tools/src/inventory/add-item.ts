/**
 * Add Item Tool
 *
 * Add an item to a character's inventory, either from a world pack template
 * or as a custom item definition.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  hasInventorySpace,
  findItemByTemplate,
  getPrimarySlotForItem,
  type Item,
  type CharacterInventory,
  ItemRaritySchema,
  EquipmentSlotSchema,
  WeaponCategorySchema,
  ArmorCategorySchema,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";
import { generateItemId } from "./helpers.js";

/**
 * Custom weapon definition
 */
const CustomWeaponSchema = z.object({
  type: z.literal("weapon"),
  name: z.string(),
  description: z.string().optional().default(""),
  damage: z.string().describe("Damage dice e.g. '1d8+2'"),
  damageType: z
    .enum(["physical", "fire", "ice", "lightning", "poison", "holy", "dark"])
    .optional()
    .default("physical"),
  range: z.enum(["melee", "ranged"]).optional().default("melee"),
  weaponCategory: WeaponCategorySchema.optional(),
  twoHanded: z.boolean().optional().default(false),
  rarity: ItemRaritySchema.optional().default("common"),
  value: z.number().int().nonnegative().optional().default(0),
  weight: z.number().nonnegative().optional().default(1),
});

/**
 * Custom armor definition
 */
const CustomArmorSchema = z.object({
  type: z.literal("armor"),
  name: z.string(),
  description: z.string().optional().default(""),
  armorValue: z.number().int().nonnegative(),
  armorCategory: ArmorCategorySchema.optional(),
  equipSlot: EquipmentSlotSchema.optional().default("body"),
  rarity: ItemRaritySchema.optional().default("common"),
  value: z.number().int().nonnegative().optional().default(0),
  weight: z.number().nonnegative().optional().default(5),
});

/**
 * Custom consumable definition
 */
const CustomConsumableSchema = z.object({
  type: z.literal("consumable"),
  name: z.string(),
  description: z.string().optional().default(""),
  uses: z.number().int().positive().optional().default(1),
  healAmount: z.number().int().optional(),
  effect: z.string().optional(),
  rarity: ItemRaritySchema.optional().default("common"),
  value: z.number().int().nonnegative().optional().default(0),
  weight: z.number().nonnegative().optional().default(0.1),
  stackable: z.boolean().optional().default(true),
});

/**
 * Custom simple item definition
 */
const CustomSimpleItemSchema = z.object({
  type: z.enum(["key", "quest", "misc", "material"]),
  name: z.string(),
  description: z.string().optional().default(""),
  questId: z.string().optional(),
  usable: z.boolean().optional().default(false),
  effect: z.string().optional(),
  rarity: ItemRaritySchema.optional().default("common"),
  value: z.number().int().nonnegative().optional().default(0),
  weight: z.number().nonnegative().optional().default(0),
  stackable: z.boolean().optional().default(false),
});

/**
 * Custom accessory definition
 */
const CustomAccessorySchema = z.object({
  type: z.literal("accessory"),
  name: z.string(),
  description: z.string().optional().default(""),
  equipSlot: z.enum(["accessory1", "accessory2"]).optional().default("accessory1"),
  rarity: ItemRaritySchema.optional().default("common"),
  value: z.number().int().nonnegative().optional().default(0),
  weight: z.number().nonnegative().optional().default(0.1),
});

/**
 * Union of all custom item types
 */
const CustomItemSchema = z.discriminatedUnion("type", [
  CustomWeaponSchema,
  CustomArmorSchema,
  CustomConsumableSchema,
  CustomSimpleItemSchema,
  CustomAccessorySchema,
]);

/**
 * Input schema for add_item
 */
export const AddItemInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID"),

  // Option 1: From world pack template
  worldPackId: z.string().optional().describe("World pack ID to get template from"),
  templateId: z.string().optional().describe("Item template ID from world pack"),

  // Option 2: Custom item
  customItem: CustomItemSchema.optional().describe("Custom item definition"),

  // Common options
  quantity: z.number().int().positive().optional().default(1).describe("Quantity to add"),
  autoEquip: z.boolean().optional().default(false).describe("Automatically equip if slot is empty"),
});

export type AddItemInput = z.infer<typeof AddItemInputSchema>;

/**
 * Output type for add_item
 */
export interface AddItemOutput {
  message: string;
  item: {
    id: string;
    name: string;
    type: string;
    quantity: number;
  };
  equipped?: {
    slot: string;
  };
  inventoryStats: {
    slotsUsed: number;
    maxSlots: number;
    weight: number;
    maxWeight: number;
  };
}

/**
 * Add item tool definition
 */
export const addItemTool = defineSharedTool({
  name: "add_item",
  description:
    "Add an item to a character's inventory. Can add from a world pack template (worldPackId + templateId) or create a custom item. Requires itemized inventory mode.",
  inputSchema: AddItemInputSchema,
  emits: [EventTypes.ITEM_ADDED, EventTypes.ITEM_EQUIPPED],

  handler: async (input, ctx): Promise<AddItemOutput> => {
    // Validate input - must have either template OR custom item
    if (!input.templateId && !input.customItem) {
      throw new Error("Must provide either templateId (with worldPackId) or customItem");
    }
    if (input.templateId && input.customItem) {
      throw new Error("Cannot provide both templateId and customItem");
    }
    if (input.templateId && !input.worldPackId) {
      throw new Error("templateId requires worldPackId");
    }

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

    // Check space
    if (!hasInventorySpace(inventory, 1)) {
      throw new Error(`Inventory full (${inventory.maxSlots} slots)`);
    }

    let newItem: Item;

    if (input.templateId && input.worldPackId) {
      // Load from world pack template
      const worldPack = await ctx.worldPacks.get(input.worldPackId);
      if (!worldPack) {
        throw new Error(`World pack not found: ${input.worldPackId}`);
      }

      // Cast to typed pack and access items
      const typedPack = worldPack as { items?: Record<string, Item> };
      const template = typedPack.items?.[input.templateId];
      if (!template) {
        throw new Error(`Item template not found: ${input.templateId}`);
      }

      // Check if stackable and already exists
      if (template.stackable) {
        const existing = findItemByTemplate(inventory, input.templateId);
        if (existing && existing.quantity !== undefined) {
          // Add to existing stack (no new slot needed)
          const previousQuantity = existing.quantity;
          existing.quantity = Math.min(existing.quantity + input.quantity, existing.maxStack ?? 99);
          const actualAdded = existing.quantity - previousQuantity;

          // Update inventory weight
          const weightDelta = (template.weight ?? 0) * actualAdded;
          if (inventory.weight) {
            inventory.weight.current += weightDelta;
          } else {
            inventory.weight = { current: weightDelta, max: 100 };
          }

          await ctx.sessions.save(session);

          // Emit ITEM_ADDED event for stacked additions
          emitInventoryEvent(
            ctx.eventBus,
            input.sessionId,
            EventTypes.ITEM_ADDED,
            {
              characterId: input.characterId,
              characterName: character.name,
              itemId: existing.id,
              templateId: input.templateId,
              itemName: existing.name,
              itemType: existing.type,
              quantityAdded: actualAdded,
              quantity: existing.quantity,
            },
            "add_item"
          );

          return {
            message: `Added ${actualAdded} ${template.name} (now have ${existing.quantity})`,
            item: {
              id: existing.id,
              name: existing.name,
              type: existing.type,
              quantity: existing.quantity,
            },
            inventoryStats: {
              slotsUsed: inventory.items.length,
              maxSlots: inventory.maxSlots,
              weight: inventory.weight.current,
              maxWeight: inventory.weight.max,
            },
          };
        }
      }

      // Need a new slot - check space
      // Non-stackable items need one slot per quantity, stackable items need one slot total
      const requiredSlots = template.stackable ? 1 : input.quantity;
      if (!hasInventorySpace(inventory, requiredSlots)) {
        throw new Error(`Inventory full (${inventory.maxSlots} slots)`);
      }

      // Create new item instance from template
      newItem = {
        ...template,
        id: generateItemId(),
        templateId: input.templateId,
        quantity: input.quantity,
      } as Item;
    } else if (input.customItem) {
      // Create custom item
      const custom = input.customItem;
      const isStackable = "stackable" in custom ? custom.stackable : false;

      // Check space - non-stackable items need one slot per quantity, stackable items need one slot total
      const requiredSlots = isStackable ? 1 : input.quantity;
      if (!hasInventorySpace(inventory, requiredSlots)) {
        throw new Error(`Inventory full (${inventory.maxSlots} slots)`);
      }

      const baseItem = {
        id: generateItemId(),
        name: custom.name,
        description: custom.description ?? "",
        type: custom.type,
        rarity: custom.rarity ?? "common",
        quantity: input.quantity,
        stackable: "stackable" in custom ? custom.stackable : false,
        maxStack: 99,
        value: custom.value ?? 0,
        weight: custom.weight ?? 0,
      };

      switch (custom.type) {
        case "weapon":
          newItem = {
            ...baseItem,
            type: "weapon" as const,
            damage: custom.damage,
            damageType: custom.damageType ?? "physical",
            range: custom.range ?? "melee",
            weaponCategory: custom.weaponCategory,
            twoHanded: custom.twoHanded ?? false,
            equipSlot: "mainHand" as const,
            stats: [],
          } as Item;
          break;
        case "armor":
          newItem = {
            ...baseItem,
            type: "armor" as const,
            armorValue: custom.armorValue,
            armorCategory: custom.armorCategory,
            equipSlot: custom.equipSlot ?? "body",
            stats: [],
            twoHanded: false,
          } as Item;
          break;
        case "consumable":
          newItem = {
            ...baseItem,
            type: "consumable" as const,
            uses: custom.uses ?? 1,
            maxUses: custom.uses ?? 1,
            healAmount: custom.healAmount,
            effect: custom.effect,
            stackable: custom.stackable ?? true,
          } as Item;
          break;
        case "accessory":
          newItem = {
            ...baseItem,
            type: "accessory" as const,
            equipSlot: custom.equipSlot ?? "accessory1",
            stats: [],
            twoHanded: false,
          } as Item;
          break;
        default:
          // Simple items (key, quest, misc, material)
          newItem = {
            ...baseItem,
            type: custom.type,
            questId: "questId" in custom ? custom.questId : undefined,
            usable: "usable" in custom ? custom.usable : false,
            effect: "effect" in custom ? custom.effect : undefined,
          } as Item;
      }
    } else {
      throw new Error("Invalid input: must provide templateId or customItem");
    }

    // Add to inventory
    inventory.items.push(newItem);

    // Update weight
    if (inventory.weight) {
      inventory.weight.current += (newItem.weight ?? 0) * input.quantity;
    }

    // Auto-equip if requested and slot is empty
    let equippedSlot: string | undefined;
    if (input.autoEquip) {
      const primarySlot = getPrimarySlotForItem(newItem);
      if (primarySlot && inventory.equipped[primarySlot] === null) {
        inventory.equipped[primarySlot] = newItem.id;
        equippedSlot = primarySlot;

        emitInventoryEvent(
          ctx.eventBus,
          input.sessionId,
          EventTypes.ITEM_EQUIPPED,
          {
            characterId: input.characterId,
            characterName: character.name,
            itemId: newItem.id,
            itemName: newItem.name,
            slot: primarySlot,
          },
          "add_item"
        );
      }
    }

    // Save session
    await ctx.sessions.save(session);

    // Emit add event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.ITEM_ADDED,
      {
        characterId: input.characterId,
        characterName: character.name,
        itemId: newItem.id,
        itemName: newItem.name,
        itemType: newItem.type,
        quantity: input.quantity,
      },
      "add_item"
    );

    return {
      message: `Added ${input.quantity > 1 ? `${input.quantity}x ` : ""}${newItem.name} to ${character.name}'s inventory`,
      item: {
        id: newItem.id,
        name: newItem.name,
        type: newItem.type,
        quantity: newItem.quantity ?? input.quantity,
      },
      equipped: equippedSlot ? { slot: equippedSlot } : undefined,
      inventoryStats: {
        slotsUsed: inventory.items.length,
        maxSlots: inventory.maxSlots,
        weight: inventory.weight?.current ?? 0,
        maxWeight: inventory.weight?.max ?? 100,
      },
    };
  },
});
