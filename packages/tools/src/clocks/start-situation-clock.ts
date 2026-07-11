/**
 * Start Situation Clock Tool (Shared)
 *
 * Start a situation clock that tracks what happens if PCs don't intervene.
 */

import { z } from "zod";
import { defineSharedTool, type ActiveClock, type GameTime } from "@mythxengine/types";
import { EventTypes } from "../events/channels.js";
import { emitGMEvent } from "../events/emitters.js";
import { resolveRawSituations } from "../situations/index.js";

/**
 * Input schema for start_situation_clock
 */
export const StartSituationClockInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  situationId: z.string().describe("Situation ID containing the clock"),
  clockId: z.string().optional().describe("Optional clock ID if situation has multiple clocks"),
  playerVisible: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Whether players can see this clock on their HUD. Defaults to false — clocks are GM-state and revealing them at start is a spoiler. Leave hidden and call reveal_clock when the fiction surfaces the threat/deadline to the players."
    ),
});

export type StartSituationClockInput = z.infer<typeof StartSituationClockInputSchema>;

/**
 * Output type for start_situation_clock
 */
export interface StartSituationClockOutput {
  message: string;
  clock: {
    id: string;
    name: string;
    doom: string;
    startedAt: string;
    /** 1-based stage number (stage N of totalStages), matching get_active_clocks. */
    currentStage: number;
    currentStageName: string;
    totalStages: number;
    paused: boolean;
    playerVisible: boolean;
  };
  warning: string;
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
 * Situation clock type from generated content
 */
interface SituationClock {
  id: string;
  name: string;
  doom: string;
  stages: Array<{
    id: string;
    name: string;
    description: string;
    trigger: unknown;
    consequences: unknown;
    reversible: boolean;
  }>;
  currentStage: number | null;
  startedAt: GameTime | null;
  paused: boolean;
}

/**
 * Situation type from generated content
 */
interface Situation {
  id: string;
  name: string;
  clock?: SituationClock;
}

/**
 * Start situation clock tool definition
 */
export const startSituationClockTool = defineSharedTool({
  name: "start_situation_clock",
  description: "Start a situation clock. The clock tracks what happens if PCs don't intervene.",
  inputSchema: StartSituationClockInputSchema,
  emits: [EventTypes.CLOCK_STARTED],

  handler: async (input, ctx): Promise<StartSituationClockOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Find the situation
    const situations = (await resolveRawSituations(ctx, session)) as Situation[];
    const situation = situations.find((s) => s.id === input.situationId) || null;
    if (!situation) {
      throw new Error(`Situation not found: ${input.situationId}`);
    }

    if (!situation.clock) {
      throw new Error(`Situation '${situation.name}' has no clock defined`);
    }

    const clock = situation.clock;

    // Check if clock ID matches (if provided)
    if (input.clockId && clock.id !== input.clockId) {
      throw new Error(`Clock ID mismatch: expected '${input.clockId}', found '${clock.id}'`);
    }

    // Initialize activeClocks if needed
    if (!session.activeClocks) {
      session.activeClocks = [];
    }

    // Check if clock is already active
    const existingClock = session.activeClocks.find((c) => c.clockId === clock.id);
    if (existingClock) {
      throw new Error(`Clock '${clock.name}' is already active`);
    }

    // Create active clock
    const activeClock: ActiveClock = {
      clockId: clock.id,
      situationId: input.situationId,
      name: clock.name,
      doom: clock.doom,
      currentStage: 0,
      startedAt: { ...session.gameTime },
      paused: false,
      playerVisible: input.playerVisible ?? false,
      totalStages: clock.stages.length,
      stages: clock.stages,
    };

    session.activeClocks.push(activeClock);
    await ctx.sessions.save(session);

    const firstStage = clock.stages[0];

    // Emit clock started event
    emitGMEvent(
      ctx.eventBus,
      input.sessionId,
      EventTypes.CLOCK_STARTED,
      {
        clockId: clock.id,
        clockName: clock.name,
        doom: clock.doom,
        situationId: input.situationId,
      },
      "start_situation_clock",
      ctx.currentTurnId
    );

    return {
      message: `Clock '${clock.name}' started`,
      clock: {
        id: clock.id,
        name: clock.name,
        doom: clock.doom,
        startedAt: formatGameTime(session.gameTime),
        currentStage: 1,
        currentStageName: firstStage?.name || "Unknown",
        totalStages: clock.stages.length,
        paused: false,
        playerVisible: activeClock.playerVisible,
      },
      warning: `The clock is now ticking toward: ${clock.doom}`,
    };
  },
});
