/**
 * High-level RNG interface
 */

import type { RNGState } from "@mythxengine/types";
import { mulberry32 } from "./mulberry32.js";

/**
 * Random number generator interface
 */
export interface RNG {
  /** Get next float [0, 1) */
  next(): number;

  /** Get integer in range [min, max] inclusive */
  nextInt(min: number, max: number): number;

  /** Get boolean with probability */
  nextBool(probability?: number): boolean;

  /** Pick random element from array */
  pick<T>(array: readonly T[]): T;

  /** Shuffle array (returns new array) */
  shuffle<T>(array: readonly T[]): T[];

  /** Get current state for persistence */
  getState(): RNGState;
}

/**
 * Create an RNG instance from seed or state
 */
export function createRNG(seedOrState: number | RNGState): RNG {
  const state: RNGState =
    typeof seedOrState === "number" ? { seed: seedOrState, cursor: 0 } : { ...seedOrState };

  // Create generator and advance to cursor position
  const generator = mulberry32(state.seed);

  // Advance to current cursor position
  for (let i = 0; i < state.cursor; i++) {
    generator();
  }

  return {
    next(): number {
      state.cursor++;
      return generator();
    },

    nextInt(min: number, max: number): number {
      const range = max - min + 1;
      return Math.floor(this.next() * range) + min;
    },

    nextBool(probability = 0.5): boolean {
      return this.next() < probability;
    },

    pick<T>(array: readonly T[]): T {
      if (array.length === 0) {
        throw new Error("Cannot pick from empty array");
      }
      const index = this.nextInt(0, array.length - 1);
      return array[index];
    },

    shuffle<T>(array: readonly T[]): T[] {
      const result = [...array];
      // Fisher-Yates shuffle
      for (let i = result.length - 1; i > 0; i--) {
        const j = this.nextInt(0, i);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },

    getState(): RNGState {
      return { ...state };
    },
  };
}
