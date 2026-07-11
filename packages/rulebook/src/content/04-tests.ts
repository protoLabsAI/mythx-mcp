/**
 * Chapter 4 — Tests & Custom Tests
 *
 * Standard skill / ability tests, the world-defined custom-test system
 * (panic, sanity, etc.), and the advantage / disadvantage model. The
 * test resolver is the most-called code path in the engine; everything
 * else (combat, resists, pushes) is a thin wrapper over its margin
 * machinery.
 */

import type { Chapter } from "../schema/index.js";

export const testsChapter: Chapter = {
  id: "tests",
  number: 4,
  title: "Tests & Custom Tests",
  summary:
    "How rolls are framed, resolved, and modified. The standard test is the engine's workhorse; custom tests let world packs define genre-specific procedures (panic, sanity); advantage and disadvantage are the universal nudge.",
  sections: [
    {
      id: "tests",
      title: "Tests",
      summary: "Standard tests, world-defined custom tests, and the modifier model.",
      entries: [
        {
          id: "4.1-standard-test",
          title: "Standard skill / ability test",
          kind: "mechanic",
          audience: "both",
          surfaceInQuickStart: true,
          tags: ["dice", "foundations"],
          summary:
            "Roll a die (default `d20`) plus ability and skill modifiers, compare to the named difficulty, and return a [five-tier outcome](2.1-outcome-tiers). Difficulty names resolve through the world's `difficultyMap` first, then a hard-coded fallback.",
          body: [
            {
              kind: "prose",
              text: "The standard test is the engine's most-called procedure. The caller supplies a character, an optional skill, an optional ability, a difficulty (named or numeric), optional modifiers, and the [position / effect framing](3.1-position). The resolver picks the test dice from the world's rules (default `d20`), rolls with the net advantage state, sums the modifiers, computes margin, and walks the [outcome ladder](2.1-outcome-tiers).",
            },
            {
              kind: "flowchart",
              caption: "Test resolution",
              steps: [
                {
                  id: "input",
                  label:
                    "Inputs: character, skill?, ability?, difficulty, modifiers, advantage state, position, effectLevel",
                  next: ["dice"],
                },
                {
                  id: "dice",
                  label: "Pick test dice via `getTestDice(rules)` (default `d20`)",
                  next: ["roll"],
                },
                {
                  id: "roll",
                  label: "Roll with advantage / disadvantage selection",
                  next: ["sum"],
                },
                {
                  id: "sum",
                  label: "total = natural + abilityMod + skillBonus + conditionMods + otherMods",
                  next: ["margin"],
                },
                {
                  id: "margin",
                  label: "margin = total − difficulty (or `difficulty − total` for roll-under)",
                  next: ["outcome"],
                },
                {
                  id: "outcome",
                  label: "Determine outcome from margin + critical naturals",
                },
              ],
            },
            {
              kind: "table",
              caption: "Default difficulty levels",
              headers: ["Name", "Target"],
              rows: [
                ["`easy`", "10"],
                ["`standard`", "12"],
                ["`hard`", "15"],
                ["`extreme`", "20"],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Default ability",
              text: "If a skill is provided but no ability, the skill's declared ability is used. If no skill is given either, the default ability is `WIT`. Custom numeric DCs require the dedicated `roll_custom_test` tool.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "World difficulty overrides",
              text: "World packs can replace or extend the difficulty list via `WorldRulesConfig.difficulties`. The tool resolves the named level through the resolved `difficultyMap` first, falling back to the hard-coded enum only when the world hasn't defined that name.",
            },
          ],
          examples: [
            {
              title: "Picking a lock at standard difficulty",
              scenario:
                "A character with AGI +2 and the `tinker` skill (+1) attempts to pick a lock. Difficulty `standard` (12), risky position.",
              inputs: {
                ability: "AGI",
                skill: "tinker",
                difficulty: "standard",
                position: "risky",
              },
              expectedOutputs: {
                "natural 13": "total 16, margin +4 → success",
                "natural 9": "total 12, margin 0 → success",
                "natural 6": "total 9, margin −3 → partial",
                "natural 1": "critical_failure (auto-failure)",
              },
            },
          ],
          numbers: [
            { name: "Default test die", value: "d20", source: "engine/rules/context.getTestDice" },
            { name: "Easy difficulty", value: 10, source: "BASE_DIFFICULTIES.easy.target" },
            { name: "Standard difficulty", value: 12, source: "BASE_DIFFICULTIES.standard.target" },
            { name: "Hard difficulty", value: 15, source: "BASE_DIFFICULTIES.hard.target" },
            { name: "Extreme difficulty", value: 20, source: "BASE_DIFFICULTIES.extreme.target" },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/test.ts" },
            { file: "packages/tools/src/dice/roll-test.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "difficultyMap",
            fullySupported: true,
            notes:
              "Difficulties resolved through `ResolvedRules.difficultyMap`. Test dice come from `mechanics.rollUnder.dice` when roll-under is enabled.",
          },
          xref: [
            "1.3-roll-under",
            "2.1-outcome-tiers",
            "2.3-margin-math",
            "3.1-position",
            "4.2-custom-tests",
            "4.3-advantage",
          ],
        },
        {
          id: "4.2-custom-tests",
          title: "Custom tests",
          kind: "mechanic",
          audience: "both",
          tags: ["dice", "world-overrides"],
          summary:
            "World-defined test types (panic checks, sanity rolls, fear saves) with their own dice, comparator, outcomes, and optional outcome tables. Manual invocation is fully supported; the `triggers[]` array is data for a future automation system.",
          body: [
            {
              kind: "prose",
              text: "A custom test is a named, world-defined resolution procedure. World packs declare custom tests under `rules.customTests.tests[]`; the engine resolves them through a dedicated path that supports both roll-over and roll-under comparators, dynamic difficulty formulas, and per-outcome tables.",
            },
            {
              kind: "table",
              caption: "Custom test schema (highlights)",
              headers: ["Field", "Purpose"],
              rows: [
                ["`id, name, description`", "Identification + display"],
                ["`triggers[]`", "Declarative trigger ids (data only — no automation today)"],
                ["`roll.dice`", "Dice expression for the test (e.g. `d100`, `2d6`)"],
                [
                  "`roll.ability` / `roll.underAbility`",
                  "Roll-over ability mod, OR roll-under target (lower than ability = success)",
                ],
                [
                  "`roll.difficulty` / `roll.difficultyFormula`",
                  "Target as literal or formula evaluated against the character's abilities",
                ],
                [
                  "`outcomes`",
                  "Effects keyed by `criticalSuccess / success / failure / criticalFailure`",
                ],
                [
                  "`outcomes.*.table`",
                  "Optional outcome table — rolled after success determination, effects concatenated",
                ],
                ["`retryable, cooldownMinutes`", "Stored but **not enforced** at runtime today"],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Triggers don't auto-fire yet",
              text: "Triggers like `combat_start`, `take_damage`, `witness_horror` are declarative data only. No engine code reads them at runtime — the GM or agent must invoke the custom test manually. The data is there so a future trigger system can pick it up without a schema change.",
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Roll-under tests",
              text: "When `roll.underAbility` is set, the comparator flips to `natural ≤ abilities[underAbility]`. Useful for classic Mothership-style Stress Saves where the target is the character's stat.",
            },
            {
              kind: "prose",
              text: "Effects from the matched outcome and any rolled table entry are concatenated and returned for the tool / agent to apply. The engine does not auto-apply effects — the tool layer is responsible for translating them into character / session mutations.",
            },
          ],
          canonicalSource: [
            { file: "packages/types/src/rules/custom-tests.ts" },
            { file: "packages/engine/src/rules/custom-test.ts" },
            { file: "packages/tools/src/dice/roll-custom-test.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "customTestMap",
            fullySupported: false,
            notes:
              "Manual invocation works fully. Trigger automation, retry semantics, and `cooldownMinutes` are unimplemented — the data is stored but no runtime enforcement exists.",
          },
          xref: ["4.1-standard-test", "1.3-roll-under", "2.1-outcome-tiers"],
        },
        {
          id: "4.3-advantage",
          title: "Modifiers, advantage, and disadvantage",
          kind: "mechanic",
          audience: "both",
          tags: ["dice", "combat"],
          summary:
            "5e-style best-of-two on the configured advantage dice (default `d20`). Sources cancel — net advantage decides; conditions can grant ad/dis automatically through scope-matched effects.",
          body: [
            {
              kind: "prose",
              text: "Advantage and disadvantage are tallied as **sources** rather than stacked bonuses. Multiple sources of advantage do not stack; one source of disadvantage cancels one of advantage. Net positive = roll twice, take higher; net negative = roll twice, take lower; net zero = single die.",
            },
            {
              kind: "formula",
              name: "Net advantage",
              expression: "net = (advantage sources) − (disadvantage sources)",
              variables: {
                "net > 0": "best of two",
                "net < 0": "worst of two",
                "net = 0": "single die",
              },
            },
            {
              kind: "callout",
              tone: "info",
              title: "Single-die only",
              text: "Best-of-two only applies to a single-die test (e.g. `d20`). Multi-die expressions (`2d6+3`) and non-d20 dice are rolled normally regardless of advantage state — the dice expression already absorbs the variance.",
            },
            {
              kind: "prose",
              text: "Advantage sources can come from explicit tool input or from active conditions whose effects are `GRANT_ADVANTAGE` / `GRANT_DISADVANTAGE` with a matching scope (`attacks`, `defense`, `skill_tests`, or `all`). The resolver collects scope-matched condition effects automatically — no separate plumbing needed at the call site.",
            },
            {
              kind: "table",
              caption: "Scope filter",
              headers: ["Scope", "Applies to"],
              rows: [
                ["`attacks`", "Attack rolls only"],
                [
                  "`defense`",
                  "Defender's effective defense (currently unused — defense isn't rolled)",
                ],
                ["`skill_tests`", "`roll_test` calls"],
                ["`all`", "Every roll"],
              ],
            },
          ],
          examples: [
            {
              title: "Climbing while bleeding and inspired",
              scenario:
                "A character has the `inspired` condition (advantage on skill tests) and the `bleeding` condition (disadvantage on skill tests). They climb a wall.",
              expectedOutputs: {
                "net advantage": 0,
                "rolled with": "single d20",
              },
              commentary:
                "Sources cancel; the dice are normal. The fictional state still matters narratively — both conditions are active and either could drive a future complication.",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/dice/advantage.ts" },
            { file: "packages/engine/src/resolution/test.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.advantage.dice",
            fullySupported: true,
          },
          xref: ["4.1-standard-test", "6.2-attack-resolution", "7.1-condition-shape"],
        },
      ],
    },
  ],
};
