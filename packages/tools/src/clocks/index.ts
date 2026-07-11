/**
 * Clock Tools
 *
 * Tools for managing situation clocks during gameplay.
 */

export {
  startSituationClockTool,
  type StartSituationClockInput,
  type StartSituationClockOutput,
} from "./start-situation-clock.js";

export {
  tickClockTool,
  TickClockInputSchema,
  type TickClockInput,
  type TickClockOutput,
} from "./tick-clock.js";

export {
  getActiveClocksTool,
  type GetActiveClocksInput,
  type GetActiveClocksOutput,
} from "./get-active-clocks.js";

export { pauseClockTool, type PauseClockInput, type PauseClockOutput } from "./pause-clock.js";

export { resumeClockTool, type ResumeClockInput, type ResumeClockOutput } from "./resume-clock.js";

export {
  revealClockTool,
  RevealClockInputSchema,
  type RevealClockInput,
  type RevealClockOutput,
} from "./reveal-clock.js";

export {
  checkClockTriggersTool,
  type CheckClockTriggersInput,
  type CheckClockTriggersOutput,
} from "./check-clock-triggers.js";

export { autoTickClocks, type ClockTickResult } from "./auto-tick.js";

import { startSituationClockTool } from "./start-situation-clock.js";
import { tickClockTool } from "./tick-clock.js";
import { getActiveClocksTool } from "./get-active-clocks.js";
import { pauseClockTool } from "./pause-clock.js";
import { resumeClockTool } from "./resume-clock.js";
import { revealClockTool } from "./reveal-clock.js";
import { checkClockTriggersTool } from "./check-clock-triggers.js";

/**
 * All clock tools
 */
export const clocksTools = [
  startSituationClockTool,
  tickClockTool,
  getActiveClocksTool,
  pauseClockTool,
  resumeClockTool,
  revealClockTool,
  checkClockTriggersTool,
];
