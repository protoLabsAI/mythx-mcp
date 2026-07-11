/**
 * Export World Pack Tool
 *
 * Exports a world pack to various formats.
 */

import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { MCPToolEntry } from "@mythxengine/types";
import type { WorldContentPack } from "@mythxengine/worlds";
import { sessionManager } from "../../state/manager.js";
import { worldPackManager } from "../../state/worldpacks.js";
import { EXPORT_DIR } from "../../config/paths.js";

const ExportWorldPackInput = z.object({
  sessionId: z.string().optional().describe("Session ID (if exporting from session)"),
  packId: z.string().optional().describe("Pack ID (if exporting saved pack)"),
  format: z.enum(["json", "markdown", "both"]).optional().default("json"),
});

/**
 * export_world_pack tool
 */
export const exportWorldPackTool: MCPToolEntry = {
  name: "export_world_pack",
  description: "Export a world pack to JSON and/or markdown format.",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Session ID (if exporting from session)" },
      packId: { type: "string", description: "Pack ID (if exporting saved pack)" },
      format: {
        type: "string",
        enum: ["json", "markdown", "both"],
        description: "Export format (default: json)",
      },
    },
  },
  handler: async (args: unknown) => {
    const input = ExportWorldPackInput.parse(args);

    if (!input.sessionId && !input.packId) {
      throw new Error("Either sessionId or packId must be provided");
    }

    let worldPack: WorldContentPack | null = null;
    let packId: string;

    if (input.packId) {
      packId = input.packId;
      worldPack = await worldPackManager.get(packId);
      if (!worldPack) {
        throw new Error(`World pack not found: ${packId}`);
      }
    } else if (input.sessionId) {
      const session = await sessionManager.get(input.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${input.sessionId}`);
      }
      if (!session.generation?.worldPackId) {
        throw new Error("No assembled world pack in session. Call assemble_world_pack first.");
      }
      packId = session.generation.worldPackId;
      worldPack = await worldPackManager.get(packId);
      if (!worldPack) {
        throw new Error(`World pack not found: ${packId}`);
      }
    } else {
      throw new Error("Could not determine pack ID");
    }

    await mkdir(EXPORT_DIR, { recursive: true });

    const exportedFiles: string[] = [];
    const format = input.format || "json";

    // Export JSON
    if (format === "json" || format === "both") {
      const jsonPath = join(EXPORT_DIR, `${packId}.json`);
      await writeFile(jsonPath, JSON.stringify(worldPack, null, 2), "utf-8");
      exportedFiles.push(jsonPath);
    }

    // Export Markdown
    if (format === "markdown" || format === "both") {
      const markdown = generateMarkdown(worldPack);
      const mdPath = join(EXPORT_DIR, `${packId}.md`);
      await writeFile(mdPath, markdown, "utf-8");
      exportedFiles.push(mdPath);
    }

    return {
      message: `World pack exported`,
      packId,
      name: worldPack.meta.name,
      files: exportedFiles,
    };
  },
};

/**
 * Generate markdown documentation for a world pack
 */
function generateMarkdown(pack: WorldContentPack): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${pack.meta.name}`);
  lines.push("");
  lines.push(`> ${pack.meta.tagline}`);
  lines.push("");

  // Overview
  lines.push("## Overview");
  lines.push("");
  lines.push(`**Tone:** ${pack.meta.aesthetic.tone}`);
  lines.push(`**Themes:** ${pack.meta.aesthetic.themes.join(", ")}`);
  lines.push(`**Visual Style:** ${pack.meta.aesthetic.visualStyle}`);
  lines.push("");
  lines.push(`**Settings:**`);
  lines.push(`- Lethality: ${pack.meta.settings.lethality}`);
  lines.push(`- Magic Level: ${pack.meta.settings.magicLevel}`);
  lines.push(`- Technology: ${pack.meta.settings.technologyLevel}`);
  lines.push(`- Supernatural: ${pack.meta.settings.supernaturalPresence}`);
  lines.push("");

  // Archetypes
  lines.push("## Archetypes");
  lines.push("");
  for (const archetype of Object.values(pack.archetypes)) {
    lines.push(`### ${archetype.name}`);
    lines.push(`*${archetype.tagline}*`);
    lines.push("");
    lines.push(archetype.description);
    lines.push("");
    lines.push(
      `**Starting Stats:** HP ${archetype.starting.hp} | STR ${archetype.starting.abilities.STR} AGI ${archetype.starting.abilities.AGI} WIT ${archetype.starting.abilities.WIT} CON ${archetype.starting.abilities.CON}`
    );
    lines.push("");
    lines.push("**Features:**");
    for (const feature of archetype.features) {
      lines.push(`- **${feature.name}:** ${feature.description}`);
    }
    lines.push("");
    lines.push(`**Playstyle:** ${archetype.playstyle}`);
    lines.push("");
    lines.push(`*${archetype.flavor}*`);
    lines.push("");
  }

  // Locations
  lines.push("## Locations");
  lines.push("");
  for (const location of Object.values(pack.locations)) {
    lines.push(`### ${location.name}`);
    lines.push(`*${location.type}*`);
    lines.push("");
    lines.push(location.description);
    lines.push("");
    lines.push(`**Atmosphere:** ${location.atmosphere}`);
    lines.push("");
    if (location.features.length > 0) {
      lines.push("**Features:**");
      for (const feature of location.features) {
        lines.push(`- ${feature}`);
      }
      lines.push("");
    }
  }

  // NPCs
  lines.push("## NPCs");
  lines.push("");
  for (const npc of Object.values(pack.npcs)) {
    lines.push(`### ${npc.name}`);
    lines.push(`*${npc.narrativeRole} - ${npc.attitude}*`);
    lines.push("");
    lines.push(npc.description);
    lines.push("");
    lines.push(`**Personality:** ${npc.personality}`);
    lines.push(`**Motivation:** ${npc.motivation}`);
    lines.push("");
  }

  // Monsters
  lines.push("## Monsters");
  lines.push("");
  for (const monster of Object.values(pack.monsters)) {
    lines.push(`### ${monster.name}`);
    lines.push(`*${monster.threat}*`);
    lines.push("");
    lines.push(monster.description);
    lines.push("");
    // Abilities are optional — minions and simple creatures fight on
    // HP/damage alone. Only render the ability line when scores exist.
    const abilityLine = monster.abilities
      ? ` | STR ${monster.abilities.STR} AGI ${monster.abilities.AGI} WIT ${monster.abilities.WIT} CON ${monster.abilities.CON}`
      : "";
    lines.push(`**Stats:** HP ${monster.hp} | Armor ${monster.armor}${abilityLine}`);
    lines.push("");
    lines.push("**Attacks:**");
    for (const attack of monster.attacks) {
      lines.push(`- **${attack.name}:** ${attack.damage} (${attack.ability}) - ${attack.flavor}`);
    }
    lines.push("");
    lines.push(
      `**Tactics:** ${monster.tactics.specialBehavior || `Prefers ${monster.tactics.preferredRange}, targets ${monster.tactics.targetPriority}`}`
    );
    lines.push("");
    lines.push(`**Lore:** ${monster.lore}`);
    lines.push("");
  }

  // Narrative Guidance
  lines.push("## Narrative Guidance");
  lines.push("");
  lines.push("### Opening Scenes");
  for (const scene of pack.narrativeGuidance.openingScenes) {
    lines.push(`- ${scene}`);
  }
  lines.push("");
  lines.push("### Plot Hooks");
  for (const hook of pack.narrativeGuidance.plotHooks) {
    lines.push(`- ${hook}`);
  }
  lines.push("");
  lines.push("### Common Conflicts");
  for (const conflict of pack.narrativeGuidance.commonConflicts) {
    lines.push(`- ${conflict}`);
  }
  lines.push("");

  return lines.join("\n");
}

export const exportTools = [exportWorldPackTool];
