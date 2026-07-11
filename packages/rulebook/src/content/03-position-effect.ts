/**
 * Chapter 3 — Position & Effect
 *
 * The two FitD-derived metadata axes that calibrate stakes before a
 * roll. Position drives consequence severity and the GM-move matrix;
 * effect level frames how much narrative impact a success grants.
 * Both are inputs to the resolver but neither alters margin math —
 * they shape the *meaning* of the outcome, not the math behind it.
 */

import type { Chapter } from "../schema/index.js";

export const positionEffectChapter: Chapter = {
  id: "position-effect",
  number: 3,
  title: "Position & Effect",
  summary:
    "Position calibrates risk before the roll; effect level frames how much progress a success buys. Set both per call to drive GM-move suggestions and narrative impact.",
  sections: [
    {
      id: "framing",
      title: "Framing axes",
      summary: "The two metadata axes that calibrate stakes before a roll.",
      entries: [
        {
          id: "3.1-position",
          title: "Position",
          kind: "concept",
          audience: "both",
          surfaceInQuickStart: true,
          tags: ["foundations", "gm-support"],
          summary:
            "Tri-state risk level — `controlled`, `risky`, `desperate` — set per roll. Doesn't alter margin or damage; drives consequence severity and the [GM-move matrix](10.2-move-matrix).",
          body: [
            {
              kind: "prose",
              text: "Position is the single most important framing question a GM can ask before a roll: **how bad is failure here?** Setting it explicitly turns vague threat into a calibrated commitment. The engine accepts position on every test and attack and attaches it to the result; it's the [tools layer](10.3-consequence-guidance) that reads position to pick GM moves.",
            },
            {
              kind: "table",
              caption: "The three positions",
              headers: ["Position", "Risk", "What failure looks like"],
              rows: [
                [
                  "`controlled`",
                  "Low",
                  "A safe approach. Worst case you spend a resource or learn an unwelcome truth.",
                ],
                [
                  "`risky`",
                  "Standard (default)",
                  "The default stakes. Failure inflicts harm, ticks a clock, or puts someone in a spot.",
                ],
                [
                  "`desperate`",
                  "High",
                  "You're past the point of safe retreat. Failure is severe — fictional flaws come into play, allies get separated.",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Pick before you roll",
              text: "Position is meant to be agreed *before* dice hit the table. Renegotiating it after a bad roll defeats the purpose — that's the partial outcome's job.",
            },
            {
              kind: "callout",
              tone: "info",
              title: "Engine vs. tools boundary",
              text: "The engine accepts position only as input metadata — it does not alter margin, damage, or threshold math. Position only takes effect through the tools layer, which calls `getGMMoves(outcome, position)` to suggest consequences. See the engine-vs-tools boundary note in `CLAUDE.md`.",
            },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/outcome.ts" },
            { file: "packages/types/src/game/gm-moves.ts" },
            { file: "packages/engine/src/resolution/test.ts" },
            { file: "packages/engine/src/resolution/combat.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "The three labels are baked into the type system as a string-literal union. Renaming or extending them would change every consumer.",
          },
          xref: ["3.2-effect-level", "10.1-gm-moves-catalog", "10.2-move-matrix"],
        },
        {
          id: "3.2-effect-level",
          title: "Effect level",
          kind: "concept",
          audience: "both",
          tags: ["foundations", "gm-support"],
          summary:
            "Tri-state impact label — `limited`, `standard`, `great` — set per roll. Currently descriptive metadata only: surfaced to the GM/agent but does not alter damage, margin, or rewards.",
          body: [
            {
              kind: "prose",
              text: "Effect level frames the *amount* a success buys, separate from whether it succeeds. A great-effect partial still produces meaningful change; a limited-effect critical might still leave the situation half-resolved.",
            },
            {
              kind: "table",
              caption: "The three effect levels",
              headers: ["Effect", "What success buys"],
              rows: [
                ["`limited`", "Partial progress even on a clean success — you nudge the situation"],
                ["`standard`", "The default. Full intended result on success"],
                ["`great`", "Bonus effect on success — extra reach, extra targets, extra ground"],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Currently descriptive only",
              text: "Effect level is metadata: no engine code branches on it today. The descriptions above are how the GM and the AI agent should *interpret* it narratively, not how the engine alters numbers. If a future version wires effect level into damage scaling, the rule will land here.",
            },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/outcome.ts" },
            { file: "packages/engine/src/resolution/test.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "The three labels are baked into the type system as a string-literal union, like position.",
          },
          xref: ["3.1-position", "2.1-outcome-tiers"],
        },
      ],
    },
  ],
};
