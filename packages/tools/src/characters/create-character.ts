/**
 * Create Character Tool (Shared)
 *
 * Create a new character in the session.
 */

import { z } from "zod";
import {
  defineSharedTool,
  type Character,
  createDefaultAbilities,
  createEmptyPsychology,
  createStressTracker,
} from "@mythxengine/types";
import { slugify } from "../generation/manifest-helpers.js";

/**
 * Input schema for create_character
 */
/**
 * Coerce string booleans ("true"/"false") to actual booleans.
 */
const coerceBool = z.preprocess(
  (val) => (val === "true" ? true : val === "false" ? false : val),
  z.boolean()
);

export const CreateCharacterInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  id: z
    .string()
    .optional()
    .describe("Unique character ID (auto-generated from the name when omitted)"),
  name: z.string().describe("Character name"),
  archetypeId: z.string().optional().default("custom").describe("Archetype ID (optional)"),
  abilities: z
    .object({
      STR: z.coerce.number().min(-5).max(5),
      AGI: z.coerce.number().min(-5).max(5),
      WIT: z.coerce.number().min(-5).max(5),
      CON: z.coerce.number().min(-5).max(5),
    })
    .optional()
    .describe("Ability modifiers (-5 to +5)"),
  hp: z.coerce.number().positive().optional().default(10).describe("Starting HP"),
  background: z.string().optional().default("").describe("Character background"),
  personality: z.array(z.string()).optional().default([]).describe("Personality traits"),
  weapons: z
    .array(z.string())
    .optional()
    .default([])
    .describe("Weapons in format 'Name (damage)' e.g. 'Sword (d8)'"),
  armor: z.string().nullable().optional().default(null).describe("Armor name"),
  gear: z.array(z.string()).optional().default([]).describe("Other equipment"),
  initializeStress: coerceBool
    .optional()
    .default(false)
    .describe("Initialize stress tracker for FitD-style mechanics"),
  maxStress: z.coerce
    .number()
    .positive()
    .optional()
    .default(9)
    .describe("Maximum stress before trauma (default: 9)"),
});

export type CreateCharacterInput = z.infer<typeof CreateCharacterInputSchema>;

/**
 * Output type for create_character
 */
export interface CreateCharacterOutput {
  message: string;
  character: {
    id: string;
    name: string;
    abilities: {
      STR: number;
      AGI: number;
      WIT: number;
      CON: number;
    };
    hp: { current: number; max: number };
    equipment: {
      weapons: string[];
      armor: string | null;
      gear: string[];
    };
  };
}

/**
 * Slug a display name into a character id, suffixing -2, -3, … on
 * collision so agents can omit ids entirely. Same pattern as add_npc.
 */
function generateCharacterId(name: string, existingIds: string[]): string {
  const base = slugify(name) || `character-${existingIds.length + 1}`;
  let id = base;
  let suffix = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

/**
 * Create character tool definition
 */
export const createCharacterTool = defineSharedTool({
  name: "create_character",
  description: "Create a new character in the session",
  inputSchema: CreateCharacterInputSchema,

  handler: async (input, ctx): Promise<CreateCharacterOutput> => {
    const session = await ctx.sessions.getOrCreate(input.sessionId);

    const id = input.id ?? generateCharacterId(input.name, Object.keys(session.characters));
    if (session.characters[id]) {
      throw new Error(`Character already exists: ${id}`);
    }

    const character: Character = {
      id,
      name: input.name,
      archetypeId: input.archetypeId || "custom",
      abilities: input.abilities || createDefaultAbilities(),
      hp: { current: input.hp, max: input.hp },
      skills: [],
      specialAbilities: [],
      equipment: {
        weapons: input.weapons,
        armor: input.armor,
        gear: input.gear,
      },
      conditions: [],
      flags: [],
      personality: input.personality,
      background: input.background,
      psychology: createEmptyPsychology(),
      ...(input.initializeStress && { stress: createStressTracker(input.maxStress) }),
    };

    session.characters[id] = character;
    await ctx.sessions.save(session);

    return {
      message: `Character '${input.name}' created`,
      character: {
        id: character.id,
        name: character.name,
        abilities: character.abilities,
        hp: character.hp,
        equipment: character.equipment,
      },
    };
  },
});
