/**
 * Chapter 1 — Foundations
 *
 * Dice notation, RNG determinism, and the roll-over vs roll-under
 * convention. The "what makes the dice work" chapter that every other
 * mechanic builds on.
 */

import type { Chapter } from "../schema/index.js";

export const foundationsChapter: Chapter = {
  id: "foundations",
  number: 1,
  title: "Foundations",
  summary:
    "Dice notation, RNG determinism, and the roll-over vs roll-under convention. Read this once and the rest of the book is just consequences.",
  sections: [
    {
      id: "dice",
      title: "Dice",
      summary: "Notation, parsing, and the determinism contract.",
      entries: [
        {
          id: "1.1-dice-notation",
          title: "Dice notation",
          kind: "mechanic",
          audience: "both",
          surfaceInQuickStart: true,
          tags: ["dice", "foundations"],
          summary:
            "Standard `NdS+M` notation with optional ability modifier (e.g. `d20+STR`). Up to 100 dice with 100 sides; modifier is a literal or a core ability id.",
          body: [
            {
              kind: "prose",
              text: "Every roll in MythxEngine is written in standard dice notation: a number of dice (`N`, optional and defaulting to 1), the letter `d`, the number of sides (`S`), and an optional modifier `+M` or `-M`. The modifier may be a literal integer or one of the four core ability ids (`STR`, `AGI`, `WIT`, `CON`), which is resolved against the rolling character at evaluation time.",
            },
            {
              kind: "table",
              caption: "Examples",
              headers: ["Expression", "Reading", "Possible total"],
              rows: [
                ["`d20`", "one twenty-sided die", "1 to 20"],
                ["`2d6`", "two six-sided dice, summed", "2 to 12"],
                ["`1d8+3`", "one d8 plus a flat 3", "4 to 11"],
                ["`d6-1`", "one d6 minus 1", "0 to 5"],
                ["`d20+STR`", "one d20 plus the roller's STR ability", "varies"],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Limits",
              text: "Both dice count and sides are clamped to the range **1..100**. Expressions outside that range are rejected at parse time — there's no `1d10000` escape hatch.",
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Custom ability ids",
              text: "The dice parser only recognizes the four core ability ids inline. A world that adds `SPD` or `STRESS` via the rules system can reference those abilities as test inputs, but not inside a dice-expression modifier — use a flat numeric modifier or a custom test instead.",
            },
          ],
          numbers: [
            { name: "Max dice count", value: 100, source: "engine/dice/parser" },
            { name: "Max sides", value: 100, source: "engine/dice/parser" },
          ],
          canonicalSource: [{ file: "packages/engine/src/dice/parser.ts" }],
          extensibility: {
            kind: "fixed",
            reason: "Notation is a parser invariant; world packs do not redefine it.",
          },
          xref: ["1.2-rng-determinism", "1.3-roll-under"],
        },
        {
          id: "1.2-rng-determinism",
          title: "RNG determinism",
          kind: "concept",
          audience: "both",
          tags: ["dice", "foundations", "determinism"],
          summary:
            "The same seed plus the same sequence of actions always produces the same outcome. Sessions store the RNG state on disk, so a session can be replayed bit-for-bit.",
          body: [
            {
              kind: "prose",
              text: "MythxEngine uses a Mulberry32 32-bit pseudo-random number generator. The RNG state is `{ seed, cursor }`: the cursor advances by one for every die rolled, and the engine stores the latest state on the session. Replaying the same actions against the same starting state produces identical outcomes — this is the determinism contract.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Why determinism matters",
              text: "Determinism is what lets the GM-assist agent reason about *what should have happened* without re-rolling. It's also what makes saved-game replays exact — bug reports can be reproduced from a session file alone.",
            },
            {
              kind: "prose",
              text: "Worlds **cannot** swap the RNG algorithm. That's intentional: changing the algorithm would silently invalidate every saved session.",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/rng/mulberry32.ts" },
            { file: "packages/engine/src/rng/rng.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason: "Algorithm is a determinism-contract invariant; never world-overridable.",
          },
          xref: ["1.1-dice-notation"],
        },
        {
          id: "1.3-roll-under",
          title: "Roll-under vs roll-over",
          kind: "concept",
          audience: "both",
          tags: ["dice", "foundations", "world-overrides"],
          summary:
            "Default is roll-over d20 (higher beats target). Worlds can opt into roll-under (lower beats target, typically d100) — both modes use the same five-tier outcome ladder.",
          body: [
            {
              kind: "prose",
              text: "Most worlds use the roll-over d20 default: roll, add modifiers, succeed if `total >= difficulty`. Some genres prefer roll-under d100 (e.g. classic Mothership-style horror): roll, succeed if `total <= ability target`, with lower being better.",
            },
            {
              kind: "prose",
              text: "Both conventions feed the same five-tier outcome ladder. When `rollUnder.enabled` is true, the resolver swaps the dice expression (default `d100`) and flips the margin computation to `difficulty - total` so a positive margin still means *succeeded by that much*. The same outcome thresholds (critical / success / partial / failure) apply unchanged.",
            },
            {
              kind: "formula",
              name: "Roll-over margin",
              expression: "margin = total - difficulty",
            },
            {
              kind: "formula",
              name: "Roll-under margin",
              expression: "margin = difficulty - total",
            },
            {
              kind: "callout",
              tone: "info",
              title: "Critical ranges",
              text: "Critical-roll detection is uniform across modes — `criticals.successOn` and `failureOn` arrays apply to the natural die regardless of comparator direction. There is no separate `criticalSuccessRange` for roll-under; configure crits the same way you would for d20.",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/rules/context.ts" },
            { file: "packages/engine/src/resolution/test.ts" },
            { file: "packages/engine/src/rules/custom-test.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.rollUnder",
            fullySupported: true,
          },
          xref: ["2.1-outcome-tiers", "4.2-custom-tests"],
        },
      ],
    },
  ],
};
