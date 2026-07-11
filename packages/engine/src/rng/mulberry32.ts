/**
 * Mulberry32 PRNG algorithm
 *
 * A simple and fast 32-bit PRNG with good statistical properties.
 * Produces deterministic sequences from a seed.
 */

/**
 * Create a Mulberry32 generator function
 * @param seed - Initial seed value
 * @returns Generator function that returns floats in [0, 1)
 */
export function mulberry32(seed: number): () => number {
  // Use a mutable closure for the state
  let state = seed;

  return function next(): number {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
