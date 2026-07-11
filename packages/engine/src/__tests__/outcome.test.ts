/**
 * Tests for five-tier outcome system
 */

import { describe, it, expect } from "vitest";
import {
  determineOutcome,
  determineOutcomeFromConfig,
  isSuccessful,
  isPartialOrWorse,
  outcomeToSuccess,
  outcomeToHit,
  outcomeShouldTickClock,
  outcomeSeverity,
  DEFAULT_OUTCOME_THRESHOLDS,
} from "../resolution/outcome.js";
import { resolveTest } from "../resolution/test.js";
import { resolveAttack } from "../resolution/combat.js";
import { createRNG } from "../rng/index.js";
import type { Character, Weapon } from "@mythxengine/types";

// Default critical rolls for tests (arrays of natural rolls that count as crits)
const defaultCriticalRolls = {
  success: [20],
  failure: [1],
};

/**
 * Module-scope factory for creating test characters with optional overrides
 */
function createTestCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "test-char",
    name: "Test Character",
    abilities: { STR: 2, AGI: 1, WIT: 3, CON: 1 },
    hp: { current: 20, max: 20 },
    skills: [
      { id: "athletics", name: "Athletics", ability: "STR", bonus: 2, description: "Physical" },
    ],
    specialAbilities: [],
    conditions: [],
    flags: [],
    background: "Test background",
    personality: [],
    psychology: { fears: [], goals: [], ambitions: [], bonds: [], flaws: [] },
    archetypeId: "test",
    equipment: { weapons: [], armor: null, gear: [] },
    ...overrides,
  };
}

/**
 * Factory for creating test enemies
 */
function createTestEnemy() {
  return {
    id: "test-enemy",
    name: "Test Enemy",
    description: "A test enemy",
    abilities: { STR: 1, AGI: 2, WIT: -1, CON: 0 },
    hp: { current: 15, max: 15 },
    conditions: [],
    attacks: [{ name: "Claw", damage: "d6", ability: "STR" as const }],
    armor: 1,
    threat: "standard" as const,
  };
}

describe("determineOutcome", () => {
  describe("margin-based outcomes", () => {
    it("returns critical_success for margin >= 10", () => {
      expect(determineOutcome(10, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "critical_success"
      );
      expect(determineOutcome(15, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "critical_success"
      );
    });

    it("returns success for margin >= 0 and < 10", () => {
      expect(determineOutcome(0, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "success"
      );
      expect(determineOutcome(5, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "success"
      );
      expect(determineOutcome(9, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "success"
      );
    });

    it("returns partial for margin >= -4 and < 0", () => {
      expect(determineOutcome(-1, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "partial"
      );
      expect(determineOutcome(-2, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "partial"
      );
      expect(determineOutcome(-4, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "partial"
      );
    });

    it("returns failure for margin < -4", () => {
      expect(determineOutcome(-5, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "failure"
      );
      expect(determineOutcome(-10, 15, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "failure"
      );
    });
  });

  describe("critical roll overrides", () => {
    it("returns critical_success on natural 20 regardless of margin", () => {
      expect(determineOutcome(-10, 20, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "critical_success"
      );
    });

    it("returns critical_failure on natural 1 regardless of margin", () => {
      expect(determineOutcome(15, 1, DEFAULT_OUTCOME_THRESHOLDS, defaultCriticalRolls)).toBe(
        "critical_failure"
      );
    });

    it("respects custom critical rolls", () => {
      const customCriticalRolls = {
        success: [19, 20], // 19-20 is crit
        failure: [1, 2], // 1-2 is crit fail
      };

      expect(determineOutcome(-5, 19, DEFAULT_OUTCOME_THRESHOLDS, customCriticalRolls)).toBe(
        "critical_success"
      );
      expect(determineOutcome(10, 2, DEFAULT_OUTCOME_THRESHOLDS, customCriticalRolls)).toBe(
        "critical_failure"
      );
    });
  });
});

describe("determineOutcomeFromConfig", () => {
  it("works with full rules config objects", () => {
    const thresholds = { criticalSuccess: 10, success: 0, partial: -4 };
    const criticals = {
      successOn: [20],
      failureOn: [1],
      damageMultiplier: 2,
      autoSuccess: true,
      autoFailure: true,
    };

    expect(determineOutcomeFromConfig(5, 15, thresholds, criticals)).toBe("success");
    expect(determineOutcomeFromConfig(-2, 15, thresholds, criticals)).toBe("partial");
  });
});

describe("outcome helper functions", () => {
  describe("isSuccessful", () => {
    it("returns true for critical_success and success", () => {
      expect(isSuccessful("critical_success")).toBe(true);
      expect(isSuccessful("success")).toBe(true);
    });

    it("returns false for partial, failure, critical_failure", () => {
      expect(isSuccessful("partial")).toBe(false);
      expect(isSuccessful("failure")).toBe(false);
      expect(isSuccessful("critical_failure")).toBe(false);
    });
  });

  describe("isPartialOrWorse", () => {
    it("returns false for critical_success and success", () => {
      expect(isPartialOrWorse("critical_success")).toBe(false);
      expect(isPartialOrWorse("success")).toBe(false);
    });

    it("returns true for partial, failure, critical_failure", () => {
      expect(isPartialOrWorse("partial")).toBe(true);
      expect(isPartialOrWorse("failure")).toBe(true);
      expect(isPartialOrWorse("critical_failure")).toBe(true);
    });
  });

  describe("outcomeToSuccess (backwards compat)", () => {
    it("maps outcomes to boolean success", () => {
      expect(outcomeToSuccess("critical_success")).toBe(true);
      expect(outcomeToSuccess("success")).toBe(true);
      expect(outcomeToSuccess("partial")).toBe(false);
      expect(outcomeToSuccess("failure")).toBe(false);
      expect(outcomeToSuccess("critical_failure")).toBe(false);
    });
  });

  describe("outcomeToHit (for attacks)", () => {
    it("returns true only for success and critical_success", () => {
      expect(outcomeToHit("critical_success")).toBe(true);
      expect(outcomeToHit("success")).toBe(true);
      expect(outcomeToHit("partial")).toBe(false);
      expect(outcomeToHit("failure")).toBe(false);
      expect(outcomeToHit("critical_failure")).toBe(false);
    });
  });

  describe("outcomeShouldTickClock", () => {
    it("returns true for partial and failure outcomes (FitD style)", () => {
      expect(outcomeShouldTickClock("partial")).toBe(true);
      expect(outcomeShouldTickClock("failure")).toBe(true);
      expect(outcomeShouldTickClock("critical_failure")).toBe(true);
    });

    it("returns false for success outcomes", () => {
      expect(outcomeShouldTickClock("critical_success")).toBe(false);
      expect(outcomeShouldTickClock("success")).toBe(false);
    });
  });

  describe("outcomeSeverity", () => {
    it("returns severity level for each outcome (higher is better)", () => {
      expect(outcomeSeverity("critical_success")).toBe(4);
      expect(outcomeSeverity("success")).toBe(3);
      expect(outcomeSeverity("partial")).toBe(2);
      expect(outcomeSeverity("failure")).toBe(1);
      expect(outcomeSeverity("critical_failure")).toBe(0);
    });
  });
});

describe("resolveTest returns outcome", () => {
  it("includes outcome field in result", () => {
    const character = createTestCharacter();
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      ability: "STR",
      difficulty: 12,
      rng,
    });

    expect(result.outcome).toBeDefined();
    expect(["critical_success", "success", "partial", "failure", "critical_failure"]).toContain(
      result.outcome
    );
  });

  it("success boolean is consistent with outcome (backwards compat)", () => {
    const character = createTestCharacter();

    // Run multiple tests to get different outcomes
    for (let seed = 1; seed <= 100; seed++) {
      const rng = createRNG(seed);
      const result = resolveTest({
        character,
        ability: "STR",
        difficulty: 12,
        rng,
      });

      const expectedSuccess = result.outcome === "critical_success" || result.outcome === "success";
      expect(result.success).toBe(expectedSuccess);
    }
  });

  it("includes position and effectLevel in result", () => {
    const character = createTestCharacter();
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      ability: "STR",
      difficulty: 12,
      rng,
      position: "desperate",
      effectLevel: "great",
    });

    expect(result.position).toBe("desperate");
    expect(result.effectLevel).toBe("great");
  });

  it("applies defaults for position/effectLevel when not provided", () => {
    const character = createTestCharacter();
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      ability: "STR",
      difficulty: 12,
      rng,
    });

    // Engine layer applies defaults: position=risky, effectLevel=standard
    expect(result.position).toBe("risky");
    expect(result.effectLevel).toBe("standard");
  });
});

describe("resolveAttack returns outcome with graze damage", () => {
  const weapon: Weapon = { name: "Sword", damage: "d8", ability: "STR" };

  it("includes outcome field in attack result", () => {
    const attacker = createTestCharacter({ abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 } });
    const defender = createTestEnemy();
    const rng = createRNG(42);

    const result = resolveAttack({
      attacker,
      defender,
      weapon,
      rng,
    });

    expect(result.outcome).toBeDefined();
    expect(["critical_success", "success", "partial", "failure", "critical_failure"]).toContain(
      result.outcome
    );
  });

  it("hit boolean is consistent with outcome (backwards compat)", () => {
    const attacker = createTestCharacter({ abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 } });
    const defender = createTestEnemy();

    for (let seed = 1; seed <= 100; seed++) {
      const rng = createRNG(seed);
      const result = resolveAttack({
        attacker,
        defender,
        weapon,
        rng,
      });

      const expectedHit = result.outcome === "critical_success" || result.outcome === "success";
      expect(result.hit).toBe(expectedHit);
    }
  });

  it("returns grazeDamage on partial outcomes (50% of full)", () => {
    const attacker = createTestCharacter({ abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 } });
    const defender = createTestEnemy();

    // Find a seed that produces a partial outcome
    let partialResult = null;
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = createRNG(seed);
      const result = resolveAttack({
        attacker,
        defender,
        weapon,
        rng,
      });

      if (result.outcome === "partial") {
        partialResult = result;
        break;
      }
    }

    // Explicitly fail if no partial outcome was found
    expect(partialResult).not.toBeNull();
    expect(partialResult!.grazeDamage).toBeDefined();
    expect(partialResult!.grazeDamage).toBeGreaterThan(0);
    expect(partialResult!.hit).toBe(false); // Partial is not a "hit" for backwards compat
    expect(partialResult!.damage).toBeUndefined(); // Full damage not present on partial
  });

  it("returns full damage on success outcomes", () => {
    const attacker = createTestCharacter({ abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 } });
    const defender = createTestEnemy();

    // Find a seed that produces a success
    let successResult = null;
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = createRNG(seed);
      const result = resolveAttack({
        attacker,
        defender,
        weapon,
        rng,
      });

      if (result.outcome === "success") {
        successResult = result;
        break;
      }
    }

    // Explicitly fail if no success outcome was found
    expect(successResult).not.toBeNull();
    expect(successResult!.damage).toBeDefined();
    expect(successResult!.damage).toBeGreaterThan(0);
    expect(successResult!.grazeDamage).toBeUndefined();
    expect(successResult!.hit).toBe(true);
  });
});
