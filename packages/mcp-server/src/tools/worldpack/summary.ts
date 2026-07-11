/**
 * World Pack Summary Tool
 *
 * Returns a compact, token-efficient GM reference for gameplay.
 * Use lookup tools (get_archetype, get_location, etc.) for full entity details.
 */

import { z } from "zod";
import type { MCPToolEntry } from "@mythxengine/types";
import type { WorldContentPack } from "@mythxengine/worlds";
import { connectionId } from "@mythxengine/worlds";
import { worldPackManager } from "../../state/worldpacks.js";

const LoadWorldSummaryInput = z.object({
  packId: z.string().describe("Pack ID to load"),
});

/**
 * Generate a compact markdown summary of a world pack
 */
function generateWorldSummary(pack: WorldContentPack): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${pack.meta.name}`);
  lines.push(`*${pack.meta.tagline}*`);
  lines.push("");

  // World settings (compact)
  lines.push("## World");
  lines.push(
    `- **Tone**: ${pack.meta.aesthetic.tone} | **Magic**: ${pack.meta.settings.magicLevel} | **Lethality**: ${pack.meta.settings.lethality}`
  );
  lines.push(`- **Themes**: ${pack.meta.aesthetic.themes.join(", ")}`);
  lines.push("");

  // Archetypes table
  const archetypes = Object.values(pack.archetypes);
  lines.push(`## Archetypes (${archetypes.length})`);
  lines.push("| ID | Name | Tagline | HP | Key Ability |");
  lines.push("|----|------|---------|-----|-------------|");
  for (const a of archetypes) {
    const abilities = a.starting.abilities;
    const keyAbility =
      Object.entries(abilities)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}+${v}`)
        .join(", ") || "balanced";
    lines.push(`| ${a.id} | ${a.name} | ${a.tagline} | ${a.starting.hp} | ${keyAbility} |`);
  }
  lines.push("");

  // Locations table
  const locations = Object.values(pack.locations);
  lines.push(`## Locations (${locations.length})`);
  lines.push("| ID | Name | Type | Connects To |");
  lines.push("|----|------|------|-------------|");
  for (const loc of locations) {
    const connectionIds = loc.connections.map(connectionId);
    const connections = connectionIds.length > 0 ? connectionIds.join(", ") : "-";
    lines.push(`| ${loc.id} | ${loc.name} | ${loc.type} | ${connections} |`);
  }
  lines.push("");

  // NPCs table
  const npcs = Object.values(pack.npcs);
  lines.push(`## NPCs (${npcs.length})`);
  lines.push("| ID | Name | Role | Attitude | Locations |");
  lines.push("|----|------|------|----------|-----------|");
  for (const npc of npcs) {
    const locs = npc.locations?.join(", ") || "-";
    lines.push(`| ${npc.id} | ${npc.name} | ${npc.narrativeRole} | ${npc.attitude} | ${locs} |`);
  }
  lines.push("");

  // Monsters table
  const monsters = Object.values(pack.monsters);
  lines.push(`## Monsters (${monsters.length})`);
  lines.push("| ID | Name | Threat | HP | Armor |");
  lines.push("|----|------|--------|-----|-------|");
  for (const m of monsters) {
    lines.push(`| ${m.id} | ${m.name} | ${m.threat} | ${m.hp} | ${m.armor} |`);
  }
  lines.push("");

  // Items table (compact - name and type only)
  const items = Object.values(pack.items);
  lines.push(`## Items (${items.length})`);
  lines.push("| ID | Name | Type |");
  lines.push("|----|------|------|");
  for (const item of items) {
    lines.push(`| ${item.id} | ${item.name} | ${item.kind} |`);
  }
  lines.push("");

  // Encounters table
  const encounters = Object.values(pack.encounters);
  lines.push(`## Encounters (${encounters.length})`);
  lines.push("| ID | Type | Name |");
  lines.push("|----|------|------|");
  for (const enc of encounters) {
    lines.push(`| ${enc.id} | ${enc.type} | ${enc.name} |`);
  }
  lines.push("");

  // Conditions table
  const conditions = Object.values(pack.conditions);
  if (conditions.length > 0) {
    lines.push(`## Conditions (${conditions.length})`);
    lines.push("| ID | Name | Duration |");
    lines.push("|----|------|----------|");
    for (const cond of conditions) {
      const dur = typeof cond.duration === "number" ? `${cond.duration} rounds` : cond.duration;
      lines.push(`| ${cond.id} | ${cond.name} | ${dur} |`);
    }
    lines.push("");
  }

  // Factions table (if present)
  const factions = pack.factions ? Object.values(pack.factions) : [];
  if (factions.length > 0) {
    lines.push(`## Factions (${factions.length})`);
    lines.push("| ID | Name | Goal |");
    lines.push("|----|------|------|");
    for (const faction of factions) {
      const goal = faction.goals[0] || "-";
      lines.push(`| ${faction.id} | ${faction.name} | ${goal} |`);
    }
    lines.push("");
  }

  // Situations table (if present)
  const situations = pack.situations ? Object.values(pack.situations) : [];
  if (situations.length > 0) {
    lines.push(`## Situations (${situations.length})`);
    lines.push("| ID | Name | Status | Clock |");
    lines.push("|----|------|--------|-------|");
    for (const sit of situations) {
      let clockInfo = "-";
      if (sit.clock) {
        clockInfo = sit.clock.doom;
      }
      lines.push(`| ${sit.id} | ${sit.name} | ${sit.status} | ${clockInfo} |`);
    }
    lines.push("");
  }

  // Arcs table (if present)
  const arcs = pack.arcs ? Object.values(pack.arcs) : [];
  if (arcs.length > 0) {
    lines.push(`## Arcs (${arcs.length})`);
    lines.push("| ID | Name | Status | Structure |");
    lines.push("|----|------|--------|-----------|");
    for (const arc of arcs) {
      lines.push(`| ${arc.id} | ${arc.name} | ${arc.status} | ${arc.structure.type} |`);
    }
    lines.push("");
  }

  // Narrative hooks
  lines.push("## Narrative Hooks");
  for (const hook of pack.narrativeGuidance.plotHooks.slice(0, 5)) {
    lines.push(`- ${hook}`);
  }
  lines.push("");

  // Opening scenes (first 3)
  lines.push("## Opening Scenes");
  for (const scene of pack.narrativeGuidance.openingScenes.slice(0, 3)) {
    lines.push(`- ${scene}`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * load_world_summary tool
 */
export const loadWorldSummaryTool: MCPToolEntry = {
  name: "load_world_summary",
  description:
    "Load a compact GM reference for a world pack. Returns a token-efficient summary with entity IDs, names, and key stats. Use get_* tools (get_archetype, get_location, etc.) for full entity details.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID to load" },
    },
    required: ["packId"],
  },
  handler: async (args: unknown) => {
    const input = LoadWorldSummaryInput.parse(args);

    const pack = await worldPackManager.get(input.packId);
    if (!pack) {
      throw new Error(`World pack not found: ${input.packId}`);
    }

    const summary = generateWorldSummary(pack);

    return {
      packId: input.packId,
      name: pack.meta.name,
      summary,
    };
  },
};

export const summaryTools = [loadWorldSummaryTool];
