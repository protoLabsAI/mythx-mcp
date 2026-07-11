/**
 * Situation XML Parser
 *
 * Parses XML output for situations into WorldSituation schema.
 * Situations are Alexandrian node-based design elements.
 *
 * This parser is designed to be FLEXIBLE - it handles missing or alternative
 * tag names gracefully, providing sensible defaults where needed.
 */

import { WorldSituationSchema, type WorldSituation } from "@mythxengine/worlds";
import { normalizeRef, normalizeRefs } from "../manifest-helpers.js";
import {
  extractRequiredTag,
  extractTag,
  extractAllTags,
  extractOptionalInt,
  extractBoolean,
} from "../xml-parser.js";

const STATUS_VALUES = ["dormant", "brewing", "active", "resolved", "failed"] as const;
type Status = (typeof STATUS_VALUES)[number];

const DISCOVERY_METHOD_VALUES = [
  "location",
  "npc",
  "investigation",
  "observation",
  "document",
  "consequence",
  "rumor",
  "item",
] as const;
type DiscoveryMethod = (typeof DISCOVERY_METHOD_VALUES)[number];

const PROMINENCE_VALUES = ["obvious", "available", "hidden", "obscured"] as const;
type Prominence = (typeof PROMINENCE_VALUES)[number];

const COMPLICATION_TYPE_VALUES = [
  "obstacle",
  "opposition",
  "moral",
  "resource",
  "time",
  "information",
  "relationship",
] as const;
type ComplicationType = (typeof COMPLICATION_TYPE_VALUES)[number];

// Valid ability scores for tests
const ABILITY_VALUES = ["STR", "AGI", "WIT", "CON"] as const;
type Ability = (typeof ABILITY_VALUES)[number];

function parseAbility(value?: string): Ability {
  if (!value) return "WIT";
  const normalized = value.toUpperCase().trim();
  return ABILITY_VALUES.includes(normalized as Ability) ? (normalized as Ability) : "WIT";
}

/**
 * Parse situations from XML output with flexible tag handling.
 */
export function parseSituationsXML(output: string): WorldSituation[] {
  const situationsBlock = extractRequiredTag(output, "situations");
  const situationBlocks = extractAllTags(situationsBlock, "situation");

  return situationBlocks.map((block) => {
    const id = extractRequiredTag(block, "id");
    const name = extractRequiredTag(block, "name");
    const description = extractTag(block, "description") ?? "";

    // Parse status - default to active
    const statusRaw = (extractTag(block, "status") ?? "active").toLowerCase().trim();
    const status: Status = STATUS_VALUES.includes(statusRaw as Status)
      ? (statusRaw as Status)
      : "active";

    // Parse stakes - be flexible with tag names and provide defaults
    const stakesBlock = extractTag(block, "stakes");
    const stakes = parseStakes(stakesBlock, description);

    // Parse actors - be flexible, can be empty
    const actorsBlock = extractTag(block, "actors");
    const actors = parseActors(actorsBlock);

    // Parse locations - be flexible with format
    const locationsBlock = extractTag(block, "locations");
    const locations = parseLocations(locationsBlock, id);

    // Parse outgoing leads - optional
    const outgoingLeadsBlock = extractTag(block, "outgoing_leads") ?? extractTag(block, "leads");
    const outgoingLeads = parseOutgoingLeads(outgoingLeadsBlock);

    // Parse entry points - provide defaults
    const entryPointsBlock = extractTag(block, "entry_points");
    const entryPoints = parseEntryPoints(entryPointsBlock);

    // Parse complications - optional
    const complicationsBlock = extractTag(block, "complications");
    const complications = parseComplications(complicationsBlock);

    // Parse outcomes - provide defaults if missing
    const outcomesBlock = extractTag(block, "outcomes");
    const outcomes = parseOutcomes(outcomesBlock, name);

    // Parse GM guidance - provide defaults if missing
    const gmGuidanceBlock = extractTag(block, "gm_guidance") ?? extractTag(block, "guidance");
    const gmGuidance = parseGmGuidance(gmGuidanceBlock, description);

    // Parse tags - optional
    const tagsBlock = extractTag(block, "tags");
    const tags = tagsBlock ? extractAllTags(tagsBlock, "tag") : [];

    // Parse clock - entirely optional
    const clockBlock = extractTag(block, "clock");
    const clock = clockBlock ? parseClock(clockBlock) : undefined;

    const situation: WorldSituation = {
      id,
      name,
      description,
      status,
      stakes,
      actors,
      locations,
      clock,
      outgoingLeads,
      entryPoints,
      complications,
      outcomes,
      gmGuidance,
      tags,
      arcId: extractTag(block, "arc_id"),
      layer: extractOptionalInt(block, "layer"),
    };

    // Validate against Zod schema
    return WorldSituationSchema.parse(situation);
  });
}

/**
 * Parse stakes block with flexible handling
 */
function parseStakes(
  stakesBlock: string | undefined,
  fallbackDescription: string
): WorldSituation["stakes"] {
  if (!stakesBlock) {
    // Provide default stakes based on description
    return {
      risks: [fallbackDescription || "Unknown risks"],
      opportunities: ["Success will advance the story"],
      primaryVictim: undefined,
      ifIgnored: "The situation will escalate",
    };
  }

  // Try <risks> block, fall back to individual <risk> tags, then to description
  const risksBlock = extractTag(stakesBlock, "risks");
  let risks: string[] = [];
  if (risksBlock) {
    risks = extractAllTags(risksBlock, "risk");
  }
  if (risks.length === 0) {
    // Try extracting risks directly
    risks = extractAllTags(stakesBlock, "risk");
  }
  if (risks.length === 0) {
    risks = [fallbackDescription || "Unknown risks"];
  }

  // Try <opportunities> block, fall back to individual tags
  const opportunitiesBlock = extractTag(stakesBlock, "opportunities");
  let opportunities: string[] = [];
  if (opportunitiesBlock) {
    opportunities = extractAllTags(opportunitiesBlock, "opportunity");
  }
  if (opportunities.length === 0) {
    opportunities = extractAllTags(stakesBlock, "opportunity");
  }
  if (opportunities.length === 0) {
    opportunities = ["Success will advance the story"];
  }

  return {
    risks,
    opportunities,
    primaryVictim: extractTag(stakesBlock, "primary_victim") ?? extractTag(stakesBlock, "victim"),
    ifIgnored:
      extractTag(stakesBlock, "if_ignored") ??
      extractTag(stakesBlock, "ignored") ??
      "The situation will escalate",
  };
}

/**
 * Parse actors block with flexible handling
 */
function parseActors(actorsBlock: string | undefined): WorldSituation["actors"] {
  if (!actorsBlock) {
    return [];
  }

  return extractAllTags(actorsBlock, "actor").map((actorBlock) => {
    // Parse defaultAction with timeline. Prefer the structured triad
    // (<default_action><now><if_ignored_1_step><if_ignored_2_steps>);
    // fall back to a flat <default_action>X</default_action> by
    // populating `now` and leaving the future steps empty for the
    // validator to flag.
    const actionBlock =
      extractTag(actorBlock, "default_action") ?? extractTag(actorBlock, "action") ?? "";
    const nowTag = extractTag(actionBlock, "now");
    const if1Tag = extractTag(actionBlock, "if_ignored_1_step");
    const if2Tag = extractTag(actionBlock, "if_ignored_2_steps");
    const defaultAction =
      nowTag !== undefined || if1Tag !== undefined || if2Tag !== undefined
        ? {
            now: nowTag ?? "",
            ifIgnored1Step: if1Tag ?? "",
            ifIgnored2Steps: if2Tag ?? "",
          }
        : {
            now: actionBlock.trim() || "Act according to agenda",
            ifIgnored1Step: "",
            ifIgnored2Steps: "",
          };

    return {
      // Default actor entityIds to npc:* — if the model emits a bare slug or
      // a non-prefixed ID, normalize to the npc namespace.
      entityId: normalizeRef(
        extractTag(actorBlock, "entity_id") ?? extractTag(actorBlock, "id") ?? "unknown",
        "npc"
      ),
      agenda:
        extractTag(actorBlock, "agenda") ?? extractTag(actorBlock, "goal") ?? "Unknown agenda",
      leverage:
        extractTag(actorBlock, "leverage") ?? extractTag(actorBlock, "power") ?? "None specified",
      defaultAction,
      isPrimaryAntagonist:
        extractBoolean(actorBlock, "is_primary_antagonist", false) ||
        extractBoolean(actorBlock, "primary_antagonist", false),
    };
  });
}

/**
 * Parse locations block with flexible handling
 */
function parseLocations(
  locationsBlock: string | undefined,
  _situationId: string
): WorldSituation["locations"] {
  if (!locationsBlock) {
    // No location block emitted — return an empty structure rather than
    // fabricating a `location:<situation-slug>` ID that won't resolve to
    // any real location in the pack. The validator will flag the missing
    // primary; better to be honest than to ship a broken cross-reference.
    return {
      primary: [],
      related: undefined,
      details: undefined,
    };
  }

  // Try structured format first
  const primaryBlock = extractTag(locationsBlock, "primary");
  let primaryLocations: string[] = [];

  if (primaryBlock) {
    primaryLocations = extractAllTags(primaryBlock, "location_id");
    if (primaryLocations.length === 0) {
      primaryLocations = extractAllTags(primaryBlock, "location");
    }
  }

  // Fall back to extracting location_id directly from locations block
  if (primaryLocations.length === 0) {
    primaryLocations = extractAllTags(locationsBlock, "location_id");
  }
  if (primaryLocations.length === 0) {
    primaryLocations = extractAllTags(locationsBlock, "location");
  }
  // No fallback fabrication — empty stays empty.
  primaryLocations = normalizeRefs(primaryLocations, "location");

  // Parse related locations
  const relatedBlock = extractTag(locationsBlock, "related");
  let relatedLocations: string[] | undefined;
  if (relatedBlock) {
    relatedLocations = extractAllTags(relatedBlock, "location_id");
    if (relatedLocations.length === 0) {
      relatedLocations = extractAllTags(relatedBlock, "location");
    }
    if (relatedLocations.length > 0) {
      relatedLocations = normalizeRefs(relatedLocations, "location");
    }
  }

  // Parse location details
  const detailsBlock = extractTag(locationsBlock, "details");
  let details: Record<string, string> | undefined;
  if (detailsBlock) {
    const detailItems = extractAllTags(detailsBlock, "detail");
    if (detailItems.length > 0) {
      details = {};
      for (const detailBlock of detailItems) {
        const locId = extractTag(detailBlock, "location_id") ?? extractTag(detailBlock, "location");
        const info = extractTag(detailBlock, "info") ?? extractTag(detailBlock, "description");
        if (locId && info) {
          details[locId] = info;
        }
      }
      if (Object.keys(details).length === 0) {
        details = undefined;
      }
    }
  }

  return {
    primary: primaryLocations,
    related: relatedLocations && relatedLocations.length > 0 ? relatedLocations : undefined,
    details,
  };
}

/**
 * Parse outgoing leads with flexible handling
 */
function parseOutgoingLeads(leadsBlock: string | undefined): WorldSituation["outgoingLeads"] {
  if (!leadsBlock) {
    return [];
  }

  return extractAllTags(leadsBlock, "lead").map((leadBlock, idx) => {
    // Parse discovery with flexibility
    const discoveryBlock = extractTag(leadBlock, "discovery");
    const methodRaw = discoveryBlock
      ? (extractTag(discoveryBlock, "method") ?? "investigation").toLowerCase().trim()
      : "investigation";
    const method: DiscoveryMethod = DISCOVERY_METHOD_VALUES.includes(methodRaw as DiscoveryMethod)
      ? (methodRaw as DiscoveryMethod)
      : "investigation";

    // Parse prominence with flexibility
    const prominenceRaw = (extractTag(leadBlock, "prominence") ?? "available").toLowerCase().trim();
    const prominence: Prominence = PROMINENCE_VALUES.includes(prominenceRaw as Prominence)
      ? (prominenceRaw as Prominence)
      : "available";

    // Parse test if present
    const testBlock = discoveryBlock ? extractTag(discoveryBlock, "test") : null;
    const test = testBlock
      ? {
          ability: parseAbility(extractTag(testBlock, "ability")),
          difficulty: extractOptionalInt(testBlock, "difficulty") ?? 10,
          skill: extractTag(testBlock, "skill"),
        }
      : undefined;

    // Parse prerequisites if present
    const prereqBlock = extractTag(leadBlock, "prerequisites");
    const prerequisites = prereqBlock
      ? {
          requiredFlags: (() => {
            const flagsBlock = extractTag(prereqBlock, "required_flags");
            return flagsBlock ? extractAllTags(flagsBlock, "flag") : undefined;
          })(),
          blockedByFlags: (() => {
            const flagsBlock = extractTag(prereqBlock, "blocked_by_flags");
            return flagsBlock ? extractAllTags(flagsBlock, "flag") : undefined;
          })(),
        }
      : undefined;

    return {
      id: extractTag(leadBlock, "id") ?? `lead:unknown-${idx}`,
      information:
        extractTag(leadBlock, "information") ?? extractTag(leadBlock, "info") ?? "Important clue",
      targetSituationId:
        extractTag(leadBlock, "target_situation_id") ?? extractTag(leadBlock, "target") ?? "",
      discovery: {
        method,
        sourceId: discoveryBlock ? extractTag(discoveryBlock, "source_id") : undefined,
        description: discoveryBlock
          ? (extractTag(discoveryBlock, "description") ?? "Discover this lead")
          : "Discover this lead",
        test,
      },
      prominence,
      prerequisites,
      gmNotes: extractTag(leadBlock, "gm_notes"),
    };
  });
}

/**
 * Parse entry points with flexible handling
 */
function parseEntryPoints(entryPointsBlock: string | undefined): WorldSituation["entryPoints"] {
  if (!entryPointsBlock) {
    return {
      incomingLeadIds: [],
      directDiscovery: [],
      minimumLeadsTarget: 3,
    };
  }

  // Parse incoming lead IDs
  const incomingLeadIdsBlock = extractTag(entryPointsBlock, "incoming_lead_ids");
  const incomingLeadIds = incomingLeadIdsBlock
    ? extractAllTags(incomingLeadIdsBlock, "lead_id")
    : [];

  // Parse direct discovery options
  const directDiscoveryBlock = extractTag(entryPointsBlock, "direct_discovery");
  const directDiscovery = directDiscoveryBlock
    ? extractAllTags(directDiscoveryBlock, "discovery").map((discBlock) => ({
        method: extractTag(discBlock, "method") ?? "Direct approach",
        description: extractTag(discBlock, "description") ?? "Enter the situation directly",
        locationId: extractTag(discBlock, "location_id"),
        npcId: extractTag(discBlock, "npc_id"),
      }))
    : [];

  return {
    incomingLeadIds,
    directDiscovery,
    minimumLeadsTarget: extractOptionalInt(entryPointsBlock, "minimum_leads_target") ?? 3,
  };
}

/**
 * Parse complications with flexible handling
 */
function parseComplications(
  complicationsBlock: string | undefined
): WorldSituation["complications"] {
  if (!complicationsBlock) {
    return [];
  }

  return extractAllTags(complicationsBlock, "complication").map((compBlock, idx) => {
    // Parse type with flexibility
    const typeRaw = (extractTag(compBlock, "type") ?? "obstacle").toLowerCase().trim();
    const type: ComplicationType = COMPLICATION_TYPE_VALUES.includes(typeRaw as ComplicationType)
      ? (typeRaw as ComplicationType)
      : "obstacle";

    // Parse resolutions - try nested block first, then direct extraction
    const resolutionsBlock = extractTag(compBlock, "resolutions");
    let resolutions: string[] = [];
    if (resolutionsBlock) {
      resolutions = extractAllTags(resolutionsBlock, "resolution");
    }
    if (resolutions.length === 0) {
      resolutions = ["Find a way to overcome this challenge"];
    }

    return {
      id: extractTag(compBlock, "id") ?? `complication:unknown-${idx}`,
      description: extractTag(compBlock, "description") ?? "An unexpected complication",
      type,
      resolutions,
    };
  });
}

/**
 * Parse outcomes with flexible handling
 */
function parseOutcomes(
  outcomesBlock: string | undefined,
  situationName: string
): WorldSituation["outcomes"] {
  // Default victory and failure outcomes
  const defaultVictory = {
    description: `The ${situationName} is resolved successfully`,
    consequences: ["The party achieves their goal"],
    flagsSet: undefined,
  };

  const defaultFailure = {
    description: `The ${situationName} ends in failure`,
    consequences: ["The situation escalates or becomes worse"],
    flagsSet: undefined,
  };

  if (!outcomesBlock) {
    return {
      victory: defaultVictory,
      failure: defaultFailure,
      partial: undefined,
      wildcards: undefined,
    };
  }

  // Parse victory outcome
  const victoryBlock = extractTag(outcomesBlock, "victory");
  const victory = victoryBlock
    ? {
        description: extractTag(victoryBlock, "description") ?? defaultVictory.description,
        consequences: (() => {
          const conseqBlock = extractTag(victoryBlock, "consequences");
          const conseqs = conseqBlock ? extractAllTags(conseqBlock, "consequence") : [];
          return conseqs.length > 0 ? conseqs : defaultVictory.consequences;
        })(),
        flagsSet: (() => {
          const flagsBlock = extractTag(victoryBlock, "flags_set");
          return flagsBlock ? extractAllTags(flagsBlock, "flag") : undefined;
        })(),
      }
    : defaultVictory;

  // Parse failure outcome
  const failureBlock = extractTag(outcomesBlock, "failure");
  const failure = failureBlock
    ? {
        description: extractTag(failureBlock, "description") ?? defaultFailure.description,
        consequences: (() => {
          const conseqBlock = extractTag(failureBlock, "consequences");
          const conseqs = conseqBlock ? extractAllTags(conseqBlock, "consequence") : [];
          return conseqs.length > 0 ? conseqs : defaultFailure.consequences;
        })(),
        flagsSet: (() => {
          const flagsBlock = extractTag(failureBlock, "flags_set");
          return flagsBlock ? extractAllTags(flagsBlock, "flag") : undefined;
        })(),
      }
    : defaultFailure;

  // Parse partial outcomes (optional)
  const partialBlock = extractTag(outcomesBlock, "partial");
  const partial = partialBlock
    ? extractAllTags(partialBlock, "outcome").map((outcomeBlock) => ({
        name: extractTag(outcomeBlock, "name") ?? "Partial success",
        description: extractTag(outcomeBlock, "description") ?? "A mixed result",
        consequences: (() => {
          const conseqBlock = extractTag(outcomeBlock, "consequences");
          return conseqBlock ? extractAllTags(conseqBlock, "consequence") : ["Mixed results"];
        })(),
        flagsSet: (() => {
          const flagsBlock = extractTag(outcomeBlock, "flags_set");
          return flagsBlock ? extractAllTags(flagsBlock, "flag") : undefined;
        })(),
      }))
    : undefined;

  // Parse wildcards (optional)
  const wildcardsBlock = extractTag(outcomesBlock, "wildcards");
  const wildcards = wildcardsBlock ? extractAllTags(wildcardsBlock, "wildcard") : undefined;

  return {
    victory,
    failure,
    partial: partial && partial.length > 0 ? partial : undefined,
    wildcards: wildcards && wildcards.length > 0 ? wildcards : undefined,
  };
}

/**
 * Parse GM guidance with flexible handling
 */
function parseGmGuidance(
  gmGuidanceBlock: string | undefined,
  fallbackDescription: string
): WorldSituation["gmGuidance"] {
  const defaultGuidance = {
    themes: [fallbackDescription || "Adventure"],
    toneNotes: "Play according to the situation",
    anticipatedApproaches: [
      {
        approach: "Direct approach",
        response: "The situation responds naturally",
      },
    ],
    foreshadowing: undefined,
    arcConnections: undefined,
  };

  if (!gmGuidanceBlock) {
    return defaultGuidance;
  }

  // Parse themes
  const themesBlock = extractTag(gmGuidanceBlock, "themes");
  let themes = themesBlock ? extractAllTags(themesBlock, "theme") : [];
  if (themes.length === 0) {
    themes = defaultGuidance.themes;
  }

  // Parse tone notes
  const toneNotes =
    extractTag(gmGuidanceBlock, "tone_notes") ??
    extractTag(gmGuidanceBlock, "tone") ??
    defaultGuidance.toneNotes;

  // Parse anticipated approaches
  const approachesBlock =
    extractTag(gmGuidanceBlock, "anticipated_approaches") ??
    extractTag(gmGuidanceBlock, "approaches");
  let anticipatedApproaches = approachesBlock
    ? extractAllTags(approachesBlock, "approach").map((approachBlock) => ({
        approach:
          extractTag(approachBlock, "approach") ??
          extractTag(approachBlock, "method") ??
          "Unknown approach",
        response:
          extractTag(approachBlock, "response") ??
          extractTag(approachBlock, "result") ??
          "Handle naturally",
      }))
    : [];
  if (anticipatedApproaches.length === 0) {
    anticipatedApproaches = defaultGuidance.anticipatedApproaches;
  }

  // Parse foreshadowing (optional)
  const foreshadowBlock = extractTag(gmGuidanceBlock, "foreshadowing");
  const foreshadowing = foreshadowBlock ? extractAllTags(foreshadowBlock, "element") : undefined;

  // Parse arc connections (optional)
  const arcBlock = extractTag(gmGuidanceBlock, "arc_connections");
  const arcConnections = arcBlock ? extractAllTags(arcBlock, "connection") : undefined;

  return {
    themes,
    toneNotes,
    anticipatedApproaches,
    foreshadowing: foreshadowing && foreshadowing.length > 0 ? foreshadowing : undefined,
    arcConnections: arcConnections && arcConnections.length > 0 ? arcConnections : undefined,
  };
}

/**
 * Parse clock structure (optional, complex)
 */
function parseClock(clockBlock: string): WorldSituation["clock"] | undefined {
  try {
    const id = extractTag(clockBlock, "id");
    const name = extractTag(clockBlock, "name");
    const doom = extractTag(clockBlock, "doom");
    // pauseCondition is required by schema. If the LLM omits it, fall back
    // to a soft sentinel rather than dropping the whole clock — the
    // validator will surface this as a quality issue without making the
    // pack fail to load. Empty stays visible.
    const pauseCondition =
      extractTag(clockBlock, "pause_condition") ?? extractTag(clockBlock, "pauseCondition") ?? "";

    if (!id || !name || !doom) {
      return undefined;
    }

    const stagesBlock = extractTag(clockBlock, "stages");
    if (!stagesBlock) {
      return undefined;
    }

    const stages = extractAllTags(stagesBlock, "stage").map((stageBlock, idx) => {
      const triggerBlock = extractTag(stageBlock, "trigger");
      const triggerType = triggerBlock
        ? (extractTag(triggerBlock, "type") ?? "event").toLowerCase()
        : "event";

      // Build discriminated union trigger type properly
      type TimeTrigger = { type: "time"; minutesFromStart: number };
      type EventTrigger = { type: "event"; eventDescription: string; flag?: string };
      type InactionTrigger = { type: "playerInaction"; minutesOfInaction: number };
      type ClockTrigger = TimeTrigger | EventTrigger | InactionTrigger;

      let trigger: ClockTrigger;

      if (triggerType === "time") {
        trigger = {
          type: "time" as const,
          minutesFromStart: extractOptionalInt(triggerBlock ?? "", "minutes_from_start") ?? 60,
        };
      } else if (triggerType === "playerinaction" || triggerType === "inaction") {
        trigger = {
          type: "playerInaction" as const,
          minutesOfInaction: extractOptionalInt(triggerBlock ?? "", "minutes_of_inaction") ?? 30,
        };
      } else {
        trigger = {
          type: "event" as const,
          eventDescription:
            extractTag(triggerBlock ?? "", "event_description") ?? "An event occurs",
          flag: extractTag(triggerBlock ?? "", "flag"),
        };
      }

      const consequencesBlock = extractTag(stageBlock, "consequences");
      const consequences = {
        setFlags: (() => {
          const flagsBlock = extractTag(consequencesBlock ?? "", "set_flags");
          return flagsBlock ? extractAllTags(flagsBlock, "flag") : undefined;
        })(),
        removeFlags: (() => {
          const flagsBlock = extractTag(consequencesBlock ?? "", "remove_flags");
          return flagsBlock ? extractAllTags(flagsBlock, "flag") : undefined;
        })(),
        npcChanges: (() => {
          const changesBlock = extractTag(consequencesBlock ?? "", "npc_changes");
          return changesBlock
            ? extractAllTags(changesBlock, "change").map((changeBlock) => ({
                npcId: extractTag(changeBlock, "npc_id") ?? "unknown",
                change: extractTag(changeBlock, "change") ?? "Changed",
              }))
            : undefined;
        })(),
        locationChanges: (() => {
          const changesBlock = extractTag(consequencesBlock ?? "", "location_changes");
          return changesBlock
            ? extractAllTags(changesBlock, "change").map((changeBlock) => ({
                locationId: extractTag(changeBlock, "location_id") ?? "unknown",
                change: extractTag(changeBlock, "change") ?? "Changed",
              }))
            : undefined;
        })(),
        leadChanges: (() => {
          const changesBlock = extractTag(consequencesBlock ?? "", "lead_changes");
          return changesBlock
            ? extractAllTags(changesBlock, "change").map((changeBlock) => ({
                leadId: extractTag(changeBlock, "lead_id") ?? "unknown",
                available: extractBoolean(changeBlock, "available", true),
              }))
            : undefined;
        })(),
        narrative: extractTag(consequencesBlock ?? "", "narrative") ?? "The situation progresses",
      };

      return {
        id: extractTag(stageBlock, "id") ?? `stage-${idx}`,
        name: extractTag(stageBlock, "name") ?? "Stage",
        description: extractTag(stageBlock, "description") ?? "A stage in the clock",
        trigger,
        consequences,
        reversible: extractBoolean(stageBlock, "reversible", false),
      };
    });

    if (stages.length === 0) {
      return undefined;
    }

    return {
      id,
      name,
      doom,
      pauseCondition,
      stages,
      currentStage: null,
      startedAt: null,
      paused: false,
    };
  } catch {
    // If clock parsing fails, just return undefined
    return undefined;
  }
}
