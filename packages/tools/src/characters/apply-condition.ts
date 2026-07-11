/**
 * Apply Condition Tool (Shared)
 *
 * Add a condition to a character (out of combat). Doesn't recalc
 * combat-effects sheet — that's `add_combat_condition`'s job. Use
 * this for narrative status (Wounded, Inspired, Hungover, etc.)
 * outside of an active combat encounter.
 *
 * Part of the intent-named character-state tools that replaced
 * `update_character`. See docs/audits/chat-flow-audit.md §3 + §5 P1.2.
 */

import { z } from "zod";
import { defineSharedTool, type Condition } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitCharacterUpdatedFor } from "../events/character-state.js";

/**
 * Coerces the `condition` argument from the two shapes the LLM
 * actually emits in practice: a structured object, or a JSON string.
 *
 * Two footguns we explicitly avoid:
 *   1. `JSON.parse` throws `SyntaxError` on malformed input. We wrap
 *      it and pass the raw value through on failure so the caller
 *      sees a normal Zod validation error instead of a crash that
 *      bypasses the schema layer.
 *   2. `z.coerce.boolean()` is JS `Boolean(value)` semantics: any
 *      non-empty string is `true`, including `"false"`. The LLM
 *      sends `"false"` as a string surprisingly often. We
 *      pre-normalize "true" / "false" / "1" / "0" before letting
 *      `z.boolean()` validate.
 */
const coerceStringBool = z.preprocess((v) => {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return v;
}, z.boolean());

const coerceCondition = z.preprocess(
  (val) => {
    if (typeof val !== "string") return val;
    try {
      return JSON.parse(val);
    } catch {
      // Pass through so Zod surfaces a normal validation error
      // instead of leaking a SyntaxError at the route boundary.
      return val;
    }
  },
  z.object({
    // id and name carry into UI (chip labels, log entries) and into
    // the session pack — empty/whitespace values would render as a
    // blank chip on the sidebar and are almost always an LLM
    // hallucination of a missing field rather than a real intent.
    id: z.string().trim().min(1, "condition.id must be non-empty"),
    name: z.string().trim().min(1, "condition.name must be non-empty"),
    description: z.string(),
    duration: z.union([z.coerce.number(), z.literal("permanent"), z.literal("until_rest")]),
    stackable: coerceStringBool.optional().default(false),
  })
);

export const ApplyConditionInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character receiving the condition"),
  condition: coerceCondition.describe(
    "Condition to apply. duration is rounds (number), 'permanent', or 'until_rest'."
  ),
});

export type ApplyConditionInput = z.infer<typeof ApplyConditionInputSchema>;

export interface ApplyConditionOutput {
  character: string;
  condition: string;
  message: string;
}

export const applyConditionTool = defineSharedTool({
  name: "apply_condition",
  description:
    "Add a condition to a character (narrative/exploration). For combat, use `add_combat_condition` instead so combat effects (advantage/disadvantage, modifiers) are picked up.",
  inputSchema: ApplyConditionInputSchema,
  emits: [EventTypes.CHARACTER_UPDATED],

  handler: async (input, ctx): Promise<ApplyConditionOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    const condition: Condition = {
      id: input.condition.id,
      name: input.condition.name,
      description: input.condition.description,
      duration: input.condition.duration,
      effects: [],
      stackable: input.condition.stackable,
    };
    character.conditions.push(condition);
    await ctx.sessions.save(session);

    emitCharacterUpdatedFor(
      ctx.eventBus,
      input.sessionId,
      character,
      session,
      { addedCondition: condition.name },
      "apply_condition"
    );

    return {
      character: character.name,
      condition: condition.name,
      message: `${condition.name} applied to ${character.name}`,
    };
  },
});
