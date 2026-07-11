/**
 * Engagement Tools
 *
 * Tools for "treasure, personal, mystery" engagement encodings.
 * Based on Alexandrian: "Make lore stick via treasure, mystery, personal ties."
 */

export {
  personalizeContentTool,
  type PersonalizeContentInput,
  type PersonalizeContentOutput,
  PersonalizeContentInputSchema,
} from "./personalize-content.js";

export {
  treasurifyInformationTool,
  type TreasurifyInformationInput,
  type TreasurifyInformationOutput,
  TreasurifyInformationInputSchema,
} from "./treasurify-information.js";

export {
  mystifyContentTool,
  type MystifyContentInput,
  type MystifyContentOutput,
  MystifyContentInputSchema,
} from "./mystify-content.js";

export {
  generateEngagementHooksTool,
  type GenerateEngagementHooksInput,
  type GenerateEngagementHooksOutput,
  GenerateEngagementHooksInputSchema,
} from "./generate-engagement-hooks.js";

import { personalizeContentTool } from "./personalize-content.js";
import { treasurifyInformationTool } from "./treasurify-information.js";
import { mystifyContentTool } from "./mystify-content.js";
import { generateEngagementHooksTool } from "./generate-engagement-hooks.js";

/**
 * All engagement tools
 */
export const engagementTools = [
  personalizeContentTool,
  treasurifyInformationTool,
  mystifyContentTool,
  generateEngagementHooksTool,
];
