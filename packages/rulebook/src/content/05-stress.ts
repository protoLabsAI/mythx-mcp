/**
 * Chapter 5 — Stress & Meta-Currency
 *
 * The FitD-inspired stress economy: the tracker, the four spend
 * verbs (push, resist, flashback), the recovery model (rest), and
 * the trauma narrative consequence that fires when stress overflows.
 */

import type { Chapter } from "../schema/index.js";

export const stressChapter: Chapter = {
  id: "stress",
  number: 5,
  title: "Stress & Meta-Currency",
  summary:
    "Stress is the player's ledger of how hard they're pushing fate. Spend it to push a roll, resist a consequence, or retroactively prepare via flashback; recover it on rest; overflow it and gain trauma.",
  sections: [
    {
      id: "tracker",
      title: "Tracker",
      summary: "The character's stress score and how trauma fires when it overflows.",
      entries: [
        {
          id: "5.1-stress-tracker",
          title: "Stress tracker, max, and trauma threshold",
          kind: "mechanic",
          audience: "both",
          tags: ["meta-currency"],
          summary:
            "Each character has `{ current, max }` stress. Spends that would push current over max trigger trauma; the engine clamps to max and surfaces a `traumaTriggered` flag the tool layer translates into a [trauma entry](5.6-trauma).",
          body: [
            {
              kind: "prose",
              text: "Stress is a per-character integer ledger. The default cap is 9 (Blades-in-the-Dark style). Spends are integer costs; the engine never allows current stress to exceed max — instead, an overflow sets `traumaTriggered: true` on the result, the value is clamped, and the tools layer is responsible for appending a `Trauma` entry to the character.",
            },
            {
              kind: "formula",
              name: "Trauma trigger",
              expression: "traumaTriggered = (current + cost) > max",
              variables: {
                current: "the character's current stress before the spend",
                cost: "the stress cost of the action",
                max: "`StressConfig.maxStress` (default 9)",
              },
            },
            {
              kind: "callout",
              tone: "info",
              title: "Engine-vs-tool split",
              text: "The engine produces the flag; the tool layer composes the consequence. `push_roll` auto-appends a generic `Pushed Too Far` trauma name when triggered — there's no curated trauma pool today, so worlds that want flavored trauma names need to handle it at the call site.",
            },
          ],
          numbers: [{ name: "Max stress", value: 9, source: "BASE_STRESS.maxStress" }],
          canonicalSource: [
            { file: "packages/types/src/game/stress.ts" },
            { file: "packages/types/src/rules/mechanics.ts" },
            { file: "packages/engine/src/resolution/stress.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.stressConfig.maxStress",
            fullySupported: true,
          },
          xref: [
            "5.2-push-roll",
            "5.3-resist-consequence",
            "5.4-flashback",
            "5.5-rest",
            "5.6-trauma",
          ],
        },
      ],
    },
    {
      id: "spends",
      title: "Spends",
      summary: "The three things you can do with stress: push, resist, flashback.",
      entries: [
        {
          id: "5.2-push-roll",
          title: "Push roll",
          kind: "mechanic",
          audience: "both",
          surfaceInQuickStart: true,
          tags: ["meta-currency", "dice"],
          summary:
            "Spend `pushCost` stress (default 2) after a partial / failure to add `pushBonus` (default `1d6`) to the original total, recomputing the margin and outcome.",
          body: [
            {
              kind: "prose",
              text: "Push is the player's primary means of fighting back against a soft outcome. After seeing a partial or failure, the character commits — they spend stress to roll the push bonus and add it to the original total. The new total flows back through the [outcome ladder](2.1-outcome-tiers); a partial can become a success, a failure can become a partial.",
            },
            {
              kind: "formula",
              name: "New total after push",
              expression: "newTotal = originalTotal + rollDice(pushBonus)",
            },
            {
              kind: "formula",
              name: "New margin",
              expression: "newMargin = originalMargin + bonusRoll",
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Push can trigger trauma",
              text: "Pushing while at high stress is the classic way to trigger trauma — the spend itself is what overflows the tracker. The engine clamps stress to max and returns `traumaTriggered: true`; the tool appends a generic trauma entry.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "When to push",
              text: "Pushing a `failure` to a `partial` still leaves you with a complication — but the partial outcome means the *effect* lands. Pushing a `partial` to `success` is the strongest spend ratio in the system: 2 stress for a clean outcome.",
            },
          ],
          examples: [
            {
              title: "Pushing a partial sword swing",
              scenario:
                "A character with current stress 4/9 partial-hits a goblin (margin −2). They push.",
              inputs: { stressBefore: 4, pushCost: 2, originalMargin: -2, pushBonus: "1d6" },
              expectedOutputs: {
                stressAfter: 6,
                "bonus roll 5": "newMargin +3 → success (clean hit)",
                "bonus roll 1": "newMargin −1 → still partial",
              },
            },
          ],
          numbers: [
            { name: "Push cost", value: 2, source: "BASE_STRESS.pushCost" },
            { name: "Push bonus", value: "1d6", source: "BASE_STRESS.pushBonus" },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/stress.ts" },
            { file: "packages/tools/src/stress/push-roll.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.stressConfig.pushCost",
            fullySupported: true,
          },
          xref: ["5.1-stress-tracker", "5.6-trauma", "2.1-outcome-tiers"],
        },
        {
          id: "5.3-resist-consequence",
          title: "Resist a consequence",
          kind: "mechanic",
          audience: "both",
          tags: ["meta-currency", "combat"],
          summary:
            "Pay 1 / 2 / 3 stress (minor / moderate / severe) to reduce a consequence's severity. Roll a d6 + ability; if the total ≥ `resistThreshold` (default 5), the cost is reduced by 1 (floor 1).",
          body: [
            {
              kind: "prose",
              text: "Resist is the defensive spend. Once a consequence has landed — harm, a tick, a separated party member — the character can spend stress to reduce or sometimes negate it. The base cost depends on the severity the GM declared; a successful resist roll buys back one stress point.",
            },
            {
              kind: "table",
              caption: "Default severity costs",
              headers: ["Severity", "Base cost"],
              rows: [
                ["`minor`", "1 stress"],
                ["`moderate`", "2 stress"],
                ["`severe`", "3 stress"],
              ],
            },
            {
              kind: "formula",
              name: "Resist roll",
              expression: "total = d6 + abilityMod",
            },
            {
              kind: "formula",
              name: "Final cost",
              expression: "finalCost = max(1, baseCost − (total ≥ resistThreshold ? 1 : 0))",
            },
            {
              kind: "callout",
              tone: "info",
              title: "What you reduce, narratively",
              text: "Resisting a `moderate` to a `minor` means the GM should re-frame the consequence: the harm is shallower, the clock ticks fewer stages, the spotlight fades. The engine doesn't model this transformation — only the stress cost — so the GM owns the narrative downgrade.",
            },
          ],
          numbers: [
            { name: "Minor cost", value: 1, source: "BASE_STRESS.resistSeverityCosts.minor" },
            { name: "Moderate cost", value: 2, source: "BASE_STRESS.resistSeverityCosts.moderate" },
            { name: "Severe cost", value: 3, source: "BASE_STRESS.resistSeverityCosts.severe" },
            { name: "Resist threshold", value: 5, source: "BASE_STRESS.resistThreshold" },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/stress.ts" },
            { file: "packages/tools/src/stress/resist-consequence.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.stressConfig.resistSeverityCosts",
            fullySupported: true,
          },
          xref: ["5.1-stress-tracker", "5.6-trauma", "10.1-gm-moves-catalog"],
        },
        {
          id: "5.4-flashback",
          title: "Flashback",
          kind: "mechanic",
          audience: "both",
          tags: ["meta-currency"],
          summary:
            "Spend `flashbackCost` stress (default 2) to retroactively justify a prepared action. Mechanical effect is the stress spend only — the flashback is a narrative hook, not a roll modifier.",
          body: [
            {
              kind: "prose",
              text: "Flashback is the cheapest narrative spend in the game: 2 stress to declare that *of course* the character had paid the bartender for information last week, *of course* the rope was already tied to the gargoyle. The engine deducts the stress and returns a `traumaTriggered` flag if it overflows; everything else is fiction.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Use sparingly, not retroactively rewriting outcomes",
              text: "Flashback shouldn't undo a roll that already resolved badly. Use it to set up a *new* situation with prep that wasn't called out in the moment — the stress cost is the price of bypassing setup.",
            },
          ],
          numbers: [{ name: "Flashback cost", value: 2, source: "BASE_STRESS.flashbackCost" }],
          canonicalSource: [
            { file: "packages/engine/src/resolution/stress.ts" },
            { file: "packages/tools/src/stress/flashback.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.stressConfig.flashbackCost",
            fullySupported: true,
          },
          xref: ["5.1-stress-tracker", "5.6-trauma"],
        },
      ],
    },
    {
      id: "recovery",
      title: "Recovery",
      summary: "How stress comes off the tracker.",
      entries: [
        {
          id: "5.5-rest",
          title: "Stress recovery (rest)",
          kind: "mechanic",
          audience: "both",
          tags: ["meta-currency", "time"],
          summary:
            'Short rest recovers `recoveryPerShortRest` stress (default 2); long rest recovers `recoveryPerLongRest` (default `"all"`, i.e. resets to 0). The `take_rest` tool also restores HP and clears `until_rest` conditions.',
          body: [
            {
              kind: "prose",
              text: "Rest is the only way stress comes back. The engine exposes two rest types — `short` and `long` — and the tool layer adds a `camp` variant that's a synonym for a long rest with full HP and 12 hours of game time.",
            },
            {
              kind: "table",
              caption: "Default rest table",
              headers: ["Rest type", "Stress recovered", "HP recovered", "Time elapsed"],
              rows: [
                ["`short`", "2", "25%", "1 hour"],
                ["`long`", "all", "50%", "8 hours"],
                ["`camp`", "all", "100%", "12 hours"],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Conditions",
              text: "Long and camp rests clear all conditions whose duration is `until_rest` (see [stacking](7.3-stacking)). Permanent conditions and numeric-duration conditions persist.",
            },
          ],
          numbers: [
            {
              name: "Short rest stress",
              value: 2,
              source: "BASE_STRESS.recoveryPerShortRest",
            },
            {
              name: "Long rest stress",
              value: "all",
              source: "BASE_STRESS.recoveryPerLongRest",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/stress.ts" },
            { file: "packages/tools/src/rest/take-rest.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.stressConfig.recoveryPerShortRest",
            fullySupported: true,
            notes:
              "Stress amounts and recovery model are world-overridable. HP-percent and elapsed-time figures are tool-domain policy and not currently in the rules config.",
          },
          xref: ["5.1-stress-tracker", "7.3-stacking", "9.1-game-time"],
        },
      ],
    },
    {
      id: "trauma",
      title: "Trauma",
      summary: "What happens when stress overflows.",
      entries: [
        {
          id: "5.6-trauma",
          title: "Trauma",
          kind: "mechanic",
          audience: "both",
          tags: ["meta-currency"],
          summary:
            "When a stress spend would exceed max, the engine clamps to max and surfaces `traumaTriggered: true`. The tool layer appends a `Trauma` entry to the character — a permanent narrative consequence with no enforced mechanical effect.",
          body: [
            {
              kind: "prose",
              text: "Trauma is the system's hard ceiling on stress as a fungible resource. Once trauma fires, the character is changed — and the GM is expected to honor that change in fiction. The engine doesn't enforce mechanical penalties; trauma is a permanent narrative tag.",
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Auto-generated names",
              text: "Tools that fire trauma (push, resist, flashback) currently append a generic name like `Pushed Too Far` to the character's `trauma[]` array. There's no curated list and no world-pack hook to seed trauma options — flavoring it is on the GM / agent.",
            },
            {
              kind: "prose",
              text: "Trauma entries are stable per character: `{ id, name, description, acquiredAt }`. They're displayed alongside the character sheet but never branched on by combat or test resolution.",
            },
          ],
          canonicalSource: [{ file: "packages/types/src/game/stress.ts" }],
          extensibility: {
            kind: "fixed",
            reason:
              "Trauma names are not yet world-overridable; the data shape is fixed and the curated pool doesn't exist.",
          },
          xref: ["5.1-stress-tracker", "5.2-push-roll", "5.3-resist-consequence", "5.4-flashback"],
        },
      ],
    },
  ],
};
