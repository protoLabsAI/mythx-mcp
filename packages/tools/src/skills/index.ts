/**
 * Skills domain — tools for loading on-demand prompt fragments.
 *
 * The agent uses `load_skill` to pull domain-specific guidance into
 * its turn context when the situation matches a skill's purpose.
 * Keeping skill bodies out of the always-loaded system prompt keeps
 * the pinned slab small and prompt-cache-friendly.
 */

export * from "./load-skill.js";

import { loadSkillTool } from "./load-skill.js";

export const skillsTools = [loadSkillTool];
