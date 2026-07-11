/**
 * Chapter 10 — GM Moves & Consequences
 *
 * The fixed catalog of ten GM moves, the position × outcome matrix
 * that suggests moves on bad rolls, and the consequence-guidance
 * composition that the test and attack tools emit.
 */

import type { Chapter } from "../schema/index.js";

export const gmMovesChapter: Chapter = {
  id: "gm-moves",
  number: 10,
  title: "GM Moves & Consequences",
  summary:
    "Ten named GM moves keyed against the position × outcome matrix. The tools layer composes consequence-guidance text from the matched moves; everything in this chapter is GM-facing tooling, not player-facing rules.",
  sections: [
    {
      id: "moves",
      title: "The move catalog",
      summary: "What the GM can do when a roll goes badly.",
      entries: [
        {
          id: "10.1-gm-moves-catalog",
          title: "GM move catalog",
          kind: "catalog",
          audience: "gm",
          tags: ["gm-support"],
          summary:
            "Ten fixed moves: `reveal_unwelcome_truth`, `show_signs_of_doom`, `offer_hard_bargain`, `tick_clock`, `separate_party`, `put_someone_in_spot`, `use_their_flaw`, `drain_resources`, `turn_move_against_them`, `inflict_harm`.",
          body: [
            {
              kind: "table",
              caption: "The ten moves",
              headers: ["Move", "Use it to…"],
              rows: [
                [
                  "`reveal_unwelcome_truth`",
                  "Surface a fact the players didn't want — a betrayal, a hidden cost, a consequence already in motion",
                ],
                [
                  "`show_signs_of_doom`",
                  "Make a coming threat visible — a darkening sky, a distant horn, a clock tick",
                ],
                [
                  "`offer_hard_bargain`",
                  "Offer success at a price — a stress hit, a relationship cost, a moral compromise",
                ],
                ["`tick_clock`", "Advance a [situation clock](9.3-situation-clocks) one stage"],
                [
                  "`separate_party`",
                  "Split allies — the bridge collapses, a wall falls between, the fog descends",
                ],
                [
                  "`put_someone_in_spot`",
                  "Force a specific character into a hard choice — usually one they're worst-equipped for",
                ],
                ["`use_their_flaw`", "Make the character's declared flaw matter right now"],
                [
                  "`drain_resources`",
                  "Spend a consumable, break a tool, deplete a stat that wasn't on the line",
                ],
                [
                  "`turn_move_against_them`",
                  "Their action backfires — the spell hits the wrong target, the lie ensnares the speaker",
                ],
                [
                  "`inflict_harm`",
                  "Deal damage / a condition; severity scales with [position](3.1-position)",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Why these ten",
              text: 'The list is small on purpose. Ten moves cover the space of "what the world does when the players fail" without forcing the GM to invent a new consequence each time. The names are mnemonic, not literal — `inflict_harm` covers stress as readily as HP.',
            },
          ],
          canonicalSource: [{ file: "packages/types/src/game/gm-moves.ts" }],
          extensibility: {
            kind: "fixed",
            reason:
              "The catalog is a TypeScript const enum; not in `WorldRulesConfig`. World-specific moves should be expressed as flavor on top of these primitives, not new entries.",
          },
          xref: ["3.1-position", "10.2-move-matrix", "10.3-consequence-guidance"],
        },
      ],
    },
    {
      id: "matrix",
      title: "The matrix",
      summary: "Which moves to suggest based on position and outcome.",
      entries: [
        {
          id: "10.2-move-matrix",
          title: "Position × outcome matrix",
          kind: "catalog",
          audience: "gm",
          tags: ["gm-support"],
          summary:
            "`getGMMoves(outcome, position)` returns the suggested move list, or `undefined` when the outcome doesn't warrant moves. Only `partial`, `failure`, and `critical_failure` have entries.",
          body: [
            {
              kind: "prose",
              text: "The matrix is the engine's stock answer to *what now?*. Each cell suggests a small set of moves the GM (or the AI agent) can pick from. Critical successes and clean successes never trigger moves — those outcomes resolve cleanly.",
            },
            {
              kind: "table",
              caption: "Position × outcome → moves",
              headers: ["Position", "Partial", "Failure", "Critical failure"],
              rows: [
                [
                  "`controlled`",
                  "drain_resources, reveal_unwelcome_truth",
                  "show_signs_of_doom, offer_hard_bargain",
                  "tick_clock, separate_party",
                ],
                [
                  "`risky`",
                  "inflict_harm, drain_resources, offer_hard_bargain",
                  "inflict_harm, put_someone_in_spot, tick_clock",
                  "inflict_harm, use_their_flaw, separate_party",
                ],
                [
                  "`desperate`",
                  "inflict_harm, tick_clock",
                  "inflict_harm, use_their_flaw, show_signs_of_doom",
                  "inflict_harm, turn_move_against_them, tick_clock",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Read it as severity scaling",
              text: "Across a row, severity rises as the outcome worsens; down a column, severity rises as position worsens. `inflict_harm` shows up everywhere risky-or-worse because risky-or-worse means *something visible should happen to a character.*",
            },
            {
              kind: "callout",
              tone: "info",
              title: "Helpers",
              text: "`getGMMoves(outcome, position)` returns `undefined` for outcomes that don't warrant moves — the gate is inside the helper, not at each call site. `buildConsequenceGuidance(outcome, position, outcomeLabel)` and `getConsequenceSeverity(position)` compose the user-facing text.",
            },
          ],
          canonicalSource: [{ file: "packages/types/src/game/gm-moves.ts" }],
          extensibility: {
            kind: "fixed",
            reason:
              "The matrix is a TypeScript const lookup. Worlds describing different consequence patterns should override the prompt / agent, not the matrix.",
          },
          xref: ["3.1-position", "10.1-gm-moves-catalog", "10.3-consequence-guidance"],
        },
      ],
    },
    {
      id: "guidance",
      title: "Consequence guidance",
      summary: "How the suggested moves get composed into a single line of text.",
      entries: [
        {
          id: "10.3-consequence-guidance",
          title: "Consequence-guidance composition",
          kind: "mechanic",
          audience: "gm",
          tags: ["gm-support"],
          summary:
            "On `partial`, `failure`, or `critical_failure`, the test and attack tools compose a one-line `consequenceGuidance` from the outcome description, the position-derived severity, and the first two suggested moves. Composition is centralized in `buildConsequenceGuidance()`.",
          body: [
            {
              kind: "prose",
              text: "Consequence guidance is the single sentence the GM / agent reads to know *what kind of consequence fits*. It's deliberately short — a hint, not a script — so the narrator can flavor it. Composition lives in `types/game/gm-moves.ts` so the test and attack tools both call the same helper.",
            },
            {
              kind: "formula",
              name: "Severity",
              expression: "getConsequenceSeverity(position) ∈ {minor, moderate, severe}",
              variables: {
                controlled: "minor",
                risky: "moderate",
                desperate: "severe",
              },
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Two-move limit",
              text: "Only the first two suggested moves are surfaced in the guidance line — more would be noisy. The full list is still on `TestResult.suggestedMoves` / `AttackResult.suggestedMoves` for callers that want it.",
            },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/gm-moves.ts" },
            { file: "packages/tools/src/dice/roll-test.ts" },
            { file: "packages/tools/src/combat/attack.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "Composition is a fixed template tied to the move catalog and severity scale. Localization or world-flavored phrasing belongs in the prompt layer.",
          },
          xref: [
            "3.1-position",
            "10.1-gm-moves-catalog",
            "10.2-move-matrix",
            "5.3-resist-consequence",
          ],
        },
      ],
    },
  ],
};
