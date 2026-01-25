/**
 * @file Vector math utility functions for axis gap analysis.
 * @description Pure functions for vector operations used in prototype analysis.
 */

/**
 * Clamp a value to [0, 1] range.
 *
 * @param {number} value - Value to clamp.
 * @returns {number} Clamped value.
 */
export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Compute the L2 magnitude (Euclidean norm) of a vector.
 *
 * @param {Record<string, number>} vector - Object mapping keys to numeric values.
 * @returns {number} The vector magnitude.
 */
export function computeVectorMagnitude(vector) {
  if (!vector || typeof vector !== 'object') {
    return 0;
  }
  let sumSquares = 0;
  for (const key of Object.keys(vector)) {
    const value = Number.isFinite(vector[key]) ? vector[key] : 0;
    sumSquares += value * value;
  }
  return Math.sqrt(sumSquares);
}

/**
 * Normalize a vector to unit length.
 *
 * @param {Record<string, number>} vector - Vector to normalize.
 * @returns {Record<string, number>|null} Normalized vector or null if zero-length.
 */
export function normalizeVector(vector) {
  if (!vector || typeof vector !== 'object') {
    return null;
  }
  const keys = Object.keys(vector);
  let magnitude = 0;
  for (const key of keys) {
    const value = Number.isFinite(vector[key]) ? vector[key] : 0;
    magnitude += value * value;
  }
  magnitude = Math.sqrt(magnitude);
  if (magnitude === 0) {
    return null;
  }
  const normalized = {};
  for (const key of keys) {
    const value = Number.isFinite(vector[key]) ? vector[key] : 0;
    normalized[key] = value / magnitude;
  }
  return normalized;
}

/**
 * Compute cosine distance between two vectors.
 *
 * @param {Record<string, number>} vecA - First vector.
 * @param {Record<string, number>} vecB - Second vector.
 * @param {{useAbsolute?: boolean}} [options] - Calculation options.
 * @returns {number} Cosine distance in [0, 1].
 */
export function computeCosineDistance(vecA, vecB, options = {}) {
  if (!vecA || !vecB) {
    return 1;
  }
  const keys = new Set([
    ...Object.keys(vecA || {}),
    ...Object.keys(vecB || {}),
  ]);
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const key of keys) {
    const a = Number.isFinite(vecA[key]) ? vecA[key] : 0;
    const b = Number.isFinite(vecB[key]) ? vecB[key] : 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA === 0 || magB === 0) {
    return 1;
  }

  const similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB));
  const adjusted = options.useAbsolute ? Math.abs(similarity) : similarity;
  const distance = 1 - adjusted;
  return clamp01(distance);
}

/**
 * Collect unique axis names from prototypes.
 *
 * @param {Array<{weights?: Record<string, number>}>} prototypes - Prototype objects.
 * @returns {string[]} Sorted array of unique axis names.
 */
export function collectAxes(prototypes) {
  const axes = new Set();
  if (!Array.isArray(prototypes)) {
    return [];
  }

  for (const prototype of prototypes) {
    const weights = prototype?.weights;
    if (!weights || typeof weights !== 'object') {
      continue;
    }
    for (const [axis, value] of Object.entries(weights)) {
      if (Number.isFinite(value)) {
        axes.add(axis);
      }
    }
  }

  return Array.from(axes).sort();
}

/**
 * Build a lookup map from prototype ID to prototype.
 *
 * @param {Array<{id?: string, prototypeId?: string}>} prototypes - Prototype objects.
 * @returns {Map<string, object>} Lookup map.
 */
export function buildPrototypeLookup(prototypes) {
  const lookup = new Map();
  if (!Array.isArray(prototypes)) {
    return lookup;
  }

  for (const prototype of prototypes) {
    const id = prototype?.id ?? prototype?.prototypeId ?? null;
    if (id) {
      lookup.set(id, prototype);
    }
  }

  return lookup;
}

/**
 * Get axis unit vectors for a set of axes.
 * Each unit vector has 1 for its corresponding axis and 0 for all others.
 *
 * @param {string[]} axes - Array of axis names.
 * @returns {Map<string, Record<string, number>>} Map of axis name to unit vector.
 */
export function getAxisUnitVectors(axes) {
  const vectors = new Map();
  for (const axis of axes) {
    const vec = {};
    for (const axisName of axes) {
      vec[axisName] = axisName === axis ? 1 : 0;
    }
    vectors.set(axis, vec);
  }
  return vectors;
}

/**
 * Compute the nearest axis distance for a vector.
 *
 * @param {Record<string, number>} vector - Normalized vector.
 * @param {Map<string, Record<string, number>>} axisUnitVectors - Unit vectors for axes.
 * @returns {number} Minimum distance to any axis.
 */
export function computeNearestAxisDistance(vector, axisUnitVectors) {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const axisVector of axisUnitVectors.values()) {
    const distance = computeCosineDistance(vector, axisVector, {
      useAbsolute: true,
    });
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  return Number.isFinite(minDistance) ? minDistance : 1;
}

/**
 * Generate all k-combinations from an array.
 *
 * @param {string[]} arr - Array of elements to combine.
 * @param {number} k - Size of each combination.
 * @returns {string[][]} Array of k-element combinations.
 */
export function generateCombinations(arr, k) {
  if (k < 0 || k > arr.length) {
    return [];
  }
  if (k === 0) {
    return [[]];
  }
  if (k === arr.length) {
    return [arr.slice()];
  }

  const result = [];

  /**
   * Recursive helper for generating combinations.
   *
   * @param {number} start - Start index in array.
   * @param {string[]} current - Current combination being built.
   */
  function combine(start, current) {
    if (current.length === k) {
      result.push(current.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combine(i + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return result;
}

/**
 * Project a vector onto a subspace defined by a set of axes.
 * The projection keeps only the components along the specified axes.
 *
 * @param {Record<string, number>} vector - Vector to project.
 * @param {string[]} subspaceAxes - Axes defining the subspace.
 * @returns {Record<string, number>|null} Projected vector (normalized) or null if zero.
 */
export function projectOntoSubspace(vector, subspaceAxes) {
  if (!vector || !Array.isArray(subspaceAxes) || subspaceAxes.length === 0) {
    return null;
  }

  const subspaceSet = new Set(subspaceAxes);
  const projected = {};

  // Keep only components in the subspace
  for (const axis of Object.keys(vector)) {
    projected[axis] = subspaceSet.has(axis)
      ? (Number.isFinite(vector[axis]) ? vector[axis] : 0)
      : 0;
  }

  // Normalize the projection
  return normalizeVector(projected);
}

/**
 * Compute distance from a vector to a k-axis subspace.
 * Returns the cosine distance between the vector and its projection onto the subspace.
 *
 * @param {Record<string, number>} vector - Normalized vector.
 * @param {string[]} subspaceAxes - Axes defining the subspace.
 * @returns {number} Cosine distance to subspace in [0, 1].
 */
export function computeSubspaceDistance(vector, subspaceAxes) {
  const projection = projectOntoSubspace(vector, subspaceAxes);
  if (!projection) {
    return 1;
  }
  return computeCosineDistance(vector, projection, { useAbsolute: true });
}

/**
 * Compute the nearest distance to any k-axis subspace.
 * Tests all C(n,k) combinations of axes and returns the minimum distance.
 *
 * For k=1, this is equivalent to computeNearestAxisDistance().
 * For k>1, it tests all k-axis subspace combinations.
 *
 * Computational complexity: O(C(n,k) * n) where n = number of axes.
 * For k=3 with 20 axes: C(20,3) = 1140 combinations.
 *
 * @param {Record<string, number>} vector - Normalized vector.
 * @param {string[]} axes - All available axis names.
 * @param {number} k - Subspace dimension (1, 2, or 3 typically).
 * @returns {{distance: number, subspaceAxes: string[]}} Minimum distance and the axes of the nearest subspace.
 */
export function computeNearestSubspaceDistance(vector, axes, k) {
  if (!vector || !Array.isArray(axes) || axes.length === 0) {
    return { distance: 1, subspaceAxes: [] };
  }

  const clampedK = Math.max(1, Math.min(k, axes.length));

  // Generate all k-combinations
  const combinations = generateCombinations(axes, clampedK);

  let minDistance = Number.POSITIVE_INFINITY;
  let nearestSubspace = [];

  for (const subspaceAxes of combinations) {
    const distance = computeSubspaceDistance(vector, subspaceAxes);
    if (distance < minDistance) {
      minDistance = distance;
      nearestSubspace = subspaceAxes;
    }
  }

  return {
    distance: Number.isFinite(minDistance) ? minDistance : 1,
    subspaceAxes: nearestSubspace,
  };
}

/**
 * Check if a vector is distant from all subspaces up to dimension maxK.
 * A vector is considered "in a gap" if it's distant from 1, 2, ..., maxK axis subspaces.
 *
 * @param {Record<string, number>} vector - Normalized vector.
 * @param {string[]} axes - All available axis names.
 * @param {Record<number, number>} thresholds - Map of k -> distance threshold.
 * @param {number} maxK - Maximum subspace dimension to test.
 * @returns {{isGap: boolean, distances: Record<number, {distance: number, subspaceAxes: string[]}>}} Gap status and distances.
 */
export function checkSubspaceGap(vector, axes, thresholds, maxK) {
  const distances = {};
  let isGap = true;

  for (let k = 1; k <= maxK; k++) {
    const result = computeNearestSubspaceDistance(vector, axes, k);
    distances[k] = result;

    const threshold = thresholds[k] ?? 0.5;
    if (result.distance < threshold) {
      // Vector is close to at least one k-subspace, not a gap
      isGap = false;
    }
  }

  return { isGap, distances };
}
