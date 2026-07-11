/**
 * Shared LLM tier + agent-role types.
 *
 * These live in @mythxengine/types so anything that needs them (the agents
 * config layer, the chat / world-gen routes, the Connections settings UI)
 * can import without taking on the rest of @mythxengine/agents/config — and
 * without forcing the UI to transitively depend on LangChain through the
 * agents package.
 *
 * The single source of truth for "which role exists" and "which tier owns
 * which role" is here. Treat additions as schema changes: bump every
 * downstream Record<RPGAgentRole, ...> and matching unit test.
 *
 * Every exported registry below is `Object.freeze`d. `as const` only
 * narrows the TypeScript view — it doesn't actually make the runtime
 * value immutable. A downstream consumer reaching into ROLE_TO_TIER and
 * mutating it would silently change behavior process-wide.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export const TIER_NAMES = Object.freeze(["fast", "smart", "creative"] as const);
export type TierName = (typeof TIER_NAMES)[number];
export const TierNameSchema = z.enum(TIER_NAMES);

// ---------------------------------------------------------------------------
// Agent roles
// ---------------------------------------------------------------------------

export const RPG_AGENT_ROLES = Object.freeze([
  "orchestrator",
  "player-researcher",
  "world-generator",
  "deep-roleplay",
  "ai-player",
  "combat-narrator",
  "scene-framer",
  "ambient-narrator",
] as const);
export type RPGAgentRole = (typeof RPG_AGENT_ROLES)[number];
export const RPGAgentRoleSchema = z.enum(RPG_AGENT_ROLES);

export function isRPGAgentRole(value: string): value is RPGAgentRole {
  return (RPG_AGENT_ROLES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Role → tier mapping
// ---------------------------------------------------------------------------

/**
 * Default tier each role falls back to when no explicit assignment exists.
 * The connections resolver consults this on every chat / world-gen request,
 * so it must stay exhaustive — adding a role without an entry will hit the
 * "smart" default but lose the categorization signal.
 *
 * `satisfies Record<RPGAgentRole, TierName>` enforces exhaustiveness at
 * compile time. `Object.freeze` makes the runtime object immutable so a
 * downstream consumer can't accidentally clobber a role's tier.
 */
const roleToTierMap = {
  orchestrator: "smart",
  "player-researcher": "fast",
  "world-generator": "creative",
  // Narration roles default to fast so the smart orchestrator (the
  // coordinator doing flow + mechanics + tool calls) stays free for
  // its tool-routing work while a separate fast model handles prose.
  // Users with a stronger creative tier configured can still override
  // per-role via assignment.roles in connections config.
  "deep-roleplay": "fast",
  // ai-player is the autonomous-player role — used by the harness
  // autoplayer (`scripts/player-agent.ts`) to drive long-form eval
  // sessions against the GM. It generates short in-character player
  // utterances ("I draw my sword and charge", "I ask the bartender
  // about the murders"), not narration or tool-orchestration, so
  // the fast tier is the right default. Users with a strong smart
  // tier configured can still override via assignment.roles.
  "ai-player": "fast",
  "combat-narrator": "fast",
  "scene-framer": "fast",
  "ambient-narrator": "fast",
} as const satisfies Record<RPGAgentRole, TierName>;

export const ROLE_TO_TIER: Readonly<Record<RPGAgentRole, TierName>> = Object.freeze(roleToTierMap);
