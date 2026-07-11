/**
 * Chapter 7 — Conditions
 *
 * The shape of a condition, the built-in catalog, the stacking
 * model, and time-based expiration. Conditions are the engine's
 * primary side-channel for ongoing fictional state — the resolver
 * reads them automatically rather than asking each tool to enumerate.
 */

import type { Chapter } from "../schema/index.js";

export const conditionsChapter: Chapter = {
  id: "conditions",
  number: 7,
  title: "Conditions",
  summary:
    "Conditions are tagged, durational state attached to a character or enemy. The engine reads them automatically during tests and combat; world packs supply additional conditions on top of the built-in catalog.",
  sections: [
    {
      id: "shape",
      title: "Shape",
      summary: "The condition record and the effects the engine consumes.",
      entries: [
        {
          id: "7.1-condition-shape",
          title: "Condition shape",
          kind: "mechanic",
          audience: "both",
          tags: ["combat"],
          summary:
            "A condition is `{ id, name, description, duration, effects[], stackable, expiresAtGameTime? }`. Six effect kinds are consumed by the engine; the rest are intent-carriers for the agent / tools.",
          body: [
            {
              kind: "prose",
              text: "Every condition carries a small set of typed effects. The engine reads them during test and combat resolution; the tools layer reads the rest as intent for narrative steps (e.g. `NARRATIVE` shows a flavor string).",
            },
            {
              kind: "table",
              caption: "Duration model",
              headers: ["Duration", "Meaning"],
              rows: [
                ["`number`", "Round-based — decrements via `tickConditionDurations()`"],
                ['`"permanent"`', "Never expires unless explicitly removed"],
                ['`"until_rest"`', "Cleared on long / camp rest by `clearRestConditions()`"],
                [
                  "(plus `expiresAtGameTime`)",
                  "Optional `GameTime` deadline — checked by `advance_time`",
                ],
              ],
            },
            {
              kind: "table",
              caption: "Effect kinds (engine-consumed)",
              headers: ["Effect", "Where consumed", "Filter"],
              rows: [
                ["`MODIFY_ABILITY`", "Test / attack rolls", "Matching ability id"],
                ["`MODIFY_SKILL`", "Test / attack rolls", "Matching skill id"],
                [
                  "`GRANT_ADVANTAGE`",
                  "Test / attack rolls",
                  "Matching scope (`attacks`, `defense`, `skill_tests`, `all`)",
                ],
                ["`GRANT_DISADVANTAGE`", "Test / attack rolls", "Matching scope"],
                ["`RESISTANCE`", "Damage applied", "Matching `damageType`"],
                ["`VULNERABILITY`", "Damage applied", "Matching `damageType`"],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Pruned effects",
              text: "Earlier drafts of the schema declared `MODIFY_HP`, `MODIFY_DEFENSE`, `ADD_CONDITION`, `REMOVE_CONDITION`, `SET_FLAG`, `DEAL_DAMAGE`, `HEAL`, `NARRATIVE` as effect types. None had engine consumers; they were pruned during the rulebook-prep consolidation. If a future feature needs them, add the consumer first, the schema entry second.",
            },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/conditions.ts" },
            { file: "packages/engine/src/conditions/stacking.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "The effect-kind union is a closed contract between the engine and consumers. Worlds add condition records, not effect kinds.",
          },
          xref: [
            "6.4-conditions-in-combat",
            "7.2-common-conditions",
            "7.3-stacking",
            "7.4-time-expiration",
          ],
        },
      ],
    },
    {
      id: "catalog",
      title: "Catalog",
      summary: "The built-in conditions every world inherits.",
      entries: [
        {
          id: "7.2-common-conditions",
          title: "Common conditions",
          kind: "catalog",
          audience: "both",
          tags: ["combat"],
          summary:
            "Ten built-in conditions baked into the types package: `WOUNDED`, `STUNNED`, `FRIGHTENED`, `INSPIRED`, `BLESSED`, `CURSED`, `HIDDEN`, `FIRE_RESISTANT`, `FIRE_VULNERABLE`, `PRONE`. Worlds supply additional conditions via `WorldContentPack.conditions`.",
          body: [
            {
              kind: "table",
              caption: "Built-in catalog",
              headers: ["Id", "Effect summary"],
              rows: [
                ["`WOUNDED`", "Disadvantage on physical actions until rested"],
                ["`STUNNED`", "Disadvantage on all rolls; short numeric duration"],
                ["`FRIGHTENED`", "Disadvantage on rolls against the source of fear"],
                ["`INSPIRED`", "Advantage on the next skill test"],
                ["`BLESSED`", "Advantage on rolls; numeric duration"],
                ["`CURSED`", "Disadvantage on rolls; permanent until cleansed"],
                ["`HIDDEN`", "Advantage on attacks; lost on first attack made"],
                ["`FIRE_RESISTANT`", "Resistance to `fire` damage"],
                ["`FIRE_VULNERABLE`", "Vulnerability to `fire` damage"],
                ["`PRONE`", "Disadvantage on melee defense, advantage to melee attackers"],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "World additions",
              text: "World packs add their own conditions through `WorldContentPack.conditions`. Worlds-schema conditions now use the same `EffectSchema[]` and runtime duration model as the built-in catalog, so a world condition can be applied to a character at runtime with no translation step.",
            },
          ],
          canonicalSource: [{ file: "packages/types/src/game/conditions.ts" }],
          extensibility: {
            kind: "fixed",
            reason:
              "The built-in catalog is a TypeScript const map. Worlds add to it via content packs; they do not rename or remove these entries.",
          },
          xref: ["7.1-condition-shape"],
        },
      ],
    },
    {
      id: "lifecycle",
      title: "Lifecycle",
      summary: "How conditions enter, persist, and exit.",
      entries: [
        {
          id: "7.3-stacking",
          title: "Stacking",
          kind: "mechanic",
          audience: "both",
          tags: ["combat"],
          summary:
            "Non-stackable conditions refuse re-add when an instance with the same id is active. Stackable conditions append unbounded. `removeCondition` drops the first matching instance; `removeAllConditionsById` clears every instance.",
          body: [
            {
              kind: "table",
              caption: "Add / remove behavior",
              headers: ["Operation", "Stackable: false", "Stackable: true"],
              rows: [
                ["`addCondition` (no existing)", "Added", "Added"],
                ["`addCondition` (existing of same id)", "Refused — `added: false`", "Appended"],
                ["`removeCondition`", "First match removed", "First match removed"],
                ["`removeAllConditionsById`", "All instances removed", "All instances removed"],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "No bounded stacks",
              text: '`stackable: true` means unbounded — there\'s no "stacks of N up to a cap" semantics. If a world needs capped stacking, the tool layer has to enforce it before calling `addCondition`.',
            },
          ],
          canonicalSource: [{ file: "packages/engine/src/conditions/stacking.ts" }],
          extensibility: {
            kind: "fixed",
            reason: "Stacking semantics are part of the condition system contract.",
          },
          xref: ["7.1-condition-shape", "7.4-time-expiration"],
        },
        {
          id: "7.4-time-expiration",
          title: "Time-based expiration",
          kind: "mechanic",
          audience: "gm",
          tags: ["combat", "time"],
          summary:
            "`condition.expiresAtGameTime` triggers expiration when `compareGameTime(currentTime, expiresAtGameTime) >= 0`. Round-based numeric durations require explicit `tickConditionDurations()` calls.",
          body: [
            {
              kind: "prose",
              text: "Conditions can expire on three different signals: round count (numeric duration, ticked manually), rest (cleared by `clearRestConditions()`), or wall-clock game time (checked by `advance_time`). The three are independent — a condition can declare any one or none.",
            },
            {
              kind: "callout",
              tone: "info",
              title: "`advance_time` integration",
              text: "When `advance_time` rolls forward, it walks every character and enemy, drops conditions whose `expiresAtGameTime` has passed, and returns them in the result's `expiredConditions` array so the GM / agent can narrate the change.",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/conditions/stacking.ts" },
            { file: "packages/tools/src/time/advance-time.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason: "Expiration semantics are part of the condition system contract.",
          },
          xref: ["7.1-condition-shape", "7.3-stacking", "9.1-game-time", "9.2-deadlines"],
        },
      ],
    },
  ],
};
