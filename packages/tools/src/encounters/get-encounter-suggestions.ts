/**
 * Get Encounter Suggestions Tool (Shared)
 *
 * List encounters that fit the current context.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { getEncounters, getLocations, getMonsters } from "./helpers.js";

export const GetEncounterSuggestionsInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  locationId: z.string().optional().describe("Filter by location"),
  situationId: z.string().optional().describe("Filter by situation"),
  mood: z.string().optional().describe("Desired mood"),
  limit: z.number().min(1).max(10).default(5).describe("Max results"),
});

export type GetEncounterSuggestionsInput = z.infer<typeof GetEncounterSuggestionsInputSchema>;

export interface GetEncounterSuggestionsOutput {
  message: string;
  suggestions: Array<{
    id: string;
    name: string;
    type: string;
    difficulty: string;
    description: string;
    monsters?: string[];
  }>;
  filters: {
    locationId?: string;
    situationId?: string;
    mood?: string;
  };
  tip?: string;
}

export const getEncounterSuggestionsTool = defineSharedTool({
  name: "get_encounter_suggestions",
  description: "List encounters that fit the current context.",
  inputSchema: GetEncounterSuggestionsInputSchema,

  handler: async (input, ctx): Promise<GetEncounterSuggestionsOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const encounters = getEncounters(session);
    const locations = getLocations(session);
    const monsters = getMonsters(session);

    if (encounters.length === 0) {
      return {
        message: "No pre-defined encounters available.",
        suggestions: [],
        tip: "Use generate_encounter to create encounters on-demand.",
        filters: {
          locationId: input.locationId,
          situationId: input.situationId,
          mood: input.mood,
        },
      };
    }

    // Filter encounters
    let filtered = encounters;

    // Filter by location
    if (input.locationId) {
      const location = locations.find((l) => l.id === input.locationId);
      if (location && location.encounters) {
        filtered = filtered.filter((e) => location.encounters.includes(e.id));
      }
    }

    // Filter by mood/type match (simple text matching)
    if (input.mood) {
      const moodLower = input.mood.toLowerCase();
      const moodMatches = filtered.filter(
        (e) =>
          e.description?.toLowerCase().includes(moodLower) ||
          e.name?.toLowerCase().includes(moodLower)
      );
      if (moodMatches.length > 0) {
        filtered = moodMatches;
      }
    }

    // Limit results
    const limited = filtered.slice(0, input.limit);

    // Enrich with monster names
    const suggestions = limited.map((e) => {
      const monsterNames: string[] = [];
      if (e.monsters) {
        for (const m of e.monsters) {
          const monster = monsters.find((mon) => mon.id === m.monsterId);
          if (monster) {
            monsterNames.push(`${m.count}x ${monster.name}`);
          }
        }
      }

      return {
        id: e.id,
        name: e.name,
        type: e.type,
        difficulty: e.difficulty,
        description: e.description,
        monsters: monsterNames.length > 0 ? monsterNames : undefined,
      };
    });

    return {
      message: `Found ${suggestions.length} encounter(s)`,
      suggestions,
      filters: {
        locationId: input.locationId,
        situationId: input.situationId,
        mood: input.mood,
      },
    };
  },
});
