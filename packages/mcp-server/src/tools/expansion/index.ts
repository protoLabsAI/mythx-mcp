/**
 * Expansion tools - content detail expansion
 */

export { expandLocationTools, expandLocationTool } from "./location.js";
export { expandArchetypeTools, expandArchetypeTool } from "./archetype.js";
export { expandNPCTools, expandNPCTool } from "./npc.js";
export { expandMonsterTools, expandMonsterTool } from "./monster.js";

import { expandLocationTools } from "./location.js";
import { expandArchetypeTools } from "./archetype.js";
import { expandNPCTools } from "./npc.js";
import { expandMonsterTools } from "./monster.js";

/**
 * All expansion tools
 */
export const expansionTools = [
  ...expandLocationTools,
  ...expandArchetypeTools,
  ...expandNPCTools,
  ...expandMonsterTools,
];
