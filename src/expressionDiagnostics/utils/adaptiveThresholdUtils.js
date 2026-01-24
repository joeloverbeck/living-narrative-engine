/**
 * @file Adaptive threshold utility functions for axis gap analysis.
 * @description Pure functions for adaptive threshold computation with seeded RNG.
 */

import {
  normalizeVector,
  getAxisUnitVectors,
  computeNearestAxisDistance,
} from './vectorMathUtils.js';
import { computePercentile } from './statisticalUtils.js';

/**
 * Create a seeded pseudo-random number generator using Linear Congruential Generator.
 *
 * @param {number} seed - Initial seed value.
 * @returns {function(): number} Function that returns next random number in [0, 1).
 */
export function createSeededRNG(seed) {
  let state = Number.isFinite(seed) ? seed : 42;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm with provided RNG.
 *
 * @param {Array} array - Array to shuffle.
 * @param {function(): number} nextRandom - RNG function returning [0, 1).
 * @returns {Array} The shuffled array (same reference, mutated in place).
 */
export function fisherYatesShuffle(array, nextRandom) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Compute a cache key for adaptive threshold results.
 *
 * @param {Array<{id?: string, prototypeId?: string}>} prototypes - Prototype objects.
 * @param {number} seed - RNG seed.
 * @returns {string} Cache key string.
 */
export function computeAdaptiveThresholdCacheKey(prototypes, seed) {
  if (!Array.isArray(prototypes)) {
    return `|${seed}|0`;
  }
  const ids = prototypes
    .map((p) => p?.id ?? p?.prototypeId ?? '')
    .sort()
    .join(',');
  return `${ids}|${seed}|${prototypes.length}`;
}

/**
 * Collect all weight values from prototypes for a given set of axes.
 *
 * @param {Array<{weights?: Record<string, number>}>} prototypes - Prototype objects.
 * @param {string[]} axes - Array of axis names.
 * @returns {number[]} Array of weight values (0 for missing/invalid).
 */
export function collectWeightsForAxes(prototypes, axes) {
  const allWeights = [];
  for (const prototype of prototypes) {
    const weights = prototype?.weights ?? {};
    for (const axis of axes) {
      const value = weights[axis];
      allWeights.push(Number.isFinite(value) ? value : 0);
    }
  }
  return allWeights;
}

/**
 * Compute adaptive distance threshold based on null distribution.
 * Shuffles weights across axes to create a null baseline and returns
 * the specified percentile of the resulting distances.
 *
 * @param {object} params - Parameters object.
 * @param {Array<{weights?: Record<string, number>}>} params.prototypes - Prototype objects.
 * @param {string[]} params.axes - Array of axis names.
 * @param {number} [params.iterations] - Number of shuffle iterations (default: 100).
 * @param {number} [params.percentile] - Percentile for threshold, 0-100 (default: 95).
 * @param {number} [params.seed] - RNG seed for reproducibility (default: 42).
 * @returns {number|null} Adaptive threshold or null if cannot compute.
 */
export function computeAdaptiveDistanceThreshold({
  prototypes,
  axes,
  iterations = 100,
  percentile = 95,
  seed = 42,
}) {
  // Validate inputs
  if (!Array.isArray(prototypes) || prototypes.length < 10) {
    return null;
  }
  if (!Array.isArray(axes) || axes.length === 0) {
    return null;
  }

  // Clamp configuration values
  const iterCount = Math.max(10, Math.min(1000, iterations));
  const pct = Math.max(0, Math.min(100, percentile));

  // Initialize seeded RNG
  const nextRandom = createSeededRNG(seed);

  // Build axis unit vectors
  const axisUnitVectors = getAxisUnitVectors(axes);

  // Collect all weight values for shuffling
  const allWeights = collectWeightsForAxes(prototypes, axes);

  // Generate null distribution
  const nullDistances = [];

  for (let iter = 0; iter < iterCount; iter++) {
    // Shuffle weights using Fisher-Yates
    const shuffled = allWeights.slice();
    fisherYatesShuffle(shuffled, nextRandom);

    // Reconstruct shuffled prototypes and compute distances
    let weightIdx = 0;
    for (let pIdx = 0; pIdx < prototypes.length; pIdx++) {
      const shuffledVector = {};
      for (const axis of axes) {
        shuffledVector[axis] = shuffled[weightIdx++];
      }

      const normalized = normalizeVector(shuffledVector);
      if (normalized) {
        const distance = computeNearestAxisDistance(normalized, axisUnitVectors);
        if (Number.isFinite(distance)) {
          nullDistances.push(distance);
        }
      }
    }
  }

  if (nullDistances.length === 0) {
    return null;
  }

  // Compute percentile
  nullDistances.sort((a, b) => a - b);
  return computePercentile(nullDistances, pct);
}
