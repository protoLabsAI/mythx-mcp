/**
 * Attack Tool (Shared)
 *
 * Perform an attack against a target.
 *
 * Returns the v2 structured envelope: agent reads `outcome` + `summary`
 * as headline, drills into `result` / `state_delta` / `suggested_next`
 * for mechanical detail. Mirrors `roll_test`. See
 * docs/context-compaction-architecture.md.
 */

import { z } from "zod";
import {
  defineSharedTool,
  type Character,
  type Enemy,
  type OutcomeType,
  type GMMove,
  type Position,
  type EffectLevel,
  getGMMoves,
  buildConsequenceGuidance,
} from "@mythxengine/types";
import {
  createRNG,
  resolveAttack,
  parseWeapons,
  getWeaponParseOptions,
  type RulesContext,
} from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitCombatEvent } from "../events/emitters.js";
import { emitCharacterUpdatedFor, isPlayerCharacter } from "../events/character-state.js";
import { autoTickClocks, type ClockTickResult } from "../clocks/index.js";
import { requireSkill } from "../skills/load-skill.js";

/**
 * Input schema for attack
 */
export const AttackInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  attackerId: z.string().describe("Attacking combatant ID"),
  defenderId: z.string().describe("Defending combatant ID"),
  weaponIndex: z.coerce
    .number()
    .optional()
    .default(0)
    .describe("Index of weapon to use (default 0)"),
  advantageSources: z
    .array(z.string())
    .optional()
    .describe("Sources granting advantage (e.g., 'flanking', 'high ground')"),
  disadvantageSources: z
    .array(z.string())
    .optional()
    .describe("Sources granting disadvantage (e.g., 'darkness', 'cover')"),
  damageType: z
    .string()
    .optional()
    .default("physical")
    .describe("Damage type for resistance/vulnerability calculation"),
  position: z
    .enum(["controlled", "risky", "desperate"])
    .optional()
    .default("risky")
    .describe("Position (risk level): controlled, risky (default), desperate"),
  effectLevel: z
    .enum(["limited", "standard", "great"])
    .optional()
    .default("standard")
    .describe(
      "Effect level (impact). limited=0.5× damage, standard=1× (default), great=1.5×. Applies to graze damage on partial hits too."
    ),
  autoTickClockIds: z
    .array(z.string())
    .optional()
    .describe("Clock IDs to automatically tick on partial/failure outcomes"),
});

export type AttackInput = z.infer<typeof AttackInputSchema>;

/**
 * Mechanical detail block — the inner `result` of the envelope.
 */
export interface AttackResult {
  attacker: string;
  defender: string;
  weapon: string;
  hit: boolean;
  advantageState: "advantage" | "disadvantage" | "normal";
  roll: {
    natural: number;
    total: number;
    advantage?: {
      bothRolls: [number, number];
      selected: "higher" | "lower";
    };
  };
  critical?: "hit" | "miss";
  damage?: number;
  grazeDamage?: number;
  damageModification?: {
    reason: "resistance" | "vulnerability";
    originalDamage: number;
    finalDamage: number;
  };
  defenderHp: {
    current: number;
    max: number;
  };
  defeated: boolean;
  position: Position;
  /** Effect level used for this attack (mechanical multiplier on damage). */
  effectLevel: EffectLevel;
}

/**
 * State changes the resolution caused — RNG always advances; clocks
 * may tick on partial/failure; HP delta tells consumers the actual
 * damage applied (graze or full).
 */
export interface AttackStateDelta {
  rng_advanced: true;
  hp_delta: number;
  defender_defeated: boolean;
  clocks_ticked?: ClockTickResult[];
}

/**
 * GM-facing follow-up suggestions — only populated on partial/failure.
 */
export interface AttackSuggestedNext {
  gm_moves?: GMMove[];
  consequence_guidance?: string;
}

/**
 * Structured envelope returned by attack. Headline fields
 * (`status`, `outcome`, `summary`) are sufficient for the agent to
 * narrate; deeper consumers read `result` / `state_delta` /
 * `suggested_next` when they need mechanical detail.
 */
export interface AttackEnvelope {
  status: "ok";
  outcome: OutcomeType;
  summary: string;
  result: AttackResult;
  state_delta: AttackStateDelta;
  suggested_next: AttackSuggestedNext;
}

/** @deprecated Use AttackEnvelope. Kept as alias to ease migration of any external readers. */
export type AttackOutput = AttackEnvelope;

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
 * One-line headline.
 *
 * Deliberately diegetic / outcome-tier driven — no damage number, raw
 * d20, or HP. The agent has the full mechanical block in `result`
 * (and `state_delta.hp_delta` / `defender_defeated` for combat
 * decisioning); pulling numbers into `summary` only trains the model
 * toward stat-blocky narration. Format examples:
 *   "Hero critically hit Goblin with Sword (target down)"
 *   "Hero hit Goblin with Sword"
 *   "Hero grazed Goblin with Sword"
 *   "Hero missed Goblin with Sword"
 *   "Hero critically missed Goblin with Sword"
 */
function buildSummary(
  attackerName: string,
  defenderName: string,
  weaponName: string,
  outcome: OutcomeType,
  defenderDefeated: boolean
): string {
  const verb =
    outcome === "critical_success"
      ? "critically hit"
      : outcome === "success"
        ? "hit"
        : outcome === "partial"
          ? "grazed"
          : outcome === "critical_failure"
            ? "critically missed"
            : "missed";
  const tag = defenderDefeated ? " (target down)" : "";
  return `${attackerName} ${verb} ${defenderName} with ${weaponName}${tag}`;
}

/**
 * Attack tool definition
 */
export const attackTool = defineSharedTool({
  name: "attack",
  description:
    "Perform an attack against a target. Supports advantage/disadvantage and damage type for resistance/vulnerability. Returns an envelope with `outcome` (five-tier) and a one-line `summary` as the headline; mechanical detail is in `result`, follow-up moves in `suggested_next`.",
  inputSchema: AttackInputSchema,
  emits: [EventTypes.DAMAGE_DEALT, EventTypes.CHARACTER_UPDATED],

  // Gate: composed — combat-runner skill prerequisite first, then the
  // mechanical invariants (active combat + both combatants in turn
  // order). Order matters: the skill body documents the
  // start_combat → roll_initiative → attack sequence and position/
  // effect calibration, so the model gets that context BEFORE being
  // told about the situational rule. cc-2.18 pattern: make skill
  // loading load-bearing; let the existing situational gate enforce
  // game-mechanic invariants.
  gate: async (input, ctx) => {
    const skillCheck = requireSkill("combat-runner")(input, ctx);
    if (!skillCheck.allow) return skillCheck;

    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      return { allow: false, reason: `Session not found: ${input.sessionId}.` };
    }
    if (!session.combat || !session.combat.active) {
      return {
        allow: false,
        reason:
          "No active combat. Call `start_combat` with the participating combatants first, then attack.",
      };
    }
    const inTurnOrder = new Set(session.combat.turnOrder);
    if (!inTurnOrder.has(input.attackerId)) {
      return {
        allow: false,
        reason: `Attacker "${input.attackerId}" is not in the active combat's turn order.`,
      };
    }
    if (!inTurnOrder.has(input.defenderId)) {
      return {
        allow: false,
        reason: `Defender "${input.defenderId}" is not in the active combat's turn order.`,
      };
    }
    return { allow: true };
  },

  handler: async (input, ctx): Promise<AttackEnvelope> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const attacker = getCombatant(session, input.attackerId);
    if (!attacker) {
      throw new Error(`Attacker not found: ${input.attackerId}`);
    }

    const defender = getCombatant(session, input.defenderId);
    if (!defender) {
      throw new Error(`Defender not found: ${input.defenderId}`);
    }

    // Resolve rules early — used both for weapon parsing (so worlds can
    // override the equipment-parser keyword sets) and for resolveAttack.
    const rules = (await ctx.getRules(session)) as RulesContext;
    const parseOpts = getWeaponParseOptions(rules);

    // Get weapon
    const weapons = "attacks" in attacker ? attacker.attacks : [];
    const weaponFromEquipment =
      "equipment" in attacker ? parseWeapons(attacker.equipment.weapons, parseOpts) : [];

    const allWeapons = [...weapons, ...weaponFromEquipment];
    const weapon = allWeapons[input.weaponIndex];

    if (!weapon) {
      if (allWeapons.length === 0) {
        throw new Error(
          `${attacker.name} has no weapons. Pass weapons at character creation, ` +
            `or use the inventory tools (add_item / equip_item) to arm them.`
        );
      }
      const available = allWeapons.map((w, i) => `[${i}] ${w.name}`).join(", ");
      throw new Error(
        `No weapon at index ${input.weaponIndex} for ${attacker.name}. Available: ${available}.`
      );
    }

    const rng = createRNG(session.rng);
    const result = resolveAttack({
      attacker,
      defender,
      weapon,
      rng,
      advantageSources: input.advantageSources,
      disadvantageSources: input.disadvantageSources,
      damageType: input.damageType,
      rules,
      position: input.position,
      effectLevel: input.effectLevel,
    });

    // Apply damage based on outcome. `appliedDamage` is what the
    // defender actually lost — the rolled `result.damage` clamped at
    // the defender's current HP. This is the load-bearing value for
    // both DAMAGE_DEALT events and the envelope's state_delta:
    // consumers expect "how much HP did the defender lose" (and would
    // over-deduct when overkill happens if we leaked the rolled damage
    // through). The rolled value still lives on `result.damage` /
    // `result.grazeDamage` for narration if anyone wants it.
    const hpBefore = defender.hp.current;
    if (result.hit && result.damage !== undefined) {
      defender.hp.current = Math.max(0, defender.hp.current - result.damage);
    }
    if (result.outcome === "partial" && result.grazeDamage !== undefined) {
      defender.hp.current = Math.max(0, defender.hp.current - result.grazeDamage);
    }
    const appliedDamage = hpBefore - defender.hp.current;

    // Update RNG state
    session.rng = rng.getState();
    await ctx.sessions.save(session);

    // Emit damage event if damage was applied (full hit or graze)
    const damageDealt = appliedDamage > 0 ? appliedDamage : 0;
    if (damageDealt > 0) {
      emitCombatEvent(
        ctx.eventBus,
        input.sessionId,
        EventTypes.DAMAGE_DEALT,
        {
          attackerId: input.attackerId,
          attackerName: attacker.name,
          defenderId: input.defenderId,
          defenderName: defender.name,
          damage: damageDealt,
          weapon: weapon.name,
          critical: result.critical,
          outcome: result.outcome,
          isGraze: result.outcome === "partial",
          defeated: defender.hp.current <= 0,
        },
        "attack",
        ctx.currentTurnId
      );

      // Sync the defender's HP into the party sidebar — but only when
      // the defender is a party character. DAMAGE_DEALT alone updates
      // `state.combat`; the sidebar reads from `state.characters`.
      // See docs/audits/chat-flow-audit.md §2.1.
      if (isPlayerCharacter(session, input.defenderId)) {
        emitCharacterUpdatedFor(
          ctx.eventBus,
          input.sessionId,
          defender as Character,
          session,
          { hpDelta: -damageDealt },
          "attack"
        );
      }
    }

    // Build roll info with advantage details
    const rollInfo: AttackResult["roll"] = {
      natural: result.roll.natural,
      total: result.roll.total,
    };
    if (result.roll.advantage) {
      rollInfo.advantage = {
        bothRolls: result.roll.advantage.bothRolls,
        selected: result.roll.advantage.selected,
      };
    }

    // GM moves + consequence-guidance composition lives in @mythxengine/types
    // (single source of truth — the gate is inside getGMMoves itself).
    const position = input.position ?? "risky";
    const suggestedMoves = getGMMoves(result.outcome, position);
    const outcomeLabel =
      result.outcome === "partial"
        ? "Partial hit (graze)"
        : result.outcome === "critical_failure"
          ? "Critical miss"
          : "Miss";
    const consequenceGuidance = buildConsequenceGuidance(result.outcome, position, outcomeLabel);

    // Auto-tick clocks on partial/failure if specified
    const clocksTicked = autoTickClocks(
      session,
      result.outcome,
      input.autoTickClockIds,
      ctx.eventBus,
      input.sessionId,
      "attack",
      ctx.currentTurnId
    );

    if (clocksTicked) {
      await ctx.sessions.save(session);
    }

    const defeated = defender.hp.current <= 0;

    const innerResult: AttackResult = {
      attacker: attacker.name,
      defender: defender.name,
      weapon: weapon.name,
      hit: result.hit,
      advantageState: result.advantageState,
      roll: rollInfo,
      critical: result.critical,
      damage: result.damage,
      grazeDamage: result.grazeDamage,
      defenderHp: {
        current: defender.hp.current,
        max: defender.hp.max,
      },
      defeated,
      position,
      effectLevel: input.effectLevel ?? "standard",
    };

    if (result.damageModification) {
      innerResult.damageModification = result.damageModification;
    }

    const stateDelta: AttackStateDelta = {
      rng_advanced: true,
      hp_delta: damageDealt > 0 ? -damageDealt : 0,
      defender_defeated: defeated,
    };
    if (clocksTicked) {
      stateDelta.clocks_ticked = clocksTicked;
    }

    const suggestedNext: AttackSuggestedNext = {};
    if (suggestedMoves) {
      suggestedNext.gm_moves = suggestedMoves;
    }
    if (consequenceGuidance) {
      suggestedNext.consequence_guidance = consequenceGuidance;
    }

    return {
      status: "ok",
      outcome: result.outcome,
      summary: buildSummary(attacker.name, defender.name, weapon.name, result.outcome, defeated),
      result: innerResult,
      state_delta: stateDelta,
      suggested_next: suggestedNext,
    };
  },
});
