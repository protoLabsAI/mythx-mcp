/**
 * Character Tools
 *
 * Tools for character CRUD + intent-named state mutators.
 *
 * `update_character` (the kitchen-sink mutator) was replaced by the
 * four intent-named tools below — see docs/audits/chat-flow-audit.md
 * §3 + §5 P1.2 for the rationale (LLMs pick the right tool more
 * reliably from a verb name than from a kitchen-sink schema). For
 * niche fields the old tool covered (maxHp, narrative weapons/gear/
 * armor, manual trauma add/remove, narrative flags), add focused
 * tools as the need surfaces.
 */

export {
  getCharacterTool,
  type GetCharacterInput,
  type GetCharacterOutput,
} from "./get-character.js";

export {
  createCharacterTool,
  type CreateCharacterInput,
  type CreateCharacterOutput,
} from "./create-character.js";

export {
  healCharacterTool,
  type HealCharacterInput,
  type HealCharacterOutput,
} from "./heal-character.js";

export {
  damageCharacterTool,
  type DamageCharacterInput,
  type DamageCharacterOutput,
} from "./damage-character.js";

export {
  applyConditionTool,
  type ApplyConditionInput,
  type ApplyConditionOutput,
} from "./apply-condition.js";

export {
  removeConditionTool,
  type RemoveConditionInput,
  type RemoveConditionOutput,
} from "./remove-condition.js";

export {
  listCharactersTool,
  type ListCharactersInput,
  type ListCharactersOutput,
  type CharacterSummary,
} from "./list-characters.js";

export {
  deleteCharacterTool,
  type DeleteCharacterInput,
  type DeleteCharacterOutput,
} from "./delete-character.js";

import { getCharacterTool } from "./get-character.js";
import { createCharacterTool } from "./create-character.js";
import { healCharacterTool } from "./heal-character.js";
import { damageCharacterTool } from "./damage-character.js";
import { applyConditionTool } from "./apply-condition.js";
import { removeConditionTool } from "./remove-condition.js";
import { listCharactersTool } from "./list-characters.js";
import { deleteCharacterTool } from "./delete-character.js";

/**
 * All character tools
 */
export const characterTools = [
  getCharacterTool,
  createCharacterTool,
  healCharacterTool,
  damageCharacterTool,
  applyConditionTool,
  removeConditionTool,
  listCharactersTool,
  deleteCharacterTool,
];
