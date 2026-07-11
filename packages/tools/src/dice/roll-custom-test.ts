/**
 * Roll Custom Test Tool (Shared)
 *
 * Perform custom tests defined in world pack rules (e.g., panic checks).
 */

import { z } from "zod";
import { defineSharedTool, type Effect } from "@mythxengine/types";
import {
  createRNG,
  resolveCustomTest,
  findCustomTest,
  type RulesContext,
} from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitCustomTestResolved } from "../events/emitters.js";

/**
 * Input schema for roll_custom_test
 */
export const RollCustomTestInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  characterId: z.string().describe("Character performing the test"),
  testId: z.string().describe("Custom test ID (e.g., 'panic', 'sanity_check')"),
  modifiers: z.number().optional().describe("Additional modifiers"),
});

export type RollCustomTestInput = z.infer<typeof RollCustomTestInputSchema>;

/**
 * Output type for roll_custom_test
 */
export interface RollCustomTestOutput {
  testId: string;
  testName: string;
  character: string;
  roll: {
    dice: string;
    natural: number;
    modifier: number;
    total: number;
  };
  target: number;
  success: boolean;
  critical: boolean;
  outcome: string;
  tableRoll?: {
    dice: string;
    roll: number;
    result: string;
  };
  effects?: Effect[];
}

/**
 * Roll custom test tool definition
 */
export const rollCustomTestTool = defineSharedTool({
  name: "roll_custom_test",
  description:
    "Perform a custom test defined in the world pack rules (e.g., panic check, sanity roll). Returns success/failure, any table rolls, and effects to apply.",
  inputSchema: RollCustomTestInputSchema,
  emits: [EventTypes.CUSTOM_TEST_RESOLVED],

  handler: async (input, ctx): Promise<RollCustomTestOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    // Load rules context for the session
    const rules = (await ctx.getRules(session)) as RulesContext;

    // Find the custom test definition
    const testDef = findCustomTest(rules, input.testId);
    if (!testDef) {
      const availableTests = rules.rules.customTests?.map((t) => t.id).join(", ") || "(none)";
      throw new Error(`Custom test not found: ${input.testId}. Available tests: ${availableTests}`);
    }

    const rng = createRNG(session.rng);

    // Build abilities record from character
    const abilities: Record<string, number> = { ...character.abilities };

    // Resolve the custom test
    const result = resolveCustomTest({
      test: testDef,
      abilities,
      rng,
      ctx: rules,
      modifiers: input.modifiers,
    });

    // Update session RNG
    session.rng = rng.getState();
    await ctx.sessions.save(session);

    // Build response
    const response: RollCustomTestOutput = {
      testId: result.testId,
      testName: testDef.name,
      character: character.name,
      roll: result.roll,
      target: result.target,
      success: result.success,
      critical: result.critical,
      outcome: result.outcome.description,
    };

    // Include table roll if applicable
    if (result.tableRoll) {
      response.tableRoll = {
        dice: result.tableRoll.dice,
        roll: result.tableRoll.roll,
        result: result.tableRoll.entry.description,
      };
    }

    // Include effects to apply
    if (result.effects.length > 0) {
      response.effects = result.effects;
    }

    // Emit event for real-time sync — `ctx.currentTurnId` groups
    // this row under the parent chat turn in gameplay_events. Use
    // `character.id` (canonical UUID) — same fix as roll_test, keeps
    // the published event consistent for consumers expecting a stable
    // ID even though this tool's lookup is UUID-only today.
    emitCustomTestResolved(
      ctx.eventBus,
      input.sessionId,
      {
        characterId: character.id,
        characterName: character.name,
        testId: result.testId,
        testName: testDef.name,
        success: result.success,
        critical: result.critical,
        outcome: result.outcome.description,
        roll: result.roll.total,
        target: result.target,
      },
      "roll_custom_test",
      ctx.currentTurnId
    );

    return response;
  },
});
