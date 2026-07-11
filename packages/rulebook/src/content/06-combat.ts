/**
 * Chapter 6 — Combat
 *
 * Initiative, attack resolution, damage calculation, condition
 * interactions in combat, and the tool-layer combat lifecycle. Combat
 * is mostly the test resolver with a different target (defense
 * instead of difficulty) plus the damage step.
 */

import type { Chapter } from "../schema/index.js";

export const combatChapter: Chapter = {
  id: "combat",
  number: 6,
  title: "Combat",
  summary:
    "Initiative orders the round; attacks are tests against a defense target; damage applies after the outcome lands. Conditions feed into all three stages — the rest is the same five-tier outcome ladder.",
  sections: [
    {
      id: "round",
      title: "The combat round",
      summary: "Initiative and attack resolution.",
      entries: [
        {
          id: "6.1-initiative",
          title: "Initiative",
          kind: "mechanic",
          audience: "both",
          tags: ["combat", "dice"],
          summary:
            "Each combatant rolls `d20 + initiative ability`; sort descending, ties broken by raw ability score. The world's resolved abilities decide which one is the initiative ability via the `usage.initiative` flag (default `AGI`).",
          body: [
            {
              kind: "prose",
              text: "Initiative is rolled once at the start of combat. The resolver walks the world's resolved abilities and picks the first one whose `usage.initiative` flag is `true`; if none is flagged, it falls back to `AGI`. Ties break on raw ability score — characters who tied on the roll resolve in the order their initiative ability ranks them.",
            },
            {
              kind: "formula",
              name: "Initiative total",
              expression: "total = d20 + abilities[initiativeAbility]",
            },
            {
              kind: "callout",
              tone: "info",
              title: "World override",
              text: "Worlds with custom ability sets can flag a different ability for initiative — e.g. a sci-fi world where `SPD` drives reaction time. The flag lives on the ability definition, not in `mechanics`, because it's an ability-set concern.",
            },
            {
              kind: "callout",
              tone: "warning",
              title: "No surprise / ambush rules",
              text: "There is no built-in surprise round or group-initiative model. Surprise narratively translates to a free action before initiative, or to a `desperate` position on the first round — the GM owns the framing.",
            },
          ],
          numbers: [
            { name: "Initiative die", value: "d20", source: "engine/resolution/initiative" },
            { name: "Default initiative ability", value: "AGI", source: "BASE_ABILITIES.AGI" },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/initiative.ts" },
            { file: "packages/engine/src/rules/context.ts" },
            { file: "packages/types/src/rules/abilities.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "abilityMap",
            fullySupported: true,
            notes:
              "Initiative ability is selected by the `usage.initiative` flag on each resolved ability definition.",
          },
          xref: ["4.3-advantage", "6.2-attack-resolution"],
        },
        {
          id: "6.2-attack-resolution",
          title: "Attack resolution",
          kind: "mechanic",
          audience: "both",
          surfaceInQuickStart: true,
          tags: ["combat", "dice"],
          summary:
            "An attack is a test against a defense target. Roll `d20 + ability + skillBonus + mods`, compare to `defense.base + defender.abilities[defense.ability]`, then apply [damage](6.3-damage) keyed on the [outcome tier](2.1-outcome-tiers).",
          body: [
            {
              kind: "prose",
              text: "Attack resolution mirrors the [standard test](4.1-standard-test) — same advantage handling, same modifier sum, same outcome ladder — but compares against a defense target instead of a difficulty.",
            },
            {
              kind: "formula",
              name: "Defense target",
              expression:
                "defenseTarget = mechanics.defense.base + defender.abilities[defense.ability]",
              variables: {
                "mechanics.defense.base": "default 10",
                "defense.ability": "default AGI",
              },
            },
            {
              kind: "formula",
              name: "Attack margin",
              expression:
                "margin = (natural + abilityMod + combatSkillBonus + conditionMods + otherMods) − defenseTarget",
            },
            {
              kind: "table",
              caption: "Outcome → damage mapping",
              headers: ["Outcome", "Hit?", "Damage applied"],
              rows: [
                [
                  "`critical_success`",
                  "yes",
                  "Full damage × `criticals.damageMultiplier` (default 2×)",
                ],
                ["`success`", "yes", "Full damage"],
                [
                  "`partial`",
                  "graze (`hit: false`, legacy)",
                  "`floor(baseDamage × grazeMultiplier)` (default 50%)",
                ],
                ["`failure`", "no", "0"],
                ["`critical_failure`", "no", "0"],
              ],
            },
            {
              kind: "callout",
              tone: "info",
              title: "Resistance and vulnerability",
              text: "Damage type (default `physical`) is matched against active conditions of type `RESISTANCE` and `VULNERABILITY`. Matching pairs cancel; one without the other applies the world's `resistanceMultiplier` (0.5) or `vulnerabilityMultiplier` (2.0) before reaching the defender.",
            },
            {
              kind: "callout",
              tone: "warning",
              title: "`hit: false` on partial is legacy",
              text: "`AttackResult.hit` reports `false` on a partial outcome even though graze damage applies. Branch on `outcome` instead — `partial` means the strike landed but cost something.",
            },
          ],
          examples: [
            {
              title: "A partial sword strike",
              scenario:
                "Attacker rolls 11 + STR (+2) + combat (+1) = 14 against defense 16 (10 base + AGI 6). Margin −2 → partial.",
              expectedOutputs: {
                outcome: "partial",
                "hit (legacy)": false,
                "graze damage": "floor(weaponDamage × 0.5)",
              },
            },
          ],
          numbers: [
            { name: "Default defense base", value: 10, source: "BASE_DEFENSE.base" },
            { name: "Default defense ability", value: "AGI", source: "BASE_DEFENSE.ability" },
            {
              name: "Graze damage multiplier",
              value: 0.5,
              source: "BASE_DAMAGE.grazeMultiplier",
            },
            {
              name: "Resistance multiplier",
              value: 0.5,
              source: "ResolvedMechanics.resistanceMultiplier",
            },
            {
              name: "Vulnerability multiplier",
              value: 2,
              source: "ResolvedMechanics.vulnerabilityMultiplier",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/combat.ts" },
            { file: "packages/tools/src/combat/attack.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.defense",
            fullySupported: true,
          },
          xref: [
            "2.1-outcome-tiers",
            "2.2-criticals",
            "2.3-margin-math",
            "4.3-advantage",
            "6.3-damage",
            "6.4-conditions-in-combat",
          ],
        },
      ],
    },
    {
      id: "damage",
      title: "Damage",
      summary: "How a successful hit translates into HP loss.",
      entries: [
        {
          id: "6.3-damage",
          title: "Damage calculation",
          kind: "mechanic",
          audience: "both",
          tags: ["combat"],
          summary:
            "`damage = max(minimumDamage, rollDice(weapon.damage) + ability − armor)`, with each addend toggleable via `mechanics.damage`. Armor is sourced from defender fields in a fixed precedence.",
          body: [
            {
              kind: "formula",
              name: "Damage",
              expression:
                "damage = max(minimumDamage, rollDice(weapon.damage) + (addAbility ? abilityMod : 0) − (subtractArmor ? armor : 0))",
              variables: {
                "weapon.damage": "the weapon's damage expression (e.g. `1d8`)",
                abilityMod: "the attacker's relevant ability score",
                armor: "the defender's armor value (see precedence below)",
                addAbility: "default true",
                subtractArmor: "default true",
                minimumDamage: "default 0",
              },
            },
            {
              kind: "table",
              caption: "Armor source precedence",
              headers: ["Order", "Source", "Notes"],
              rows: [
                ["1", "`defender.armor`", "Numeric — used by Enemy and modern Character shape"],
                ["2", "`Character.equipment.armorValue`", "Numeric on the legacy equipment object"],
                [
                  "3",
                  "Parse `+(\\d+)` from `Character.equipment.armor` string",
                  'e.g. `"chain mail +3"` → 3',
                ],
                ["4", "0", "Fall-through default"],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Itemized armor is not piped through",
              text: "Combat reads `Character.equipment.armor` (the legacy field), **not** `Character.inventory.equipped`. If a character has armor in their itemized inventory but nothing in legacy equipment, the combat resolver will see armor 0. See [equipment modes](8.1-inventory-modes).",
            },
            {
              kind: "callout",
              tone: "info",
              title: "Critical hit interaction",
              text: "Critical-hit multiplication happens *before* resistance / vulnerability multiplication and *before* armor subtraction is reapplied — armor is subtracted once, on the raw damage roll, not after the crit multiplier.",
            },
          ],
          numbers: [
            { name: "Add ability default", value: true, source: "BASE_DAMAGE.addAbility" },
            { name: "Subtract armor default", value: true, source: "BASE_DAMAGE.subtractArmor" },
            { name: "Minimum damage", value: 0, source: "BASE_DAMAGE.minimumDamage" },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/damage.ts" },
            { file: "packages/engine/src/resolution/combat.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.damage",
            fullySupported: true,
          },
          xref: ["6.2-attack-resolution", "8.1-inventory-modes", "8.2-weapon-parsing"],
        },
      ],
    },
    {
      id: "interactions",
      title: "Interactions",
      summary: "Conditions in combat and the tool-layer combat lifecycle.",
      entries: [
        {
          id: "6.4-conditions-in-combat",
          title: "Conditions in combat",
          kind: "mechanic",
          audience: "both",
          tags: ["combat"],
          summary:
            'Combat reads three families of [condition effects](7.1-condition-shape): `MODIFY_SKILL` with `skillId === "combat"` adjusts the attack roll; `GRANT_ADVANTAGE`/`GRANT_DISADVANTAGE` with matching scope adjusts the dice; `RESISTANCE`/`VULNERABILITY` adjusts damage by type.',
          body: [
            {
              kind: "prose",
              text: "The engine treats conditions as a side-channel input to combat — the call site doesn't enumerate effects, the resolver does. This keeps combat tools dumb (just attacker, target, weapon) while still honoring the fictional state.",
            },
            {
              kind: "table",
              caption: "Combat-consumed condition effects",
              headers: ["Effect type", "Where it applies", "Filter"],
              rows: [
                ["`MODIFY_SKILL`", "Attack roll modifier", '`skillId === "combat"`'],
                ["`MODIFY_ABILITY`", "Attack roll modifier", "Matching ability id"],
                ["`GRANT_ADVANTAGE`", "Attack dice (best of two)", "Scope `attacks` or `all`"],
                ["`GRANT_DISADVANTAGE`", "Attack dice (worst of two)", "Scope `attacks` or `all`"],
                ["`RESISTANCE`", "Damage applied", "Matching `damageType`"],
                ["`VULNERABILITY`", "Damage applied", "Matching `damageType`"],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Defense effects are dead",
              text: "`MODIFY_DEFENSE` was pruned from the `Effect` union when the audit consolidated dead effect types. Defense math reads only the raw ability score plus base — there's no condition-driven defense modifier today.",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/resolution/combat.ts" },
            { file: "packages/types/src/game/conditions.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "The set of consumed effect types is a fixed contract between the engine and the condition system; world packs add new conditions, not new effect kinds.",
          },
          xref: ["6.2-attack-resolution", "7.1-condition-shape", "4.3-advantage"],
        },
        {
          id: "6.5-combat-lifecycle",
          title: "Combat lifecycle (tool layer)",
          kind: "workflow",
          audience: "gm",
          tags: ["combat", "gm-support"],
          summary:
            "`start_combat` → `roll_initiative` → repeated `attack` / `apply_damage` / `next_turn` → `end_combat`. State lives on `SessionState.combat = { active, round, turnOrder, currentTurnId, turnIndex }`.",
          body: [
            {
              kind: "prose",
              text: "The tools layer wraps the engine with a state machine. `start_combat` accepts inline enemy definitions; weapons are parsed via [parseWeaponString](8.2-weapon-parsing). `roll_initiative` mutates `combat.turnOrder` to the sorted result and sets `round = 1, turnIndex = 0`. `next_turn` advances the turn index, looping to the next round when it overflows. `end_combat` clears the combat state and emits a final outcome event.",
            },
            {
              kind: "callout",
              tone: "warning",
              title: "No round economy",
              text: "There's no built-in concept of action / bonus action / reaction — a turn is whatever the GM lets a combatant do before calling `next_turn`. Movement and range are similarly narrative-only; there's no grid or zone model.",
            },
          ],
          canonicalSource: [
            { file: "packages/tools/src/combat/start-combat.ts" },
            { file: "packages/tools/src/combat/roll-initiative.ts" },
            { file: "packages/tools/src/combat/next-turn.ts" },
            { file: "packages/tools/src/combat/end-combat.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason:
              "The combat state machine is part of the session-state shape, not world-tunable.",
          },
          xref: ["6.1-initiative", "6.2-attack-resolution", "8.2-weapon-parsing"],
        },
      ],
    },
  ],
};
