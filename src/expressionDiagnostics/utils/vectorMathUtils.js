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
