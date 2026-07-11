/**
 * Item XML Parser
 *
 * Parses XML output for items into WorldItem schema.
 * Aligned with world-generator.md prompt format.
 */

import { WorldItemSchema, type WorldItem } from "@mythxengine/worlds";
import {
  extractRequiredTag,
  extractTag,
  extractAllTags,
  extractOptionalInt,
} from "../xml-parser.js";

type ItemKind = "weapon" | "armor" | "consumable" | "special" | "misc";

/**
 * Parse items from XML output.
 *
 * Expected format (from world-generator.md prompt):
 * ```xml
 * <items>
 * <item>
 * <id>item:slug-name</id>
 * <name>Display Name</name>
 * <type>weapon|armor|consumable|tool|treasure</type>
 * <description>What it looks like</description>
 * <mechanical_effect>Game mechanics</mechanical_effect>
 * <value>gold value or rarity</value>
 * </item>
 * </items>
 * ```
 */
export function parseItemsXML(output: string): WorldItem[] {
  const itemsBlock = extractRequiredTag(output, "items");
  const itemBlocks = extractAllTags(itemsBlock, "item");

  return itemBlocks.map((block) => {
    // Try <type> first (prompt format), then <kind> (legacy format)
    let kindRaw = extractTag(block, "type") ?? extractTag(block, "kind") ?? "misc";
    kindRaw = kindRaw.toLowerCase().trim();

    // Map prompt values to schema values
    const kindMap: Record<string, ItemKind> = {
      weapon: "weapon",
      armor: "armor",
      consumable: "consumable",
      tool: "special",
      treasure: "misc",
      special: "special",
      misc: "misc",
    };
    const kind: ItemKind = kindMap[kindRaw] ?? "misc";

    // Parse tags if present
    const tagsBlock = extractTag(block, "tags");
    const tags = tagsBlock ? extractAllTags(tagsBlock, "tag") : [];

    // Get mechanical effect (from prompt format)
    const mechanicalEffect = extractTag(block, "mechanical_effect") ?? "";

    // Parse weapon properties if present (legacy detailed format)
    const weaponBlock = extractTag(block, "weapon");
    const weapon = weaponBlock
      ? {
          damage: extractTag(weaponBlock, "damage") ?? "1d6",
          ability: (extractTag(weaponBlock, "ability") ?? "STR") as "STR" | "AGI" | "WIT" | "CON",
          properties: (() => {
            const propsBlock = extractTag(weaponBlock, "properties");
            return propsBlock ? extractAllTags(propsBlock, "property") : undefined;
          })(),
        }
      : kind === "weapon"
        ? {
            damage: "1d6",
            ability: "STR" as const,
            properties: undefined,
          }
        : undefined;

    // Parse armor properties if present
    const armorBlock = extractTag(block, "armor");
    const armor = armorBlock
      ? {
          damageReduction: extractOptionalInt(armorBlock, "damage_reduction") ?? 1,
          properties: (() => {
            const propsBlock = extractTag(armorBlock, "properties");
            return propsBlock ? extractAllTags(propsBlock, "property") : undefined;
          })(),
        }
      : kind === "armor"
        ? {
            damageReduction: 1,
            properties: undefined,
          }
        : undefined;

    // Parse consumable properties if present
    const consumableBlock = extractTag(block, "consumable");
    const consumable = consumableBlock
      ? {
          uses: extractOptionalInt(consumableBlock, "uses") ?? 1,
          effect: extractTag(consumableBlock, "effect") ?? "use",
          effectDescription: extractTag(consumableBlock, "effect_description") ?? mechanicalEffect,
        }
      : kind === "consumable"
        ? {
            uses: 1,
            effect: "use",
            effectDescription: mechanicalEffect,
          }
        : undefined;

    // Build description with mechanical effect if separate
    let description = extractTag(block, "description") ?? "";
    if (mechanicalEffect && !description.includes(mechanicalEffect)) {
      description = description ? `${description} ${mechanicalEffect}` : mechanicalEffect;
    }

    const item: WorldItem = {
      id: extractRequiredTag(block, "id"),
      name: extractRequiredTag(block, "name"),
      kind,
      description,
      // No fallback to <value>. Flavor is one-line evocative prose
      // (provenance, rumor, threat); value is rarity/price. Conflating
      // them filled flavor with strings like "Rare" — visible junk.
      flavor: extractTag(block, "flavor") ?? "",
      tags,
      slots: extractOptionalInt(block, "slots") ?? 1,
      weapon,
      armor,
      consumable,
    };

    // Validate against Zod schema
    return WorldItemSchema.parse(item);
  });
}
