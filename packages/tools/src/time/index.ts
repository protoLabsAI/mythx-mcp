/**
 * Time Tools
 *
 * Tools for game time tracking and deadline management.
 */

export {
  getTimeTool,
  type GetTimeInput,
  type GetTimeOutput,
  type DeadlineStatus,
} from "./get-time.js";

export {
  advanceTimeTool,
  AdvanceTimeInputSchema,
  type AdvanceTimeInput,
  type AdvanceTimeOutput,
  type TimeSnapshot,
  type ExpiredDeadline,
  type ApproachingDeadline,
  type ExpiredCondition,
} from "./advance-time.js";

export { setTimeTool, type SetTimeInput, type SetTimeOutput } from "./set-time.js";

export { addDeadlineTool, type AddDeadlineInput, type AddDeadlineOutput } from "./add-deadline.js";

export {
  removeDeadlineTool,
  type RemoveDeadlineInput,
  type RemoveDeadlineOutput,
} from "./remove-deadline.js";

import { getTimeTool } from "./get-time.js";
import { advanceTimeTool } from "./advance-time.js";
import { setTimeTool } from "./set-time.js";
import { addDeadlineTool } from "./add-deadline.js";
import { removeDeadlineTool } from "./remove-deadline.js";

/**
 * All time tools
 */
export const timeTools = [
  getTimeTool,
  advanceTimeTool,
  setTimeTool,
  addDeadlineTool,
  removeDeadlineTool,
];
