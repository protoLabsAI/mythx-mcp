/**
 * Use Item Tool
 *
 * Use a consumable item, applying its effects.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  getInventoryItem,
  type CharacterInventory,
} from "@mythxengine/types";
import { EventTypes, emitInventoryEvent } from "../events/index.js";
import { emitCharacterUpdatedFor } from "../events/character-state.js";

/**
 * Input schema for use_item
 */
export const UseItemInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character ID using the item"),
  itemId: z.string().describe("Item instance ID to use"),
  targetCharacterId: z
    .string()
    .optional()
    .describe("Target character ID (for items that affect others). Defaults to self."),
});

export type UseItemInput = z.infer<typeof UseItemInputSchema>;

/**
 * Effect result from using an item
 */
export interface ItemEffectResult {
  type: "healing" | "effect" | "none";
  description: string;
  healAmount?: number;
  effectApplied?: string;
}

/**
 * Output type for use_item
 */
export interface UseItemOutput {
  message: string;
  item: {
    id: string;
    name: string;
    usesRemaining: number;
    depleted: boolean;
  };
  target: {
    characterId: string;
    characterName: string;
  };
  effect: ItemEffectResult;
}

/**
 * Use item tool definition
 */
export const useItemTool = defineSharedTool({
  name: "use_item",
  description:
    "Use a consumable item. Applies healing or effects, decrements uses, and removes item when depleted.",
  inputSchema: UseItemInputSchema,
  emits: [EventTypes.ITEM_USED, EventTypes.ITEM_REMOVED, EventTypes.CHARACTER_UPDATED],

  handler: async (input, ctx): Promise<UseItemOutput> => {
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

    // Check if item is usable
    if (item.type !== "consumable") {
      // Check for usable simple items
      if (
        item.type === "key" ||
        item.type === "quest" ||
        item.type === "misc" ||
        item.type === "material"
      ) {
        if (!("usable" in item) || !item.usable) {
          throw new Error(`Item '${item.name}' is not usable`);
        }
      } else {
        throw new Error(`Item '${item.name}' is not a consumable`);
      }
    }

    // Determine target
    const targetId = input.targetCharacterId ?? input.characterId;
    const target = session.characters[targetId];
    if (!target) {
      throw new Error(`Target character not found: ${targetId}`);
    }

    // Apply effects based on item type
    let effectResult: ItemEffectResult = {
      type: "none",
      description: "No effect",
    };

    /**
     * Process item effect - handles both consumables and usable non-consumables
     */
    const processItemEffect = (): ItemEffectResult => {
      // Apply healing if applicable (consumables only)
      if (
        item.type === "consumable" &&
        "healAmount" in item &&
        item.healAmount &&
        item.healAmount > 0
      ) {
        const healAmount = item.healAmount;
        const previousHp = target.hp.current;
        target.hp.current = Math.min(target.hp.current + healAmount, target.hp.max);
        const actualHealing = target.hp.current - previousHp;

        return {
          type: "healing",
          description: `Healed ${actualHealing} HP`,
          healAmount: actualHealing,
        };
      }

      // Apply generic effect (works for consumables and usable items)
      if ("effect" in item && item.effect) {
        return {
          type: "effect",
          description: item.effect,
          effectApplied: item.effect,
        };
      }

      return { type: "none", description: "No effect" };
    };

    if (item.type === "consumable") {
      // Check uses remaining for consumables
      const uses = item.uses ?? 1;
      if (uses <= 0) {
        throw new Error(`Item '${item.name}' has no uses remaining`);
      }

      effectResult = processItemEffect();

      // Decrement uses
      item.uses = uses - 1;
    } else {
      // Non-consumable usable items (key, quest, misc, material with usable: true)
      effectResult = processItemEffect();
    }

    // Check if item is depleted
    let usesRemaining = item.type === "consumable" ? (item.uses ?? 0) : 0;
    let depleted = usesRemaining <= 0;
    let fullyRemoved = false;

    // Remove item if depleted (or reduce quantity for stackable)
    if (depleted) {
      if (item.stackable && (item.quantity ?? 1) > 1 && item.type === "consumable") {
        // Reduce stack, reset uses (consumables only)
        item.quantity = (item.quantity ?? 1) - 1;
        item.uses = item.maxUses ?? 1;

        // Update weight for the consumed unit
        if (inventory.weight) {
          inventory.weight.current -= item.weight ?? 0;
          inventory.weight.current = Math.max(0, inventory.weight.current);
        }

        // Recompute after reset - item is no longer depleted, has uses again
        usesRemaining = item.uses;
        depleted = false;
      } else if (item.stackable && (item.quantity ?? 1) > 1) {
        // Reduce stack for non-consumable stackable items
        item.quantity = (item.quantity ?? 1) - 1;

        // Update weight for the consumed unit
        if (inventory.weight) {
          inventory.weight.current -= item.weight ?? 0;
          inventory.weight.current = Math.max(0, inventory.weight.current);
        }
      } else {
        // Remove entirely
        const index = inventory.items.findIndex((i) => i.id === input.itemId);
        if (index !== -1) {
          inventory.items.splice(index, 1);
        }
        fullyRemoved = true;

        // Update weight
        if (inventory.weight) {
          inventory.weight.current -= item.weight ?? 0;
          inventory.weight.current = Math.max(0, inventory.weight.current);
        }

        emitInventoryEvent(
          ctx.eventBus,
          input.sessionId,
          EventTypes.ITEM_REMOVED,
          {
            characterId: input.characterId,
            characterName: character.name,
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
            fullyRemoved: true,
            reason: "depleted",
          },
          "use_item"
        );
      }
    }

    // Save session
    await ctx.sessions.save(session);

    // Emit use event
    emitInventoryEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.ITEM_USED,
      {
        characterId: input.characterId,
        characterName: character.name,
        itemId: item.id,
        itemName: item.name,
        targetCharacterId: targetId,
        targetCharacterName: target.name,
        effect: effectResult,
        usesRemaining,
        depleted: fullyRemoved,
        quantity: item.quantity,
      },
      "use_item"
    );

    // Sync the target's HP into the party sidebar — only when the
    // item actually mutated snapshot-backed state. Healing potions
    // bump hp.current; narrative `effect` results and "none" don't
    // touch hp/conditions/stress, so emitting CHARACTER_UPDATED for
    // them would push a payload that's identical to what the client
    // already has, and could trigger a bogus character-update card.
    // Items targeted at session characters always belong to the
    // player party (target lookup hit `session.characters[targetId]`
    // above), so no enemy guard needed.
    //
    // We deliberately do NOT emit a second snapshot for the source
    // character when target ≠ source: the source character's mutation
    // is purely inventory (uses decremented / item removed), and the
    // CHARACTER_UPDATED snapshot only carries hp/conditions/stress.
    // Inventory sync stays on its own channel via the ITEM_USED /
    // ITEM_REMOVED events emitted above; once the sidebar grows an
    // inventory surface, the right fix is to extend the snapshot
    // shape, not to re-emit per-character.
    // See docs/audits/chat-flow-audit.md §2.1 + §7.
    // Tighter than `type === "healing"` — when the target is already
    // at max HP, the heal computes `actualHealing = 0` and the
    // snapshot is byte-for-byte identical to the prior state. Skip
    // those too so a "drink potion at full HP" doesn't push a no-op
    // CHARACTER_UPDATED.
    if (effectResult.type === "healing" && (effectResult.healAmount ?? 0) > 0) {
      emitCharacterUpdatedFor(
        ctx.eventBus,
        input.sessionId,
        target,
        session,
        { itemUsed: item.name, effect: effectResult.type, healAmount: effectResult.healAmount },
        "use_item"
      );
    }

    return {
      message: fullyRemoved
        ? `${character.name} used ${item.name} on ${target.name}. ${effectResult.description}. Item depleted.`
        : `${character.name} used ${item.name} on ${target.name}. ${effectResult.description}`,
      item: {
        id: item.id,
        name: item.name,
        usesRemaining,
        depleted: fullyRemoved,
      },
      target: {
        characterId: targetId,
        characterName: target.name,
      },
      effect: effectResult,
    };
  },
});
