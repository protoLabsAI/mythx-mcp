/**
 * Rest Module
 *
 * Tools for party rest and recovery.
 */

export { takeRestTool } from "./take-rest.js";
export type {
  TakeRestInput,
  TakeRestEnvelope,
  TakeRestResult,
  TakeRestStateDelta,
  TakeRestOutcome,
  TakeRestOutput,
} from "./take-rest.js";

import { takeRestTool } from "./take-rest.js";

export const restTools = [takeRestTool];
