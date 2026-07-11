/**
 * Browse Shop Tool
 *
 * Load shop inventory from a world pack NPC (merchant) or location,
 * and set the stage to "shop" for the UI.
 */

import { z } from "zod";
import {
  defineSharedTool,
  hasItemizedInventory,
  type CharacterInventory,
} from "@mythxengine/types";
import { upgradeCharacterToItemized } from "../inventory/helpers.js";
import { requireSkill } from "../skills/load-skill.js";

export const BrowseShopInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character who is shopping"),
  npcId: z.string().optional().describe("NPC ID of the merchant (looked up from world pack)"),
  locationId: z
    .string()
    .optional()
    .describe("Location ID to find merchants at (alternative to npcId)"),
  shopName: z.string().optional().describe("Custom shop name (overrides NPC/location name)"),
  flavor: z.string().optional().describe("Flavor text describing the shop atmosphere"),
});

export type BrowseShopInput = z.infer<typeof BrowseShopInputSchema>;

export interface ShopItem {
  itemId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: string;
  rarity: string;
}

export interface BrowseShopOutput {
  message: string;
  shopName: string;
  shopkeeperName?: string;
  items: ShopItem[];
  playerGold: number;
}

export const browseShopTool = defineSharedTool({
  name: "browse_shop",
  description:
    "Open a shop interface for the player. Loads items from world pack NPC/location data. Sets the stage to 'shop' so the player can browse, buy, and sell items.",
  inputSchema: BrowseShopInputSchema,

  // Gate: require the engine-flows skill loaded first. The skill body
  // documents the exact browse_shop → showShop → buy_item/sell_item
  // sequence; entering the flow without it leads to mis-ordered calls
  // and missing the inventory-rendering UI handoff.
  gate: requireSkill("engine-flows"),

  handler: async (input, ctx): Promise<BrowseShopOutput> => {
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

    // Resolve shop data from world pack
    let shopName = input.shopName ?? "Shop";
    let shopkeeperName: string | undefined;
    const shopItems: ShopItem[] = [];

    // World pack type for shop-relevant fields.
    // Collections are records keyed by id (see WorldContentPackSchema).
    type ShopWorldPack = {
      npcs?: Record<
        string,
        {
          id: string;
          name: string;
          narrativeRole?: string;
          locations?: string[];
          images?: { portrait?: { url?: string } };
        }
      >;
      items?: Record<
        string,
        {
          id: string;
          name: string;
          description?: string;
          value?: number;
          kind?: string;
          rarity?: string;
        }
      >;
      locations?: Record<
        string,
        {
          id: string;
          name: string;
        }
      >;
    };

    // Try NPC merchant route
    if (input.npcId && session.worldPackId) {
      const rawPack = await ctx.worldPacks.get(session.worldPackId);
      const worldPack = rawPack as ShopWorldPack | null;
      if (worldPack) {
        const npc = Object.values(worldPack.npcs ?? {}).find((n) => n.id === input.npcId);
        if (npc) {
          shopkeeperName = npc.name;
          shopName = input.shopName ?? `${npc.name}'s Shop`;

          // Load items from world pack that the NPC would sell
          const worldItems = Object.values(worldPack.items ?? {});
          for (const item of worldItems) {
            shopItems.push({
              itemId: item.id,
              name: item.name,
              description: item.description ?? "",
              price: item.value ?? 10,
              quantity: -1, // unlimited stock
              category: item.kind ?? "misc",
              rarity: item.rarity ?? "common",
            });
          }
        }
      }
    }

    // Try location route (find merchants at location)
    if (shopItems.length === 0 && input.locationId && session.worldPackId) {
      const rawPack = await ctx.worldPacks.get(session.worldPackId);
      const worldPack = rawPack as ShopWorldPack | null;
      if (worldPack) {
        const location = Object.values(worldPack.locations ?? {}).find(
          (l) => l.id === input.locationId
        );
        if (location) {
          shopName = input.shopName ?? `${location.name} Market`;

          // Find merchant NPCs at this location
          const merchantNpcs = Object.values(worldPack.npcs ?? {}).filter(
            (n) => n.narrativeRole === "merchant" && (n.locations ?? []).includes(input.locationId!)
          );

          if (merchantNpcs.length > 0) {
            shopkeeperName = merchantNpcs[0].name;
          }

          // Load all world items for location-based shops
          const worldItems = Object.values(worldPack.items ?? {});
          for (const item of worldItems) {
            shopItems.push({
              itemId: item.id,
              name: item.name,
              description: item.description ?? "",
              price: item.value ?? 10,
              quantity: -1,
              category: item.kind ?? "misc",
              rarity: item.rarity ?? "common",
            });
          }
        }
      }
    }

    return {
      message: `Opened ${shopName} with ${shopItems.length} items. ${character.name} has ${inventory.gold} gold.`,
      shopName,
      shopkeeperName,
      items: shopItems,
      playerGold: inventory.gold,
    };
  },
});
