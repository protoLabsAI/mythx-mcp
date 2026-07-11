/**
 * Shared helpers for emitting `CHARACTER_UPDATED` events from any tool
 * that mutates a character's state.
 *
 * Why: the web client's `useGameStateSync` hook listens for
 * `CHARACTER_UPDATED` (with a full character snapshot) to keep the
 * party sidebar in sync with the canonical session state. Tools that
 * only emit their domain event (`DAMAGE_TAKEN`, `CONDITION_APPLIED`,
 * `ITEM_EQUIPPED`, etc.) silently desync the sidebar — the chat
 * renders the new state from the tool's return payload, but the
 * sidebar keeps showing stale data.
 *
 * Every tool that mutates a character's hp / conditions / stress /
 * inventory should call `emitCharacterUpdatedFor` after persisting,
 * alongside its domain event. The two events serve different consumers:
 *   - domain event: GameEventFeed cards, log entries
 *   - CHARACTER_UPDATED: state sync into the sidebar / hud / etc.
 *
 * See docs/audits/chat-flow-audit.md §2.1 + §5 P0.1.
 */

import type { IEventBus, Character, SessionState } from "@mythxengine/types";
import { emitCharacterUpdated } from "./emitters.js";

/**
 * Subset of `Character` the snapshot builder reads. Derived from the
 * canonical `@mythxengine/types` model so changes to `Character`
 * surface here as type errors instead of silent drift.
 */
export type CharacterLike = Pick<Character, "id" | "name" | "hp" | "conditions" | "stress">;

/**
 * Subset of `SessionState` we need to derive `isPlayer` and to gate
 * combat targets. Same `Pick<>` rationale as `CharacterLike`.
 */
export type SessionLike = Pick<SessionState, "players" | "characters" | "enemies">;

/**
 * Emit `CHARACTER_UPDATED` with a full character snapshot suitable
 * for the web client's state reducer.
 *
 * `changes` is free-form and surfaces in the GameEventFeed card —
 * pass whatever the caller's domain event would have shown ("hpDelta:
 * -3", "addedCondition: 'wounded'", etc.).
 *
 * `toolId` is the tool name that triggered the mutation; used for
 * span correlation in the event-bus telemetry.
 */
export function emitCharacterUpdatedFor(
  eventBus: IEventBus,
  sessionId: string,
  character: CharacterLike,
  session: SessionLike,
  changes: Record<string, unknown>,
  toolId: string,
  /** Chat-turn id for gameplay-events grouping. Pass `ctx.currentTurnId`. */
  causedBy?: string
): void {
  const isPlayer = Object.values(session.players ?? {}).some((p) => p.characterId === character.id);
  emitCharacterUpdated(
    eventBus,
    sessionId,
    {
      characterId: character.id,
      characterName: character.name,
      changes,
      character: {
        id: character.id,
        name: character.name,
        hp: character.hp.current,
        maxHp: character.hp.max,
        conditions: (character.conditions ?? []).map((c) => c.name),
        isPlayer,
        stress: character.stress
          ? { current: character.stress.current, max: character.stress.max }
          : undefined,
      },
    },
    toolId,
    causedBy
  );
}

/**
 * True iff the given combatant id is a player character (not an
 * enemy). Tools that operate on a `getCombatant()` result need this
 * gate before emitting `CHARACTER_UPDATED` — emitting for enemies
 * would create phantom party-sidebar entries.
 */
export function isPlayerCharacter(
  session: Pick<SessionState, "characters" | "enemies">,
  combatantId: string
): boolean {
  return Boolean(session.characters?.[combatantId]) && !session.enemies?.[combatantId];
}
