/**
 * Tool exports and registry
 */

import type { MCPToolRegistry } from "@mythxengine/types";
import { diceTools } from "./dice.js";
import { characterTools } from "./characters.js";
import { sessionTools } from "./sessions.js";
import { combatTools } from "./combat.js";
import { generationTools } from "./generation.js";
import { expansionTools } from "./expansion/index.js";
import { worldpackTools } from "./worldpack/index.js";
import { timeTools } from "./time.js";
import { playerTools } from "./players.js";
import { turnTools } from "./turns.js";
import { stressTools } from "./stress.js";
import { lookupTools } from "./lookup.js";
import { locationTools } from "./location.js";
import { shopTools } from "./shop.js";
import { restTools } from "./rest.js";
import { dialogueTools } from "./dialogue.js";
import { inventoryTools } from "./inventory.js";
import { clockTools } from "./clocks.js";
import { leadTools } from "./leads.js";
import { relationshipTools } from "./relationships.js";
import { gmGuidanceTools } from "./gm-guidance.js";
import { sceneFramingTools } from "./scene-framing.js";
import { encounterTools } from "./encounters.js";
import { investigationTools } from "./investigation.js";
import { portableClueTools } from "./portable-clues.js";
import { engagementTools } from "./engagement.js";
import { bookTools } from "./books/index.js";
import { augmentationTools } from "./augmentation/index.js";
import { skillsTools } from "./skills.js";

/**
 * All available tools
 */
export const allTools = [
  ...diceTools,
  ...characterTools,
  ...sessionTools,
  ...combatTools,
  ...timeTools,
  ...playerTools,
  ...turnTools,
  ...stressTools,
  ...lookupTools,
  ...locationTools,
  ...shopTools,
  ...restTools,
  ...dialogueTools,
  ...inventoryTools,
  ...clockTools,
  ...leadTools,
  ...relationshipTools,
  ...gmGuidanceTools,
  ...sceneFramingTools,
  ...encounterTools,
  ...investigationTools,
  ...portableClueTools,
  ...engagementTools,
  ...generationTools,
  ...expansionTools,
  ...worldpackTools,
  ...bookTools,
  ...augmentationTools,
  ...skillsTools,
];

/**
 * Create a tool registry from the tools array
 */
export function createToolRegistry(): MCPToolRegistry {
  const registry: MCPToolRegistry = new Map();

  for (const tool of allTools) {
    registry.set(tool.name, tool);
  }

  return registry;
}

// Re-export individual tool modules
export { diceTools } from "./dice.js";
export { characterTools } from "./characters.js";
export { sessionTools } from "./sessions.js";
export { combatTools } from "./combat.js";
export { generationTools } from "./generation.js";
export { expansionTools } from "./expansion/index.js";
export { worldpackTools } from "./worldpack/index.js";
export { timeTools } from "./time.js";
export { playerTools } from "./players.js";
export { turnTools } from "./turns.js";
export { stressTools } from "./stress.js";
export { lookupTools } from "./lookup.js";
export { locationTools } from "./location.js";
export { shopTools } from "./shop.js";
export { restTools } from "./rest.js";
export { dialogueTools } from "./dialogue.js";
export { inventoryTools } from "./inventory.js";
export { clockTools } from "./clocks.js";
export { leadTools } from "./leads.js";
export { relationshipTools } from "./relationships.js";
export { gmGuidanceTools } from "./gm-guidance.js";
export { sceneFramingTools } from "./scene-framing.js";
export { encounterTools } from "./encounters.js";
export { investigationTools } from "./investigation.js";
export { portableClueTools } from "./portable-clues.js";
export { engagementTools } from "./engagement.js";
export { bookTools } from "./books/index.js";
export { augmentationTools } from "./augmentation/index.js";
export { skillsTools } from "./skills.js";
