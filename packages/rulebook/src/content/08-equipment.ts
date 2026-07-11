/**
 * Chapter 8 — Equipment & Gear
 *
 * Two inventory modes (narrative vs itemized), the weapon-string
 * parser, item rarity / type / modifier enums, and encumbrance.
 */

import type { Chapter } from "../schema/index.js";

export const equipmentChapter: Chapter = {
  id: "equipment",
  number: 8,
  title: "Equipment & Gear",
  summary:
    "Equipment can be held in narrative-string mode or in fully-itemized mode. The combat resolver currently reads the legacy narrative path; the itemized model is a display-layer model with weight, slots, and rarity.",
  sections: [
    {
      id: "modes",
      title: "Inventory modes",
      summary: "Narrative strings vs itemized objects.",
      entries: [
        {
          id: "8.1-inventory-modes",
          title: "Narrative vs itemized inventory",
          kind: "mechanic",
          audience: "both",
          tags: ["equipment"],
          summary:
            '`CharacterInventory.mode = "narrative" | "itemized"`. Narrative mode is free-text strings (`weapons[]: string`, `armor: string`); itemized mode is `Item` objects with an 8-slot equipment loadout, gold, and weight.',
          body: [
            {
              kind: "table",
              caption: "Narrative vs itemized at a glance",
              headers: ["Aspect", "Narrative", "Itemized"],
              rows: [
                [
                  "Weapon storage",
                  '`weapons[]: string` (e.g. `"longsword (1d8, STR)"`)',
                  "`Item` objects with full schema",
                ],
                [
                  "Armor storage",
                  "`armor: string`, optional `armorValue`",
                  "Slotted `armor` items",
                ],
                ["Equipped slots", "Implicit", "8 slots (see below)"],
                ["Gold / weight", "Optional", "Always present"],
                ["Combat reads from", "Legacy `Character.equipment`", "Same legacy field (drift)"],
              ],
            },
            {
              kind: "table",
              caption: "Equipment slots (itemized)",
              headers: ["Slot", "Slot"],
              rows: [
                ["`mainHand`", "`offHand`"],
                ["`head`", "`body`"],
                ["`hands`", "`feet`"],
                ["`accessory1`", "`accessory2`"],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Itemized inventory and combat are not connected",
              text: "Combat reads `Character.equipment.armor` (the legacy narrative field), not `Character.inventory.equipped`. If you put a `+3 chain mail` item in the body slot but leave the legacy field empty, combat sees armor 0. The itemized model is a display-layer model today.",
            },
          ],
          numbers: [
            { name: "Equipment slot count", value: 8, source: "EquipmentLoadout" },
            { name: "Default max slots", value: 20, source: "Inventory.maxSlots" },
            { name: "Default gold", value: 0, source: "Inventory.gold" },
          ],
          canonicalSource: [
            { file: "packages/types/src/game/inventory.ts" },
            { file: "packages/engine/src/resolution/combat.ts" },
          ],
          extensibility: {
            kind: "fixed",
            reason: "Inventory shape, slot count, and slot ids are baked into the type system.",
          },
          xref: ["6.3-damage", "8.2-weapon-parsing", "8.3-items", "8.4-encumbrance"],
        },
        {
          id: "8.2-weapon-parsing",
          title: "Weapon parsing",
          kind: "mechanic",
          audience: "gm",
          tags: ["equipment", "combat"],
          summary:
            '`parseWeaponString("Name (props)")` extracts a damage expression and ability from the property list using world-overridable keyword tables (`mechanics.equipmentParsing`).',
          body: [
            {
              kind: "prose",
              text: "Weapon strings are the bridge between narrative inventory and combat. The parser scans the parenthesized property list for: a dice expression (first token matching the dice regex), an ability keyword (against `abilityKeywords`), and a ranged keyword (against `rangedKeywords`). Anything not found falls back to the world's defaults.",
            },
            {
              kind: "table",
              caption: "Default fantasy keyword tables",
              headers: ["Setting", "Default"],
              rows: [
                ["`rangedKeywords`", '`["ranged", "thrown", "bow", "crossbow", "sling"]`'],
                [
                  "`abilityKeywords`",
                  "`{ str: STR, agi: AGI, dex: AGI, wit: WIT, con: CON, strength: STR, agility: AGI, dexterity: AGI }`",
                ],
                ["`defaultMeleeAbility`", "`STR`"],
                ["`defaultRangedAbility`", "`AGI`"],
                ["`defaultDamage`", "`d4`"],
              ],
            },
            {
              kind: "callout",
              tone: "tip",
              title: "Sci-fi or non-English worlds",
              text: "Worlds with a different lexicon — sci-fi (`pulse`, `plasma`, `laser`), non-English worlds, or different ability sets — should override `mechanics.equipmentParsing`. The parser threads through `getWeaponParseOptions(rules)` so the same string parses differently per world.",
            },
          ],
          canonicalSource: [
            { file: "packages/engine/src/equipment/parser.ts" },
            { file: "packages/types/src/rules/mechanics.ts" },
          ],
          extensibility: {
            kind: "world-overridable",
            configPath: "mechanics.equipmentParsing",
            fullySupported: true,
          },
          xref: ["6.2-attack-resolution", "6.3-damage", "8.1-inventory-modes"],
        },
      ],
    },
    {
      id: "items",
      title: "Items",
      summary: "Itemized model: rarity, types, modifiers, encumbrance.",
      entries: [
        {
          id: "8.3-items",
          title: "Item rarity, types, and modifiers",
          kind: "catalog",
          audience: "both",
          tags: ["equipment"],
          summary:
            "Items carry `rarity, type, statModifiers[], damageType?`. The taxonomy enums are TypeScript literal unions; none of the itemized model's stat modifiers, damage types, or weapon categories are read by the combat engine today.",
          body: [
            {
              kind: "table",
              caption: "Enums",
              headers: ["Enum", "Values"],
              rows: [
                ["`ItemRarity`", "`common, uncommon, rare, epic, legendary`"],
                [
                  "`ItemType`",
                  "`weapon, armor, consumable, key, quest, misc, material, accessory`",
                ],
                ["`ItemStatModifier.type`", "`flat, percent`"],
                ["Damage types", "`physical, fire, ice, lightning, poison, holy, dark`"],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "The itemized model is display-only",
              text: "Stat modifiers, item-level damage types, and weapon categories on `Item` are not consumed by the combat resolver — `Weapon` (the runtime type) carries no damage-type field and is parsed from the legacy narrative string. The itemized inventory exists for UI and shop / loot logic; it doesn't change combat math.",
            },
          ],
          canonicalSource: [{ file: "packages/types/src/game/items.ts" }],
          extensibility: {
            kind: "fixed",
            reason:
              "Rarity, type, and damage-type enums are TypeScript literal unions; no world-pack hook exists to extend them today.",
          },
          xref: ["8.1-inventory-modes", "8.2-weapon-parsing", "8.4-encumbrance"],
        },
        {
          id: "8.4-encumbrance",
          title: "Encumbrance",
          kind: "mechanic",
          audience: "both",
          tags: ["equipment"],
          summary:
            "Optional `weight: { current, max }` with status thresholds: `light ≤ 0.33`, `normal ≤ 0.66`, `heavy ≤ 1.0`, else `overloaded`. Not enforced mechanically — no movement or check penalty.",
          body: [
            {
              kind: "table",
              caption: "Encumbrance bands",
              headers: ["Status", "Ratio (current / max)"],
              rows: [
                ["`light`", "≤ 0.33"],
                ["`normal`", "≤ 0.66"],
                ["`heavy`", "≤ 1.0"],
                ["`overloaded`", "> 1.0"],
              ],
            },
            {
              kind: "callout",
              tone: "warning",
              title: "Display only",
              text: "The status string is computed and surfaced for UI, but no engine code branches on it — there's no movement penalty, no check disadvantage hook. If a world wants encumbrance to bite, the tool layer has to enforce it.",
            },
          ],
          canonicalSource: [{ file: "packages/types/src/game/inventory.ts" }],
          extensibility: {
            kind: "fixed",
            reason: "Encumbrance thresholds are TS constants; not in `WorldRulesConfig`.",
          },
          xref: ["8.1-inventory-modes", "8.3-items"],
        },
      ],
    },
  ],
};
