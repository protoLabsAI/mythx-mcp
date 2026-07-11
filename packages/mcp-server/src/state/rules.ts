/**
 * Rules Context Loading
 *
 * Helper functions to load rules context from sessions and world packs.
 */

import type { SessionState } from "@mythxengine/types";
import { type RulesContext, createRulesContext, getDefaultRulesContext } from "@mythxengine/engine";
import { worldPackManager } from "./worldpacks.js";

/**
 * Cache for rules contexts by world pack ID
 */
const rulesCache: Map<string, RulesContext> = new Map();

/**
 * Get the rules context for a session.
 *
 * If the session has a worldPackId, loads the world pack's rules.
 * Otherwise, returns the default rules context.
 *
 * @param session - The session state
 * @returns RulesContext for the session
 */
export async function getRulesForSession(session: SessionState): Promise<RulesContext> {
  if (!session.worldPackId) {
    return getDefaultRulesContext();
  }
  return getRulesForWorldPack(session.worldPackId);
}

/**
 * Get rules context directly from a world pack ID.
 *
 * @param packId - World pack ID
 * @returns RulesContext for the world pack, or default if not found
 */
export async function getRulesForWorldPack(packId: string): Promise<RulesContext> {
  // Check cache
  const cached = rulesCache.get(packId);
  if (cached) {
    return cached;
  }

  // Load world pack
  const worldPack = await worldPackManager.get(packId);
  if (!worldPack) {
    return getDefaultRulesContext();
  }

  // Create and cache
  const rules = createRulesContext(worldPack.rules);
  rulesCache.set(packId, rules);

  return rules;
}

/**
 * Clear the rules cache (useful when world pack is updated)
 * @param packId - If provided, clears only that pack's cache. Otherwise clears all.
 */
export function clearRulesCache(packId?: string): void {
  if (packId) {
    rulesCache.delete(packId);
  } else {
    rulesCache.clear();
  }
}
