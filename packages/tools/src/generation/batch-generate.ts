/**
 * Batch Generate Tool (Shared)
 *
 * Returns all generation prompts at once after seeding, enabling parallel LLM execution.
 * This eliminates the need to call each generator individually — one tool call
 * returns all prompts, the agent executes them in parallel, then calls batch_save.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldRulesConfig } from "@mythxengine/types";
import {
  tierContentCounts,
  type WorldTier,
  formatManifestList,
  formatManifestInline,
  formatMonsterManifest,
  formatItemManifest,
} from "./manifest-helpers.js";
import {
  buildRulesPromptSection,
  buildHPGuidelines,
  buildMonsterHPGuidelines,
} from "./rules-prompt.js";

export const BatchGenerateInputSchema = z.object({
  sessionId: z.string().describe("Session ID (must have a saved world seed)"),
  phases: z
    .array(
      z.enum([
        "archetypes",
        "monsters",
        "items",
        "encounters",
        "locations",
        "npcs",
        "narrative",
        "situations",
        "arcs",
      ])
    )
    .optional()
    .describe("Specific phases to generate (default: all)"),
});

export type BatchGenerateInput = z.infer<typeof BatchGenerateInputSchema>;

interface GenerationPrompt {
  phase: string;
  stepId: string;
  prompt: {
    system: string;
    user: string;
    outputSchemaName: string;
  };
}

export interface BatchGenerateOutput {
  sessionId: string;
  tier: string;
  recommendedCounts: Record<string, number>;
  prompts: GenerationPrompt[];
  message: string;
}

// Minimal world seed interface
interface WorldSeedMinimal {
  id: string;
  name: string;
  tagline: string;
  aesthetic: {
    visualStyle: string;
    tone: string;
    themes: string[];
    inspirations?: string[];
  };
  settings: {
    lethality: string;
    magicLevel: string;
    technologyLevel: string;
    supernaturalPresence: string;
  };
  coreConflict: string;
  archetypeSeeds: Array<{ id?: string; name: string; concept: string }>;
  locationSeeds: Array<{ id?: string; name: string; concept: string }>;
  npcSeeds: Array<{ id?: string; name: string; concept: string }>;
  monsterSeeds: Array<{ id?: string; name: string; concept: string; threat: string }>;
  itemSeeds?: Array<{ id?: string; name: string; kind?: string }>;
  situationSeeds?: Array<{ id?: string; name: string; concept: string; urgency?: string }>;
  arcSeeds?: Array<{ name: string; concept: string; structure?: string }>;
  rules?: WorldRulesConfig;
}

export const batchGenerateTool = defineSharedTool({
  name: "batch_generate",
  description:
    "After seeding, returns ALL generation prompts at once for parallel LLM execution. Execute each prompt with an LLM, then call save_generation_result for each result. This replaces calling individual generate_* tools one by one.",
  inputSchema: BatchGenerateInputSchema,

  handler: async (input, ctx): Promise<BatchGenerateOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) throw new Error(`Session not found: ${input.sessionId}`);
    if (!session.generation?.worldSeed) {
      throw new Error("World seed not found. Call generate_world_seed and save the result first.");
    }

    const worldSeed = session.generation.worldSeed as WorldSeedMinimal;
    const tier = (session.generation.tier || "medium") as WorldTier;
    const counts = tierContentCounts[tier];

    const allPhases = input.phases || [
      "archetypes",
      "monsters",
      "items",
      "encounters",
      "locations",
      "npcs",
      "narrative",
      "situations",
      "arcs",
    ];

    // Skip already-completed phases
    const completedTypes = new Set(
      session.generation.history.filter((s) => s.status === "completed").map((s) => s.type)
    );
    const pendingPhases = allPhases.filter((p) => !completedTypes.has(p));

    if (pendingPhases.length === 0) {
      return {
        sessionId: input.sessionId,
        tier,
        recommendedCounts: counts,
        prompts: [],
        message: "All requested phases already completed. Ready for assemble_world_pack.",
      };
    }

    const rulesSection = buildRulesPromptSection(worldSeed.rules);
    const hpGuidelines = buildHPGuidelines(worldSeed.rules);
    const monsterHPGuidelines = buildMonsterHPGuidelines(worldSeed.rules);

    const prompts: GenerationPrompt[] = [];

    for (const phase of pendingPhases) {
      const stepId = randomUUID();

      // Record the step
      session.generation.history.push({
        id: stepId,
        type: phase,
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: "in_progress",
        generatedIds: [],
      });

      const prompt = buildPromptForPhase(
        phase,
        worldSeed,
        counts,
        tier,
        rulesSection,
        hpGuidelines,
        monsterHPGuidelines
      );
      if (prompt) {
        prompts.push({ phase, stepId, prompt });
      }
    }

    session.generation.status = "generating";
    await ctx.sessions.save(session);

    return {
      sessionId: input.sessionId,
      tier,
      recommendedCounts: counts,
      prompts,
      message: `${prompts.length} generation prompts ready for parallel execution. Execute each with an LLM and call save_generation_result with each result.`,
    };
  },
});

function buildPromptForPhase(
  phase: string,
  seed: WorldSeedMinimal,
  counts: Record<string, number>,
  _tier: WorldTier,
  rulesSection: string,
  hpGuidelines: string,
  monsterHPGuidelines: string
): { system: string; user: string; outputSchemaName: string } | null {
  switch (phase) {
    case "archetypes":
      return {
        system: `You are a character archetype designer for tabletop RPGs.\n\n${rulesSection}\n\n${hpGuidelines}\n\nDesign Guidelines:\n- Ability modifiers should sum to approximately +2 total\n- Each archetype needs 2 unique features\n- Starting items should be 3-5 thematic items (reference by ID)\n\nOutput valid JSON only.`,
        user: `Generate ${counts.archetypes} playable character archetypes for:\n\nWorld: ${seed.name}\nTone: ${seed.aesthetic.tone}\nThemes: ${seed.aesthetic.themes.join(", ")}\nCore Conflict: ${seed.coreConflict}\n\nArchetype seeds:\n${seed.archetypeSeeds.map((a, i) => `${i + 1}. ${a.name}: ${a.concept}`).join("\n")}\n\nID Manifest:\nArchetype IDs: ${formatManifestInline(seed.archetypeSeeds, "archetype")}\nItem IDs: ${formatItemManifest(seed.itemSeeds || [], true)}\nLocation IDs: ${formatManifestInline(seed.locationSeeds, "location")}\n\nIMPORTANT: Use the archetype IDs above as-is.\n\nOutput: { "archetypes": [{ "id": "archetype:slug", "name": "...", "tagline": "...", "description": "...", "starting": { "abilities": { "STR": 0, "AGI": 0, "WIT": 0, "CON": 0 }, "hp": 10, "maxHp": 10 }, "startingItems": ["item:id"], "features": [{ "id": "feature:id", "name": "...", "description": "..." }], "playstyle": "...", "background": "...", "flavor": "..." }] }\n\nReturn ONLY the JSON object.`,
        outputSchemaName: "{ archetypes: WorldArchetype[] }",
      };

    case "monsters":
      return {
        system: `You are a monster designer for tabletop RPGs.\n\n${rulesSection}\n\n${monsterHPGuidelines}\n\nDesign Guidelines:\n- Armor: 0-1 for most, 2-3 for heavily armored\n- Each monster needs 1-3 attacks\n- Include morale, tactics, lore\n- Morale threshold MUST be 1-10 (never 0). Use checkWhen: "never" for fearless.\n\nOutput valid JSON only.`,
        user: `Generate ${counts.monsters} monsters for:\n\nWorld: ${seed.name}\nTone: ${seed.aesthetic.tone}\nCore Conflict: ${seed.coreConflict}\nLethality: ${seed.settings.lethality}\n\nMonster seeds:\n${seed.monsterSeeds.map((m, i) => `${i + 1}. ${m.name} (${m.threat}): ${m.concept}`).join("\n")}\n\nID Manifest:\nMonster IDs: ${formatMonsterManifest(seed.monsterSeeds, true)}\nLocation IDs: ${formatManifestInline(seed.locationSeeds, "location")}\n\nIMPORTANT: Use the monster IDs above as-is.\n\nOutput: { "monsters": [{ "id": "monster:slug", "name": "...", "description": "...", "hp": 10, "armor": 0, "abilities": {}, "threat": "...", "attacks": [{ "name": "...", "ability": "STR", "damage": "d6", "properties": [], "flavor": "..." }], "specialAbilities": [], "morale": { "threshold": 5, "checkWhen": "belowHalfHP", "fleesBelowHP": 3 }, "tactics": { "preferredRange": "melee", "targetPriority": "nearest" }, "lore": "...", "encounterText": "...", "deathText": "..." }] }\n\nReturn ONLY the JSON object.`,
        outputSchemaName: "{ monsters: WorldMonster[] }",
      };

    case "items":
      return {
        system: `You are an item designer for tabletop RPGs.\n\n${rulesSection}\n\nItem Guidelines:\n- Weapons: d4=light, d6=standard, d8=heavy, d10=two-handed, d12=devastating\n- Armor: 1=light, 2=medium, 3=heavy damage reduction\n\nOutput valid JSON only.`,
        user: `Generate ${counts.items} items for:\n\nWorld: ${seed.name}\nTechnology: ${seed.settings.technologyLevel}\nMagic: ${seed.settings.magicLevel}\n\nArchetypes: ${seed.archetypeSeeds.map((a) => a.name).join(", ")}\n\nID Manifest:\nItem IDs: ${formatItemManifest(seed.itemSeeds || [])}\nArchetype IDs: ${formatManifestInline(seed.archetypeSeeds, "archetype")}\n\nIMPORTANT: Use item IDs from the manifest.\n\nOutput: { "items": [{ "id": "item:slug", "name": "...", "kind": "weapon|armor|consumable|special|misc", "description": "...", "flavor": "...", "tags": [], "slots": 1, "weapon": { "damage": "d6", "ability": "STR", "properties": [] }, "armor": { "damageReduction": 1, "properties": [] }, "consumable": { "uses": 1, "effect": "...", "effectDescription": "..." } }] }\n\nInclude weapon/armor/consumable objects only for their respective kinds.\nReturn ONLY the JSON object.`,
        outputSchemaName: "{ items: WorldItem[] }",
      };

    case "encounters":
      return {
        system: `You are an encounter designer for tabletop RPGs.\n\n${rulesSection}\n\nEncounter types: combat, event, social.\nOutput valid JSON only.`,
        user: `Generate ${counts.encounters} encounters for:\n\nWorld: ${seed.name}\nTone: ${seed.aesthetic.tone}\nLethality: ${seed.settings.lethality}\n\nID Manifest:\nMonster IDs: ${formatMonsterManifest(seed.monsterSeeds)}\nNPC IDs: ${formatManifestInline(seed.npcSeeds, "npc")}\nLocation IDs: ${formatManifestInline(seed.locationSeeds, "location")}\n\nIMPORTANT: Use IDs from the manifest only.\n\nOutput: { "encounters": [{ "id": "encounter:slug", "name": "...", "type": "combat|event|social", "description": "...", "text": "...", "gmGuidance": "...", "outcomes": [], "combat": { "monsters": [{ "monsterId": "monster:id", "count": 2 }], "surprise": "none", "environment": { "lighting": "bright", "terrain": "open", "hazards": [] } }, "event": { "choices": [{ "text": "...", "test": { "ability": "STR", "difficulty": 12 }, "successOutcome": "...", "failureOutcome": "..." }] }, "social": { "npcIds": [], "initialAttitude": "neutral", "negotiable": true } }] }\n\nInclude combat/event/social objects only for their respective types.\nReturn ONLY the JSON object.`,
        outputSchemaName: "{ encounters: WorldEncounter[] }",
      };

    case "locations":
      return {
        system: `You are a location designer for tabletop RPGs.\n\n${rulesSection}\n\nLocation types: settlement, dungeon, wilderness, landmark, building.\nOutput valid JSON only.`,
        user: `Generate ${counts.locations} locations for:\n\nWorld: ${seed.name}\nVisual Style: ${seed.aesthetic.visualStyle}\nTone: ${seed.aesthetic.tone}\nCore Conflict: ${seed.coreConflict}\n\nLocation seeds:\n${seed.locationSeeds.map((l, i) => `${i + 1}. ${l.name}: ${l.concept}`).join("\n")}\n\nID Manifest:\nLocation IDs: ${formatManifestList(seed.locationSeeds, "location")}\nNPC IDs: ${formatManifestInline(seed.npcSeeds, "npc")}\n\nIMPORTANT:\n- Use location IDs from the manifest as-is.\n- Leave encounters[] as an EMPTY ARRAY []. Encounters reference locations, not vice versa.\n- Reference NPC IDs for npcs[] arrays.\n\nOutput: { "locations": [{ "id": "location:slug", "name": "...", "description": "...", "type": "settlement|dungeon|wilderness|landmark|building", "atmosphere": "...", "features": [], "connections": ["location:other-id"], "encounters": [], "npcs": ["npc:id"], "secrets": [], "gmNotes": "..." }] }\n\nReturn ONLY the JSON object.`,
        outputSchemaName: "{ locations: WorldLocation[] }",
      };

    case "npcs":
      return {
        system: `You are an NPC designer for tabletop RPGs.\n\n${rulesSection}\n\nNPC roles: quest_giver, ally, obstacle, information, antagonist, merchant, background.\nOutput valid JSON only.`,
        user: `Generate ${counts.npcs} NPCs for:\n\nWorld: ${seed.name}\nTone: ${seed.aesthetic.tone}\nCore Conflict: ${seed.coreConflict}\n\nNPC seeds:\n${seed.npcSeeds.map((n, i) => `${i + 1}. ${n.name}: ${n.concept}`).join("\n")}\n\nID Manifest:\nNPC IDs: ${formatManifestList(seed.npcSeeds, "npc")}\nLocation IDs: ${formatManifestInline(seed.locationSeeds, "location")}\n\nIMPORTANT: Use NPC IDs from the manifest as-is.\n\nOutput: { "npcs": [{ "id": "npc:slug", "name": "...", "description": "...", "personality": "...", "motivation": "...", "attitude": "friendly|neutral|hostile|unknown", "dialogueHints": [], "narrativeRole": "quest_giver|ally|obstacle|information|antagonist|merchant|background", "locations": ["location:id"], "relationships": { "npc:other-id": "description" }, "secrets": [] }] }\n\nReturn ONLY the JSON object.`,
        outputSchemaName: "{ npcs: WorldNPC[] }",
      };

    case "narrative":
      return {
        system: `You are a narrative designer for tabletop RPGs. Create guidance for GMs and AI.\nOutput valid JSON only.`,
        user: `Generate narrative guidance for:\n\nWorld: ${seed.name}\nTagline: ${seed.tagline}\nTone: ${seed.aesthetic.tone}\nThemes: ${seed.aesthetic.themes.join(", ")}\nCore Conflict: ${seed.coreConflict}\n\nArchetypes: ${seed.archetypeSeeds.map((a) => a.name).join(", ")}\nLocations: ${seed.locationSeeds.map((l) => l.name).join(", ")}\nNPCs: ${seed.npcSeeds.map((n) => n.name).join(", ")}\n\nOutput: { "narrative": { "openingScenes": ["..."], "plotHooks": ["..."], "commonConflicts": ["..."], "resolutionPatterns": ["..."] } }\n\nReturn ONLY the JSON object.`,
        outputSchemaName: "NarrativeGuidance",
      };

    case "situations":
      return {
        system: `You are a scenario designer using Alexandrian node-based design.\n\nKey Principles:\n1. THREE CLUE RULE: 3+ ways to discover each situation\n2. PROACTIVE ELEMENTS: Clocks for time pressure\n3. LEADS AS EDGES: Connect situations with discoverable info\n4. SITUATIONS NOT PLOTS: Circumstances, not predetermined events\n\nOutput valid JSON only.`,
        user: `Generate ${counts.situations} interconnected situations for:\n\nWorld: ${seed.name}\nTone: ${seed.aesthetic.tone}\nCore Conflict: ${seed.coreConflict}\n\n${seed.situationSeeds?.length ? `Situation seeds:\n${seed.situationSeeds.map((s, i) => `${i + 1}. ${s.name}: ${s.concept}${s.urgency ? ` (${s.urgency})` : ""}`).join("\n")}` : "Create situations exploring the core conflict."}\n\nID Manifest:\nNPC IDs:\n${formatManifestList(seed.npcSeeds, "npc")}\nLocation IDs:\n${formatManifestList(seed.locationSeeds, "location")}\n\nIMPORTANT: Use NPC/Location IDs from the manifest. For situation cross-references, use IDs you define in this batch.\n\nOutput: { "situations": [{ "id": "situation:slug", "name": "...", "description": "...", "status": "brewing", "stakes": { "risks": [], "opportunities": [], "ifIgnored": "..." }, "actors": [{ "entityId": "npc:id", "agenda": "...", "leverage": "...", "defaultAction": "...", "isPrimaryAntagonist": false }], "locations": { "primary": ["location:id"], "related": [], "details": {} }, "clock": { "id": "clock:name", "name": "...", "doom": "...", "stages": [{ "id": "stage-1", "name": "...", "description": "...", "trigger": { "type": "time", "minutesFromStart": 1440 }, "consequences": { "setFlags": [], "narrative": "..." }, "reversible": true }], "currentStage": null, "startedAt": null, "paused": false }, "outgoingLeads": [{ "id": "lead:source-to-target", "information": "...", "targetSituationId": "situation:target", "discovery": { "method": "npc|location|investigation|observation|document|consequence|rumor|item", "sourceId": "npc:or-location:id", "description": "..." }, "prominence": "obvious|available|hidden|obscured" }], "entryPoints": { "incomingLeadIds": [], "directDiscovery": [{ "method": "...", "description": "...", "locationId": "location:id" }], "minimumLeadsTarget": 3 }, "complications": [{ "id": "comp-1", "description": "...", "type": "obstacle|opposition|moral|resource|time|information|relationship", "resolutions": [] }], "outcomes": { "victory": { "description": "...", "consequences": [], "flagsSet": [] }, "failure": { "description": "...", "consequences": [], "flagsSet": [] }, "partial": [{ "name": "...", "description": "...", "consequences": [], "flagsSet": [] }] }, "gmGuidance": { "themes": [], "toneNotes": "...", "anticipatedApproaches": [{ "approach": "...", "response": "..." }], "foreshadowing": [] }, "tags": [], "layer": 1 }] }\n\nReturn ONLY the JSON object.`,
        outputSchemaName: "{ situations: WorldSituation[] }",
      };

    case "arcs": {
      const sitSeeds = seed.situationSeeds || [];
      const sitSection =
        sitSeeds.length > 0
          ? `Situation seeds (pre-allocated IDs):\n${sitSeeds.map((s) => `- ${s.id || `situation:${s.name.toLowerCase().replace(/\s+/g, "-")}`}: ${s.name} - ${s.concept}`).join("\n")}`
          : "Situations are being generated in parallel — use situation:slug-name format for references.";

      return {
        system: `You are a narrative architect. Create story arcs grouping situations.\n\nArc structures: funnel, layer_cake, hub_spoke, chain, web.\nOutput valid JSON only.`,
        user: `Generate ${counts.arcs} story arc(s) for:\n\nWorld: ${seed.name}\nTone: ${seed.aesthetic.tone}\nCore Conflict: ${seed.coreConflict}\n\n${sitSection}\n\nID Manifest:\nNPC IDs: ${formatManifestInline(seed.npcSeeds, "npc")}\n\nOutput: { "arcs": [{ "id": "arc:slug", "name": "...", "description": "...", "tension": { "centralConflict": "...", "source": "...", "opposingForces": [{ "name": "...", "goal": "...", "factionId": "" }], "urgency": "..." }, "situationIds": ["situation:id"], "structure": { "type": "funnel|layer_cake|hub_spoke|chain|web", "layers": {}, "entryPoints": [], "climax": "situation:id", "hub": "", "suggestedOrder": [] }, "resolution": { "patterns": [{ "name": "...", "description": "...", "triggerConditions": [] }], "unlocksArcs": [], "worldChanges": [] }, "themes": [], "gmGuidance": { "introduction": "...", "pacing": "...", "keyNpcs": ["npc:id"], "atmosphere": "..." }, "status": "dormant" }] }\n\nReturn ONLY the JSON object.`,
        outputSchemaName: "{ arcs: WorldArc[] }",
      };
    }

    default:
      return null;
  }
}
