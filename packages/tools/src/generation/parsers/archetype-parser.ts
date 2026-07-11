/**
 * Archetype XML Parser
 *
 * Parses XML output for archetypes into WorldArchetype schema.
 * Aligned with world-generator.md prompt format.
 */

import { WorldArchetypeSchema, type WorldArchetype } from "@mythxengine/worlds";
import { normalizeRefs } from "../manifest-helpers.js";
import {
  extractRequiredTag,
  extractTag,
  extractAllTags,
  extractOptionalInt,
  extractOptionalClampedInt,
} from "../xml-parser.js";

/**
 * Parse archetypes from XML output.
 *
 * Expected format (from world-generator.md prompt):
 * ```xml
 * <archetypes>
 * <archetype>
 * <id>archetype:slug-name</id>
 * <name>Display Name</name>
 * <tagline>One-line concept</tagline>
 * <role>striker|defender|support|controller</role>
 * <abilities><str>0</str><agi>0</agi><wit>0</wit><con>0</con></abilities>
 * <hp_base>6</hp_base>
 * <starting_gear><item>Item 1</item><item>Item 2</item></starting_gear>
 * <special_ability><name>Ability Name</name><description>What it does</description></special_ability>
 * <background_hooks><hook>Hook 1</hook><hook>Hook 2</hook></background_hooks>
 * </archetype>
 * </archetypes>
 * ```
 */
export function parseArchetypesXML(output: string): WorldArchetype[] {
  const archetypesBlock = extractRequiredTag(output, "archetypes");
  const archetypeBlocks = extractAllTags(archetypesBlock, "archetype");

  return archetypeBlocks.map((block) => {
    // Parse abilities - can be at top level or nested in <starting>
    let abilitiesBlock = extractTag(block, "abilities");
    if (!abilitiesBlock) {
      const startingBlock = extractTag(block, "starting");
      if (startingBlock) {
        abilitiesBlock = extractTag(startingBlock, "abilities");
      }
    }

    // Parse abilities - each stat is optional with default 0, clamped to -3..3
    const abilities = abilitiesBlock
      ? {
          STR: extractOptionalClampedInt(abilitiesBlock, "str", -3, 3, 0),
          AGI: extractOptionalClampedInt(abilitiesBlock, "agi", -3, 3, 0),
          WIT: extractOptionalClampedInt(abilitiesBlock, "wit", -3, 3, 0),
          CON: extractOptionalClampedInt(abilitiesBlock, "con", -3, 3, 0),
        }
      : { STR: 0, AGI: 0, WIT: 0, CON: 0 };

    // Parse HP - try hp_base, then hp, then max_hp, then default
    const hpBase =
      extractOptionalInt(block, "hp_base") ??
      extractOptionalInt(block, "hp") ??
      extractOptionalInt(block, "max_hp") ??
      6;

    const starting = {
      abilities,
      hp: hpBase,
      maxHp: hpBase,
    };

    // Parse starting items - try starting_gear first, then starting_items.
    // Normalize prefix in case the model emits bare slugs.
    let startingItemsBlock = extractTag(block, "starting_gear");
    if (!startingItemsBlock) {
      startingItemsBlock = extractTag(block, "starting_items");
    }
    const startingItems = startingItemsBlock
      ? normalizeRefs(extractAllTags(startingItemsBlock, "item"), "item")
      : [];

    // Parse features - try special_ability first, then features
    const specialAbilityBlock = extractTag(block, "special_ability");
    const featuresBlock = extractTag(block, "features");

    let features: { id: string; name: string; description: string }[] = [];

    if (specialAbilityBlock) {
      const name = extractTag(specialAbilityBlock, "name") ?? "Special Ability";
      const description = extractTag(specialAbilityBlock, "description") ?? "";
      const id = extractTag(block, "id") ?? "archetype:unknown";
      features = [
        {
          id: `feature:${id.replace("archetype:", "")}-special`,
          name,
          description,
        },
      ];
    } else if (featuresBlock) {
      features = extractAllTags(featuresBlock, "feature").map((featureBlock, idx) => ({
        id: extractTag(featureBlock, "id") ?? `feature:unknown-${idx}`,
        name: extractTag(featureBlock, "name") ?? "Unknown Feature",
        description: extractTag(featureBlock, "description") ?? "",
      }));
    }

    // Parse background hooks
    const hooksBlock = extractTag(block, "background_hooks");
    const hooks = hooksBlock ? extractAllTags(hooksBlock, "hook") : [];

    // Build archetype with flexible field extraction
    const archetype: WorldArchetype = {
      id: extractRequiredTag(block, "id"),
      name: extractRequiredTag(block, "name"),
      tagline: extractTag(block, "tagline") ?? extractTag(block, "role") ?? "",
      description: extractTag(block, "description") ?? "",
      starting,
      startingItems,
      features,
      playstyle: extractTag(block, "playstyle") ?? extractTag(block, "role") ?? "",
      background: extractTag(block, "background") ?? hooks.join(" "),
      flavor: extractTag(block, "flavor") ?? "",
    };

    // Validate against Zod schema
    return WorldArchetypeSchema.parse(archetype);
  });
}
