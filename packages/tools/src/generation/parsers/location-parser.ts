/**
 * Location XML Parser
 *
 * Parses XML output for locations into WorldLocation schema.
 * Aligned with world-generator.md prompt format.
 */

import { WorldLocationSchema, type WorldLocation } from "@mythxengine/worlds";
import { normalizeRef, normalizeRefs } from "../manifest-helpers.js";
import { extractRequiredTag, extractTag, extractAllTags } from "../xml-parser.js";

const _LOCATION_TYPE_VALUES = [
  "settlement",
  "dungeon",
  "wilderness",
  "landmark",
  "building",
] as const;
type LocationType = (typeof _LOCATION_TYPE_VALUES)[number];

/**
 * Parse locations from XML output.
 *
 * Expected format (from world-generator.md prompt):
 * ```xml
 * <locations>
 * <location>
 * <id>location:slug-name</id>
 * <name>Display Name</name>
 * <type>urban|wilderness|dungeon|building</type>
 * <description>Physical description and atmosphere</description>
 * <atmosphere>Sensory details</atmosphere>
 * <connections><connection>location:other-id</connection></connections>
 * <features><feature>Notable feature</feature></features>
 * <hazards><hazard>Environmental danger</hazard></hazards>
 * <secrets><secret>Hidden information</secret></secrets>
 * </location>
 * </locations>
 * ```
 */
export function parseLocationsXML(output: string): WorldLocation[] {
  const locationsBlock = extractRequiredTag(output, "locations");
  const locationBlocks = extractAllTags(locationsBlock, "location");

  return locationBlocks.map((block) => {
    // Parse type with mapping for prompt values
    let typeRaw = extractTag(block, "type") ?? "landmark";
    typeRaw = typeRaw.toLowerCase().trim();

    // Map prompt values to schema values
    const typeMap: Record<string, LocationType> = {
      urban: "settlement",
      city: "settlement",
      town: "settlement",
      village: "settlement",
      settlement: "settlement",
      dungeon: "dungeon",
      cave: "dungeon",
      ruin: "dungeon",
      wilderness: "wilderness",
      forest: "wilderness",
      mountain: "wilderness",
      plains: "wilderness",
      landmark: "landmark",
      building: "building",
      tavern: "building",
      shop: "building",
      temple: "building",
    };
    const locationType: LocationType = typeMap[typeRaw] ?? "landmark";

    // Parse features
    const featuresBlock = extractTag(block, "features");
    const features = featuresBlock ? extractAllTags(featuresBlock, "feature") : [];

    // Parse hazards and add to features
    const hazardsBlock = extractTag(block, "hazards");
    const hazards = hazardsBlock
      ? extractAllTags(hazardsBlock, "hazard").map((h) => `Hazard: ${h}`)
      : [];

    // Parse connections. Prefer the structured form with travel narrative
    // (<connection><to>...</to><travel>...</travel><observation>...</observation>
    // <risk>...</risk></connection>); fall back to flat ID strings for
    // legacy / model-omitted-structure cases. Schema accepts both.
    const connectionsBlock = extractTag(block, "connections");
    const connectionElems = connectionsBlock ? extractAllTags(connectionsBlock, "connection") : [];
    const connections: WorldLocation["connections"] = connectionElems.map((el) => {
      const toTag = extractTag(el, "to");
      // Detect the structured form by tag presence, not truthiness:
      // an empty `<to></to>` returns "" and would otherwise fall through
      // to the flat-string branch, which would try to normalize the
      // entire XML fragment as a location ID — turning a recoverable
      // validation problem into a malformed cross-reference.
      if (toTag !== undefined) {
        return {
          to: normalizeRef(toTag, "location"),
          travel: extractTag(el, "travel") ?? "",
          observation: extractTag(el, "observation") ?? undefined,
          risk: extractTag(el, "risk") ?? undefined,
        };
      }
      // Flat-string form: the entire <connection>...</connection> body
      // is just the ID.
      return normalizeRef(el.trim(), "location");
    });

    // Parse encounters
    const encountersBlock = extractTag(block, "encounters");
    const encounters = encountersBlock
      ? normalizeRefs(extractAllTags(encountersBlock, "encounter"), "encounter")
      : [];

    // Parse NPCs
    const npcsBlock = extractTag(block, "npcs");
    const npcs = npcsBlock ? normalizeRefs(extractAllTags(npcsBlock, "npc"), "npc") : [];

    // Parse secrets (optional)
    const secretsBlock = extractTag(block, "secrets");
    const secrets = secretsBlock ? extractAllTags(secretsBlock, "secret") : undefined;

    const location: WorldLocation = {
      id: extractRequiredTag(block, "id"),
      name: extractRequiredTag(block, "name"),
      description: extractTag(block, "description") ?? "",
      type: locationType,
      atmosphere: extractTag(block, "atmosphere") ?? "",
      features: [...features, ...hazards],
      connections,
      encounters,
      npcs,
      secrets,
      gmNotes: extractTag(block, "gm_notes"),
    };

    // Validate against Zod schema
    return WorldLocationSchema.parse(location);
  });
}
