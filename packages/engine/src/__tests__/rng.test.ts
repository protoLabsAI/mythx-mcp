import { describe, it, expect } from "vitest";
import { createRNG, mulberry32 } from "../rng/index.js";

describe("mulberry32", () => {
  it("produces deterministic sequences from the same seed", () => {
    const gen1 = mulberry32(12345);
    const gen2 = mulberry32(12345);

    for (let i = 0; i < 100; i++) {
      expect(gen1()).toBe(gen2());
    }
  });

  it("produces different sequences from different seeds", () => {
    const gen1 = mulberry32(12345);
    const gen2 = mulberry32(54321);

    // At least one of the first 10 values should differ
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (gen1() !== gen2()) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });

  it("produces values in [0, 1)", () => {
    const gen = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const val = gen();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe("createRNG", () => {
  it("creates RNG from seed", () => {
    const rng = createRNG(12345);
    expect(rng.getState()).toEqual({ seed: 12345, cursor: 0 });
  });

  it("creates RNG from state", () => {
    const rng = createRNG({ seed: 12345, cursor: 10 });
    expect(rng.getState()).toEqual({ seed: 12345, cursor: 10 });
  });

  it("advances cursor on each call", () => {
    const rng = createRNG(12345);
    expect(rng.getState().cursor).toBe(0);

    rng.next();
    expect(rng.getState().cursor).toBe(1);

    rng.next();
    expect(rng.getState().cursor).toBe(2);
  });

  it("produces deterministic integers", () => {
    const rng1 = createRNG(12345);
    const rng2 = createRNG(12345);

    for (let i = 0; i < 100; i++) {
      expect(rng1.nextInt(1, 100)).toBe(rng2.nextInt(1, 100));
    }
  });

  it("nextInt produces values in range", () => {
    const rng = createRNG(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(5, 15);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(15);
    }
  });

  it("pick selects from array", () => {
    const rng = createRNG(42);
    const items = ["a", "b", "c", "d"];

    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("shuffle returns all elements", () => {
    const rng = createRNG(42);
    const items = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(items);

    expect(shuffled).toHaveLength(items.length);
    expect(shuffled.sort()).toEqual(items.sort());
  });

  it("restoring from state continues same sequence", () => {
    const rng1 = createRNG(12345);

    // Advance 10 times
    for (let i = 0; i < 10; i++) {
      rng1.next();
    }

    const state = rng1.getState();
    const expected = rng1.next();

    // Create new RNG from state
    const rng2 = createRNG(state);
    const actual = rng2.next();

    expect(actual).toBe(expected);
  });
});
