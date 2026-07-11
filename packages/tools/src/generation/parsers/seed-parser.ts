/**
 * World Seed XML Parser
 *
 * Parses XML output for world seed into WorldSeed schema.
 *
 * IDs are deterministically generated from the LLM-emitted names via
 * `slugify`. The LLM should NOT emit `<id>` tags inside seed entries —
 * the prompt explicitly tells it not to. We strip any IDs the LLM
 * happens to emit and replace them with canonical `<prefix>:<slug>` IDs
 * so the downstream wave-1 / wave-2 generators have a stable manifest
 * to reference.
 */

import { WorldSeedSchema, type WorldSeed } from "@mythxengine/worlds";
import { slugify } from "../manifest-helpers.js";
import {
  extractRequiredTag,
  extractTag,
  extractAllTags,
  extractRequiredEnum,
  extractOptionalEnum,
} from "../xml-parser.js";

const LETHALITY_VALUES = ["low", "medium", "high", "brutal"] as const;
const MAGIC_LEVEL_VALUES = ["none", "rare", "common", "high"] as const;
const TECHNOLOGY_LEVEL_VALUES = [
  "primitive",
  "medieval",
  "renaissance",
  "industrial",
  "modern",
  "futuristic",
] as const;
const SUPERNATURAL_PRESENCE_VALUES = ["subtle", "common", "pervasive"] as const;
const THREAT_VALUES = ["minion", "standard", "elite", "boss"] as const;
const URGENCY_VALUES = ["low", "medium", "high", "critical"] as const;
const STRUCTURE_VALUES = ["funnel", "layer_cake", "hub_spoke", "chain", "web"] as const;
const ITEM_KIND_VALUES = ["weapon", "armor", "consumable", "tool", "treasure"] as const;
const ENCOUNTER_TYPE_VALUES = ["combat", "social", "exploration", "puzzle"] as const;

/**
 * Build a canonical ID for a seed entry.
 *
 * Names are uniquified by appending `-2`, `-3`, ... when the same slug
 * appears more than once within a domain — duplicate names from the
 * LLM shouldn't collapse into a single manifest entry.
 */
function makeIdAllocator(prefix: string): (name: string) => string {
  const seen = new Map<string, number>();
  return (name: string) => {
    const baseSlug = slugify(name) || "unnamed";
    const count = (seen.get(baseSlug) ?? 0) + 1;
    seen.set(baseSlug, count);
    const slug = count === 1 ? baseSlug : `${baseSlug}-${count}`;
    return `${prefix}:${slug}`;
  };
}

/**
 * Parse a world seed from XML output.
 *
 * The seed must contain seed lists for ALL nine domains (archetypes,
 * locations, npcs, monsters, items, encounters, factions, situations,
 * arcs). Empty lists are tolerated by the parser but will cause the
 * seed retry loop to fire (see generateSeedNode).
 */
export function parseSeedXML(output: string, campaignSeed: string): WorldSeed {
  const seedBlock = extractRequiredTag(output, "seed");

  // Parse aesthetic
  const aestheticBlock = extractRequiredTag(seedBlock, "aesthetic");
  const aesthetic = {
    visualStyle: extractRequiredTag(aestheticBlock, "visual_style"),
    tone: extractRequiredTag(aestheticBlock, "tone"),
    themes: extractAllTags(extractRequiredTag(aestheticBlock, "themes"), "theme"),
    inspirations: extractAllTags(extractRequiredTag(aestheticBlock, "inspirations"), "inspiration"),
  };

  // Parse settings
  const settingsBlock = extractRequiredTag(seedBlock, "settings");
  const settings = {
    lethality: extractRequiredEnum(settingsBlock, "lethality", LETHALITY_VALUES),
    magicLevel: extractRequiredEnum(settingsBlock, "magic_level", MAGIC_LEVEL_VALUES),
    technologyLevel: extractRequiredEnum(
      settingsBlock,
      "technology_level",
      TECHNOLOGY_LEVEL_VALUES
    ),
    supernaturalPresence: extractRequiredEnum(
      settingsBlock,
      "supernatural_presence",
      SUPERNATURAL_PRESENCE_VALUES
    ),
  };

  // Helper for the simple {name, concept} domains (archetypes, locations,
  // npcs, factions). Each domain gets its own ID allocator so dedup is
  // scoped to the domain. Concept is descriptive and the LLM occasionally
  // omits it — accept empty rather than failing the whole seed.
  const parseSimpleSeeds = (
    block: string | undefined,
    childTag: string,
    prefix: string
  ): Array<{ id: string; name: string; concept: string }> => {
    if (!block) return [];
    const allocId = makeIdAllocator(prefix);
    return extractAllTags(block, childTag).map((entry) => {
      const name = extractRequiredTag(entry, "name");
      return {
        id: allocId(name),
        name,
        concept: extractTag(entry, "concept") ?? "",
      };
    });
  };

  const archetypeSeeds = parseSimpleSeeds(
    extractTag(seedBlock, "archetype_seeds"),
    "archetype",
    "archetype"
  );
  const locationSeeds = parseSimpleSeeds(
    extractTag(seedBlock, "location_seeds"),
    "location",
    "location"
  );
  const npcSeeds = parseSimpleSeeds(extractTag(seedBlock, "npc_seeds"), "npc", "npc");
  const factionSeeds = parseSimpleSeeds(
    extractTag(seedBlock, "faction_seeds"),
    "faction",
    "faction"
  );

  // Monsters carry threat tier
  const monsterSeedsBlock = extractTag(seedBlock, "monster_seeds");
  const allocMonster = makeIdAllocator("monster");
  const monsterSeeds = monsterSeedsBlock
    ? extractAllTags(monsterSeedsBlock, "monster").map((entry) => {
        const name = extractRequiredTag(entry, "name");
        return {
          id: allocMonster(name),
          name,
          concept: extractTag(entry, "concept") ?? "",
          threat: extractRequiredEnum(entry, "threat", THREAT_VALUES),
        };
      })
    : [];

  // Items carry kind (concept is replaced by kind for items — they're
  // mechanical rather than narrative entities, so a category label is
  // more useful than a sentence)
  const itemSeedsBlock = extractTag(seedBlock, "item_seeds");
  const allocItem = makeIdAllocator("item");
  const itemSeeds = itemSeedsBlock
    ? extractAllTags(itemSeedsBlock, "item").map((entry) => {
        const name = extractRequiredTag(entry, "name");
        return {
          id: allocItem(name),
          name,
          kind: extractOptionalEnum(entry, "kind", ITEM_KIND_VALUES),
        };
      })
    : [];

  // Encounters carry type
  const encounterSeedsBlock = extractTag(seedBlock, "encounter_seeds");
  const allocEncounter = makeIdAllocator("encounter");
  const encounterSeeds = encounterSeedsBlock
    ? extractAllTags(encounterSeedsBlock, "encounter").map((entry) => {
        const name = extractRequiredTag(entry, "name");
        return {
          id: allocEncounter(name),
          name,
          concept: extractTag(entry, "concept") ?? "",
          type: extractOptionalEnum(entry, "type", ENCOUNTER_TYPE_VALUES),
        };
      })
    : [];

  // Situations carry urgency
  const situationSeedsBlock = extractTag(seedBlock, "situation_seeds");
  const allocSituation = makeIdAllocator("situation");
  const situationSeeds = situationSeedsBlock
    ? extractAllTags(situationSeedsBlock, "situation").map((entry) => {
        const name = extractRequiredTag(entry, "name");
        return {
          id: allocSituation(name),
          name,
          concept: extractTag(entry, "concept") ?? "",
          urgency: extractOptionalEnum(entry, "urgency", URGENCY_VALUES),
        };
      })
    : [];

  // Arcs carry structure
  const arcSeedsBlock = extractTag(seedBlock, "arc_seeds");
  const allocArc = makeIdAllocator("arc");
  const arcSeeds = arcSeedsBlock
    ? extractAllTags(arcSeedsBlock, "arc").map((entry) => {
        const name = extractRequiredTag(entry, "name");
        return {
          id: allocArc(name),
          name,
          concept: extractTag(entry, "concept") ?? "",
          structure: extractOptionalEnum(entry, "structure", STRUCTURE_VALUES),
        };
      })
    : [];

  const seed: WorldSeed = {
    id: extractRequiredTag(seedBlock, "id"),
    name: extractRequiredTag(seedBlock, "name"),
    tagline: extractRequiredTag(seedBlock, "tagline"),
    campaignSeed,
    aesthetic,
    settings,
    coreConflict: extractRequiredTag(seedBlock, "core_conflict"),
    archetypeSeeds,
    locationSeeds,
    npcSeeds,
    monsterSeeds,
    itemSeeds,
    encounterSeeds,
    factionSeeds,
    situationSeeds,
    arcSeeds,
    createdAt: new Date().toISOString(),
  };

  return WorldSeedSchema.parse(seed);
}
