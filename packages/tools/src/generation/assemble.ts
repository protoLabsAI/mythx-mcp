/**
 * Assemble World Pack Tool (Shared)
 *
 * Combines all generated content into a complete WorldContentPack.
 */

import { z } from "zod";
import { merge } from "lodash-es";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldRulesConfig } from "@mythxengine/types";
import type {
  WorldContentPack,
  WorldMeta,
  WorldArchetype,
  WorldItem,
  WorldMonster,
  WorldEncounter,
  WorldLocation,
  WorldNPC,
  WorldCondition,
  WorldFaction,
  NarrativeGuidance,
  WorldSituation,
  WorldArc,
} from "@mythxengine/worlds";
import { connectionId } from "@mythxengine/worlds";

export const AssembleWorldPackInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
});

export type AssembleWorldPackInput = z.infer<typeof AssembleWorldPackInputSchema>;

interface ValidationIssue {
  type: "error" | "warning";
  path: string;
  message: string;
}

export interface AssembleWorldPackOutput {
  message: string;
  packId: string;
  name: string;
  contentCounts: {
    archetypes: number;
    items: number;
    monsters: number;
    encounters: number;
    conditions: number;
    locations: number;
    npcs?: number;
    factions?: number;
  };
  validation: {
    valid: boolean;
    errorCount: number;
    warningCount: number;
    issues: ValidationIssue[];
  };
}

interface WorldSeedForAssembly {
  id: string;
  name: string;
  tagline: string;
  aesthetic: {
    visualStyle: string;
    tone: string;
    themes: string[];
    inspirations: string[];
  };
  settings: {
    lethality: string;
    magicLevel: string;
    technologyLevel: string;
    supernaturalPresence: string;
  };
  rules?: WorldRulesConfig;
}

/**
 * Merge base content with expansions by ID using lodash deep merge
 * Expansions extend base content rather than replacing it
 */
function mergeById<T extends { id: string }>(base: T[], expanded: T[]): T[] {
  const result = new Map<string, T>();

  for (const item of base) {
    result.set(item.id, item);
  }

  for (const item of expanded) {
    const existing = result.get(item.id);
    // lodash merge mutates first arg, so clone first
    result.set(item.id, existing ? merge({}, existing, item) : item);
  }

  return Array.from(result.values());
}

/**
 * Convert array to record by ID
 */
function toRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  const record: Record<string, T> = {};
  for (const item of items) {
    record[item.id] = item;
  }
  return record;
}

export const assembleWorldPackTool = defineSharedTool({
  name: "assemble_world_pack",
  description: "Combine all generated content into a complete WorldContentPack and save it.",
  inputSchema: AssembleWorldPackInputSchema,

  handler: async (input, ctx): Promise<AssembleWorldPackOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation) {
      throw new Error("No generation session found");
    }

    const worldSeed = session.generation.worldSeed as WorldSeedForAssembly | null;
    if (!worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed first.");
    }

    const content = session.generation.generatedContent;
    const expansions = session.generation.expansions;

    // Merge base content with expansions
    const archetypes = mergeById(
      content.archetypes as WorldArchetype[],
      expansions.archetypes as WorldArchetype[]
    );
    const monsters = mergeById(
      content.monsters as WorldMonster[],
      expansions.monsters as WorldMonster[]
    );
    const locations = mergeById(
      content.locations as WorldLocation[],
      expansions.locations as WorldLocation[]
    );
    const npcs = mergeById(content.npcs as WorldNPC[], expansions.npcs as WorldNPC[]);

    // Get situations and arcs (no expansion merging for these yet)
    const situations = content.situations as WorldSituation[];
    const arcs = content.arcs as WorldArc[];

    // Build meta
    const meta: WorldMeta = {
      id: worldSeed.id,
      name: worldSeed.name,
      tagline: worldSeed.tagline,
      version: "1.0.0",
      aesthetic: {
        visualStyle: worldSeed.aesthetic.visualStyle,
        tone: worldSeed.aesthetic.tone,
        themes: worldSeed.aesthetic.themes,
        inspirations: worldSeed.aesthetic.inspirations || [],
      },
      settings: {
        lethality: worldSeed.settings.lethality as "low" | "medium" | "high" | "brutal",
        magicLevel: worldSeed.settings.magicLevel as "none" | "rare" | "common" | "high",
        technologyLevel: worldSeed.settings.technologyLevel as
          | "primitive"
          | "medieval"
          | "renaissance"
          | "industrial"
          | "modern"
          | "futuristic",
        supernaturalPresence: worldSeed.settings.supernaturalPresence as
          | "subtle"
          | "common"
          | "pervasive",
      },
      contentCounts: {
        archetypes: archetypes.length,
        items: (content.items as WorldItem[]).length,
        monsters: monsters.length,
        encounters: (content.encounters as WorldEncounter[]).length,
        conditions: (content.conditions as WorldCondition[]).length,
        locations: locations.length,
        npcs: npcs.length,
        factions: (content.factions as WorldFaction[]).length,
      },
    };

    // Build narrative (with defaults if not generated)
    const narrative: NarrativeGuidance = (content.narrative as NarrativeGuidance) || {
      openingScenes: [],
      plotHooks: [],
      commonConflicts: [],
      resolutionPatterns: [],
    };

    // Assemble the world pack
    const worldPack: WorldContentPack = {
      meta,
      archetypes: toRecord(archetypes),
      items: toRecord(content.items as WorldItem[]),
      monsters: toRecord(monsters),
      encounters: toRecord(content.encounters as WorldEncounter[]),
      conditions: toRecord(content.conditions as WorldCondition[]),
      locations: toRecord(locations),
      npcs: toRecord(npcs),
      factions: toRecord(content.factions as WorldFaction[]),
      situations: situations.length > 0 ? toRecord(situations) : undefined,
      arcs: arcs.length > 0 ? toRecord(arcs) : undefined,
      narrativeGuidance: narrative,
      // Include rules configuration from seed (if provided)
      rules: worldSeed.rules,
    };

    // Run validation before saving
    const validationIssues = validateWorldPack(worldPack);
    const errorCount = validationIssues.filter((i) => i.type === "error").length;
    const warningCount = validationIssues.filter((i) => i.type === "warning").length;

    // Save the world pack (even with warnings — only block on errors if desired)
    const packId = worldSeed.id;
    await ctx.worldPacks.save(packId, worldPack);

    // Auto-generate archetype portraits if pixelgen is available
    if (ctx.worldMedia) {
      try {
        const { generateWorldImagesTool } = await import("../imagegen/generate-world-images.js");
        const imgResult = await generateWorldImagesTool.handler(
          { packId, entityTypes: ["archetype"] },
          ctx
        );
        console.log(
          `[assemble] Generated ${imgResult.generated} archetype portraits, ${imgResult.cached} cached, ${imgResult.failed} failed`
        );
      } catch (err) {
        // Non-fatal — images can be lazy-generated later
        console.warn(
          "[assemble] Archetype portrait generation failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    // Update session — set both the generation tracker and the top-level worldPackId
    // The top-level field is used by the web app to link sessions to worlds
    session.generation.worldPackId = packId;
    session.generation.status = "complete";
    session.worldPackId = packId;
    await ctx.sessions.save(session);

    const validSuffix =
      errorCount > 0
        ? ` Validation: ${errorCount} errors, ${warningCount} warnings.`
        : warningCount > 0
          ? ` Validation: ${warningCount} warnings (no errors).`
          : " Validation: passed.";

    return {
      message: `World pack assembled and saved.${validSuffix}`,
      packId,
      name: meta.name,
      contentCounts: meta.contentCounts,
      validation: {
        valid: errorCount === 0,
        errorCount,
        warningCount,
        issues: validationIssues,
      },
    };
  },
});

// Export merge utility for testing
export { mergeById };

/**
 * Inline validation for assembled world packs.
 * Checks references, duplicates, and minimum content requirements.
 */
function validateWorldPack(pack: WorldContentPack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allIds = new Set<string>();
  const seenIds = new Set<string>();

  // Collect all entity IDs
  const collectIds = (record: Record<string, { id: string }>, prefix: string) => {
    for (const [key, value] of Object.entries(record)) {
      if (seenIds.has(value.id)) {
        issues.push({
          type: "error",
          path: `${prefix}.${key}`,
          message: `Duplicate ID: ${value.id}`,
        });
      }
      seenIds.add(value.id);
      allIds.add(value.id);
    }
  };

  collectIds(pack.archetypes, "archetypes");
  collectIds(pack.items, "items");
  collectIds(pack.monsters, "monsters");
  collectIds(pack.encounters, "encounters");
  collectIds(pack.conditions, "conditions");
  collectIds(pack.locations, "locations");
  collectIds(pack.npcs, "npcs");
  if (pack.factions) collectIds(pack.factions, "factions");
  if (pack.situations) collectIds(pack.situations, "situations");
  if (pack.arcs) collectIds(pack.arcs, "arcs");

  const checkRef = (ref: string, context: string) => {
    if (!allIds.has(ref)) {
      issues.push({ type: "warning", path: context, message: `Missing reference: ${ref}` });
    }
  };

  // Check archetype starting item references
  for (const [id, arch] of Object.entries(pack.archetypes)) {
    for (const itemId of arch.startingItems) {
      checkRef(itemId, `archetypes.${id}.startingItems`);
    }
  }

  // Check encounter references
  for (const [id, enc] of Object.entries(pack.encounters)) {
    if (enc.combat?.monsters) {
      for (const spawn of enc.combat.monsters) {
        checkRef(spawn.monsterId, `encounters.${id}.combat.monsters`);
      }
    }
    if (enc.social?.npcIds) {
      for (const npcId of enc.social.npcIds) {
        checkRef(npcId, `encounters.${id}.social.npcIds`);
      }
    }
  }

  // Check location references
  for (const [id, loc] of Object.entries(pack.locations)) {
    for (const conn of loc.connections) {
      checkRef(connectionId(conn), `locations.${id}.connections`);
    }
    for (const encId of loc.encounters) {
      checkRef(encId, `locations.${id}.encounters`);
    }
    for (const npcId of loc.npcs) {
      checkRef(npcId, `locations.${id}.npcs`);
    }
  }

  // Check NPC location references
  for (const [id, npc] of Object.entries(pack.npcs)) {
    if (npc.locations) {
      for (const locId of npc.locations) {
        checkRef(locId, `npcs.${id}.locations`);
      }
    }
  }

  // Minimum content checks
  if (Object.keys(pack.archetypes).length === 0) {
    issues.push({ type: "error", path: "archetypes", message: "No archetypes defined" });
  }
  if (Object.keys(pack.locations).length === 0) {
    issues.push({ type: "warning", path: "locations", message: "No locations defined" });
  }

  // Fail-forward heuristic: event-encounter failureOutcome strings that
  // start with negative-blocking patterns are likely bad design — they
  // halt the fiction instead of advancing it. Soft warning, not an error
  // (the pack still loads), but useful signal during gen review.
  const blockingPatterns =
    /^(you fail|you cannot|nothing happens|nothing changes|you can't|you are unable|the attempt fails|the test fails)\b/i;
  for (const [id, enc] of Object.entries(pack.encounters)) {
    if (enc.type !== "event" || !enc.event) continue;
    enc.event.choices.forEach((choice, idx) => {
      const fo = choice.failureOutcome?.trim() ?? "";
      if (!fo) {
        issues.push({
          type: "warning",
          path: `encounters.${id}.event.choices[${idx}].failureOutcome`,
          message: "Event-encounter failureOutcome is empty (fail-forward required)",
        });
      } else if (blockingPatterns.test(fo)) {
        issues.push({
          type: "warning",
          path: `encounters.${id}.event.choices[${idx}].failureOutcome`,
          message: `Event-encounter failureOutcome starts with a blocking pattern (advance the fiction instead): "${fo.slice(0, 80)}"`,
        });
      }
    });
  }

  // Three Clue Rule diversity: per Justin Alexander's refined version, a
  // situation's outgoing leads must use ≥2 different `discovery.method`
  // values AND ≥2 different `prominence` levels. Three leads that all
  // share the same method/prominence will all fail simultaneously for
  // parties lacking that capability.
  if (pack.situations) {
    for (const [id, sit] of Object.entries(pack.situations)) {
      const leads = sit.outgoingLeads ?? [];
      // Fewer than 2 leads is itself a Three Clue Rule violation — the rule
      // says ≥3 leads, and you can't even talk about method/prominence
      // diversity with 0 or 1. Flag it instead of silently skipping.
      if (leads.length < 3) {
        issues.push({
          type: "warning",
          path: `situations.${id}.outgoingLeads`,
          message: `Three Clue Rule: only ${leads.length} outgoing lead(s). Aim for ≥3 with diverse discovery methods and prominence so a single party capability gap doesn't dead-end the situation.`,
        });
      }
      if (leads.length < 2) continue;
      const methods = new Set(leads.map((l) => l.discovery?.method).filter(Boolean));
      const prominences = new Set(leads.map((l) => l.prominence).filter(Boolean));
      if (methods.size < 2) {
        issues.push({
          type: "warning",
          path: `situations.${id}.outgoingLeads`,
          message: `Three Clue Rule: all ${leads.length} leads use the same discovery method (${[...methods].join(", ")}). Diversify so a party that lacks one capability can still find at least one clue.`,
        });
      }
      if (prominences.size < 2) {
        issues.push({
          type: "warning",
          path: `situations.${id}.outgoingLeads`,
          message: `Three Clue Rule: all ${leads.length} leads share prominence "${[...prominences].join(", ")}". Mix obvious/available/hidden so leads aren't uniformly easy or uniformly buried.`,
        });
      }
    }
  }

  // Situation clock pause conditions: schema requires the field but the
  // parser falls back to empty string when the model omits the tag.
  // Surface that as a warning so we can iterate on prompt quality.
  if (pack.situations) {
    for (const [id, sit] of Object.entries(pack.situations)) {
      if (sit.clock && !sit.clock.pauseCondition?.trim()) {
        issues.push({
          type: "warning",
          path: `situations.${id}.clock.pauseCondition`,
          message:
            "Situation clock missing pauseCondition — players need a legible lever to stop or reverse the clock.",
        });
      }
    }
  }

  // NPC motivation triad: warn when fear or lie are empty. The schema
  // accepts flat-string motivation as a legacy fallback, but we want to
  // see the full triad emerge over time so flag both shapes.
  for (const [id, npc] of Object.entries(pack.npcs)) {
    const m = npc.motivation;
    if (typeof m === "string") {
      issues.push({
        type: "warning",
        path: `npcs.${id}.motivation`,
        message:
          "NPC motivation is a flat string — prefer the want/fear/lie triad for richer interaction.",
      });
    } else {
      if (!m.fear?.trim()) {
        issues.push({
          type: "warning",
          path: `npcs.${id}.motivation.fear`,
          message: "NPC motivation.fear is empty — what is this character avoiding?",
        });
      }
      if (!m.lie?.trim()) {
        issues.push({
          type: "warning",
          path: `npcs.${id}.motivation.lie`,
          message: "NPC motivation.lie is empty — what false belief makes them exploitable?",
        });
      }
    }
  }

  // Monster firstAction: optional in schema but required by Tier 3
  // prompt. Surface absence so generation quality is visible.
  for (const [id, monster] of Object.entries(pack.monsters)) {
    if (!monster.firstAction?.trim()) {
      issues.push({
        type: "warning",
        path: `monsters.${id}.firstAction`,
        message: "Monster missing firstAction — what does it do round 1 if the party does nothing?",
      });
    }
  }

  // Actor defaultAction timeline: warn when escalation steps are absent.
  // Flat-string defaultAction is accepted as legacy fallback but the
  // triad is the goal.
  if (pack.situations) {
    for (const [id, sit] of Object.entries(pack.situations)) {
      sit.actors.forEach((actor, idx) => {
        const a = actor.defaultAction;
        if (typeof a === "string") {
          issues.push({
            type: "warning",
            path: `situations.${id}.actors[${idx}].defaultAction`,
            message:
              "Actor defaultAction is a flat string — prefer the now/ifIgnored1Step/ifIgnored2Steps triad.",
          });
        } else if (!a.ifIgnored1Step?.trim() || !a.ifIgnored2Steps?.trim()) {
          issues.push({
            type: "warning",
            path: `situations.${id}.actors[${idx}].defaultAction`,
            message:
              "Actor defaultAction missing escalation timeline — what happens if the party keeps ignoring them?",
          });
        }
      });
    }
  }

  // Location features as verbs: heuristic. Look for at least one verb
  // in a meaningful prefix position. If none of the features look like
  // verbs, the location is scenery, not affordance. Soft warning only —
  // English verb detection without NLP is approximate.
  const verbPattern =
    /^[A-Z]?[a-z]*(climb|cross|dig|drink|enter|escape|exploit|hide|hunt|investigate|listen|negotiate|observe|open|pry|push|read|search|smell|speak|steal|stop|study|swim|talk|test|trade|travel|trigger|unlock|use|walk|watch)\b/i;
  for (const [id, loc] of Object.entries(pack.locations)) {
    const features = loc.features ?? [];
    if (features.length === 0) continue;
    const verbCount = features.filter((f) => verbPattern.test(f.trim())).length;
    // Match the prompt's "at least half" rule. Heuristic regex
    // under-counts (won't match "Perform a rite", "Inspect the cell"),
    // so this is best understood as a soft floor, not a hard contract.
    if (verbCount < features.length / 2) {
      issues.push({
        type: "warning",
        path: `locations.${id}.features`,
        message: `Location features read as mostly nouns (${verbCount}/${features.length} verb-phrased) — phrase at least half as actionable verbs (what can players DO here?).`,
      });
    }
  }

  // Connection traversal narrative: warn when connections are flat
  // strings or have empty travel. The schema accepts flat strings for
  // backwards compat but the prompt asks for structured form with travel.
  for (const [id, loc] of Object.entries(pack.locations)) {
    loc.connections.forEach((conn, idx) => {
      if (typeof conn === "string") {
        issues.push({
          type: "warning",
          path: `locations.${id}.connections[${idx}]`,
          message:
            "Connection is a flat ID — prefer the structured form with <travel> narrative for what the trip is like.",
        });
      } else if (!conn.travel?.trim()) {
        issues.push({
          type: "warning",
          path: `locations.${id}.connections[${idx}].travel`,
          message: "Connection.travel is empty — describe the journey, not just the edge.",
        });
      }
    });
  }

  return issues;
}
