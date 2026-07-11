/**
 * Chapter 9 — Time, Clocks & Deadlines
 *
 * The game-time model, deadlines that fire when wall-clock game time
 * passes them, and situation clocks (named-stage countdowns) that
 * advance via explicit ticks or via auto-tick on partial / failure.
 */

import type { Chapter } from "../schema/index.js";

export const timeClocksChapter: Chapter = {
  id: "time-clocks",
  number: 9,
  title: "Time, Clocks & Deadlines",
  summary:
    "Game time is a `{ day, hour, minute }` integer triple advancing by minutes. Deadlines fire when game time passes them; situation clocks advance by named stages, manually or via auto-tick on bad outcomes.",
  sections: [
    {
      id: "time",
      title: "Game time",
      summary: "The integer triple every other time mechanic builds on.",
      entries: [
        {
          id: "9.1-game-time",
          title: "Game time model",
          kind: "mechanic",
          audience: "both",
          tags: ["time"],
          summary:
            "`GameTime = { day, hour, minute }` advancing by minutes. Initial time is `{ day: 1, hour: 6, minute: 0 }` — day 1, dawn. All time helpers (`gameTimeToMinutes`, `compareGameTime`, `minutesUntil`, `formatDuration`, `advanceGameTime`) live in the engine.",
          body: [
            {
              kind: "prose",
              text: "Game time is integer-only — there are no fractional minutes. `advanceGameTime(time, minutes)` rolls minute → hour → day correctly; `gameTimeToMinutes` flattens to a single integer for comparisons (using the `(day - 1) × MINUTES_PER_DAY` convention so `{ day: 1, hour: 0, minute: 0 }` is the canonical epoch).",
            },
            {
              kind: "formula",
              name: "Time as minutes",
              expression: "minutes = (day − 1) × 1440 + hour × 60 + minute",
            },
            {
              kind: "callout",
              tone: "info",
              title: "Initial time",
              text: "`createInitialGameTime()` returns `{ day: 1, hour: 6, minute: 0 }` — sessions start at dawn on day 1. Worlds wanting a different start can override after creation; nothing in the engine forces dawn.",
            },
          ],
          numbers: [
            { name: "Minutes per hour", value: 60, source: "engine/time/expiration" },
            { name: "Hours per day", value: 24, source: "engine/time/expiration" },
            { name: "Initial day", value: 1, source: "createInitialGameTime" },
            { name: "Initial hour", value: 6, source: "createInitialGameTime" },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/state.ts" },
            { file: "packages/engine/src/time/expiration.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason: "Time math is a determinism-adjacent invariant; not world-overridable.",
          },
          xref: ["7.4-time-expiration", "9.2-deadlines", "9.3-situation-clocks"],
        },
      ],
    },
    {
      id: "deadlines-clocks",
      title: "Deadlines and clocks",
      summary: "Two ways to make time pressure mechanical.",
      entries: [
        {
          id: "9.2-deadlines",
          title: "Deadlines",
          kind: "mechanic",
          audience: "gm",
          tags: ["time", "gm-support"],
          summary:
            "`Deadline = { id, name, description, expiresAt, onExpireFlag?, warnOnApproach }`. `advance_time` fires expired deadlines (sets the flag, removes from list) and warns on any deadline within 60 minutes if `warnOnApproach`.",
          body: [
            {
              kind: "prose",
              text: "Deadlines are wall-clock pressure: a flag is set when game time passes the configured `expiresAt` `GameTime`. The tool layer's `advance_time` is the single firing site — it walks the deadline list, removes anything that's expired, and sets the optional flag on the session.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Use `warnOnApproach` for heads-up beats",
              text: "Setting `warnOnApproach: true` lets the GM / agent surface a soft warning when the deadline is within 60 minutes of game time. Useful for visible countdowns — the bell that rings before the hour, the ritual that completes at midnight.",
            },
          ],
          numbers: [
            { name: "Approach warning window (min)", value: 60, source: "advance-time tool" },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/state.ts" },
            { file: "packages/engine/src/time/expiration.ts" },
            { file: "packages/tools/src/time/add-deadline.ts" },
            { file: "packages/tools/src/time/advance-time.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason: "Deadlines are session-state shape; not world-tunable.",
          },
          xref: ["9.1-game-time", "9.3-situation-clocks"],
        },
        {
          id: "9.3-situation-clocks",
          title: "Situation clocks",
          kind: "mechanic",
          audience: "gm",
          tags: ["time", "gm-support", "combat"],
          summary:
            "Named-stage countdowns. `start_situation_clock` instantiates an `ActiveClock`; `tick_clock` advances by one stage; `roll_test` and `attack` accept `autoTickClockIds[]` and auto-tick on partial-or-worse outcomes (via [outcomeShouldTickClock](2.1-outcome-tiers)).",
          body: [
            {
              kind: "prose",
              text: "Situation clocks are the engine's pressure-cooker mechanic. A clock is defined on a world-pack `situations[].clock` with named stages, each carrying consequences (`setFlags`, `removeFlags`, optional narrative). At runtime, `start_situation_clock` instantiates an `ActiveClock` on `SessionState.activeClocks` with `currentStage = 0` and `paused = false`.",
            },
            {
              kind: "table",
              caption: "Tick sources",
              headers: ["Source", "When"],
              rows: [
                ["`tick_clock` tool", "Manual GM tick (e.g. a scene transition)"],
                [
                  "`roll_test` / `attack` `autoTickClockIds`",
                  "Auto-fires on `partial`, `failure`, `critical_failure` per [outcomeShouldTickClock](2.1-outcome-tiers)",
                ],
                [
                  "`tick_clock` from a [GM move](10.1-gm-moves-catalog)",
                  "Move-driven tick (`tick_clock`)",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Final stage = doom",
              text: "When a tick advances the clock past its final stage, the engine removes it from `activeClocks` and emits a `doom` event. The clock's terminal consequences (flags) apply on that final tick — there's no separate \"after doom\" phase.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Pause / resume",
              text: "`pause_clock` and `resume_clock` toggle the `paused` flag without altering the stage. A paused clock is skipped by auto-tick — useful when the situation moves out of focus.",
            },
          ],
          examples: [
            {
              title: "Auto-tick on a partial",
              scenario:
                "A character attempts to defuse a bomb (clock id `bomb-timer`). They roll a partial — the action lands but the bomb timer ticks one stage closer to detonation.",
              inputs: { autoTickClockIds: ["bomb-timer"], outcome: "partial" },
              expectedOutputs: {
                clocksTicked: [{ id: "bomb-timer", from: 1, to: 2 }],
              },
            },
          ],
          canonicalSource: [
            { file: "packages/tools/src/clocks/start-situation-clock.ts" },
            { file: "packages/tools/src/clocks/tick-clock.ts" },
            { file: "packages/tools/src/clocks/auto-tick.ts" },
            { file: "packages/engine/src/resolution/outcome.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "Clock stages live in world-pack content (`situations[].clock`), not in `WorldRulesConfig`. The engine's clock tick contract is fixed.",
          },
          xref: ["2.1-outcome-tiers", "9.1-game-time", "9.2-deadlines", "10.1-gm-moves-catalog"],
        },
      ],
    },
  ],
};
