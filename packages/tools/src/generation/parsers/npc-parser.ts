/**
 * NPC XML Parser
 *
 * Parses XML output for NPCs into WorldNPC schema.
 * Aligned with world-generator.md prompt format.
 */

import { WorldNPCSchema, type WorldNPC } from "@mythxengine/worlds";
import { normalizeRef, normalizeRefs } from "../manifest-helpers.js";
import { extractRequiredTag, extractTag, extractAllTags } from "../xml-parser.js";

type Attitude = "friendly" | "neutral" | "hostile" | "unknown";
type NarrativeRole =
  | "quest_giver"
  | "ally"
  | "obstacle"
  | "information"
  | "antagonist"
  | "merchant"
  | "background";

/**
 * Parse NPCs from XML output.
 *
 * Expected format (from world-generator.md prompt):
 * ```xml
 * <npcs>
 * <npc>
 * <id>npc:slug-name</id>
 * <name>Full Name</name>
 * <role>Their function in the world</role>
 * <description>Physical appearance</description>
 * <personality>How they act</personality>
 * <motivation>What they want</motivation>
 * <location>location:where-found</location>
 * <secrets><secret>Hidden information</secret></secrets>
 * <connections><connection>npc:other-id</connection></connections>
 * </npc>
 * </npcs>
 * ```
 */
export function parseNPCsXML(output: string): WorldNPC[] {
  const npcsBlock = extractRequiredTag(output, "npcs");
  const npcBlocks = extractAllTags(npcsBlock, "npc");

  return npcBlocks.map((block) => {
    // Parse attitude - try explicit tag, then infer from role
    let attitudeRaw = extractTag(block, "attitude");
    if (!attitudeRaw) {
      const role = extractTag(block, "role") ?? "";
      // Infer attitude from role/personality
      const roleLower = role.toLowerCase();
      if (
        roleLower.includes("enemy") ||
        roleLower.includes("villain") ||
        roleLower.includes("antagonist")
      ) {
        attitudeRaw = "hostile";
      } else if (
        roleLower.includes("ally") ||
        roleLower.includes("friend") ||
        roleLower.includes("helper")
      ) {
        attitudeRaw = "friendly";
      } else {
        attitudeRaw = "neutral";
      }
    }
    const attitude: Attitude = (
      ["friendly", "neutral", "hostile", "unknown"].includes(attitudeRaw) ? attitudeRaw : "neutral"
    ) as Attitude;

    // Parse narrative role - try explicit tag, then infer from role description
    let narrativeRoleRaw = extractTag(block, "narrative_role");
    if (!narrativeRoleRaw) {
      const role = (extractTag(block, "role") ?? "").toLowerCase();
      if (role.includes("quest") || role.includes("mission")) {
        narrativeRoleRaw = "quest_giver";
      } else if (role.includes("merchant") || role.includes("shop") || role.includes("vendor")) {
        narrativeRoleRaw = "merchant";
      } else if (role.includes("ally") || role.includes("friend")) {
        narrativeRoleRaw = "ally";
      } else if (
        role.includes("enemy") ||
        role.includes("villain") ||
        role.includes("antagonist")
      ) {
        narrativeRoleRaw = "antagonist";
      } else if (role.includes("info") || role.includes("knowledge") || role.includes("sage")) {
        narrativeRoleRaw = "information";
      } else if (role.includes("obstacle") || role.includes("guard") || role.includes("blocker")) {
        narrativeRoleRaw = "obstacle";
      } else {
        narrativeRoleRaw = "background";
      }
    }
    const narrativeRole: NarrativeRole = (
      [
        "quest_giver",
        "ally",
        "obstacle",
        "information",
        "antagonist",
        "merchant",
        "background",
      ].includes(narrativeRoleRaw)
        ? narrativeRoleRaw
        : "background"
    ) as NarrativeRole;

    // Parse dialogue hints. No fallback to personality — wrapping the
    // personality string in *...* and calling it a dialogue hint just
    // hides the fact that the LLM didn't emit any. Empty stays empty
    // so the prompt requirement is enforced through visibility, not
    // patched over silently.
    const dialogueHintsBlock = extractTag(block, "dialogue_hints");
    const dialogueHints = dialogueHintsBlock
      ? extractAllTags(dialogueHintsBlock, "hint")
          .map((h) => h.trim())
          .filter((h) => h.length > 0)
      : [];

    // Parse locations - try both location (singular) and locations
    const locationsBlock = extractTag(block, "locations");
    const singleLocation = extractTag(block, "location");
    let locations: string[] | undefined;
    if (locationsBlock) {
      locations = normalizeRefs(extractAllTags(locationsBlock, "location"), "location");
    } else if (singleLocation) {
      locations = [normalizeRef(singleLocation, "location")];
    }

    // Parse relationships. The schema is `Record<string, string>` —
    // keyed by other-NPC ID, value is the narrative tie ("uses Aldric
    // as an informant; Aldric resents the leverage"). Requires the
    // structured <relationship><id>...</id><description>...</description>
    // form. The legacy <connections> shorthand has been retired —
    // value-less connections produced uniform "Connected" strings that
    // the UI faithfully rendered as junk.
    const relationshipsBlock = extractTag(block, "relationships");
    let relationships: Record<string, string> | undefined;

    if (relationshipsBlock) {
      relationships = extractAllTags(relationshipsBlock, "relationship").reduce(
        (acc, relBlock) => {
          const rawId = extractTag(relBlock, "id")?.trim();
          const description = extractTag(relBlock, "description")?.trim();
          if (rawId && description) {
            // Normalize bare slugs ("thug") to npc-prefixed IDs ("npc:thug")
            // to keep relationship keys consistent with the rest of the
            // ID graph. Downstream lookup code expects the "npc:" prefix
            // because this map is documented as NPC-to-NPC ties; reject
            // anything that isn't a real npc:* ID, including the bare
            // "npc:" sentinel that normalizeRef returns for empty input
            // and stray cross-domain IDs like "location:foo" that the
            // model might emit by mistake.
            const id = normalizeRef(rawId, "npc");
            if (id?.startsWith("npc:") && id !== "npc:") acc[id] = description;
          }
          return acc;
        },
        {} as Record<string, string>
      );
    }

    // Parse secrets
    const secretsBlock = extractTag(block, "secrets");
    const secrets = secretsBlock ? extractAllTags(secretsBlock, "secret") : undefined;

    // Parse motivation. Prefer the structured triad form
    // (<motivation><want><fear><lie>); fall back to a flat string when
    // no triad tags are present. The schema accepts `string | { want,
    // fear, lie }` precisely so legacy consumers (gm-guidance/helpers
    // etc.) that interpolate motivation directly continue to render —
    // auto-wrapping flat strings into an object here would surface as
    // `[object Object]` until every consumer migrates.
    const motivationBlock = extractTag(block, "motivation") ?? "";
    const wantTag = extractTag(motivationBlock, "want");
    const fearTag = extractTag(motivationBlock, "fear");
    const lieTag = extractTag(motivationBlock, "lie");
    const motivation =
      wantTag !== undefined || fearTag !== undefined || lieTag !== undefined
        ? { want: wantTag ?? "", fear: fearTag ?? "", lie: lieTag ?? "" }
        : motivationBlock.trim();

    const npc: WorldNPC = {
      id: extractRequiredTag(block, "id"),
      name: extractRequiredTag(block, "name"),
      description: extractTag(block, "description") ?? "",
      personality: extractTag(block, "personality") ?? "",
      motivation,
      attitude,
      dialogueHints,
      narrativeRole,
      locations,
      relationships:
        relationships && Object.keys(relationships).length > 0 ? relationships : undefined,
      secrets: secrets && secrets.length > 0 ? secrets : undefined,
    };

    // Validate against Zod schema
    return WorldNPCSchema.parse(npc);
  });
}
