/**
 * Auto-tick helper for clocks
 *
 * Used by roll_test and attack to automatically tick clocks on partial/failure outcomes.
 */

import type { SessionState, IEventBus, OutcomeType } from "@mythxengine/types";
import { outcomeShouldTickClock } from "@mythxengine/engine";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";

/**
 * Result of an auto-tick operation for a single clock
 */
export interface ClockTickResult {
  clockId: string;
  clockName: string;
  /** 1-based stage number before the tick (stage N of totalStages). */
  previousStage: number;
  /** 1-based stage number after the tick, matching get_active_clocks. */
  currentStage: number;
  totalStages: number;
  stagesRemaining: number;
  reachedDoom: boolean;
  /**
   * Whether players may see this clock. Player surfaces (e.g. the
   * frame's outcome card) must REDACT ticks of hidden clocks — an
   * unnamed "something advances" beat, no name/doom/narrative.
   */
  playerVisible: boolean;
  flagsSet?: string[];
  flagsRemoved?: string[];
  narrative?: string;
}

/**
 * Auto-tick clocks based on outcome
 *
 * @param session - Session state (will be mutated)
 * @param outcome - The outcome that may trigger ticking
 * @param clockIds - Clock IDs to potentially tick
 * @param eventBus - Event bus for emitting clock events
 * @param sessionId - Session ID for events
 * @param source - Source tool for events
 * @param causedBy - Optional chat-turn id (`ctx.currentTurnId`) so the
 *   gameplay-events sink groups the resulting `clock_ticked` rows under
 *   the parent chat turn.
 * @returns Array of tick results, or undefined if no ticking occurred
 */
export function autoTickClocks(
  session: SessionState,
  outcome: OutcomeType,
  clockIds: string[] | undefined,
  eventBus: IEventBus,
  sessionId: string,
  source: string,
  causedBy?: string
): ClockTickResult[] | undefined {
  // Check if outcome warrants ticking
  if (!outcomeShouldTickClock(outcome)) {
    return undefined;
  }

  // Check if there are clocks to tick
  if (!clockIds || clockIds.length === 0) {
    return undefined;
  }

  // Check if session has active clocks
  if (!session.activeClocks || session.activeClocks.length === 0) {
    return undefined;
  }

  const results: ClockTickResult[] = [];

  for (const clockId of clockIds) {
    const clockIndex = session.activeClocks.findIndex((c) => c.clockId === clockId);
    if (clockIndex === -1) {
      // Clock not found, skip silently
      continue;
    }

    const clock = session.activeClocks[clockIndex];

    // Skip paused clocks
    if (clock.paused) {
      continue;
    }

    const previousStage = clock.currentStage;

    // Check if at final stage (doom)
    if (clock.currentStage >= clock.totalStages - 1) {
      // Already at doom, process consequences
      const finalStage = clock.stages[clock.totalStages - 1];
      const consequences = finalStage.consequences as {
        setFlags?: string[];
        removeFlags?: string[];
        narrative?: string;
      };

      if (consequences.setFlags) {
        for (const flag of consequences.setFlags) {
          if (!session.flags.includes(flag)) {
            session.flags.push(flag);
          }
        }
      }

      if (consequences.removeFlags) {
        session.flags = session.flags.filter((f) => !consequences.removeFlags!.includes(f));
      }

      // Remove clock from active list
      session.activeClocks.splice(clockIndex, 1);

      // Emit doom event
      emitGMEvent(
        eventBus,
        sessionId,
        EventTypes.CLOCK_TICKED,
        {
          id: clock.clockId,
          name: clock.name,
          segments: clock.totalStages,
          filled: clock.totalStages,
          type: "countdown" as const,
          doom: true,
          autoTicked: true,
          triggerOutcome: outcome,
        },
        source,
        causedBy
      );

      results.push({
        clockId: clock.clockId,
        clockName: clock.name,
        previousStage: previousStage + 1,
        currentStage: clock.totalStages,
        totalStages: clock.totalStages,
        stagesRemaining: 0,
        reachedDoom: true,
        playerVisible: clock.playerVisible,
        flagsSet: consequences.setFlags,
        flagsRemoved: consequences.removeFlags,
        narrative: consequences.narrative,
      });
    } else {
      // Advance to next stage
      clock.currentStage++;
      const newStage = clock.stages[clock.currentStage];
      const consequences = newStage.consequences as {
        setFlags?: string[];
        removeFlags?: string[];
        narrative?: string;
      };

      if (consequences.setFlags) {
        for (const flag of consequences.setFlags) {
          if (!session.flags.includes(flag)) {
            session.flags.push(flag);
          }
        }
      }

      if (consequences.removeFlags) {
        session.flags = session.flags.filter((f) => !consequences.removeFlags!.includes(f));
      }

      // Emit tick event
      emitGMEvent(
        eventBus,
        sessionId,
        EventTypes.CLOCK_TICKED,
        {
          id: clock.clockId,
          name: clock.name,
          segments: clock.totalStages,
          filled: clock.currentStage + 1,
          type: "countdown" as const,
          autoTicked: true,
          triggerOutcome: outcome,
        },
        source,
        causedBy
      );

      results.push({
        clockId: clock.clockId,
        clockName: clock.name,
        previousStage: previousStage + 1,
        currentStage: clock.currentStage + 1,
        totalStages: clock.totalStages,
        stagesRemaining: clock.totalStages - clock.currentStage - 1,
        reachedDoom: false,
        playerVisible: clock.playerVisible,
        flagsSet: consequences.setFlags,
        flagsRemoved: consequences.removeFlags,
        narrative: consequences.narrative,
      });
    }
  }

  return results.length > 0 ? results : undefined;
}
