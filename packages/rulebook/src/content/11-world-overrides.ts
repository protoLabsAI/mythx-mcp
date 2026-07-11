/**
 * Chapter 11 — World-Specific Overrides
 *
 * The flat list of every knob a world pack can tune via
 * `WorldRulesConfig`, alongside the things that are intentionally
 * not world-overridable (and why).
 */

import type { Chapter } from "../schema/index.js";

export const worldOverridesChapter: Chapter = {
  id: "world-overrides",
  number: 11,
  title: "World-Specific Overrides",
  summary:
    "What `WorldRulesConfig` lets a world tune — abilities, difficulties, mechanics, custom tests — and what's intentionally fixed (position labels, GM moves, time math). Every entry in earlier chapters with `extensibility: world-overridable` lands here.",
  sections: [
    {
      id: "overview",
      title: "Overview",
      summary: "What a world can tune today, and what it can't.",
      entries: [
        {
          id: "11.1-world-overrides",
          title: "What a world can override",
          kind: "concept",
          audience: "gm",
          tags: ["world-overrides"],
          summary:
            "World packs tune the engine through `WorldRulesConfig`: abilities, difficulties, mechanics (defense / damage / criticals / roll-under / advantage / outcome thresholds / stress / equipment parsing), and custom tests. Position labels, GM moves, and time math are intentionally fixed.",
          body: [
            {
              kind: "prose",
              text: "Every entry in this rulebook tagged `extensibility: world-overridable` points to a path under `WorldRulesConfig`. The table below is the consolidated map — see the linked entry for what each knob controls.",
            },
            {
              kind: "table",
              caption: "Tunable knobs",
              headers: ["Knob (configPath)", "What it controls", "See"],
              rows: [
                [
                  "`abilities`",
                  "Replace / add / override the ability set",
                  "[6.1 initiative](6.1-initiative)",
                ],
                [
                  "`difficulties`",
                  "Replace / add named difficulty levels",
                  "[4.1 standard test](4.1-standard-test)",
                ],
                [
                  "`mechanics.defense`",
                  "Defense base + ability",
                  "[6.2 attack resolution](6.2-attack-resolution)",
                ],
                [
                  "`mechanics.damage`",
                  "Add ability / subtract armor / minimum / graze multiplier",
                  "[6.3 damage](6.3-damage)",
                ],
                [
                  "`mechanics.criticals`",
                  "Crit ranges + multiplier + auto flags",
                  "[2.2 criticals](2.2-criticals)",
                ],
                [
                  "`mechanics.rollUnder`",
                  "Roll-under enable + dice",
                  "[1.3 roll-under](1.3-roll-under)",
                ],
                [
                  "`mechanics.advantage.dice`",
                  "Dice for best-of-two",
                  "[4.3 advantage](4.3-advantage)",
                ],
                [
                  "`mechanics.outcomeThresholds`",
                  "Margin thresholds for the five-tier ladder",
                  "[2.1 outcome tiers](2.1-outcome-tiers)",
                ],
                [
                  "`mechanics.resistanceMultiplier` / `vulnerabilityMultiplier`",
                  "Default damage multipliers",
                  "[6.2 attack resolution](6.2-attack-resolution)",
                ],
                [
                  "`mechanics.stressConfig`",
                  "Max / push / resist / flashback / rest costs",
                  "[5.1 stress tracker](5.1-stress-tracker)",
                ],
                [
                  "`mechanics.equipmentParsing`",
                  "Ranged / ability keyword tables and defaults",
                  "[8.2 weapon parsing](8.2-weapon-parsing)",
                ],
                [
                  "`customTests.tests[]`",
                  "World-defined test types (panic, sanity)",
                  "[4.2 custom tests](4.2-custom-tests)",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Resolution model",
              text: "World rules are merged into a `ResolvedRules` value at session start via `resolveRules()`. Defaults fill anything the world didn't set; the resolver is pure and deterministic. Entries in this rulebook quote `configPath` against the resolved shape so the rulebook test suite can verify the path resolves.",
            },
          ],
          canonicalSource: [
            { file: "packages/types/src/rules/index.ts" },
            { file: "packages/types/src/rules/mechanics.ts" },
            { file: "packages/worlds/src/schema/rules.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "This entry indexes the override surface; the surface itself is what's tunable.",
          },
          xref: [
            "1.3-roll-under",
            "2.1-outcome-tiers",
            "2.2-criticals",
            "4.1-standard-test",
            "4.2-custom-tests",
            "4.3-advantage",
            "5.1-stress-tracker",
            "6.1-initiative",
            "6.2-attack-resolution",
            "6.3-damage",
            "8.2-weapon-parsing",
            "11.2-fixed-surfaces",
          ],
        },
        {
          id: "11.2-fixed-surfaces",
          title: "What's intentionally fixed",
          kind: "concept",
          audience: "gm",
          tags: ["world-overrides"],
          summary:
            "Position / effect labels, the GM move catalog and matrix, the common-condition catalog, trauma names, itemized inventory enums, encumbrance thresholds, and time math are all fixed. Each is a deliberate non-knob.",
          body: [
            {
              kind: "table",
              caption: "Fixed surfaces and the reason",
              headers: ["Surface", "Why fixed"],
              rows: [
                [
                  "Position labels (`controlled` / `risky` / `desperate`)",
                  "Baked into the type system as a string-literal union — every consumer would have to change",
                ],
                [
                  "Effect labels (`limited` / `standard` / `great`)",
                  "Same — and they're descriptive metadata anyway",
                ],
                [
                  "GM move catalog and matrix",
                  "Small fixed vocabulary is the point — worlds re-flavor, they don't extend",
                ],
                [
                  "Common conditions catalog",
                  "Type-system const map; worlds **add** conditions via content packs",
                ],
                ["Trauma name pool", "No curated pool exists yet; tools auto-name"],
                [
                  "Itemized inventory enums (rarity, type, damage type)",
                  "TS literal unions; not in `WorldRulesConfig`",
                ],
                ["Encumbrance thresholds", "TS constants; not enforced mechanically anyway"],
                [
                  "Game time math (minutes / hours / days)",
                  "Determinism-adjacent — changing it would invalidate saved sessions",
                ],
                [
                  "RNG algorithm (Mulberry32)",
                  "[Determinism contract](1.2-rng-determinism) — never world-overridable",
                ],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Custom-test trigger automation",
              text: "Custom-test `triggers[]` declares trigger ids (`combat_start`, `take_damage`, etc.) but no engine code reads them at runtime. The data is stored; the automation isn't built. Manual invocation is the only path that works today.",
            },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/gm-moves.ts" },
            { file: "packages/types/src/game/conditions.ts" },
            { file: "packages/types/src/game/items.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason: "Documents the fixed surfaces.",
          },
          xref: [
            "1.2-rng-determinism",
            "3.1-position",
            "3.2-effect-level",
            "5.6-trauma",
            "7.2-common-conditions",
            "8.3-items",
            "8.4-encumbrance",
            "9.1-game-time",
            "10.1-gm-moves-catalog",
            "11.1-world-overrides",
          ],
        },
      ],
    },
  ],
};
