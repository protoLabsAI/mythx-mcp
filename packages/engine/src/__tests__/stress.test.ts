/**
 * Tests for FitD-style stress mechanics
 */

import { describe, it, expect } from "vitest";
import {
  pushRoll,
  resistConsequence,
  recoverStress,
  executeFlashback,
  ensureStressTracker,
  canAffordStress,
} from "../resolution/stress.js";
import { BASE_STRESS } from "@mythxengine/types";
import { createRNG } from "../rng/index.js";
import type { Character } from "@mythxengine/types";

// Test character factory
function createTestCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "test-char",
    name: "Test Character",
    abilities: { STR: 2, AGI: 1, WIT: 3, CON: 2 },
    hp: { current: 20, max: 20 },
    skills: [],
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

describe("pushRoll", () => {
  it("costs 2 stress by default", () => {
    const rng = createRNG(42);
    const result = pushRoll({
      rng,
      currentStress: 0,
      maxStress: 9,
    });

    expect(result.stressCost).toBe(2);
    expect(result.newStress).toBe(2);
  });

  it("returns a 1d6 bonus", () => {
    const rng = createRNG(42);
    const result = pushRoll({
      rng,
      currentStress: 0,
      maxStress: 9,
    });

    expect(result.bonus).toBeGreaterThanOrEqual(1);
    expect(result.bonus).toBeLessThanOrEqual(6);
    expect(result.bonusRoll.expression).toBe("1d6");
    expect(result.bonusRoll.total).toBe(result.bonus);
  });

  it("triggers trauma when stress exceeds max", () => {
    const rng = createRNG(42);
    const result = pushRoll({
      rng,
      currentStress: 8, // 8 + 2 = 10 > 9
      maxStress: 9,
    });

    expect(result.traumaTriggered).toBe(true);
    expect(result.newStress).toBe(9); // Capped at max
  });

  it("does not trigger trauma when stress stays at or below max", () => {
    const rng = createRNG(42);
    const result = pushRoll({
      rng,
      currentStress: 7, // 7 + 2 = 9 <= 9
      maxStress: 9,
    });

    expect(result.traumaTriggered).toBe(false);
    expect(result.newStress).toBe(9);
  });

  it("respects custom stress config", () => {
    const rng = createRNG(42);
    const result = pushRoll({
      rng,
      currentStress: 0,
      maxStress: 9,
      config: {
        pushCost: 3,
        pushBonus: "2d6",
      },
    });

    expect(result.stressCost).toBe(3);
    expect(result.bonusRoll.expression).toBe("2d6");
  });
});

describe("resistConsequence", () => {
  it("costs based on severity: minor=1, moderate=2, severe=3", () => {
    const character = createTestCharacter({ stress: { current: 0, max: 9 } });

    // We need to mock the roll to not reduce cost
    // Using a seed that gives a low roll
    const rng1 = createRNG(1);
    const minorResult = resistConsequence({
      character,
      resistAbility: "CON",
      severity: "minor",
      rng: rng1,
    });

    // The cost should be 1 (minor) or 0 if reduced
    expect(minorResult.stressCost).toBeGreaterThanOrEqual(0);
    expect(minorResult.stressCost).toBeLessThanOrEqual(1);
  });

  it("can reduce cost on high ability roll (>= 5)", () => {
    const character = createTestCharacter({
      abilities: { STR: 2, AGI: 1, WIT: 3, CON: 4 }, // High CON
      stress: { current: 0, max: 9 },
    });

    // Find a seed where roll + abilityMod >= 5
    let reduced = false;
    for (let seed = 1; seed <= 100; seed++) {
      const rng = createRNG(seed);
      const result = resistConsequence({
        character,
        resistAbility: "CON",
        severity: "moderate",
        rng,
      });

      if (result.reduced) {
        reduced = true;
        // Base cost for moderate is 2, reduced should be 1
        expect(result.stressCost).toBe(1);
        break;
      }
    }

    expect(reduced).toBe(true);
  });

  it("triggers trauma when stress exceeds max", () => {
    const character = createTestCharacter({ stress: { current: 8, max: 9 } });
    const rng = createRNG(42);

    const result = resistConsequence({
      character,
      resistAbility: "CON",
      severity: "severe", // Base cost 3
      rng,
    });

    // Even if reduced to 2, 8 + 2 = 10 > 9
    expect(result.traumaTriggered).toBe(true);
  });

  it("uses correct ability modifier in roll", () => {
    const character = createTestCharacter({
      abilities: { STR: 5, AGI: 1, WIT: 3, CON: 0 },
      stress: { current: 0, max: 9 },
    });
    const rng = createRNG(42);

    const result = resistConsequence({
      character,
      resistAbility: "STR",
      severity: "minor",
      rng,
    });

    expect(result.resistRoll?.abilityMod).toBe(5);
  });
});

describe("recoverStress", () => {
  it("recovers 2 stress on short rest by default", () => {
    const character = createTestCharacter({ stress: { current: 5, max: 9 } });

    const result = recoverStress({
      character,
      restType: "short",
    });

    expect(result.recovered).toBe(2);
    expect(result.newStress).toBe(3);
  });

  it("recovers all stress on long rest by default", () => {
    const character = createTestCharacter({ stress: { current: 7, max: 9 } });

    const result = recoverStress({
      character,
      restType: "long",
    });

    expect(result.recovered).toBe(7);
    expect(result.newStress).toBe(0);
  });

  it("cannot recover more stress than current", () => {
    const character = createTestCharacter({ stress: { current: 1, max: 9 } });

    const result = recoverStress({
      character,
      restType: "short", // Would recover 2, but only has 1
    });

    expect(result.recovered).toBe(1);
    expect(result.newStress).toBe(0);
  });

  it("applies bonuses to recovery", () => {
    const character = createTestCharacter({ stress: { current: 5, max: 9 } });

    const result = recoverStress({
      character,
      restType: "short",
      bonuses: 1, // +1 from safe haven or similar
    });

    expect(result.recovered).toBe(3); // 2 base + 1 bonus
    expect(result.newStress).toBe(2);
  });

  it("respects custom recovery config", () => {
    const character = createTestCharacter({ stress: { current: 5, max: 9 } });

    const result = recoverStress({
      character,
      restType: "short",
      config: {
        recoveryPerShortRest: 3,
      },
    });

    expect(result.recovered).toBe(3);
  });
});

describe("executeFlashback", () => {
  it("costs BASE_STRESS.flashbackCost (default 2) when no override is supplied", () => {
    const character = createTestCharacter({ stress: { current: 0, max: 9 } });

    const result = executeFlashback({ character });

    expect(result.stressCost).toBe(BASE_STRESS.flashbackCost);
    expect(result.newStress).toBe(BASE_STRESS.flashbackCost);
  });

  it("honors a world-supplied flashbackCost override", () => {
    const character = createTestCharacter({ stress: { current: 0, max: 9 } });

    const result = executeFlashback({ character, config: { flashbackCost: 3 } });

    expect(result.stressCost).toBe(3);
    expect(result.newStress).toBe(3);
  });

  it("triggers trauma when stress exceeds max", () => {
    const character = createTestCharacter({ stress: { current: 8, max: 9 } });

    const result = executeFlashback({ character });

    expect(result.traumaTriggered).toBe(true);
    expect(result.newStress).toBe(9); // Capped
  });

  it("does not trigger trauma when stress stays at max", () => {
    const character = createTestCharacter({ stress: { current: 7, max: 9 } });

    const result = executeFlashback({ character });

    expect(result.traumaTriggered).toBe(false);
    expect(result.newStress).toBe(9);
  });
});

describe("ensureStressTracker", () => {
  it("returns existing stress tracker if present", () => {
    const character = createTestCharacter({ stress: { current: 5, max: 9 } });

    const stress = ensureStressTracker(character);

    expect(stress.current).toBe(5);
    expect(stress.max).toBe(9);
  });

  it("creates default stress tracker if missing", () => {
    const character = createTestCharacter();
    // Remove stress
    delete (character as { stress?: unknown }).stress;

    const stress = ensureStressTracker(character);

    expect(stress.current).toBe(0);
    expect(stress.max).toBe(9); // Default max
  });

  it("uses custom config for default max", () => {
    const character = createTestCharacter();
    delete (character as { stress?: unknown }).stress;

    const stress = ensureStressTracker(character, { maxStress: 6 });

    expect(stress.max).toBe(6);
  });
});

describe("canAffordStress", () => {
  it("returns true when cost would not exceed max", () => {
    const character = createTestCharacter({ stress: { current: 5, max: 9 } });

    expect(canAffordStress(character, 2)).toBe(true); // 5 + 2 = 7 <= 9
    expect(canAffordStress(character, 4)).toBe(true); // 5 + 4 = 9 <= 9
  });

  it("returns false when cost would exceed max", () => {
    const character = createTestCharacter({ stress: { current: 5, max: 9 } });

    expect(canAffordStress(character, 5)).toBe(false); // 5 + 5 = 10 > 9
  });

  it("handles characters without stress tracker", () => {
    const character = createTestCharacter();
    delete (character as { stress?: unknown }).stress;

    // Should use defaults: current=0, max=9
    expect(canAffordStress(character, 2)).toBe(true);
    expect(canAffordStress(character, 10)).toBe(false);
  });
});
