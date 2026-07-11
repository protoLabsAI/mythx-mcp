/**
 * Advance Time Tool (Shared)
 *
 * Advances game time by N minutes.
 */

import { z } from "zod";
import {
  defineSharedTool,
  createInitialGameTime,
  advanceGameTime,
  type GameTime,
  type Deadline,
} from "@mythxengine/types";
import { compareGameTime, minutesUntil, formatDuration } from "@mythxengine/engine";

/**
 * Input schema for advance_time
 */
export const AdvanceTimeInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  minutes: z.coerce.number().min(1).describe("Minutes to advance"),
});

export type AdvanceTimeInput = z.infer<typeof AdvanceTimeInputSchema>;

/**
 * Time snapshot in output
 */
export interface TimeSnapshot {
  day: number;
  hour: number;
  minute: number;
  formatted: string;
}

/**
 * Expired deadline info
 */
export interface ExpiredDeadline {
  id: string;
  name: string;
  flagSet?: string;
}

/**
 * Approaching deadline info
 */
export interface ApproachingDeadline {
  id: string;
  name: string;
  minutesRemaining: number;
  timeRemaining: string;
}

/**
 * Expired condition info
 */
export interface ExpiredCondition {
  characterId: string;
  characterName: string;
  conditionId: string;
  conditionName: string;
}

/**
 * Output type for advance_time
 */
export interface AdvanceTimeOutput {
  previous: TimeSnapshot;
  current: TimeSnapshot;
  advanced: number;
  expiredDeadlines?: ExpiredDeadline[];
  approachingDeadlines?: ApproachingDeadline[];
  expiredConditions?: ExpiredCondition[];
}

/**
 * Format game time as human-readable string
 */
function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}

/**
 * Advance time tool definition
 */
export const advanceTimeTool = defineSharedTool({
  name: "advance_time",
  description: "Advances time by N minutes",
  inputSchema: AdvanceTimeInputSchema,

  handler: async (input, ctx): Promise<AdvanceTimeOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Handle sessions created before gameTime was added
    if (!session.gameTime) {
      session.gameTime = createInitialGameTime();
    }

    // Handle sessions created before deadlines was added
    if (!session.deadlines) {
      session.deadlines = [];
    }

    const previous = { ...session.gameTime };
    session.gameTime = advanceGameTime(session.gameTime, input.minutes);

    // Check for expired deadlines
    const expiredDeadlines: ExpiredDeadline[] = [];
    const remainingDeadlines: Deadline[] = [];

    for (const deadline of session.deadlines) {
      if (compareGameTime(session.gameTime, deadline.expiresAt) >= 0) {
        // Deadline expired
        expiredDeadlines.push({
          id: deadline.id,
          name: deadline.name,
          flagSet: deadline.onExpireFlag,
        });
        // Set flag if specified
        if (deadline.onExpireFlag) {
          if (!session.flags.includes(deadline.onExpireFlag)) {
            session.flags.push(deadline.onExpireFlag);
          }
        }
      } else {
        remainingDeadlines.push(deadline);
      }
    }

    session.deadlines = remainingDeadlines;

    // Check for approaching deadlines (within 1 hour)
    const approachingDeadlines = remainingDeadlines
      .filter((d) => {
        const remaining = minutesUntil(session.gameTime, d.expiresAt);
        return remaining > 0 && remaining <= 60 && d.warnOnApproach;
      })
      .map((d) => ({
        id: d.id,
        name: d.name,
        minutesRemaining: minutesUntil(session.gameTime, d.expiresAt),
        timeRemaining: formatDuration(minutesUntil(session.gameTime, d.expiresAt)),
      }));

    // Check for expired conditions on characters
    const expiredConditions: ExpiredCondition[] = [];

    for (const [charId, character] of Object.entries(session.characters)) {
      const remainingConditions = character.conditions.filter((c) => {
        if (c.expiresAtGameTime) {
          if (compareGameTime(session.gameTime, c.expiresAtGameTime) >= 0) {
            expiredConditions.push({
              characterId: charId,
              characterName: character.name,
              conditionId: c.id,
              conditionName: c.name,
            });
            return false;
          }
        }
        return true;
      });
      character.conditions = remainingConditions;
    }

    // Also check enemies
    for (const [enemyId, enemy] of Object.entries(session.enemies)) {
      const remainingConditions = enemy.conditions.filter((c) => {
        if (c.expiresAtGameTime) {
          if (compareGameTime(session.gameTime, c.expiresAtGameTime) >= 0) {
            expiredConditions.push({
              characterId: enemyId,
              characterName: enemy.name,
              conditionId: c.id,
              conditionName: c.name,
            });
            return false;
          }
        }
        return true;
      });
      enemy.conditions = remainingConditions;
    }

    await ctx.sessions.save(session);

    const currentSnapshot: TimeSnapshot = {
      day: session.gameTime.day,
      hour: session.gameTime.hour,
      minute: session.gameTime.minute,
      formatted: formatGameTime(session.gameTime),
    };

    // Broadcast to the session's state channel so the HUD updates
    // in real time. Without this, time only changes on the next full
    // session refetch.
    //
    // `meta.causedBy` lets the gameplay-events sink group this row
    // under the parent chat turn — see ToolContext.currentTurnId in
    // packages/types/src/tools/shared.ts. Was missed in the
    // causedBy-threading sweep (#427) because this is a raw inline
    // emit, not a call into an emitX helper.
    ctx.eventBus.publish(`session:${input.sessionId}:state`, {
      id: crypto.randomUUID(),
      type: "TIME_ADVANCED",
      channel: `session:${input.sessionId}:state`,
      payload: { time: currentSnapshot, advanced: input.minutes },
      timestamp: Date.now(),
      source: { type: "tool", id: "advance_time" },
      sessionId: input.sessionId,
      ...(ctx.currentTurnId ? { meta: { causedBy: ctx.currentTurnId } } : {}),
    });

    const result: AdvanceTimeOutput = {
      previous: {
        day: previous.day,
        hour: previous.hour,
        minute: previous.minute,
        formatted: formatGameTime(previous),
      },
      current: currentSnapshot,
      advanced: input.minutes,
    };

    if (expiredDeadlines.length > 0) {
      result.expiredDeadlines = expiredDeadlines;
    }

    if (approachingDeadlines.length > 0) {
      result.approachingDeadlines = approachingDeadlines;
    }

    if (expiredConditions.length > 0) {
      result.expiredConditions = expiredConditions;
    }

    return result;
  },
});
