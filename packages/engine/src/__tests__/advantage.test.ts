/**
 * Tests for advantage/disadvantage mechanics
 */

import { describe, it, expect } from "vitest";
import {
  calculateNetAdvantage,
  rollD20WithAdvantage,
  rollWithAdvantage,
} from "../dice/advantage.js";
import { createRNG } from "../rng/index.js";

describe("calculateNetAdvantage", () => {
  it("returns normal when no sources", () => {
    expect(calculateNetAdvantage([], [])).toBe("normal");
  });

  it("returns advantage when only advantage sources", () => {
    expect(calculateNetAdvantage(["flanking"], [])).toBe("advantage");
    expect(calculateNetAdvantage(["flanking", "high ground"], [])).toBe("advantage");
  });

  it("returns disadvantage when only disadvantage sources", () => {
    expect(calculateNetAdvantage([], ["darkness"])).toBe("disadvantage");
    expect(calculateNetAdvantage([], ["darkness", "wounded"])).toBe("disadvantage");
  });

  it("cancels advantage and disadvantage to normal", () => {
    expect(calculateNetAdvantage(["flanking"], ["darkness"])).toBe("normal");
    expect(calculateNetAdvantage(["flanking", "high ground"], ["darkness"])).toBe("normal");
    expect(calculateNetAdvantage(["flanking"], ["darkness", "wounded"])).toBe("normal");
  });
});

describe("rollD20WithAdvantage", () => {
  it("returns single roll for normal state", () => {
    const rng = createRNG(12345);
    const result = rollD20WithAdvantage(rng, "normal");

    expect(result.natural).toBeGreaterThanOrEqual(1);
    expect(result.natural).toBeLessThanOrEqual(20);
    expect(result.advantageInfo).toBeUndefined();
  });

  it("returns two rolls and selects higher for advantage", () => {
    const rng = createRNG(42);
    const result = rollD20WithAdvantage(rng, "advantage");

    expect(result.advantageInfo).toBeDefined();
    expect(result.advantageInfo!.type).toBe("advantage");
    expect(result.advantageInfo!.selected).toBe("higher");
    expect(result.advantageInfo!.bothRolls).toHaveLength(2);

    const [roll1, roll2] = result.advantageInfo!.bothRolls;
    expect(result.natural).toBe(Math.max(roll1, roll2));
  });

  it("returns two rolls and selects lower for disadvantage", () => {
    const rng = createRNG(42);
    const result = rollD20WithAdvantage(rng, "disadvantage");

    expect(result.advantageInfo).toBeDefined();
    expect(result.advantageInfo!.type).toBe("disadvantage");
    expect(result.advantageInfo!.selected).toBe("lower");
    expect(result.advantageInfo!.bothRolls).toHaveLength(2);

    const [roll1, roll2] = result.advantageInfo!.bothRolls;
    expect(result.natural).toBe(Math.min(roll1, roll2));
  });

  it("is deterministic with same seed", () => {
    const rng1 = createRNG(12345);
    const rng2 = createRNG(12345);

    const result1 = rollD20WithAdvantage(rng1, "advantage");
    const result2 = rollD20WithAdvantage(rng2, "advantage");

    expect(result1.natural).toBe(result2.natural);
    expect(result1.advantageInfo!.bothRolls).toEqual(result2.advantageInfo!.bothRolls);
  });
});

describe("rollWithAdvantage", () => {
  it("applies advantage to d20 rolls", () => {
    const rng = createRNG(42);
    const result = rollWithAdvantage("d20", rng, "advantage");

    expect(result.advantage).toBeDefined();
    expect(result.advantage!.type).toBe("advantage");
    expect(result.rolls).toHaveLength(1);
    expect(result.rolls[0]).toBe(result.natural);
  });

  it("ignores advantage for non-d20 rolls", () => {
    const rng = createRNG(42);
    const result = rollWithAdvantage("2d6+3", rng, "advantage");

    expect(result.advantage).toBeUndefined();
    expect(result.rolls).toHaveLength(2);
  });

  it("ignores advantage for multiple d20 rolls", () => {
    const rng = createRNG(42);
    const result = rollWithAdvantage("2d20", rng, "advantage");

    expect(result.advantage).toBeUndefined();
    expect(result.rolls).toHaveLength(2);
  });

  it("includes modifier in total", () => {
    const rng = createRNG(42);
    const result = rollWithAdvantage("d20+5", rng, "normal");

    expect(result.modifier).toBe(5);
    expect(result.total).toBe(result.natural + 5);
  });

  // Critical detection is a resolution-layer concern (see CriticalsConfig);
  // the dice layer only reports natural values.
});

describe("advantage integration with abilities", () => {
  it("applies ability modifier to roll with advantage", () => {
    const rng = createRNG(42);
    const abilities = { STR: 2, AGI: 1, WIT: 0, CON: -1 };

    const result = rollWithAdvantage("d20+STR", rng, "advantage", abilities);

    expect(result.modifier).toBe(2);
    expect(result.total).toBe(result.natural + 2);
    expect(result.advantage).toBeDefined();
  });
});
