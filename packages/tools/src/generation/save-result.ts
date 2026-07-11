/**
 * Save Generation Result Tool (Shared)
 *
 * Saves LLM-generated content back to the session.
 * Supports both JSON and XML input formats.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import {
  WorldSeedSchema,
  WorldArchetypeSchema,
  WorldMonsterSchema,
  WorldItemSchema,
  WorldEncounterSchema,
  WorldLocationSchema,
  WorldNPCSchema,
  NarrativeGuidanceSchema,
  ExpandedLocationSchema,
  ExpandedArchetypeSchema,
  ExpandedNPCSchema,
  ExpandedMonsterSchema,
  WorldSituationSchema,
  WorldArcSchema,
  WorldConditionSchema,
  WorldFactionSchema,
  type WorldSeed,
  type WorldArchetype,
  type WorldMonster,
  type WorldItem,
  type WorldEncounter,
  type WorldLocation,
  type WorldNPC,
  type WorldCondition,
  type WorldFaction,
  type NarrativeGuidance,
  type WorldSituation,
  type WorldArc,
  type ExpandedLocation,
  type ExpandedArchetype,
  type ExpandedNPC,
  type ExpandedMonster,
} from "@mythxengine/worlds";

import { isXML } from "./xml-parser.js";
import {
  parseSeedXML,
  parseArchetypesXML,
  parseMonstersXML,
  parseItemsXML,
  parseEncountersXML,
  parseLocationsXML,
  parseNPCsXML,
  parseNarrativeXML,
  parseSituationsXML,
  parseArcsXML,
} from "./parsers/index.js";

export const SaveGenerationResultInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  stepId: z.string().describe("Step ID from the generation tool response"),
  result: z.unknown().describe("The LLM-generated result (JSON object or XML string)"),
});

export type SaveGenerationResultInput = z.infer<typeof SaveGenerationResultInputSchema>;

export interface SaveGenerationResultOutput {
  message: string;
  stepId: string;
  generatedIds: string[];
  status: string;
}

/**
 * Clamp ability values to valid range [-3, 3]
 */
function clampAbilities(abilities: Record<string, number>): Record<string, number> {
  const clamped: Record<string, number> = {};
  for (const [key, value] of Object.entries(abilities)) {
    if (typeof value === "number") {
      clamped[key] = Math.max(-3, Math.min(3, value));
    } else {
      clamped[key] = 0;
    }
  }
  return clamped;
}

/**
 * Recursively clamp ability values in content arrays/objects
 */
function clampAbilitiesInContent(content: unknown): unknown {
  if (Array.isArray(content)) {
    return content.map((item) => clampAbilitiesInContent(item));
  }
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (key === "abilities" && value && typeof value === "object") {
        result[key] = clampAbilities(value as Record<string, number>);
      } else if (
        key === "starting" &&
        value &&
        typeof value === "object" &&
        (value as Record<string, unknown>).abilities
      ) {
        // Handle archetype starting.abilities
        const starting = value as Record<string, unknown>;
        result[key] = {
          ...starting,
          abilities: clampAbilities(starting.abilities as Record<string, number>),
        };
      } else {
        result[key] = clampAbilitiesInContent(value);
      }
    }
    return result;
  }
  return content;
}

/**
 * Parse a result, handling both objects and JSON strings
 */
function normalizeResult(result: unknown): unknown {
  // If result is a string but not XML, try to parse it as JSON
  if (typeof result === "string" && !isXML(result)) {
    try {
      const parsed = JSON.parse(result);
      // Clamp any ability values to valid range
      return clampAbilitiesInContent(parsed);
    } catch {
      // If parsing fails, return as-is for schema validation to catch
      return result;
    }
  }
  // Clamp abilities in object results too
  if (result && typeof result === "object") {
    return clampAbilitiesInContent(result);
  }
  return result;
}

/**
 * Detect if input is XML and parse accordingly
 */
function parseResultByType(
  result: unknown,
  stepType: string,
  campaignSeed?: string
): {
  parsed: unknown;
  ids: string[];
} {
  // Check if result is a string that looks like XML
  const isXmlInput = typeof result === "string" && isXML(result);

  // Normalize JSON strings to objects
  const normalizedResult = isXmlInput ? result : normalizeResult(result);

  switch (stepType) {
    case "seed": {
      let seed: WorldSeed;
      if (isXmlInput) {
        // For XML, we need campaignSeed - it should be embedded in the XML
        seed = parseSeedXML(result as string, campaignSeed || "");
      } else {
        seed = WorldSeedSchema.parse(normalizedResult);
      }
      return { parsed: seed, ids: [seed.id] };
    }

    case "archetypes": {
      let archetypes: WorldArchetype[];
      if (isXmlInput) {
        archetypes = parseArchetypesXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        archetypes = z.array(WorldArchetypeSchema).parse(jsonResult.archetypes || normalizedResult);
      }
      return { parsed: archetypes, ids: archetypes.map((a) => a.id) };
    }

    case "monsters": {
      let monsters: WorldMonster[];
      if (isXmlInput) {
        monsters = parseMonstersXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        monsters = z.array(WorldMonsterSchema).parse(jsonResult.monsters || normalizedResult);
      }
      return { parsed: monsters, ids: monsters.map((m) => m.id) };
    }

    case "items": {
      let items: WorldItem[];
      if (isXmlInput) {
        items = parseItemsXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        items = z.array(WorldItemSchema).parse(jsonResult.items || normalizedResult);
      }
      return { parsed: items, ids: items.map((i) => i.id) };
    }

    case "encounters": {
      let encounters: WorldEncounter[];
      if (isXmlInput) {
        encounters = parseEncountersXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        encounters = z.array(WorldEncounterSchema).parse(jsonResult.encounters || normalizedResult);
      }
      return { parsed: encounters, ids: encounters.map((e) => e.id) };
    }

    case "locations": {
      let locations: WorldLocation[];
      if (isXmlInput) {
        locations = parseLocationsXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        locations = z.array(WorldLocationSchema).parse(jsonResult.locations || normalizedResult);
      }
      return { parsed: locations, ids: locations.map((l) => l.id) };
    }

    case "npcs": {
      let npcs: WorldNPC[];
      if (isXmlInput) {
        npcs = parseNPCsXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        npcs = z.array(WorldNPCSchema).parse(jsonResult.npcs || normalizedResult);
      }
      return { parsed: npcs, ids: npcs.map((n) => n.id) };
    }

    case "narrative": {
      let narrative: NarrativeGuidance;
      if (isXmlInput) {
        narrative = parseNarrativeXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        narrative = NarrativeGuidanceSchema.parse(jsonResult.narrative || normalizedResult);
      }
      return { parsed: narrative, ids: ["narrative"] };
    }

    // Conditions and factions are JSON-only — no XML parsers exist for these types
    // since they were added after the XML parsing system was established.
    case "conditions": {
      const jsonResult =
        normalizedResult && typeof normalizedResult === "object"
          ? (normalizedResult as Record<string, unknown>)
          : {};
      const conditions = z
        .array(WorldConditionSchema)
        .parse(jsonResult.conditions || normalizedResult);
      return { parsed: conditions, ids: conditions.map((c) => c.id) };
    }

    case "factions": {
      const jsonResult =
        normalizedResult && typeof normalizedResult === "object"
          ? (normalizedResult as Record<string, unknown>)
          : {};
      const factions = z.array(WorldFactionSchema).parse(jsonResult.factions || normalizedResult);
      return { parsed: factions, ids: factions.map((f) => f.id) };
    }

    case "situations": {
      let situations: WorldSituation[];
      if (isXmlInput) {
        situations = parseSituationsXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        situations = z.array(WorldSituationSchema).parse(jsonResult.situations || normalizedResult);
      }
      return { parsed: situations, ids: situations.map((s) => s.id) };
    }

    case "arcs": {
      let arcs: WorldArc[];
      if (isXmlInput) {
        arcs = parseArcsXML(result as string);
      } else {
        const jsonResult =
          normalizedResult && typeof normalizedResult === "object"
            ? (normalizedResult as Record<string, unknown>)
            : {};
        arcs = z.array(WorldArcSchema).parse(jsonResult.arcs || normalizedResult);
      }
      return { parsed: arcs, ids: arcs.map((a) => a.id) };
    }

    case "expand_location": {
      // Expansion types currently only support JSON
      const jsonResult = normalizedResult as Record<string, unknown>;
      const expanded = ExpandedLocationSchema.parse(
        jsonResult.expandedLocation || normalizedResult
      );
      return { parsed: expanded, ids: [expanded.id] };
    }

    case "expand_archetype": {
      const jsonResult = normalizedResult as Record<string, unknown>;
      const expanded = ExpandedArchetypeSchema.parse(
        jsonResult.expandedArchetype || normalizedResult
      );
      return { parsed: expanded, ids: [expanded.id] };
    }

    case "expand_npc": {
      const jsonResult = normalizedResult as Record<string, unknown>;
      const expanded = ExpandedNPCSchema.parse(jsonResult.expandedNPC || normalizedResult);
      return { parsed: expanded, ids: [expanded.id] };
    }

    case "expand_monster": {
      const jsonResult = normalizedResult as Record<string, unknown>;
      const expanded = ExpandedMonsterSchema.parse(jsonResult.expandedMonster || normalizedResult);
      return { parsed: expanded, ids: [expanded.id] };
    }

    default:
      throw new Error(`Unknown step type: ${stepType}`);
  }
}

export const saveGenerationResultTool = defineSharedTool({
  name: "save_generation_result",
  description:
    "Save LLM-generated content back to the session. Call this after executing a generation prompt. Accepts JSON or XML formatted results.",
  inputSchema: SaveGenerationResultInputSchema,

  handler: async (input, ctx): Promise<SaveGenerationResultOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (!session.generation) {
      throw new Error("No generation session found");
    }

    // Find the step
    const step = session.generation.history.find((s) => s.id === input.stepId);
    if (!step) {
      throw new Error(`Step not found: ${input.stepId}`);
    }

    if (step.status === "completed") {
      return {
        message: "Step already completed",
        stepId: input.stepId,
        generatedIds: step.generatedIds || [],
        status: String(session.generation.status),
      };
    }

    try {
      // Get the campaignSeed if this is a seed step (needed for XML parsing)
      // The campaignSeed should be in the session metadata or we extract it from the result
      let campaignSeed: string | undefined;
      if (step.type === "seed") {
        // Try to extract from the result if it's JSON
        if (typeof input.result === "object" && input.result !== null) {
          campaignSeed = (input.result as Record<string, unknown>).campaignSeed as string;
        }
      }

      // Parse the result based on step type and format
      const { parsed, ids } = parseResultByType(input.result, step.type, campaignSeed);

      // Ensure generatedContent arrays are initialized (may be missing from loaded sessions)
      if (!session.generation.generatedContent) {
        session.generation.generatedContent = {
          archetypes: [],
          monsters: [],
          items: [],
          encounters: [],
          locations: [],
          npcs: [],
          conditions: [],
          factions: [],
          narrative: null,
          situations: [],
          arcs: [],
        };
      }
      const gc = session.generation.generatedContent;
      gc.archetypes ??= [];
      gc.monsters ??= [];
      gc.items ??= [];
      gc.encounters ??= [];
      gc.locations ??= [];
      gc.npcs ??= [];
      gc.situations ??= [];
      gc.arcs ??= [];

      // Ensure expansions are initialized
      if (!session.generation.expansions) {
        session.generation.expansions = {
          locations: [],
          archetypes: [],
          npcs: [],
          monsters: [],
        };
      }
      const exp = session.generation.expansions;
      exp.locations ??= [];
      exp.archetypes ??= [];
      exp.npcs ??= [];
      exp.monsters ??= [];

      // Deduplicated push: skip entities whose ID already exists in the array
      function dedupPush<T extends { id: string }>(arr: T[], items: T[]): void {
        const existingIds = new Set(arr.map((e) => e.id));
        for (const item of items) {
          if (!existingIds.has(item.id)) {
            arr.push(item);
            existingIds.add(item.id);
          }
        }
      }

      // Store the parsed result in the appropriate location
      switch (step.type) {
        case "seed":
          session.generation.worldSeed = parsed as WorldSeed;
          break;
        case "archetypes":
          dedupPush(
            session.generation.generatedContent.archetypes as Array<{ id: string }>,
            parsed as WorldArchetype[]
          );
          break;
        case "monsters":
          dedupPush(
            session.generation.generatedContent.monsters as Array<{ id: string }>,
            parsed as WorldMonster[]
          );
          break;
        case "items":
          dedupPush(
            session.generation.generatedContent.items as Array<{ id: string }>,
            parsed as WorldItem[]
          );
          break;
        case "encounters":
          dedupPush(
            session.generation.generatedContent.encounters as Array<{ id: string }>,
            parsed as WorldEncounter[]
          );
          break;
        case "locations":
          dedupPush(
            session.generation.generatedContent.locations as Array<{ id: string }>,
            parsed as WorldLocation[]
          );
          break;
        case "npcs":
          dedupPush(
            session.generation.generatedContent.npcs as Array<{ id: string }>,
            parsed as WorldNPC[]
          );
          break;
        case "narrative":
          session.generation.generatedContent.narrative = parsed as NarrativeGuidance;
          break;
        case "conditions":
          dedupPush(
            session.generation.generatedContent.conditions as Array<{ id: string }>,
            parsed as WorldCondition[]
          );
          break;
        case "factions":
          dedupPush(
            session.generation.generatedContent.factions as Array<{ id: string }>,
            parsed as WorldFaction[]
          );
          break;
        case "situations":
          dedupPush(
            session.generation.generatedContent.situations as Array<{ id: string }>,
            parsed as WorldSituation[]
          );
          break;
        case "arcs":
          dedupPush(
            session.generation.generatedContent.arcs as Array<{ id: string }>,
            parsed as WorldArc[]
          );
          break;
        case "expand_location":
          dedupPush(session.generation.expansions.locations as Array<{ id: string }>, [
            parsed as ExpandedLocation,
          ]);
          break;
        case "expand_archetype":
          dedupPush(session.generation.expansions.archetypes as Array<{ id: string }>, [
            parsed as ExpandedArchetype,
          ]);
          break;
        case "expand_npc":
          dedupPush(session.generation.expansions.npcs as Array<{ id: string }>, [
            parsed as ExpandedNPC,
          ]);
          break;
        case "expand_monster":
          dedupPush(session.generation.expansions.monsters as Array<{ id: string }>, [
            parsed as ExpandedMonster,
          ]);
          break;
      }

      step.generatedIds = ids;
    } catch (error) {
      step.status = "failed";
      step.error = error instanceof Error ? error.message : String(error);
      step.completedAt = new Date().toISOString();
      await ctx.sessions.save(session);
      throw error;
    }

    // Mark step complete
    step.status = "completed";
    step.completedAt = new Date().toISOString();

    // Update overall status
    const hasInProgress = session.generation.history.some((s) => s.status === "in_progress");
    if (!hasInProgress) {
      if (session.generation.status === "seeding") {
        session.generation.status = "generating";
      } else if (session.generation.status === "expanding") {
        // Check if all expansion steps are completed
        const expansionSteps = session.generation.history.filter((s) =>
          s.type.startsWith("expand_")
        );
        const allExpanded =
          expansionSteps.length === 0 || expansionSteps.every((s) => s.status === "completed");
        if (allExpanded) {
          session.generation.status = "generating";
        }
      }
    }

    await ctx.sessions.save(session);

    return {
      message: `Saved ${step.type} result`,
      stepId: String(step.id),
      generatedIds: (step.generatedIds || []).map(String),
      status: String(session.generation.status),
    };
  },
});
