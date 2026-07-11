/**
 * Validate World Pack Tool
 *
 * Checks a world pack for completeness and consistency.
 */

import { z } from "zod";
import type { MCPToolEntry } from "@mythxengine/types";
import type { WorldContentPack, ValidationResult, ValidationIssue } from "@mythxengine/worlds";
import { connectionId } from "@mythxengine/worlds";
import { sessionManager } from "../../state/manager.js";
import { worldPackManager } from "../../state/worldpacks.js";

const ValidateWorldPackInput = z.object({
  sessionId: z.string().optional().describe("Session ID (if validating from session)"),
  packId: z.string().optional().describe("Pack ID (if validating saved pack)"),
});

/**
 * validate_world_pack tool
 */
export const validateWorldPackTool: MCPToolEntry = {
  name: "validate_world_pack",
  description: "Check a world pack for completeness, consistency, and broken references.",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Session ID (if validating from session)" },
      packId: { type: "string", description: "Pack ID (if validating saved pack)" },
    },
  },
  handler: async (args: unknown) => {
    const input = ValidateWorldPackInput.parse(args);

    if (!input.sessionId && !input.packId) {
      throw new Error("Either sessionId or packId must be provided");
    }

    let worldPack: WorldContentPack | null = null;

    if (input.packId) {
      worldPack = await worldPackManager.get(input.packId);
      if (!worldPack) {
        throw new Error(`World pack not found: ${input.packId}`);
      }
    } else if (input.sessionId) {
      const session = await sessionManager.get(input.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${input.sessionId}`);
      }
      if (!session.generation?.worldPackId) {
        throw new Error("No assembled world pack in session. Call assemble_world_pack first.");
      }
      worldPack = await worldPackManager.get(session.generation.worldPackId);
      if (!worldPack) {
        throw new Error(`World pack not found: ${session.generation.worldPackId}`);
      }
    }

    if (!worldPack) {
      throw new Error("Could not load world pack");
    }

    // Validate the world pack
    const result = validatePack(worldPack);

    return {
      packId: worldPack.meta.id,
      name: worldPack.meta.name,
      ...result,
    };
  },
};

/**
 * Validate a world pack and return issues
 */
function validatePack(pack: WorldContentPack): ValidationResult {
  const issues: ValidationIssue[] = [];
  const allIds = new Set<string>();
  const seenIds = new Set<string>();
  let missingReferences = 0;
  let duplicateIds = 0;

  // Collect all IDs
  const collectIds = (record: Record<string, { id: string }>, prefix: string) => {
    for (const [key, value] of Object.entries(record)) {
      if (seenIds.has(value.id)) {
        duplicateIds++;
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
  if (pack.factions) {
    collectIds(pack.factions, "factions");
  }
  if (pack.situations) {
    collectIds(pack.situations, "situations");
  }
  if (pack.arcs) {
    collectIds(pack.arcs, "arcs");
  }

  // Check references
  const checkRef = (ref: string, context: string) => {
    if (!allIds.has(ref)) {
      missingReferences++;
      issues.push({
        type: "warning",
        path: context,
        message: `Missing reference: ${ref}`,
      });
    }
  };

  // Check archetype starting items
  for (const [id, archetype] of Object.entries(pack.archetypes)) {
    for (const itemId of archetype.startingItems) {
      checkRef(itemId, `archetypes.${id}.startingItems`);
    }
  }

  // Check encounter monster references
  for (const [id, encounter] of Object.entries(pack.encounters)) {
    if (encounter.combat?.monsters) {
      for (const spawn of encounter.combat.monsters) {
        checkRef(spawn.monsterId, `encounters.${id}.combat.monsters`);
      }
    }
    if (encounter.social?.npcIds) {
      for (const npcId of encounter.social.npcIds) {
        checkRef(npcId, `encounters.${id}.social.npcIds`);
      }
    }
  }

  // Check location references
  for (const [id, location] of Object.entries(pack.locations)) {
    for (const conn of location.connections) {
      checkRef(connectionId(conn), `locations.${id}.connections`);
    }
    for (const encId of location.encounters) {
      checkRef(encId, `locations.${id}.encounters`);
    }
    for (const npcId of location.npcs) {
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

  // Check minimum content
  if (Object.keys(pack.archetypes).length === 0) {
    issues.push({
      type: "error",
      path: "archetypes",
      message: "No archetypes defined",
    });
  }

  if (Object.keys(pack.locations).length === 0) {
    issues.push({
      type: "warning",
      path: "locations",
      message: "No locations defined",
    });
  }

  if (!pack.narrativeGuidance.openingScenes.length) {
    issues.push({
      type: "warning",
      path: "narrativeGuidance.openingScenes",
      message: "No opening scenes defined",
    });
  }

  // Validate situations if present
  if (pack.situations && Object.keys(pack.situations).length > 0) {
    validateSituationsAndArcs(pack, issues, allIds, checkRef);
  }

  // Calculate totals
  const totalItems =
    Object.keys(pack.archetypes).length +
    Object.keys(pack.items).length +
    Object.keys(pack.monsters).length +
    Object.keys(pack.encounters).length +
    Object.keys(pack.conditions).length +
    Object.keys(pack.locations).length +
    Object.keys(pack.npcs).length +
    (pack.factions ? Object.keys(pack.factions).length : 0) +
    (pack.situations ? Object.keys(pack.situations).length : 0) +
    (pack.arcs ? Object.keys(pack.arcs).length : 0);

  const errorCount = issues.filter((i) => i.type === "error").length;

  return {
    valid: errorCount === 0,
    issues,
    stats: {
      totalItems,
      missingReferences,
      duplicateIds,
    },
  };
}

/**
 * Detect cycles in situation lead graph using DFS
 * Returns array of cycle descriptions for reporting
 */
function detectSituationCycles(
  situations: Record<string, { id: string; outgoingLeads: Array<{ targetSituationId: string }> }>
): string[] {
  const cycles: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(situationId: string, path: string[]): boolean {
    if (recursionStack.has(situationId)) {
      // Found a cycle - extract the cycle path
      const cycleStart = path.indexOf(situationId);
      const cyclePath = [...path.slice(cycleStart), situationId];
      cycles.push(cyclePath.join(" → "));
      return true;
    }

    if (visited.has(situationId)) {
      return false;
    }

    visited.add(situationId);
    recursionStack.add(situationId);

    const situation = situations[situationId];
    if (situation) {
      for (const lead of situation.outgoingLeads) {
        const targetId = lead.targetSituationId;
        if (situations[targetId]) {
          dfs(targetId, [...path, situationId]);
        }
      }
    }

    recursionStack.delete(situationId);
    return false;
  }

  // Run DFS from each unvisited node
  for (const situationId of Object.keys(situations)) {
    if (!visited.has(situationId)) {
      dfs(situationId, []);
    }
  }

  return cycles;
}

/**
 * Validate situations and arcs (Alexandrian node-based design)
 */
function validateSituationsAndArcs(
  pack: WorldContentPack,
  issues: ValidationIssue[],
  _allIds: Set<string>,
  checkRef: (ref: string, context: string) => void
): void {
  const situationIds = new Set<string>();
  const allLeadIds = new Set<string>();
  const incomingLeadCounts = new Map<string, number>();

  // Detect cycles in the situation graph
  if (pack.situations && Object.keys(pack.situations).length > 0) {
    const cycles = detectSituationCycles(pack.situations);
    for (const cycle of cycles) {
      issues.push({
        type: "warning",
        path: "situations",
        message: `Circular lead chain detected: ${cycle}. This may cause infinite loops or confusing navigation.`,
      });
    }
  }

  // Collect situation IDs and validate situations
  for (const [id, situation] of Object.entries(pack.situations || {})) {
    situationIds.add(situation.id);

    // Validate actor references
    for (const actor of situation.actors) {
      if (actor.entityId.startsWith("npc:")) {
        checkRef(actor.entityId, `situations.${id}.actors`);
      }
    }

    // Validate location references
    for (const locId of situation.locations.primary) {
      checkRef(locId, `situations.${id}.locations.primary`);
    }
    if (situation.locations.related) {
      for (const locId of situation.locations.related) {
        checkRef(locId, `situations.${id}.locations.related`);
      }
    }

    // Collect outgoing leads
    for (const lead of situation.outgoingLeads) {
      allLeadIds.add(lead.id);

      // Track incoming leads to target situations
      const targetId = lead.targetSituationId;
      const count = incomingLeadCounts.get(targetId) || 0;
      incomingLeadCounts.set(targetId, count + 1);

      // Validate lead source references
      if (lead.discovery.sourceId) {
        checkRef(lead.discovery.sourceId, `situations.${id}.outgoingLeads.${lead.id}`);
      }
    }

    // Validate incoming lead references
    for (const leadId of situation.entryPoints.incomingLeadIds) {
      if (!allLeadIds.has(leadId)) {
        // Lead might be defined in another situation we haven't processed yet
        // We'll check orphaned leads after processing all situations
      }
    }
  }

  // Three Clue Rule validation
  for (const [id, situation] of Object.entries(pack.situations || {})) {
    const incomingCount = incomingLeadCounts.get(situation.id) || 0;
    const directCount = situation.entryPoints.directDiscovery.length;
    const totalEntryPoints = incomingCount + directCount;

    const target = situation.entryPoints.minimumLeadsTarget || 3;

    if (totalEntryPoints < target) {
      issues.push({
        type: "warning",
        path: `situations.${id}.entryPoints`,
        message: `Three Clue Rule: Situation has ${totalEntryPoints} entry points (target: ${target}). Add more leads or direct discovery methods.`,
      });
    }
  }

  // Check for orphan situations (no entry points at all)
  for (const [id, situation] of Object.entries(pack.situations || {})) {
    const incomingCount = incomingLeadCounts.get(situation.id) || 0;
    const directCount = situation.entryPoints.directDiscovery.length;

    if (incomingCount === 0 && directCount === 0) {
      issues.push({
        type: "warning",
        path: `situations.${id}`,
        message: `Orphan situation: No way to discover this situation. Add leads from other situations or direct discovery methods.`,
      });
    }
  }

  // Validate lead network connectivity
  const leadTargets = new Set<string>();
  for (const [, situation] of Object.entries(pack.situations || {})) {
    for (const lead of situation.outgoingLeads) {
      leadTargets.add(lead.targetSituationId);

      // Validate target situation exists
      if (!situationIds.has(lead.targetSituationId)) {
        issues.push({
          type: "warning",
          path: `situations lead ${lead.id}`,
          message: `Lead points to unknown situation: ${lead.targetSituationId}`,
        });
      }
    }
  }

  // Validate arcs if present
  if (pack.arcs && Object.keys(pack.arcs).length > 0) {
    for (const [id, arc] of Object.entries(pack.arcs)) {
      // Validate situation references
      for (const sitId of arc.situationIds) {
        if (!situationIds.has(sitId)) {
          issues.push({
            type: "warning",
            path: `arcs.${id}.situationIds`,
            message: `Arc references unknown situation: ${sitId}`,
          });
        }
      }

      // Validate structure references
      if (arc.structure.entryPoints) {
        for (const entryId of arc.structure.entryPoints) {
          if (!situationIds.has(entryId)) {
            issues.push({
              type: "warning",
              path: `arcs.${id}.structure.entryPoints`,
              message: `Arc entry point references unknown situation: ${entryId}`,
            });
          }
        }
      }

      if (arc.structure.climax && !situationIds.has(arc.structure.climax)) {
        issues.push({
          type: "warning",
          path: `arcs.${id}.structure.climax`,
          message: `Arc climax references unknown situation: ${arc.structure.climax}`,
        });
      }

      if (arc.structure.hub && !situationIds.has(arc.structure.hub)) {
        issues.push({
          type: "warning",
          path: `arcs.${id}.structure.hub`,
          message: `Arc hub references unknown situation: ${arc.structure.hub}`,
        });
      }

      // Validate GM guidance NPC references
      for (const npcId of arc.gmGuidance.keyNpcs) {
        if (npcId.startsWith("npc:")) {
          checkRef(npcId, `arcs.${id}.gmGuidance.keyNpcs`);
        }
      }
    }
  }
}

export const validateTools = [validateWorldPackTool];
