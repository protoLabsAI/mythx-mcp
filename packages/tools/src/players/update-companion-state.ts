/**
 * Update Companion State Tool (Shared)
 *
 * Modify an AI companion's dynamic internal state: loyalty, mood, grievances,
 * admirations, disagreements, and memories.  Call this after events that would
 * plausibly affect the companion's attitude.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import type { CompanionState } from "@mythxengine/types";

/**
 * Input schema for update_companion_state
 */
export const UpdateCompanionStateInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("The AI companion's character ID"),
  loyaltyDelta: z
    .number()
    .min(-100)
    .max(100)
    .optional()
    .describe("Change to party loyalty (negative = losing trust, positive = gaining trust)"),
  playerLoyaltyDelta: z
    .record(z.string(), z.number())
    .optional()
    .describe("Per-player trust changes keyed by player ID"),
  reason: z.string().optional().describe("Why the loyalty changed — used in narrative context"),
  newGrievance: z.string().optional().describe("A new grievance the companion is holding"),
  newAdmiration: z.string().optional().describe("Something the companion now admires"),
  newDisagreement: z.string().optional().describe("A new active disagreement"),
  moodShift: z.string().optional().describe("New mood descriptor for the companion"),
  newMemory: z
    .object({
      event: z.string().describe("Description of the memorable event"),
      impact: z
        .enum(["positive", "negative", "complex"])
        .describe("Whether this left a good, bad, or complicated impression"),
    })
    .optional()
    .describe("A new memory to record (always marked unresolved)"),
  hiddenAgenda: z
    .string()
    .nullable()
    .optional()
    .describe("Set or clear the companion's hidden agenda"),
  fireTrigger: z
    .string()
    .optional()
    .describe("ID of a loyalty trigger that was fired — marks it as fired and applies its effect"),
});

export type UpdateCompanionStateInput = z.infer<typeof UpdateCompanionStateInputSchema>;

/**
 * Output type for update_companion_state
 */
export interface UpdateCompanionStateOutput {
  companion: string;
  changes: string[];
  currentState: CompanionState;
}

/** Clamp a number to [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Default empty companion state */
function defaultCompanionState(): CompanionState {
  return {
    loyalty: {
      toParty: 50,
      toPlayers: {},
      hiddenAgenda: null,
    },
    opinions: {
      currentMood: "neutral",
      grievances: [],
      admirations: [],
      disagreements: [],
    },
    memories: [],
  };
}

/**
 * Update companion state tool definition
 */
export const updateCompanionStateTool = defineSharedTool({
  name: "update_companion_state",
  description:
    "Update an AI companion's internal state (loyalty, mood, grievances, memories). Call after events that would plausibly affect the companion's attitude toward the party.",
  inputSchema: UpdateCompanionStateInputSchema,
  emits: [],

  handler: async (input, ctx): Promise<UpdateCompanionStateOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Find the AI player whose character matches characterId
    const players = session.players || {};
    const player = Object.values(players).find(
      (p) => p.characterId === input.characterId && p.controlType === "ai"
    );

    if (!player) {
      throw new Error(
        `No AI player found with characterId '${input.characterId}' in session '${input.sessionId}'`
      );
    }

    // Initialise companionState if missing
    if (!player.companionState) {
      player.companionState = defaultCompanionState();
    }

    const state = player.companionState;
    const changes: string[] = [];

    // Party loyalty delta
    if (input.loyaltyDelta !== undefined) {
      const before = state.loyalty.toParty;
      state.loyalty.toParty = clamp(before + input.loyaltyDelta, 0, 100);
      const delta = state.loyalty.toParty - before;
      const sign = delta >= 0 ? "+" : "";
      changes.push(
        `Party loyalty ${sign}${delta} → ${state.loyalty.toParty}${input.reason ? ` (${input.reason})` : ""}`
      );
    }

    // Per-player loyalty deltas
    if (input.playerLoyaltyDelta) {
      for (const [playerId, delta] of Object.entries(input.playerLoyaltyDelta)) {
        const before = state.loyalty.toPlayers[playerId] ?? 50;
        state.loyalty.toPlayers[playerId] = clamp(before + delta, 0, 100);
        const actual = state.loyalty.toPlayers[playerId] - before;
        const sign = actual >= 0 ? "+" : "";
        changes.push(
          `Player '${playerId}' trust ${sign}${actual} → ${state.loyalty.toPlayers[playerId]}`
        );
      }
    }

    // Hidden agenda
    if (input.hiddenAgenda !== undefined) {
      state.loyalty.hiddenAgenda = input.hiddenAgenda;
      changes.push(
        input.hiddenAgenda ? `Hidden agenda set: "${input.hiddenAgenda}"` : "Hidden agenda cleared"
      );
    }

    // Mood shift
    if (input.moodShift !== undefined) {
      state.opinions.currentMood = input.moodShift;
      changes.push(`Mood shifted to '${input.moodShift}'`);
    }

    // New grievance
    if (input.newGrievance) {
      state.opinions.grievances.push(input.newGrievance);
      changes.push(`New grievance: "${input.newGrievance}"`);
    }

    // New admiration
    if (input.newAdmiration) {
      state.opinions.admirations.push(input.newAdmiration);
      changes.push(`New admiration: "${input.newAdmiration}"`);
    }

    // New disagreement
    if (input.newDisagreement) {
      state.opinions.disagreements.push(input.newDisagreement);
      changes.push(`New disagreement: "${input.newDisagreement}"`);
    }

    // Fire a loyalty trigger
    if (input.fireTrigger) {
      const triggers = state.loyalty.triggers ?? [];
      const trigger = triggers.find((t) => t.id === input.fireTrigger && !t.fired);
      if (trigger) {
        trigger.fired = true;
        // Apply the trigger's effect to party loyalty
        if (trigger.effect === "increase") {
          const before = state.loyalty.toParty;
          state.loyalty.toParty = clamp(before + trigger.magnitude, 0, 100);
          changes.push(
            `Trigger '${trigger.id}' fired (increase +${trigger.magnitude}): loyalty ${before} → ${state.loyalty.toParty}`
          );
        } else if (trigger.effect === "decrease") {
          const before = state.loyalty.toParty;
          state.loyalty.toParty = clamp(before - trigger.magnitude, 0, 100);
          changes.push(
            `Trigger '${trigger.id}' fired (decrease -${trigger.magnitude}): loyalty ${before} → ${state.loyalty.toParty}`
          );
        } else if (trigger.effect === "betray") {
          state.loyalty.toParty = clamp(state.loyalty.toParty - trigger.magnitude, 0, 100);
          if (!state.loyalty.hiddenAgenda) {
            state.loyalty.hiddenAgenda = trigger.condition;
          }
          changes.push(
            `Trigger '${trigger.id}' fired (BETRAY): loyalty dropped by ${trigger.magnitude} — companion may act against party interests`
          );
        } else if (trigger.effect === "sacrifice") {
          changes.push(
            `Trigger '${trigger.id}' fired (SACRIFICE): companion is willing to sacrifice for the party`
          );
        }
      } else {
        changes.push(`Trigger '${input.fireTrigger}' not found or already fired — skipped`);
      }
    }

    // New memory
    if (input.newMemory) {
      state.memories.push({
        event: input.newMemory.event,
        impact: input.newMemory.impact,
        resolved: false,
      });
      changes.push(`Memory recorded (${input.newMemory.impact}): "${input.newMemory.event}"`);
    }

    player.lastActiveAt = new Date().toISOString();
    await ctx.sessions.save(session);

    // Look up character name for the response
    const character = session.characters?.[input.characterId];
    const companionName = character?.name ?? player.name;

    return {
      companion: companionName,
      changes,
      currentState: state,
    };
  },
});
