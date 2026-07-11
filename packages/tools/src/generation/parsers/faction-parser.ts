/**
 * Faction XML Parser
 *
 * Parses XML output for factions into WorldFaction schema.
 * Aligned with world-generator.md prompt format.
 */

import { WorldFactionSchema, type WorldFaction } from "@mythxengine/worlds";
import { normalizeRef, normalizeRefs } from "../manifest-helpers.js";
import { extractRequiredTag, extractTag, extractAllTags } from "../xml-parser.js";

type Attitude = "hostile" | "unfriendly" | "neutral" | "friendly" | "allied";
const VALID_ATTITUDES: ReadonlySet<Attitude> = new Set([
  "hostile",
  "unfriendly",
  "neutral",
  "friendly",
  "allied",
]);

/**
 * Parse factions from XML output.
 *
 * Expected format (from world-generator.md prompt):
 * ```xml
 * <factions>
 * <faction>
 * <id>faction:slug-name</id>
 * <name>Display Name</name>
 * <description>Identity and purpose</description>
 * <goals><goal>What they want</goal></goals>
 * <resources><resource>Power they command</resource></resources>
 * <territory><location>location:where-they-operate</location></territory>
 * <key_members><npc>npc:leader-id</npc></key_members>
 * <relationships><relationship><faction_id>faction:other-id</faction_id><attitude>hostile|unfriendly|neutral|friendly|allied</attitude><reason>Why</reason></relationship></relationships>
 *
 * The inner relationship target tag is `<faction_id>` (not `<faction>`)
 * because the outer container is named `<faction>` and our non-greedy
 * regex would match outer-open to inner-close otherwise.
 * <hooks><hook>Plot hook</hook></hooks>
 * <secrets><secret>Hidden truth</secret></secrets>
 * </faction>
 * </factions>
 * ```
 */
export function parseFactionsXML(output: string): WorldFaction[] {
  const factionsBlock = extractRequiredTag(output, "factions");
  const factionBlocks = extractAllTags(factionsBlock, "faction");

  return factionBlocks.map((block) => {
    const goalsBlock = extractTag(block, "goals");
    const goals = goalsBlock ? extractAllTags(goalsBlock, "goal") : [];

    const resourcesBlock = extractTag(block, "resources");
    const resources = resourcesBlock ? extractAllTags(resourcesBlock, "resource") : [];

    const territoryBlock = extractTag(block, "territory");
    const territory = territoryBlock
      ? normalizeRefs(extractAllTags(territoryBlock, "location"), "location")
      : [];

    const keyMembersBlock = extractTag(block, "key_members");
    const keyMembers = keyMembersBlock
      ? normalizeRefs(extractAllTags(keyMembersBlock, "npc"), "npc")
      : [];

    const hooksBlock = extractTag(block, "hooks");
    const hooks = hooksBlock ? extractAllTags(hooksBlock, "hook") : [];

    const secretsBlock = extractTag(block, "secrets");
    const secrets = secretsBlock ? extractAllTags(secretsBlock, "secret") : [];

    // Relationships: a record keyed by other-faction-id
    // The relationship target ID MUST use the tag name <faction_id>, not
    // <faction>. The outer XML container is also named <faction>, and our
    // non-greedy regex in extractAllTags would match the outer open to the
    // inner close, truncating the entire faction block — by the time we get
    // here, the relationships block has already been clipped off. So this
    // isn't graceful degradation; it's a hard contract enforced by the
    // prompt and by the format of the XML itself.
    const relationshipsBlock = extractTag(block, "relationships");
    const relationships: WorldFaction["relationships"] = {};
    if (relationshipsBlock) {
      const relBlocks = extractAllTags(relationshipsBlock, "relationship");
      for (const relBlock of relBlocks) {
        const rawFactionId = extractTag(relBlock, "faction_id");
        const factionId = rawFactionId ? normalizeRef(rawFactionId, "faction") : undefined;
        const attitudeRaw = extractTag(relBlock, "attitude")?.toLowerCase().trim();
        const reason = extractTag(relBlock, "reason") ?? "";
        if (!factionId) continue;
        const attitude: Attitude = VALID_ATTITUDES.has(attitudeRaw as Attitude)
          ? (attitudeRaw as Attitude)
          : "neutral";
        relationships[factionId] = { attitude, reason };
      }
    }

    const faction: WorldFaction = {
      id: extractRequiredTag(block, "id"),
      name: extractRequiredTag(block, "name"),
      description: extractTag(block, "description") ?? "",
      goals,
      resources,
      territory,
      keyMembers,
      relationships,
      hooks,
      secrets,
    };

    return WorldFactionSchema.parse(faction);
  });
}
