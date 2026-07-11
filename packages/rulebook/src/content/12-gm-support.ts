/**
 * Chapter 12 — Runtime GM Support
 *
 * The workflow tools that operate on session state and produce
 * narrative guidance. Not mechanics — these layer on top of the
 * engine and prompt the GM / agent rather than altering rolls.
 */

import type { Chapter } from "../schema/index.js";

export const gmSupportChapter: Chapter = {
  id: "gm-support",
  number: 12,
  title: "Runtime GM Support",
  summary:
    "Tools that help the GM (or AI agent) run the game without inventing new mechanics: leads, clocks, scene framing, investigation, NPC relationships, GM guidance. They read session state and produce advice; they do not alter dice or outcomes.",
  sections: [
    {
      id: "overview",
      title: "Overview",
      summary: "What the runtime support tools do, and why they're not in `WorldRulesConfig`.",
      entries: [
        {
          id: "12.1-runtime-gm-support",
          title: "Runtime GM support — overview",
          kind: "workflow",
          audience: "gm",
          tags: ["gm-support"],
          summary:
            "A workflow layer that operates on session state and produces narrative guidance. Includes leads/clues, portable clues, NPC relationships, GM guidance, scene framing, encounter generation, investigation tracking, and engagement hooks. Not modeled as overrideable rules.",
          body: [
            {
              kind: "prose",
              text: "The tools in this chapter don't introduce new mechanics — they read session state, the world pack, and the recent action log, and produce structured advice. They live outside `WorldRulesConfig` because they don't compute outcomes; they help frame the *next* outcome by surfacing pacing, NPC attitude, available leads, and so on.",
            },
            {
              kind: "table",
              caption: "Runtime support domains",
              headers: ["Domain", "Tool dir", "What it does"],
              rows: [
                [
                  "Leads / clues",
                  "`tools/src/leads/`",
                  "Three Clue Rule support — query / reveal / search lead state",
                ],
                [
                  "Portable clues",
                  "`tools/src/portable-clues/`",
                  "Flexible revelation packaging that isn't tied to a specific lead node",
                ],
                [
                  "NPC relationships",
                  "`tools/src/relationships/`",
                  "Attitude + knowledge tracking for named NPCs",
                ],
                [
                  "GM guidance",
                  "`tools/src/gm-guidance/`",
                  "Five context-aware modes: stuck, resolution, pacing, tone, npc",
                ],
                [
                  "Scene framing",
                  "`tools/src/scene-framing/`",
                  "Pacing analysis, scene cuts, scene framing",
                ],
                [
                  "Encounter generation",
                  "`tools/src/encounters/`",
                  "Pulls balanced encounters from the world pack on demand",
                ],
                [
                  "Investigation board",
                  "`tools/src/investigation/`",
                  "Evidence / hypothesis / null-result tracking for mysteries",
                ],
                [
                  "Engagement hooks",
                  "`tools/src/engagement/`",
                  "Personalize content, package as items, fragment into discoveries",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Why these aren't in the rules config",
              text: "World packs already control the *content* these tools operate on (leads live in situations, NPCs in the NPC catalog, encounters in encounter sets). The behavior of each tool is fixed glue between session state and that content — there's no per-world knob to tune.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Read the tool surface, not this chapter, for details",
              text: "Each tool's input / output is documented in `CLAUDE.md` and in the `tools/src/<domain>/` source. This chapter is the index — not a re-statement of every parameter.",
            },
          ],
          canonicalSource: [
            { file: "packages/tools/src/leads/get-available-leads.ts" },
            { file: "packages/tools/src/portable-clues/create-portable-clue.ts" },
            { file: "packages/tools/src/relationships/get-relationship.ts" },
            { file: "packages/tools/src/gm-guidance/get-gm-guidance.ts" },
            { file: "packages/tools/src/scene-framing/frame-scene.ts" },
            { file: "packages/tools/src/encounters/generate-encounter.ts" },
            { file: "packages/tools/src/investigation/get-investigation-status.ts" },
            { file: "packages/tools/src/engagement/generate-engagement-hooks.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "These are workflow tools layered on top of session state and world content. They don't have rules-config knobs; world-specific behavior comes from the content the tools read.",
          },
          xref: ["9.3-situation-clocks", "10.1-gm-moves-catalog", "11.2-fixed-surfaces"],
        },
      ],
    },
  ],
};
