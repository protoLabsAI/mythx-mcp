/**
 * Tests for the rules configuration system
 */

import { describe, it, expect } from "vitest";
import {
  resolveAbilities,
  BASE_ABILITIES,
  createDefaultAbilitiesRecord,
  resolveDifficulties,
  BASE_DIFFICULTIES,
  difficultiesToRecord,
  resolveMechanics,
  resolveRules,
  validateRulesConfig,
  getAbilityIds,
  isRollUnderSystem,
  parseFormula,
  type AbilityDefinition,
  type WorldRulesConfig,
} from "../rules/index.js";

describe("Abilities", () => {
  describe("resolveAbilities", () => {
    it("returns base abilities when no config provided", () => {
      const abilities = resolveAbilities();
      expect(abilities).toEqual(BASE_ABILITIES);
      expect(abilities.map((a) => a.id)).toEqual(["STR", "AGI", "WIT", "CON"]);
    });

    it("replaces all abilities when replace is provided", () => {
      const customAbilities: AbilityDefinition[] = [
        {
          id: "STR",
          name: "Strength",
          description: "Physical",
          minValue: 10,
          maxValue: 80,
          defaultValue: 30,
        },
        {
          id: "SPD",
          name: "Speed",
          description: "Quickness",
          minValue: 10,
          maxValue: 80,
          defaultValue: 30,
        },
      ];

      const abilities = resolveAbilities({ replace: customAbilities });
      expect(abilities).toEqual(customAbilities);
      expect(abilities.map((a) => a.id)).toEqual(["STR", "SPD"]);
    });

    it("adds abilities to base set", () => {
      const stressAbility: AbilityDefinition = {
        id: "STRESS",
        name: "Stress",
        description: "Mental strain",
        minValue: 0,
        maxValue: 20,
        defaultValue: 2,
      };

      const abilities = resolveAbilities({ add: [stressAbility] });
      expect(abilities.length).toBe(5);
      expect(abilities.map((a) => a.id)).toEqual(["STR", "AGI", "WIT", "CON", "STRESS"]);
    });

    it("overrides specific ability properties", () => {
      const abilities = resolveAbilities({
        override: {
          STR: { name: "Might", description: "Raw physical power" },
        },
      });

      const str = abilities.find((a) => a.id === "STR")!;
      expect(str.name).toBe("Might");
      expect(str.description).toBe("Raw physical power");
      expect(str.minValue).toBe(-3); // Unchanged
    });
  });

  describe("createDefaultAbilitiesRecord", () => {
    it("creates record from base abilities", () => {
      const record = createDefaultAbilitiesRecord(BASE_ABILITIES);
      expect(record).toEqual({ STR: 0, AGI: 0, WIT: 0, CON: 0 });
    });

    it("respects custom default values", () => {
      const abilities: AbilityDefinition[] = [
        {
          id: "STR",
          name: "Strength",
          description: "",
          minValue: 10,
          maxValue: 80,
          defaultValue: 30,
        },
        {
          id: "STRESS",
          name: "Stress",
          description: "",
          minValue: 0,
          maxValue: 20,
          defaultValue: 2,
        },
      ];
      const record = createDefaultAbilitiesRecord(abilities);
      expect(record).toEqual({ STR: 30, STRESS: 2 });
    });
  });
});

describe("Difficulties", () => {
  describe("resolveDifficulties", () => {
    it("returns base difficulties when no config provided", () => {
      const diffs = resolveDifficulties();
      expect(diffs).toEqual(BASE_DIFFICULTIES);
    });

    it("adds custom difficulties and sorts by target", () => {
      const diffs = resolveDifficulties({
        add: [{ id: "TRIVIAL", name: "Trivial", target: 4 }],
      });
      expect(diffs[0].id).toBe("TRIVIAL");
      expect(diffs[0].target).toBe(4);
    });

    it("replaces all difficulties", () => {
      const diffs = resolveDifficulties({
        replace: [
          { id: "ROUTINE", name: "Routine", target: 20 },
          { id: "HARD", name: "Hard", target: 40 },
        ],
      });
      expect(diffs.length).toBe(2);
      expect(diffs.map((d) => d.id)).toEqual(["ROUTINE", "HARD"]);
    });
  });

  describe("difficultiesToRecord", () => {
    it("creates lookup record", () => {
      const record = difficultiesToRecord(BASE_DIFFICULTIES);
      expect(record).toEqual({
        EASY: 8,
        STANDARD: 12,
        HARD: 16,
        EXTREME: 20,
      });
    });
  });
});

describe("Mechanics", () => {
  describe("resolveMechanics", () => {
    it("returns defaults when no config provided", () => {
      const mechanics = resolveMechanics();
      expect(mechanics.defense.base).toBe(10);
      expect(mechanics.defense.ability).toBe("AGI");
      expect(mechanics.criticals.successOn).toEqual([20]);
      expect(mechanics.criticals.failureOn).toEqual([1]);
      expect(mechanics.damage.addAbility).toBe(true);
    });

    it("merges partial config with defaults", () => {
      const mechanics = resolveMechanics({
        defense: { base: 8 },
        criticals: { successOn: [19, 20] },
      });
      expect(mechanics.defense.base).toBe(8);
      expect(mechanics.defense.ability).toBe("AGI"); // Default preserved
      expect(mechanics.criticals.successOn).toEqual([19, 20]);
      expect(mechanics.criticals.failureOn).toEqual([1]); // Default preserved
    });

    it("supports roll-under configuration", () => {
      const mechanics = resolveMechanics({
        rollUnder: {
          enabled: true,
          dice: "d100",
        },
      });
      expect(mechanics.rollUnder?.enabled).toBe(true);
      expect(mechanics.rollUnder?.dice).toBe("d100");
    });
  });
});

describe("Full Rules Resolution", () => {
  describe("resolveRules", () => {
    it("returns default rules when no config", () => {
      const rules = resolveRules();
      expect(rules.abilities.length).toBe(4);
      expect(rules.difficulties.length).toBe(4);
      expect(rules.customTests.length).toBe(0);
      expect(rules.abilityMap.get("STR")).toBeDefined();
      expect(rules.difficultyMap.get("STANDARD")?.target).toBe(12);
    });

    it("resolves complex Mothership-style config", () => {
      const config: WorldRulesConfig = {
        abilities: {
          replace: [
            {
              id: "STR",
              name: "Strength",
              description: "",
              minValue: 10,
              maxValue: 80,
              defaultValue: 30,
            },
            {
              id: "SPD",
              name: "Speed",
              description: "",
              minValue: 10,
              maxValue: 80,
              defaultValue: 30,
            },
            {
              id: "INT",
              name: "Intellect",
              description: "",
              minValue: 10,
              maxValue: 80,
              defaultValue: 30,
            },
            {
              id: "CMB",
              name: "Combat",
              description: "",
              minValue: 10,
              maxValue: 80,
              defaultValue: 30,
            },
            {
              id: "SAN",
              name: "Sanity",
              description: "",
              minValue: 0,
              maxValue: 100,
              defaultValue: 30,
            },
            {
              id: "STRESS",
              name: "Stress",
              description: "",
              minValue: 0,
              maxValue: 20,
              defaultValue: 2,
            },
          ],
        },
        mechanics: {
          rollUnder: { enabled: true, dice: "d100" },
        },
        customTests: {
          tests: [
            {
              id: "panic",
              name: "Panic Check",
              description: "Roll when encountering horror",
              triggers: ["witness_death", "see_creature"],
              roll: { dice: "d100", underAbility: "SAN" },
              outcomes: {
                success: { description: "You keep it together" },
                failure: { description: "Roll on panic table" },
              },
            },
          ],
        },
      };

      const rules = resolveRules(config);
      expect(rules.abilities.length).toBe(6);
      expect(rules.abilityMap.get("STRESS")).toBeDefined();
      expect(rules.mechanics.rollUnder?.enabled).toBe(true);
      expect(rules.customTests.length).toBe(1);
      expect(rules.customTestMap.get("panic")?.name).toBe("Panic Check");
    });
  });

  describe("validateRulesConfig", () => {
    it("returns no errors for valid config", () => {
      const errors = validateRulesConfig({
        abilities: {
          add: [
            {
              id: "STRESS",
              name: "Stress",
              description: "",
              minValue: 0,
              maxValue: 20,
              defaultValue: 2,
            },
          ],
        },
      });
      expect(errors).toEqual([]);
    });

    it("detects duplicate ability IDs", () => {
      const errors = validateRulesConfig({
        abilities: {
          replace: [
            {
              id: "STR",
              name: "Strength",
              description: "",
              minValue: -3,
              maxValue: 3,
              defaultValue: 0,
            },
            {
              id: "STR",
              name: "Strength2",
              description: "",
              minValue: -3,
              maxValue: 3,
              defaultValue: 0,
            },
          ],
        },
      });
      expect(errors).toContain("Duplicate ability ID: STR");
    });

    it("detects invalid ability ranges", () => {
      const errors = validateRulesConfig({
        abilities: {
          replace: [
            { id: "BAD", name: "Bad", description: "", minValue: 10, maxValue: 5, defaultValue: 7 },
          ],
        },
      });
      expect(errors).toContain("Ability BAD: minValue must be less than maxValue");
    });

    it("detects conflicting critical ranges", () => {
      const errors = validateRulesConfig({
        mechanics: {
          criticals: {
            successOn: [19, 20],
            failureOn: [1, 2, 19], // 19 overlaps!
          },
        },
      });
      expect(errors.some((e) => e.includes("overlap"))).toBe(true);
    });

    it("requires at least success or failure outcome for custom tests", () => {
      const errors = validateRulesConfig({
        customTests: {
          tests: [
            {
              id: "bad",
              name: "Bad Test",
              description: "",
              triggers: ["manual"],
              roll: { dice: "d20" },
              outcomes: {}, // Missing both success and failure
            },
          ],
        },
      });
      expect(errors).toContain("Custom test bad: at least success or failure outcome is required");
    });
  });

  describe("helper functions", () => {
    it("isRollUnderSystem detects roll-under", () => {
      expect(isRollUnderSystem()).toBe(false);
      expect(isRollUnderSystem({ mechanics: { rollUnder: { enabled: true, dice: "d100" } } })).toBe(
        true
      );
      expect(
        isRollUnderSystem({ mechanics: { rollUnder: { enabled: false, dice: "d100" } } })
      ).toBe(false);
    });

    it("getAbilityIds returns IDs", () => {
      expect(getAbilityIds()).toEqual(["STR", "AGI", "WIT", "CON"]);
      expect(
        getAbilityIds({
          abilities: {
            add: [
              {
                id: "STRESS",
                name: "Stress",
                description: "",
                minValue: 0,
                maxValue: 20,
                defaultValue: 2,
              },
            ],
          },
        })
      ).toEqual(["STR", "AGI", "WIT", "CON", "STRESS"]);
    });
  });
});

describe("Formula Parsing", () => {
  describe("parseFormula", () => {
    it("evaluates simple addition", () => {
      const fn = parseFormula("{STRESS} + 10");
      expect(fn({ STRESS: 5 })).toBe(15);
    });

    it("evaluates multiplication", () => {
      const fn = parseFormula("{STRESS} * 2");
      expect(fn({ STRESS: 7 })).toBe(14);
    });

    it("evaluates complex formulas", () => {
      const fn = parseFormula("20 - {WIT} + ({STRESS} * 2)");
      expect(fn({ WIT: 3, STRESS: 5 })).toBe(27);
    });

    it("handles multiple ability references", () => {
      const fn = parseFormula("{STR} + {AGI} + {WIT}");
      expect(fn({ STR: 2, AGI: 1, WIT: 3 })).toBe(6);
    });

    it("rejects invalid expressions", () => {
      const fn = parseFormula("{STR}; console.log('bad')");
      expect(() => fn({ STR: 1 })).toThrow("Invalid formula expression");
    });
  });
});
