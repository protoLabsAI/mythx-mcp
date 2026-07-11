/**
 * Add Combat Condition Tool (Shared)
 *
 * Add a condition to a combatant during combat.
 */

import { z } from "zod";
import {
  defineSharedTool,
  type Character,
  type Enemy,
  type Condition,
  advanceGameTime,
  createInitialGameTime,
} from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitCharacterUpdatedFor, isPlayerCharacter } from "../events/character-state.js";

/**
 * Effect schema for conditions
 */
const EffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MODIFY_ABILITY"),
    ability: z.enum(["STR", "AGI", "WIT", "CON"]),
    amount: z.number(),
  }),
  z.object({
    type: z.literal("MODIFY_SKILL"),
    skillId: z.string(),
    amount: z.number(),
  }),
  z.object({
    type: z.literal("GRANT_ADVANTAGE"),
    scope: z.enum(["attacks", "defense", "skill_tests", "all"]),
    skills: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("GRANT_DISADVANTAGE"),
    scope: z.enum(["attacks", "defense", "skill_tests", "all"]),
    skills: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("RESISTANCE"),
    damageType: z.string(),
    multiplier: z.number().optional(),
  }),
  z.object({
    type: z.literal("VULNERABILITY"),
    damageType: z.string(),
    multiplier: z.number().optional(),
  }),
]);

/**
 * Input schema for add_combat_condition
 */
export const AddCombatConditionInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  targetId: z.string().describe("Target combatant ID"),
  condition: z.object({
    // Same non-empty rule as apply_condition — empty strings would
    // render as blank chips and are almost always a missing-field
    // hallucination, not real intent.
    id: z.string().trim().min(1, "condition.id must be non-empty"),
    name: z.string().trim().min(1, "condition.name must be non-empty"),
    description: z.string(),
    duration: z.union([z.number(), z.literal("permanent"), z.literal("until_rest")]),
    durationMinutes: z
      .number()
      .min(1)
      .optional()
      .describe("Duration in game minutes (sets time-based expiration)"),
    effects: z.array(EffectSchema).optional().describe("Effects of the condition"),
  }),
});

export type AddCombatConditionInput = z.infer<typeof AddCombatConditionInputSchema>;

/**
 * Output type for add_combat_condition
 */
export interface AddCombatConditionOutput {
  target: string;
  condition: string;
  message: string;
  expiresAt?: string;
  durationMinutes?: number;
}

/**
 * Helper to get a combatant by ID
 */
function getCombatant(
  session: {
    characters: Record<string, Character>;
    enemies: Record<string, Enemy>;
  },
  id: string
): Character | Enemy | null {
  return session.characters[id] || session.enemies[id] || null;
}

/**
 * Add combat condition tool definition
 */
export const addCombatConditionTool = defineSharedTool({
  name: "add_combat_condition",
  description:
    "Add a condition to a combatant. Supports advantage/disadvantage and resistance/vulnerability effects.",
  inputSchema: AddCombatConditionInputSchema,
  emits: [EventTypes.CONDITION_APPLIED, EventTypes.CHARACTER_UPDATED],

  // Gate: combat must be active and target must be in turnOrder.
  // Conditions can be applied outside combat via narrative-level
  // tools (e.g. `update_character`); add_combat_condition is the
  // mid-encounter mutation path and shouldn't fire when combat
  // isn't running.
  gate: async (input, ctx) => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      return { allow: false, reason: `Session not found: ${input.sessionId}.` };
    }
    if (!session.combat || !session.combat.active) {
      return {
        allow: false,
        reason:
          "No active combat. Use `update_character` for narrative-level conditions outside an encounter, or `start_combat` first.",
      };
    }
    if (!new Set(session.combat.turnOrder).has(input.targetId)) {
      return {
        allow: false,
        reason: `Target "${input.targetId}" is not in the active combat's turn order.`,
      };
    }
    return { allow: true };
  },

  handler: async (input, ctx): Promise<AddCombatConditionOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const target = getCombatant(session, input.targetId);
    if (!target) {
      throw new Error(`Target not found: ${input.targetId}`);
    }

    // Handle sessions created before gameTime was added
    if (!session.gameTime) {
      session.gameTime = createInitialGameTime();
    }

    const condition: Condition = {
      id: input.condition.id,
      name: input.condition.name,
      description: input.condition.description,
      duration: input.condition.duration,
      effects: input.condition.effects ?? [],
      stackable: false,
    };

    // If durationMinutes specified, calculate expiration time
    if (input.condition.durationMinutes) {
      condition.expiresAtGameTime = advanceGameTime(
        session.gameTime,
        input.condition.durationMinutes
      );
    }

    target.conditions.push(condition);
    await ctx.sessions.save(session);

    // Sync the new condition into the party sidebar — only for player
    // characters; enemies have their own combat-card render path.
    // See docs/audits/chat-flow-audit.md §2.1.
    if (isPlayerCharacter(session, input.targetId)) {
      emitCharacterUpdatedFor(
        ctx.eventBus,
        input.sessionId,
        target as Character,
        session,
        { addedCondition: condition.name },
        "add_combat_condition"
      );
    }

    const result: AddCombatConditionOutput = {
      target: target.name,
      condition: condition.name,
      message: `${condition.name} applied to ${target.name}`,
    };

    if (condition.expiresAtGameTime) {
      const hour12 = condition.expiresAtGameTime.hour % 12 || 12;
      const ampm = condition.expiresAtGameTime.hour < 12 ? "AM" : "PM";
      const min = condition.expiresAtGameTime.minute.toString().padStart(2, "0");
      result.expiresAt = `Day ${condition.expiresAtGameTime.day}, ${hour12}:${min} ${ampm}`;
      result.durationMinutes = input.condition.durationMinutes;
    }

    return result;
  },
});
