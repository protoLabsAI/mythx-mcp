/**
 * Events Module
 *
 * Channel naming conventions, event types, and emitter helpers.
 */

export { GameChannels, EventTypes } from "./channels.js";
export type { EventType } from "./channels.js";

export {
  createEvent,
  emitDiceRolled,
  emitTestResolved,
  emitSessionUpdated,
  emitCharacterUpdated,
  emitCombatEvent,
  emitGMEvent,
  emitInventoryEvent,
  emitImageGenRequest,
  emitImageGenStarted,
  // Training-corpus emitters — see docs/finetuning-data-pipeline.md
  emitChatTurnStarted,
  emitNarratorGenerated,
  emitSceneFramed,
  emitSessionEnded,
} from "./emitters.js";

// Character-state sync helpers — see docs/audits/chat-flow-audit.md §2.1.
// Every tool that mutates hp / conditions / stress / inventory should
// call `emitCharacterUpdatedFor` after persisting so the web client's
// state sync (and party sidebar) stay in step with chat.
export {
  emitCharacterUpdatedFor,
  isPlayerCharacter,
  type CharacterLike,
  type SessionLike,
} from "./character-state.js";
