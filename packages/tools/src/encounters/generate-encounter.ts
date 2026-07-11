/**
 * Generate Encounter Tool (Shared)
 *
 * On-demand encounter generation using available monsters from the world pack.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { DIFFICULTIES, ENCOUNTER_TYPES, type Difficulty } from "./types.js";
import {
  getMonsters,
  getLocations,
  getPartyStrength,
  getTargetThreat,
  selectMonsters,
  getThreatValue,
} from "./helpers.js";

export const GenerateEncounterInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  difficulty: z.enum(DIFFICULTIES).describe("How challenging the encounter should be"),
  type: z.enum(ENCOUNTER_TYPES).default("combat").describe("Type of encounter"),
  locationId: z.string().optional().describe("Use location-appropriate content"),
  theme: z.string().optional().describe("Theme like 'ambush', 'negotiation', 'chase'"),
  includeMonsterIds: z.array(z.string()).optional().describe("Force specific monsters"),
  excludeMonsterIds: z.array(z.string()).optional().describe("Exclude these monsters"),
});

export type GenerateEncounterInput = z.infer<typeof GenerateEncounterInputSchema>;

export interface GenerateEncounterOutput {
  message: string;
  encounter: {
    id: string;
    name: string;
    type: string;
    difficulty: Difficulty;
    threatTotal?: number;
    partySize?: number;
    monsters?: Array<{
      id: string;
      name: string;
      count: number;
      threatTier: string;
      hp: number;
    }>;
    setup: string;
    tactics?: string;
    environment?: string;
    outcomes?: {
      victory?: {
        description: string;
        loot: string;
      };
      defeat?: {
        description: string;
        consequences: string[];
      };
      escape?: {
        how: string;
        consequences: string[];
      };
    };
    description?: string;
    resolution?: {
      success: string;
      failure: string;
      partial: string;
    };
    difficultyGuidance?: string;
    locationId?: string;
    theme?: string;
  };
  notes?: {
    balanceCheck: string;
  };
  error?: string;
  suggestion?: string;
}

export const generateEncounterTool = defineSharedTool({
  name: "generate_encounter",
  description:
    "Create an encounter matching the specified parameters. Uses available monsters from the world pack.",
  inputSchema: GenerateEncounterInputSchema,

  handler: async (input, ctx): Promise<GenerateEncounterOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const monsters = getMonsters(session);
    const locations = getLocations(session);

    if (monsters.length === 0 && input.type === "combat") {
      return {
        message: "No monsters available",
        encounter: {
          id: "",
          name: "",
          type: input.type,
          difficulty: input.difficulty,
          setup: "",
        },
        error: "No monsters available. Generate monsters first with generate_monsters.",
        suggestion: "Create a world pack with monsters before generating combat encounters.",
      };
    }

    // Get location context if provided
    const location = input.locationId
      ? locations.find((l) => l.id === input.locationId)
      : undefined;

    const partySize = getPartyStrength(session);
    const target = getTargetThreat(input.difficulty, partySize);

    // Generate based on type
    if (input.type === "combat") {
      // Filter monsters by theme if provided
      let availableMonsters = monsters;
      if (input.theme) {
        const themeLower = input.theme.toLowerCase();
        const themeMonsters = monsters.filter(
          (m) =>
            m.tags?.some((t) => t.toLowerCase().includes(themeLower)) ||
            m.name.toLowerCase().includes(themeLower) ||
            m.description.toLowerCase().includes(themeLower)
        );
        if (themeMonsters.length > 0) {
          availableMonsters = themeMonsters;
        }
      }

      // Select monsters
      const selected = selectMonsters(
        availableMonsters,
        target,
        input.includeMonsterIds || [],
        input.excludeMonsterIds || []
      );

      if (selected.length === 0) {
        return {
          message: "Could not select monsters",
          encounter: {
            id: "",
            name: "",
            type: input.type,
            difficulty: input.difficulty,
            setup: "",
          },
          error: "Could not select appropriate monsters for this encounter.",
          suggestion: "Try different parameters or add more monsters to the world.",
        };
      }

      // Calculate actual threat
      const totalThreat = selected.reduce((sum, s) => sum + getThreatValue(s.monster) * s.count, 0);

      // Generate encounter details
      const encounterName = input.theme
        ? `${input.theme.charAt(0).toUpperCase() + input.theme.slice(1)} Encounter`
        : `${input.difficulty.charAt(0).toUpperCase() + input.difficulty.slice(1)} Combat`;

      // Build setup based on theme
      let setup = "The enemies become aware of the party's presence.";
      let tactics = "Fight until reduced to half HP, then consider retreat.";

      if (input.theme) {
        const themeLower = input.theme.toLowerCase();
        if (themeLower.includes("ambush")) {
          setup = "The enemies lie in wait, hidden. They strike when the party is vulnerable.";
          tactics = "Focus fire on isolated targets. Use terrain for cover.";
        } else if (themeLower.includes("chase")) {
          setup = "The enemies are fleeing (or pursuing). This is a running battle.";
          tactics = "Split up to confuse pursuers. Use obstacles to slow the other side.";
        } else if (themeLower.includes("defense")) {
          setup = "The enemies are defending a position. They have prepared.";
          tactics = "Hold ground. Use chokepoints and ranged attacks.";
        }
      }

      // Use monster tactics if available
      const primaryMonster = selected.reduce((best, curr) =>
        getThreatValue(curr.monster) > getThreatValue(best.monster) ? curr : best
      ).monster;
      if (primaryMonster.tactics) {
        tactics = primaryMonster.tactics;
      }

      const encounter = {
        id: `encounter:generated-${Date.now()}`,
        name: encounterName,
        type: "combat",
        difficulty: input.difficulty,
        threatTotal: totalThreat,
        partySize,

        monsters: selected.map((s) => ({
          id: s.monster.id,
          name: s.monster.name,
          count: s.count,
          threatTier: s.monster.threatTier,
          hp: s.monster.hp,
        })),

        setup,
        tactics,
        environment: location?.atmosphere || "Standard terrain with some cover available.",

        outcomes: {
          victory: {
            description: "The enemies are defeated.",
            loot: "Search the fallen for valuables.",
          },
          defeat: {
            description: "The party is overwhelmed.",
            consequences: ["Captured", "Robbed and left for dead", "Forced to flee"],
          },
          escape: {
            how: "Disengage and flee the area.",
            consequences: ["Enemies may pursue", "Lost opportunity"],
          },
        },

        locationId: input.locationId,
        theme: input.theme,
      };

      return {
        message: `Generated ${input.difficulty} combat encounter`,
        encounter,
        notes: {
          balanceCheck:
            totalThreat >= target.min && totalThreat <= target.max
              ? "Within target range"
              : totalThreat > target.max
                ? "Slightly overtuned - consider removing a monster"
                : "Slightly undertuned - consider adding minions",
        },
      };
    } else {
      // Non-combat encounter
      const encounter = {
        id: `encounter:generated-${Date.now()}`,
        name: `${input.type.charAt(0).toUpperCase() + input.type.slice(1)} Challenge`,
        type: input.type,
        difficulty: input.difficulty,

        description:
          input.type === "social"
            ? "A social situation requiring negotiation, persuasion, or deception."
            : input.type === "puzzle"
              ? "A puzzle or riddle that must be solved to proceed."
              : "An environmental hazard or obstacle to overcome.",

        setup: `Present the ${input.type} challenge with clear stakes.`,

        resolution: {
          success: "The challenge is overcome. Progress is made.",
          failure: "The challenge defeats them. New complications arise.",
          partial: "Partial success with complications or costs.",
        },

        difficultyGuidance: {
          easy: "DC 8 - Most attempts should succeed",
          medium: "DC 12 - Fair challenge, competent characters succeed often",
          hard: "DC 16 - Difficult, requires skill or luck",
          deadly: "DC 20 - Near impossible without special preparation",
        }[input.difficulty],

        locationId: input.locationId,
        theme: input.theme,
      };

      return {
        message: `Generated ${input.difficulty} ${input.type} encounter`,
        encounter,
      };
    }
  },
});
