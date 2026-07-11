/**
 * GM Guidance Tools Module
 *
 * Shared tool definitions for contextual GM advice.
 */

export { getGmGuidanceTool, GetGmGuidanceInputSchema } from "./get-gm-guidance.js";
export type { GetGmGuidanceInput, GetGmGuidanceOutput } from "./get-gm-guidance.js";

export {
  generateStuckGuidance,
  generateResolutionGuidance,
  generatePacingGuidance,
  generateToneGuidance,
  generateNpcGuidance,
} from "./helpers.js";
export type { GuidanceResult, GuidanceSituation } from "./helpers.js";

// Export all GM guidance tools as an array
import { getGmGuidanceTool } from "./get-gm-guidance.js";

export const gmGuidanceTools = [getGmGuidanceTool];
