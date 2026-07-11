/**
 * Arc XML Parser
 *
 * Parses XML output for arcs into WorldArc schema.
 * Aligned with world-generator.md prompt format.
 */

import { WorldArcSchema, type WorldArc } from "@mythxengine/worlds";
import { normalizeRef, normalizeRefs } from "../manifest-helpers.js";
import { extractRequiredTag, extractTag, extractAllTags } from "../xml-parser.js";

type Status = "dormant" | "foreshadowed" | "active" | "climax" | "resolved";
type StructureType = "funnel" | "layer_cake" | "hub_spoke" | "chain" | "web";

/**
 * Parse arcs from XML output.
 *
 * Expected format (from world-generator.md prompt):
 * ```xml
 * <arcs>
 * <arc>
 * <id>arc:slug-name</id>
 * <name>Display Name</name>
 * <structure_type>linear|branching|sandbox</structure_type>
 * <theme>Central theme</theme>
 * <situations><situation_ref>situation:id-1</situation_ref><situation_ref>situation:id-2</situation_ref></situations>
 * <climax>situation:final-situation</climax>
 * </arc>
 * </arcs>
 * ```
 */
export function parseArcsXML(output: string): WorldArc[] {
  const arcsBlock = extractRequiredTag(output, "arcs");
  const arcBlocks = extractAllTags(arcsBlock, "arc");

  return arcBlocks.map((block) => {
    // Parse status - default to active
    let statusRaw = extractTag(block, "status") ?? "active";
    statusRaw = statusRaw.toLowerCase().trim();
    const statusMap: Record<string, Status> = {
      dormant: "dormant",
      foreshadowed: "foreshadowed",
      active: "active",
      climax: "climax",
      resolved: "resolved",
    };
    const status: Status = statusMap[statusRaw] ?? "active";

    // Parse structure type - map prompt values to schema values
    let structureTypeRaw =
      extractTag(block, "structure_type") ?? extractTag(block, "type") ?? "chain";
    structureTypeRaw = structureTypeRaw.toLowerCase().trim();
    const structureTypeMap: Record<string, StructureType> = {
      linear: "chain",
      branching: "funnel",
      sandbox: "hub_spoke",
      funnel: "funnel",
      layer_cake: "layer_cake",
      hub_spoke: "hub_spoke",
      chain: "chain",
      web: "web",
    };
    const structureType: StructureType = structureTypeMap[structureTypeRaw] ?? "chain";

    // Parse situation IDs - try multiple formats
    let situationIds: string[] = [];
    const situationsBlock = extractTag(block, "situations");
    const situationIdsBlock = extractTag(block, "situation_ids");

    if (situationIdsBlock) {
      situationIds = extractAllTags(situationIdsBlock, "situation_id");
    } else if (situationsBlock) {
      // Try situation_ref format
      const refs = extractAllTags(situationsBlock, "situation_ref");
      if (refs.length > 0) {
        situationIds = refs;
      } else {
        // Try plain situation format
        situationIds = extractAllTags(situationsBlock, "situation");
      }
    }
    situationIds = normalizeRefs(situationIds, "situation");

    // Parse climax — same canonical ID rule
    const climaxRaw = extractTag(block, "climax");
    const climax = climaxRaw ? normalizeRef(climaxRaw, "situation") : undefined;

    // Parse theme(s)
    const themeTag = extractTag(block, "theme");
    const themesBlock = extractTag(block, "themes");
    let themes: string[] = [];
    if (themesBlock) {
      themes = extractAllTags(themesBlock, "theme");
    } else if (themeTag) {
      themes = [themeTag];
    }

    // Parse tension - try explicit block or create from theme
    const tensionBlock = extractTag(block, "tension");
    let tension: {
      centralConflict: string;
      source: string;
      opposingForces: { name: string; goal: string; factionId?: string }[];
      urgency?: string;
    };

    if (tensionBlock && extractTag(tensionBlock, "central_conflict")) {
      const opposingForcesBlock = extractTag(tensionBlock, "opposing_forces");
      tension = {
        centralConflict: extractTag(tensionBlock, "central_conflict") ?? "",
        source: extractTag(tensionBlock, "source") ?? "",
        opposingForces: opposingForcesBlock
          ? extractAllTags(opposingForcesBlock, "force").map((forceBlock) => ({
              name: extractTag(forceBlock, "name") ?? "Unknown",
              goal: extractTag(forceBlock, "goal") ?? "",
              factionId: extractTag(forceBlock, "faction_id"),
            }))
          : [],
        urgency: extractTag(tensionBlock, "urgency"),
      };
    } else {
      // Create tension from theme/description
      const description = extractTag(block, "description") ?? themes[0] ?? "";
      tension = {
        centralConflict: description,
        source: "Story events",
        opposingForces: [
          { name: "Protagonists", goal: "Achieve their goals" },
          { name: "Antagonists", goal: "Oppose the protagonists" },
        ],
        urgency: undefined,
      };
    }

    // Parse structure - create from available data
    const entryPointsBlock = extractTag(block, "entry_points");
    const structure = {
      type: structureType,
      layers: undefined,
      entryPoints: entryPointsBlock ? extractAllTags(entryPointsBlock, "entry") : undefined,
      climax,
      hub: undefined,
      suggestedOrder: situationIds.length > 0 ? situationIds : undefined,
    };

    // Parse resolution - try explicit block or create default
    const resolutionBlock = extractTag(block, "resolution");
    let resolution: {
      patterns: { name: string; description: string; triggerConditions: string[] }[];
      unlocksArcs?: string[];
      worldChanges: string[];
    };

    if (resolutionBlock && extractTag(resolutionBlock, "patterns")) {
      const patternsBlock = extractTag(resolutionBlock, "patterns");
      const worldChangesBlock = extractTag(resolutionBlock, "world_changes");
      const unlocksBlock = extractTag(resolutionBlock, "unlocks_arcs");

      resolution = {
        patterns: patternsBlock
          ? extractAllTags(patternsBlock, "pattern").map((patternBlock) => ({
              name: extractTag(patternBlock, "name") ?? "Resolution",
              description: extractTag(patternBlock, "description") ?? "",
              triggerConditions: (() => {
                const condBlock = extractTag(patternBlock, "trigger_conditions");
                return condBlock ? extractAllTags(condBlock, "condition") : [];
              })(),
            }))
          : [],
        unlocksArcs: unlocksBlock ? extractAllTags(unlocksBlock, "arc_id") : undefined,
        worldChanges: worldChangesBlock ? extractAllTags(worldChangesBlock, "change") : [],
      };
    } else {
      resolution = {
        patterns: [
          {
            name: "Resolution",
            description: "The arc reaches its conclusion",
            triggerConditions: ["Arc goals achieved"],
          },
        ],
        unlocksArcs: undefined,
        worldChanges: ["World state changes based on outcome"],
      };
    }

    // Parse GM guidance - try explicit block or create default
    const gmGuidanceBlock = extractTag(block, "gm_guidance");
    let gmGuidance: {
      introduction: string;
      pacing: string;
      keyNpcs: string[];
      atmosphere: string;
    };

    if (gmGuidanceBlock && extractTag(gmGuidanceBlock, "introduction")) {
      const keyNpcsBlock = extractTag(gmGuidanceBlock, "key_npcs");
      gmGuidance = {
        introduction: extractTag(gmGuidanceBlock, "introduction") ?? "",
        pacing: extractTag(gmGuidanceBlock, "pacing") ?? "",
        keyNpcs: keyNpcsBlock ? extractAllTags(keyNpcsBlock, "npc") : [],
        atmosphere: extractTag(gmGuidanceBlock, "atmosphere") ?? "",
      };
    } else {
      gmGuidance = {
        introduction: "Introduce the arc through its entry situations",
        pacing: "Let players drive the investigation",
        keyNpcs: [],
        atmosphere: themes[0] ?? "Tense",
      };
    }

    const arc: WorldArc = {
      id: extractRequiredTag(block, "id"),
      name: extractRequiredTag(block, "name"),
      description: extractTag(block, "description") ?? tension.centralConflict,
      tension,
      situationIds,
      structure,
      resolution,
      themes,
      gmGuidance,
      status,
    };

    // Validate against Zod schema
    return WorldArcSchema.parse(arc);
  });
}
