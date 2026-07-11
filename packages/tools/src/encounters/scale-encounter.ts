/**
 * Scale Encounter Tool (Shared)
 *
 * Adjust the difficulty of an existing encounter.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { DIFFICULTIES } from "./types.js";
import {
  getEncounters,
  getMonsters,
  getPartyStrength,
  getTargetThreat,
  getThreatValue,
} from "./helpers.js";

export const ScaleEncounterInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  encounterId: z.string().describe("Encounter ID to scale"),
  targetDifficulty: z.enum(DIFFICULTIES).describe("New target difficulty"),
  method: z
    .enum(["add_monsters", "remove_monsters", "adjust_hp", "add_minions"])
    .default("add_monsters")
    .describe("How to adjust difficulty"),
});

export type ScaleEncounterInput = z.infer<typeof ScaleEncounterInputSchema>;

export interface ScaleEncounterOutput {
  encounter: {
    id: string;
    name: string;
    currentDifficulty: string;
    targetDifficulty: string;
  };
  analysis: {
    currentThreat: number;
    targetRange: { min: number; max: number };
    currentMonsters: Array<{ id: string; name: string; count: number; threat: number }>;
  };
  adjustments: string[];
  method: string;
  error?: string;
  suggestion?: string;
}

export const scaleEncounterTool = defineSharedTool({
  name: "scale_encounter",
  description: "Adjust the difficulty of an existing encounter.",
  inputSchema: ScaleEncounterInputSchema,

  handler: async (input, ctx): Promise<ScaleEncounterOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const encounters = getEncounters(session);
    const monsters = getMonsters(session);

    const encounter = encounters.find((e) => e.id === input.encounterId);
    if (!encounter) {
      return {
        encounter: {
          id: input.encounterId,
          name: "",
          currentDifficulty: "",
          targetDifficulty: input.targetDifficulty,
        },
        analysis: {
          currentThreat: 0,
          targetRange: { min: 0, max: 0 },
          currentMonsters: [],
        },
        adjustments: [],
        method: input.method,
        error: `Encounter not found: ${input.encounterId}`,
        suggestion: "Use get_encounter_suggestions to find available encounters.",
      };
    }

    const partySize = getPartyStrength(session);
    const target = getTargetThreat(input.targetDifficulty, partySize);

    // Calculate current threat
    let currentThreat = 0;
    const currentMonsters: Array<{ id: string; name: string; count: number; threat: number }> = [];

    if (encounter.monsters) {
      for (const m of encounter.monsters) {
        const monster = monsters.find((mon) => mon.id === m.monsterId);
        if (monster) {
          const threat = getThreatValue(monster) * m.count;
          currentThreat += threat;
          currentMonsters.push({
            id: monster.id,
            name: monster.name,
            count: m.count,
            threat,
          });
        }
      }
    }

    // Determine adjustment
    const adjustments: string[] = [];
    const targetMid = (target.min + target.max) / 2;

    if (input.method === "add_monsters" && currentThreat < targetMid) {
      const needed = Math.ceil((targetMid - currentThreat) / 2);
      adjustments.push(`Add ${needed} standard monster(s) or equivalent`);
    } else if (input.method === "remove_monsters" && currentThreat > targetMid) {
      const toRemove = Math.ceil((currentThreat - targetMid) / 2);
      adjustments.push(`Remove ${toRemove} threat worth of monsters`);
    } else if (input.method === "adjust_hp") {
      const ratio = targetMid / currentThreat;
      const percentage = Math.round((ratio - 1) * 100);
      if (percentage > 0) {
        adjustments.push(`Increase monster HP by ${percentage}%`);
      } else if (percentage < 0) {
        adjustments.push(`Decrease monster HP by ${Math.abs(percentage)}%`);
      }
    } else if (input.method === "add_minions") {
      const needed = Math.ceil(targetMid - currentThreat);
      adjustments.push(`Add ${needed} minion-tier creature(s)`);
    }

    if (adjustments.length === 0) {
      adjustments.push("Encounter is already at target difficulty");
    }

    return {
      encounter: {
        id: encounter.id,
        name: encounter.name,
        currentDifficulty: encounter.difficulty,
        targetDifficulty: input.targetDifficulty,
      },
      analysis: {
        currentThreat,
        targetRange: target,
        currentMonsters,
      },
      adjustments,
      method: input.method,
    };
  },
});
