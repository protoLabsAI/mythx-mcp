/**
 * Training-data capture surface — see docs/finetuning-data-pipeline.md
 *
 * Two halves:
 *   - `sink.ts` — bus subscriber that persists domain events to
 *     `gameplay_events`.
 *   - `reward-attacher.ts` — debounced reconciler that back-fills
 *     reward signals onto prior events.
 *
 * Plus the underlying query helpers in `queries.ts`.
 */

export {
  startGameplayEventSink,
  type SinkBusEvent,
  type SinkSubscribe,
  type SinkOptions,
  type GameplayEventSink,
} from "./sink.js";

export {
  reconcileSessionRewards,
  createRewardReconciler,
  type ReconcileResult,
  type ReconcilerRunner,
  type RunnerOptions,
} from "./reward-attacher.js";

export {
  insertGameplayEvent,
  listGameplayEventsBySession,
  listGameplayEventsByType,
  getLatestEventByTurn,
  markEventUndone,
  markEventCausedCrash,
  markEventThumbed,
  deleteAllGameplayEvents,
  type GameplayEventInput,
  type GameplayEventRow,
  type GameplayEventType,
  type GameplayActor,
} from "./queries.js";
