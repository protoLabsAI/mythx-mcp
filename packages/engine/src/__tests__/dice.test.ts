import { describe, it, expect } from "vitest";
import { parseDice, isValidDiceExpression, rollDice, rollDie, rollNd } from "../dice/index.js";
import { createRNG } from "../rng/index.js";

describe("parseDice", () => {
  it("parses simple d20", () => {
    expect(parseDice("d20")).toEqual({
      count: 1,
      sides: 20,
      modifier: 0,
      ability: undefined,
    });
  });

  it("parses 2d6", () => {
    expect(parseDice("2d6")).toEqual({
      count: 2,
      sides: 6,
      modifier: 0,
      ability: undefined,
    });
  });

  it("parses d8+3", () => {
    expect(parseDice("d8+3")).toEqual({
      count: 1,
      sides: 8,
      modifier: 3,
      ability: undefined,
    });
  });

  it("parses 1d6-2", () => {
    expect(parseDice("1d6-2")).toEqual({
      count: 1,
      sides: 6,
      modifier: -2,
      ability: undefined,
    });
  });

  it("parses d20+STR", () => {
    expect(parseDice("d20+STR")).toEqual({
      count: 1,
      sides: 20,
      modifier: 0,
      ability: "STR",
    });
  });

  it("is case insensitive for abilities", () => {
    expect(parseDice("d20+str").ability).toBe("STR");
    expect(parseDice("d20+Agi").ability).toBe("AGI");
  });

  it("throws on invalid expression", () => {
    expect(() => parseDice("invalid")).toThrow();
    expect(() => parseDice("d")).toThrow();
    expect(() => parseDice("2d")).toThrow();
  });

  it("throws on out of range values", () => {
    expect(() => parseDice("0d6")).toThrow();
    expect(() => parseDice("101d6")).toThrow();
    expect(() => parseDice("1d0")).toThrow();
    expect(() => parseDice("1d101")).toThrow();
  });
});

describe("isValidDiceExpression", () => {
  it("returns true for valid expressions", () => {
    expect(isValidDiceExpression("d20")).toBe(true);
    expect(isValidDiceExpression("2d6+3")).toBe(true);
    expect(isValidDiceExpression("1d8-1")).toBe(true);
    expect(isValidDiceExpression("d20+STR")).toBe(true);
  });

  it("returns false for invalid expressions", () => {
    expect(isValidDiceExpression("invalid")).toBe(false);
    expect(isValidDiceExpression("")).toBe(false);
    expect(isValidDiceExpression("0d6")).toBe(false);
  });
});

describe("rollDice", () => {
  it("produces deterministic results with same RNG state", () => {
    const rng1 = createRNG(12345);
    const rng2 = createRNG(12345);

    const result1 = rollDice("2d6+3", rng1);
    const result2 = rollDice("2d6+3", rng2);

    expect(result1).toEqual(result2);
  });

  it("returns correct structure", () => {
    const rng = createRNG(42);
    const result = rollDice("2d6+3", rng);

    expect(result.expression).toBe("2d6+3");
    expect(result.rolls).toHaveLength(2);
    expect(result.modifier).toBe(3);
    expect(result.natural).toBe(result.rolls[0] + result.rolls[1]);
    expect(result.total).toBe(result.natural + result.modifier);
  });

  it("rolls are within die range", () => {
    const rng = createRNG(42);

    for (let i = 0; i < 100; i++) {
      const result = rollDice("1d6", rng);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(6);
    }
  });

  it("applies ability modifier", () => {
    const rng = createRNG(42);
    const abilities = { STR: 2, AGI: 1, WIT: 0, CON: -1 };

    const result = rollDice("d20+STR", rng, abilities);
    expect(result.modifier).toBe(2);
  });

  // Critical detection is intentionally NOT a dice-layer concern — it
  // depends on a world's CriticalsConfig and lives at the resolution
  // layer. See resolveTest / resolveAttack tests for crit coverage.
});

describe("rollDie", () => {
  it("returns values in range", () => {
    const rng = createRNG(42);
    for (let i = 0; i < 100; i++) {
      const result = rollDie(6, rng);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });
});

describe("rollNd", () => {
  it("sums multiple dice", () => {
    const rng = createRNG(42);
    const result = rollNd(3, 6, rng);

    // 3d6 should be between 3 and 18
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(18);
  });
});
