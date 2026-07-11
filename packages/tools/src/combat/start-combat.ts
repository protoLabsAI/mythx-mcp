/**
 * Start Combat Tool (Shared)
 *
 * Initialize combat with characters and enemies.
 */

import { z } from "zod";
import { defineSharedTool, createDefaultAbilities } from "@mythxengine/types";
import { parseWeaponString, getWeaponParseOptions, type RulesContext } from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitCombatEvent } from "../events/emitters.js";
import { requireSkill } from "../skills/load-skill.js";
import { getCombatant } from "./helpers.js";
import { slugify } from "../generation/manifest-helpers.js";

/**
 * Slug an enemy name into an id, suffixing -2, -3, … against both
 * existing session enemies and ones created earlier in this call.
 */
function generateEnemyId(name: string, existingIds: string[]): string {
  const base = slugify(name) || `enemy-${existingIds.length + 1}`;
  let id = base;
  let suffix = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

/**
 * Inline enemy definition for start_combat.
 * Creates enemies on the fly without requiring pre-creation.
 */
const InlineEnemySchema = z.object({
  id: z.string().optional().describe("Unique enemy ID (auto-generated from the name when omitted)"),
  name: z.string().describe("Enemy display name"),
  hp: z.coerce
    .number()
    .positive()
    .optional()
    .describe("Current hit points (defaults to maxHp, then 10)"),
  maxHp: z.coerce.number().positive().optional().describe("Max hit points (defaults to hp)"),
  threat: z
    .enum(["minion", "standard", "elite", "boss"])
    .optional()
    .default("standard")
    .describe("Threat tier — drives encounter balance and frame display"),
  armor: z.coerce.number().min(0).optional().default(0).describe("Armor/damage reduction"),
  abilities: z
    .object({
      STR: z.coerce.number(),
      AGI: z.coerce.number(),
      WIT: z.coerce.number(),
      CON: z.coerce.number(),
    })
    .optional()
    .describe("Ability modifiers"),
  attacks: z
    .array(z.string())
    .optional()
    .default([])
    .describe("Attack descriptions in format 'Name (damage)'"),
});

/**
 * Input schema for start_combat
 */
export const StartCombatInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterIds: z.array(z.string()).describe("Character IDs participating in combat"),
  enemyIds: z
    .array(z.string())
    .optional()
    .default([])
    .describe("IDs of enemies already in the session"),
  enemies: z
    .array(InlineEnemySchema)
    .optional()
    .default([])
    .describe(
      "Inline enemy definitions — creates enemies automatically. Use this instead of pre-creating enemies with create_character."
    ),
});

export type StartCombatInput = z.infer<typeof StartCombatInputSchema>;

/** Categorical outcome — drives narration tone. */
export type StartCombatOutcome = "combat_started";

export interface StartCombatResult {
  message: string;
  combatants: {
    characters: string[];
    enemies: string[];
  };
  hint: string;
}

export interface StartCombatStateDelta {
  combat_active: true;
  round: number;
  combatant_count: number;
  inline_enemies_created: number;
}

export interface StartCombatSuggestedNext {
  next_action: "roll_initiative";
  hint: string;
}

export interface StartCombatEnvelope {
  status: "ok";
  outcome: StartCombatOutcome;
  summary: string;
  result: StartCombatResult;
  state_delta: StartCombatStateDelta;
  suggested_next: StartCombatSuggestedNext;
}

/** @deprecated Use StartCombatEnvelope. Kept as alias to ease migration. */
export type StartCombatOutput = StartCombatEnvelope;

/**
 * Start combat tool definition
 */
export const startCombatTool = defineSharedTool({
  name: "start_combat",
  description:
    "Initialize combat with characters and enemies. Returns an envelope with `outcome: 'combat_started'` and a one-line `summary` as the headline; combatant lists in `result`, combat state in `state_delta`. Always follow with `roll_initiative` (also surfaced in `suggested_next.next_action`).",
  inputSchema: StartCombatInputSchema,
  emits: [EventTypes.COMBAT_STARTED],

  // Gate: combat-runner skill required. The skill body documents the
  // start_combat → roll_initiative → attack → next_turn → end_combat
  // sequence, inline-enemy shape, position/effect calibration, and
  // outcome narration. Without loading it the model tends to narrate
  // hostile contact as prose instead of opening the encounter — same
  // architectural pattern as image-generation / engine-flows.
  gate: requireSkill("combat-runner"),

  handler: async (input, ctx): Promise<StartCombatEnvelope> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (session.combat?.active) {
      throw new Error("Combat is already active. End current combat first.");
    }

    // Create inline enemies if provided
    const inlineEnemyIds: string[] = [];
    if (input.enemies && input.enemies.length > 0) {
      if (!session.enemies) {
        session.enemies = {};
      }
      // Use the world's equipment-parser config so attack strings honor
      // its keyword sets and default abilities (sci-fi worlds, etc.).
      const rules = (await ctx.getRules(session)) as RulesContext;
      const parseOpts = getWeaponParseOptions(rules);
      for (const e of input.enemies) {
        const id =
          e.id ?? generateEnemyId(e.name, [...Object.keys(session.enemies), ...inlineEnemyIds]);
        if (session.enemies[id]) {
          // Enemy with this ID already exists — skip
          inlineEnemyIds.push(id);
          continue;
        }
        const maxHp = e.maxHp ?? e.hp ?? 10;
        session.enemies[id] = {
          id,
          name: e.name,
          description: e.name,
          threat: e.threat,
          abilities: e.abilities || createDefaultAbilities(),
          hp: { current: e.hp ?? maxHp, max: maxHp },
          armor: e.armor || 0,
          conditions: [],
          attacks: e.attacks.map((a) => {
            const w = parseWeaponString(a, parseOpts);
            return {
              name: w.name,
              damage: w.damage,
              ability: w.ability,
              properties: w.properties ?? [],
              flavor: "",
            };
          }),
        };
        inlineEnemyIds.push(id);
      }
    }

    // Combine explicit enemyIds with inline-created ones
    const allEnemyIds = [...(input.enemyIds || []), ...inlineEnemyIds];

    // Validate all combatants exist
    const allIds = [...input.characterIds, ...allEnemyIds];
    for (const id of allIds) {
      if (!getCombatant(session, id)) {
        throw new Error(`Combatant not found: ${id}`);
      }
    }

    // Initialize combat state
    session.combat = {
      active: true,
      round: 0,
      turnOrder: allIds,
      currentTurnId: "",
      turnIndex: -1,
    };

    await ctx.sessions.save(session);

    // Emit combat started event
    emitCombatEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.COMBAT_STARTED,
      {
        characterIds: input.characterIds,
        enemyIds: allEnemyIds,
      },
      "start_combat",
      ctx.currentTurnId
    );

    // Diegetic summary — character + enemy names where convenient.
    // Names are pulled from session state since the input only carries IDs.
    const characterNames = input.characterIds
      .map((id) => session.characters[id]?.name ?? id)
      .join(", ");
    const enemyNames = allEnemyIds.map((id) => session.enemies?.[id]?.name ?? id).join(", ");
    const summary = `Combat begins — ${characterNames} vs ${enemyNames}`;

    return {
      status: "ok",
      outcome: "combat_started",
      summary,
      result: {
        message: `Combat started${inlineEnemyIds.length > 0 ? ` (${inlineEnemyIds.length} enemies created inline)` : ""}`,
        combatants: {
          characters: input.characterIds,
          enemies: allEnemyIds,
        },
        hint: "Use roll_initiative to determine turn order",
      },
      state_delta: {
        combat_active: true,
        round: 0,
        combatant_count: allIds.length,
        inline_enemies_created: inlineEnemyIds.length,
      },
      suggested_next: {
        next_action: "roll_initiative",
        hint: "Roll initiative to determine turn order before the first attack.",
      },
    };
  },
});
