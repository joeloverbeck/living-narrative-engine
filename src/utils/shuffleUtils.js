/**
 * @file Shuffle utilities for array randomization
 * @description Provides Fisher-Yates shuffle algorithm with optional seeding for testability.
 * @see specs/randomized-turn-ordering.md
 */

/**
 * Fisher-Yates shuffle algorithm (in-place, modifies array)
 *
 * @param {Array} array - Array to shuffle
 * @param {function(): number} [randomFn=Math.random] - Random function returning [0, 1)
 * @returns {Array} The same array reference, shuffled
 */
export function shuffleInPlace(array, randomFn = Math.random) {
  if (!Array.isArray(array)) {
    return array;
  }

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/**
 * Creates a new shuffled copy of an array (does not modify original)
 *
 * @param {Array} array - Array to shuffle
 * @param {function(): number} [randomFn=Math.random] - Random function returning [0, 1)
 * @returns {Array} New shuffled array
 */
export function shuffle(array, randomFn = Math.random) {
  if (!Array.isArray(array)) {
    return array;
  }

  return shuffleInPlace([...array], randomFn);
}

/**
 * Creates a seeded random number generator for deterministic testing.
 * Uses a simple Linear Congruential Generator (LCG) with glibc constants.
 *
 * @param {number} seed - Seed value (will be coerced to integer)
 * @returns {function(): number} Seeded random function returning [0, 1)
 */
export function createSeededRandom(seed) {
  // Ensure seed is a valid integer
  let state = Math.floor(seed) || 1;

  return function seededRandom() {
    // LCG constants (same as glibc)
    // state = (state * a + c) mod m
    // a = 1103515245, c = 12345, m = 2^31
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}
