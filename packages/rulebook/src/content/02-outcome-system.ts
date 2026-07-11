/**
 * Chapter 2 — The Five-Tier Outcome System
 *
 * The outcome ladder every roll resolves into, the critical-roll
 * model that overrides the margin, and the margin math that connects
 * dice + modifiers to the ladder. This chapter is the hub the rest of
 * the book points back to — every test, attack, and resist consequence
 * lands on one of these five tiers.
 */

import type { Chapter } from "../schema/index.js";

export const outcomeSystemChapter: Chapter = {
  id: "outcome-system",
  number: 2,
  title: "The Five-Tier Outcome System",
  summary:
    "Every roll resolves to one of five tiers — critical success, success, partial, failure, critical failure — based on the margin and the natural die. Critical-roll detection and margin math are the two inputs that drive the ladder.",
  sections: [
    {
      id: "outcomes",
      title: "Outcomes",
      summary: "The five tiers, the thresholds that produce them, and the math behind the margin.",
      entries: [
        {
          id: "2.1-outcome-tiers",
          title: "Outcome tiers and thresholds",
          kind: "mechanic",
          audience: "both",
          surfaceInQuickStart: true,
          tags: ["dice", "foundations"],
          summary:
            "Five tiers — `critical_success`, `success`, `partial`, `failure`, `critical_failure` — selected from the roll's margin against three thresholds, with critical naturals overriding the margin.",
          body: [
            {
              kind: "prose",
              text: "Every test and attack lands on one of five outcomes. The resolver computes the **margin** (see [margin math](2.3-margin-math)), then walks the threshold ladder from highest to lowest. A natural die in the configured critical-roll range can override the margin in either direction (see [criticals](2.2-criticals)).",
            },
            {
              kind: "table",
              caption: "The ladder (defaults shown)",
              headers: ["Outcome", "Margin", "Meaning"],
              rows: [
                ["`critical_success`", "≥ 10", "Full success plus a bonus effect"],
                ["`success`", "0 to 9", "Full intended effect"],
                ["`partial`", "−4 to −1", "Yes, but… — partial effect plus a complication"],
                ["`failure`", "−5 or worse", "No success; GM makes a move"],
                ["`critical_failure`", "natural in `failureOn`", "Disaster; severe consequences"],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Critical overrides",
              text: "A natural die in `criticals.successOn` (default `[20]`) sets the outcome to `critical_success` regardless of margin when `criticals.autoSuccess` is true. The mirror rule applies for `failureOn` / `autoFailure`. Set the auto flags to `false` if you want naturals to flavor the result without overriding the threshold ladder.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Helpers",
              text: "The types package exposes `isSuccessful(outcome)`, `isPartialOrWorse(outcome)`, `outcomeAllowsEffect(outcome)`, `outcomeSeverity(outcome)`, and `outcomeShouldTickClock(outcome)` so callers don't have to memorize the tiers. `outcomeShouldTickClock` is the gate used by [auto-tick on partial/failure](9.3-situation-clocks).",
            },
            {
              kind: "prose",
              text: "Both `TestResult` and `AttackResult` carry a deprecated `success` / `hit` boolean derived from `isSuccessful(outcome)` for callers that haven't migrated; new code should branch on the outcome directly.",
            },
          ],
          examples: [
            {
              title: "Margin → outcome at default thresholds",
              scenario:
                "A character rolls a test against difficulty 12. The resolver computes margin and walks the ladder.",
              inputs: { thresholds: { criticalSuccess: 10, success: 0, partial: -4 } },
              expectedOutputs: {
                "total 23 (margin +11)": "critical_success",
                "total 14 (margin +2)": "success",
                "total 10 (margin −2)": "partial",
                "total 7 (margin −5)": "failure",
                "natural 1": "critical_failure (auto-failure)",
              },
            },
          ],
          numbers: [
            {
              name: "Critical success threshold",
              value: 10,
              source: "DEFAULT_OUTCOME_THRESHOLDS.criticalSuccess",
            },
            {
              name: "Success threshold",
              value: 0,
              source: "DEFAULT_OUTCOME_THRESHOLDS.success",
            },
            {
              name: "Partial threshold",
              value: -4,
              source: "DEFAULT_OUTCOME_THRESHOLDS.partial",
            },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/outcome.ts" },
            { file: "packages/engine/src/resolution/outcome.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.outcomeThresholds",
            fullySupported: true,
          },
          xref: ["1.3-roll-under", "2.2-criticals", "2.3-margin-math", "10.2-move-matrix"],
        },
        {
          id: "2.2-criticals",
          title: "Critical success and critical failure",
          kind: "mechanic",
          audience: "both",
          tags: ["dice", "combat", "foundations"],
          summary:
            "Natural-die ranges that can override the margin, plus the critical-hit damage multiplier. Default: nat 20 = critical success, nat 1 = critical failure, crit damage = 2×.",
          body: [
            {
              kind: "prose",
              text: "Critical naturals are the engine's safety valve against pure linear margin. The configuration is per-world: `successOn` and `failureOn` are arrays of natural-die values (so a world can run crits on 19–20, or skip them entirely with `[]`). When `autoSuccess` is true, a critical-success natural sets the outcome to `critical_success` regardless of margin; same for `autoFailure`.",
            },
            {
              kind: "formula",
              name: "Critical hit damage",
              expression: "damage × criticals.damageMultiplier",
              variables: {
                damage: "the attack's normal damage roll (after ability + armor)",
                "criticals.damageMultiplier": "default 2",
              },
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Auto-flags vs. flavor crits",
              text: "Setting `autoSuccess: false` is how you build a world where nat 20 is just *cool* — the margin still has to clear `criticalSuccess` for the outcome to be a critical. Most worlds want auto-flags true; that's the default.",
            },
            {
              kind: "prose",
              text: "Critical-hit damage applies **before** resistance and vulnerability multipliers, not after. A critical hit on a fire-resistant target still gets multiplied first, then halved.",
            },
          ],
          numbers: [
            { name: "Default critical success", value: 20, source: "BASE_CRITICALS.successOn" },
            { name: "Default critical failure", value: 1, source: "BASE_CRITICALS.failureOn" },
            { name: "Damage multiplier", value: 2, source: "BASE_CRITICALS.damageMultiplier" },
            { name: "Auto-success", value: true, source: "BASE_CRITICALS.autoSuccess" },
            { name: "Auto-failure", value: true, source: "BASE_CRITICALS.autoFailure" },
          ],
          canonicalSource: [
            { file: "packages/types/src/rules/mechanics.ts" },
            { file: "packages/engine/src/rules/context.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.criticals",
            fullySupported: true,
          },
          xref: ["2.1-outcome-tiers", "6.2-attack-resolution", "6.3-damage"],
        },
        {
          id: "2.3-margin-math",
          title: "Margin math",
          kind: "mechanic",
          audience: "both",
          tags: ["dice", "foundations", "combat"],
          summary:
            "Margin is the signed distance between the modified total and the target. The outcome ladder reads off margin; conditions, advantage, and ability/skill bonuses all funnel through this single number.",
          body: [
            {
              kind: "prose",
              text: "Margin is always a single signed integer. The full input list is the same for tests and attacks — only the target differs.",
            },
            {
              kind: "formula",
              name: "Test margin (roll-over)",
              expression:
                "margin = (natural + abilityMod + skillBonus + conditionMods + otherMods) − difficulty",
              variables: {
                natural: "the raw die result (after advantage/disadvantage selection)",
                abilityMod: "the rolling character's ability score",
                skillBonus: "the rolled skill's bonus, if any",
                conditionMods:
                  "sum of `MODIFY_ABILITY` and `MODIFY_SKILL` effects from active conditions",
                otherMods: "user-supplied extra modifiers (situational, items, etc.)",
                difficulty: "the test's target number",
              },
            },
            {
              kind: "formula",
              name: "Attack margin",
              expression:
                "margin = (natural + abilityMod + skillBonus + conditionMods + otherMods) − defenseTarget",
              variables: {
                defenseTarget: "`mechanics.defense.base + defender.abilities[defense.ability]`",
              },
            },
            {
              kind: "formula",
              name: "Roll-under margin",
              expression: "margin = difficulty − total",
              variables: {
                difficulty: "the test's target",
                total: "the same modified total above",
              },
            },
            {
              kind: "callout",
              tone: "info",
              title: "`otherMods` field naming",
              text: "`TestResult.otherMods` includes condition-derived modifiers as well as user-supplied ones — the engine bundles them under one field on the result for compactness. If you need the breakdown, read `conditionMods` separately in the input log.",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/test.ts" },
            { file: "packages/engine/src/resolution/combat.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "Margin is the universal currency of the outcome ladder; the formula isn't world-tunable, but every input to it (difficulty, ability, defense, advantage) is.",
          },
          xref: [
            "1.3-roll-under",
            "2.1-outcome-tiers",
            "4.1-standard-test",
            "6.2-attack-resolution",
          ],
        },
      ],
    },
  ],
};
