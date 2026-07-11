/**
 * Monster XML Parser
 *
 * Parses XML output for monsters into WorldMonster schema.
 * Aligned with world-generator.md prompt format.
 */

import { WorldMonsterSchema, type WorldMonster } from "@mythxengine/worlds";
import {
  extractRequiredTag,
  extractTag,
  extractAllTags,
  extractOptionalInt,
  extractOptionalClampedInt,
} from "../xml-parser.js";

type Threat = "minion" | "standard" | "elite" | "boss";

/**
 * Parse monsters from XML output.
 *
 * Expected format (from world-generator.md prompt):
 * ```xml
 * <monsters>
 * <monster>
 * <id>monster:slug-name</id>
 * <name>Display Name</name>
 * <threat_tier>minion|standard|elite|boss</threat_tier>
 * <hp>8</hp>
 * <damage>1d6</damage>
 * <description>Appearance and behavior</description>
 * <tactics>How it fights</tactics>
 * <special_abilities><ability><name>Name</name><description>Effect</description></ability></special_abilities>
 * <loot><item>item:dropped-item</item></loot>
 * </monster>
 * </monsters>
 * ```
 */
export function parseMonstersXML(output: string): WorldMonster[] {
  const monstersBlock = extractRequiredTag(output, "monsters");
  const monsterBlocks = extractAllTags(monstersBlock, "monster");

  return monsterBlocks.map((block) => {
    // Parse abilities. Schema marks this optional — return undefined when
    // the LLM doesn't emit the block rather than fabricating an all-zero
    // stat row that reads as a real (but useless) entry. Within an emitted
    // block, individual stats default to 0 (clamped -3..3) since the LLM
    // sometimes omits a stat tag while emitting the rest.
    const abilitiesBlock = extractTag(block, "abilities");
    const abilities = abilitiesBlock
      ? {
          STR: extractOptionalClampedInt(abilitiesBlock, "str", -3, 3, 0),
          AGI: extractOptionalClampedInt(abilitiesBlock, "agi", -3, 3, 0),
          WIT: extractOptionalClampedInt(abilitiesBlock, "wit", -3, 3, 0),
          CON: extractOptionalClampedInt(abilitiesBlock, "con", -3, 3, 0),
        }
      : undefined;

    // Parse threat - try threat_tier first, then threat
    let threatRaw = extractTag(block, "threat_tier") ?? extractTag(block, "threat") ?? "standard";
    threatRaw = threatRaw.toLowerCase().trim();
    const threatMap: Record<string, Threat> = {
      minion: "minion",
      standard: "standard",
      elite: "elite",
      boss: "boss",
      normal: "standard",
      weak: "minion",
      strong: "elite",
    };
    const threat: Threat = threatMap[threatRaw] ?? "standard";

    // Parse HP
    const hp = extractOptionalInt(block, "hp") ?? 8;

    // Parse armor (optional, default to 0)
    const armor = extractOptionalInt(block, "armor") ?? 0;

    // Parse attacks - try explicit block or create from damage
    const attacksBlock = extractTag(block, "attacks");
    let attacks: {
      name: string;
      ability: "STR" | "AGI" | "WIT" | "CON";
      damage: string;
      properties?: string[];
      flavor: string;
    }[];

    if (attacksBlock) {
      attacks = extractAllTags(attacksBlock, "attack").map((attackBlock) => {
        const propsBlock = extractTag(attackBlock, "properties");
        const abilityRaw = (extractTag(attackBlock, "ability") ?? "STR").toUpperCase();
        return {
          name: extractTag(attackBlock, "name") ?? "Attack",
          ability: (["STR", "AGI", "WIT", "CON"].includes(abilityRaw) ? abilityRaw : "STR") as
            | "STR"
            | "AGI"
            | "WIT"
            | "CON",
          damage: extractTag(attackBlock, "damage") ?? "1d6",
          properties: propsBlock ? extractAllTags(propsBlock, "property") : undefined,
          flavor: extractTag(attackBlock, "flavor") ?? "",
        };
      });
    } else {
      // Create default attack from damage tag
      const damage = extractTag(block, "damage") ?? "1d6";
      const name = extractRequiredTag(block, "name");
      attacks = [
        {
          name: `${name} Attack`,
          ability: "STR" as const,
          damage,
          properties: undefined,
          flavor: "",
        },
      ];
    }

    // Parse special abilities - handle both formats
    const specialAbilitiesBlock = extractTag(block, "special_abilities");
    let specialAbilities: string[] = [];

    if (specialAbilitiesBlock) {
      // Try structured format first
      const abilityBlocks = extractAllTags(specialAbilitiesBlock, "ability");
      specialAbilities = abilityBlocks.map((ab) => {
        const name = extractTag(ab, "name");
        const desc = extractTag(ab, "description");
        if (name && desc) {
          return `${name}: ${desc}`;
        }
        return ab; // Plain text ability
      });
    }

    // Parse morale - try explicit block or use defaults
    const moraleBlock = extractTag(block, "morale");
    const morale = moraleBlock
      ? {
          threshold: extractOptionalInt(moraleBlock, "threshold") ?? 6,
          checkWhen: (extractTag(moraleBlock, "check_when") ?? "belowHalfHP") as
            | "belowHalfHP"
            | "allyDies"
            | "firstHit"
            | "never",
          fleesBelowHP: extractOptionalInt(moraleBlock, "flees_below_hp"),
        }
      : {
          threshold: 6,
          checkWhen: "belowHalfHP" as const,
          fleesBelowHP: undefined,
        };

    // Parse tactics - try explicit block or use description
    const tacticsBlock = extractTag(block, "tactics");
    const tacticsDesc = extractTag(block, "tactics");
    const tactics =
      tacticsBlock && extractTag(tacticsBlock, "preferred_range")
        ? {
            preferredRange: (extractTag(tacticsBlock, "preferred_range") ?? "melee") as
              | "melee"
              | "ranged"
              | "any",
            targetPriority: (extractTag(tacticsBlock, "target_priority") ?? "nearest") as
              | "weakest"
              | "strongest"
              | "nearest"
              | "random",
            specialBehavior: extractTag(tacticsBlock, "special_behavior"),
          }
        : {
            preferredRange: "melee" as const,
            targetPriority: "nearest" as const,
            specialBehavior: tacticsDesc || undefined,
          };

    const monster: WorldMonster = {
      id: extractRequiredTag(block, "id"),
      name: extractRequiredTag(block, "name"),
      description: extractTag(block, "description") ?? "",
      hp,
      armor,
      abilities,
      threat,
      attacks,
      specialAbilities,
      morale,
      tactics,
      // Behavioral intent on round 1. Optional in the schema so existing
      // packs don't fail to load; the prompt asks for it and the
      // validator surfaces missing values.
      firstAction: extractTag(block, "first_action") ?? undefined,
      lore: extractTag(block, "lore") ?? "",
      // No fallback to <description>. The two fields serve different
      // purposes — description is what the creature looks like,
      // encounter_text is the read-aloud-able beat when players first
      // see it. Empty stays empty so missing fields are visible.
      encounterText: extractTag(block, "encounter_text") ?? "",
      deathText: extractTag(block, "death_text") ?? "",
    };

    // Validate against Zod schema
    return WorldMonsterSchema.parse(monster);
  });
}
