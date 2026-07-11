/**
 * Encounter XML Parser
 *
 * Parses XML output for encounters into WorldEncounter schema.
 * Aligned with world-generator.md prompt format.
 *
 * Contract: encounters use type-specific structured blocks (`<combat>`,
 * `<social>`, `<event>`). The legacy `<participants>` mixed-domain list
 * has been removed — it forced us to pattern-match prefixes to recover
 * what kind of entity each entry was, which broke when models emitted
 * bare slugs. The structured form makes the domain explicit at the
 * source.
 */

import { WorldEncounterSchema, type WorldEncounter } from "@mythxengine/worlds";
import { normalizeRef, normalizeRefs } from "../manifest-helpers.js";
import {
  extractRequiredTag,
  extractTag,
  extractAllTags,
  extractOptionalInt,
  extractBoolean,
} from "../xml-parser.js";

// Derive EncounterType from schema to stay in sync
type EncounterType = WorldEncounter["type"];

// Valid attitudes for social encounters
const validAttitudes = ["hostile", "unfriendly", "neutral", "friendly", "allied"] as const;
type Attitude = (typeof validAttitudes)[number];

function parseAttitude(value?: string): Attitude {
  if (!value) return "neutral";
  const normalized = value.toLowerCase().trim();
  return validAttitudes.includes(normalized as Attitude) ? (normalized as Attitude) : "neutral";
}

// Valid ability scores
const validAbilities = ["STR", "AGI", "WIT", "CON"] as const;
type Ability = (typeof validAbilities)[number];

function parseAbility(value?: string): Ability {
  if (!value) return "WIT";
  const normalized = value.toUpperCase().trim();
  return validAbilities.includes(normalized as Ability) ? (normalized as Ability) : "WIT";
}

/**
 * Parse encounters from XML output.
 *
 * Expected format (from world-generator.md prompt):
 * ```xml
 * <encounters>
 * <encounter>
 *   <id>encounter:slug-name</id>
 *   <name>Display Name</name>
 *   <type>combat|social|exploration|puzzle|event</type>
 *   <description>What happens</description>
 *   <text>Narrative text</text>
 *   <gm_guidance>...</gm_guidance>
 *   <outcomes><outcome>...</outcome></outcomes>
 *
 *   <!-- ONE of <combat>, <social>, <event> based on type -->
 *   <combat>
 *     <monsters><monster><monster_id>monster:slug</monster_id><count>3</count></monster></monsters>
 *     <surprise>none|enemies|party</surprise>
 *   </combat>
 *
 *   <social>
 *     <npcs><npc_id>npc:slug</npc_id></npcs>
 *     <initial_attitude>...</initial_attitude>
 *     <negotiable>true|false</negotiable>
 *   </social>
 *
 *   <event>
 *     <choices><choice>...</choice></choices>
 *   </event>
 * </encounter>
 * </encounters>
 * ```
 */
export function parseEncountersXML(output: string): WorldEncounter[] {
  const encountersBlock = extractRequiredTag(output, "encounters");
  const encounterBlocks = extractAllTags(encountersBlock, "encounter");

  return encounterBlocks.map((block) => {
    // Parse type with mapping to schema-supported values
    const typeRaw = (extractTag(block, "type") ?? "event").toLowerCase().trim();
    const typeMap: Record<string, EncounterType> = {
      combat: "combat",
      social: "social",
      exploration: "event",
      puzzle: "event",
      event: "event",
    };
    const type: EncounterType = typeMap[typeRaw] ?? "event";

    // Parse outcomes (with <rewards> as a backwards-compat alias for the
    // semantically similar concept — kept because it's parser-side
    // forgiveness, not a domain ambiguity)
    const outcomesBlock = extractTag(block, "outcomes");
    const rewardsBlock = extractTag(block, "rewards");
    let outcomes: string[] = [];
    if (outcomesBlock) {
      outcomes = extractAllTags(outcomesBlock, "outcome");
    } else if (rewardsBlock) {
      outcomes = extractAllTags(rewardsBlock, "reward");
    }

    // Type ↔ block mapping is strict: only read the block matching the
    // encounter's declared type. Stray blocks of other types are ignored.
    // This enforces the "exactly one typed block" contract from the prompt
    // and prevents mixed-shape data when models hedge by emitting multiple.
    let combat: WorldEncounter["combat"];
    let social: WorldEncounter["social"];
    let event: WorldEncounter["event"];

    if (type === "combat") {
      const combatBlock = extractTag(block, "combat");
      if (combatBlock) {
        const monstersListBlock = extractTag(combatBlock, "monsters") ?? "";
        const monsters: { monsterId: string; count: number | string }[] = [];
        for (const monsterBlock of extractAllTags(monstersListBlock, "monster")) {
          // Require an explicit <monster_id> — the surrounding XML fragment
          // is not a valid fallback (could be "\n<count>3</count>\n").
          const rawMonsterId = extractTag(monsterBlock, "monster_id");
          if (!rawMonsterId) continue;
          const monsterId = normalizeRef(rawMonsterId, "monster");
          if (!monsterId) continue;
          const countStr = extractTag(monsterBlock, "count") ?? "1";
          const num = parseInt(countStr, 10);
          monsters.push({
            monsterId,
            count: (isNaN(num) ? countStr : num) as number | string,
          });
        }
        const surpriseRaw = extractTag(combatBlock, "surprise")?.toLowerCase().trim();
        const surprise =
          surpriseRaw === "enemies" || surpriseRaw === "party" || surpriseRaw === "none"
            ? surpriseRaw
            : undefined;
        combat = { monsters, surprise, environment: undefined };
      }
    } else if (type === "social") {
      const socialBlock = extractTag(block, "social");
      if (socialBlock) {
        const npcsListBlock = extractTag(socialBlock, "npcs") ?? "";
        social = {
          npcIds: normalizeRefs(extractAllTags(npcsListBlock, "npc_id"), "npc"),
          initialAttitude: parseAttitude(extractTag(socialBlock, "initial_attitude")),
          negotiable: extractBoolean(socialBlock, "negotiable", true),
        };
      }
    } else if (type === "event") {
      // Event-type encounters require non-empty `choices` to satisfy Zod.
      // Try the structured form; fall back to a synthesized "investigate"
      // choice when the block is missing OR present-but-empty.
      const eventBlock = extractTag(block, "event");
      let parsedChoices: NonNullable<WorldEncounter["event"]>["choices"] = [];
      if (eventBlock) {
        const choicesListBlock = extractTag(eventBlock, "choices") ?? "";
        parsedChoices = extractAllTags(choicesListBlock, "choice").map((choiceBlock) => {
          const testBlock = extractTag(choiceBlock, "test");
          return {
            text: extractTag(choiceBlock, "text") ?? "",
            test: testBlock
              ? {
                  ability: parseAbility(extractTag(testBlock, "ability")),
                  difficulty: extractOptionalInt(testBlock, "difficulty") ?? 10,
                }
              : undefined,
            successOutcome: extractTag(choiceBlock, "success_outcome") ?? "Success",
            // Schema now requires failureOutcome (fail-forward). When the
            // model omits it, fall back to a fiction-advancing sentinel
            // rather than undefined so the pack stays loadable. The
            // validator will surface absent/blocking failureOutcomes as
            // quality issues at assemble time.
            failureOutcome:
              extractTag(choiceBlock, "failure_outcome") ??
              "You learn something costly: the situation shifts and a new complication arises.",
          };
        });
      }
      event = {
        choices:
          parsedChoices.length > 0
            ? parsedChoices
            : [
                {
                  text: "Investigate",
                  test: undefined,
                  successOutcome: outcomes[0] ?? "You succeed",
                  failureOutcome:
                    "You uncover a partial truth at a cost — time passes, attention shifts, and a new pressure enters the scene.",
                },
              ],
      };
    }

    const description = extractTag(block, "description") ?? "";
    const text = extractTag(block, "text") ?? description;
    const triggersBlock = extractTag(block, "triggers");
    const triggers = triggersBlock ? extractAllTags(triggersBlock, "trigger") : [];
    const gmGuidance =
      extractTag(block, "gm_guidance") ??
      (triggers.length > 0 ? triggers.join(". ") : "Run as written.");

    const encounter: WorldEncounter = {
      id: extractRequiredTag(block, "id"),
      name: extractRequiredTag(block, "name"),
      type,
      description,
      text,
      gmGuidance,
      outcomes: outcomes.length > 0 ? outcomes : ["Players succeed", "Players fail"],
      combat,
      event,
      social,
    };

    return WorldEncounterSchema.parse(encounter);
  });
}
