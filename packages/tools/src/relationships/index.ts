/**
 * Relationship Tools
 *
 * Tools for tracking NPC attitudes and interaction history.
 */

// Shared types and helpers (exported for potential reuse)
export {
  ATTITUDES,
  type Attitude,
  getAttitudeSummary,
} from "./helpers.js";

export {
  getRelationshipTool,
  type GetRelationshipInput,
  type GetRelationshipOutput,
} from "./get-relationship.js";

export {
  initializeRelationshipTool,
  type InitializeRelationshipInput,
  type InitializeRelationshipOutput,
} from "./initialize-relationship.js";

export {
  updateRelationshipTool,
  type UpdateRelationshipInput,
  type UpdateRelationshipOutput,
} from "./update-relationship.js";

export {
  listRelationshipsTool,
  type ListRelationshipsInput,
  type ListRelationshipsOutput,
} from "./list-relationships.js";

export {
  getNpcDispositionTool,
  type GetNpcDispositionInput,
  type GetNpcDispositionOutput,
} from "./get-npc-disposition.js";

import { getRelationshipTool } from "./get-relationship.js";
import { initializeRelationshipTool } from "./initialize-relationship.js";
import { updateRelationshipTool } from "./update-relationship.js";
import { listRelationshipsTool } from "./list-relationships.js";
import { getNpcDispositionTool } from "./get-npc-disposition.js";

/**
 * All relationship tools
 */
export const relationshipsTools = [
  getRelationshipTool,
  initializeRelationshipTool,
  updateRelationshipTool,
  listRelationshipsTool,
  getNpcDispositionTool,
];
