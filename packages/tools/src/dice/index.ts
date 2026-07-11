/**
 * Dice Tools Module
 *
 * Shared tool definitions for dice rolling and tests.
 */

export { rollDiceTool, RollDiceInputSchema } from "./roll-dice.js";
export type { RollDiceInput, RollDiceOutput } from "./roll-dice.js";

export { rollTestTool, RollTestInputSchema } from "./roll-test.js";
export type {
  RollTestInput,
  RollTestEnvelope,
  RollTestResult,
  RollTestStateDelta,
  RollTestSuggestedNext,
  RollTestOutput,
} from "./roll-test.js";

export { rollCustomTestTool, RollCustomTestInputSchema } from "./roll-custom-test.js";
export type { RollCustomTestInput, RollCustomTestOutput } from "./roll-custom-test.js";

// Export all dice tools as an array
import { rollDiceTool } from "./roll-dice.js";
import { rollTestTool } from "./roll-test.js";
import { rollCustomTestTool } from "./roll-custom-test.js";

export const diceTools = [rollDiceTool, rollTestTool, rollCustomTestTool];
