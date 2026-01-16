/**
 * @file Service for computing similarity and distance metrics between prototypes.
 * Extracted from PrototypeFitRankingService for single responsibility.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} DistanceDistribution
 * @property {number} mean - Mean of nearest-neighbor distances
 * @property {number} std - Standard deviation of distances
 * @property {number[]} sortedDistances - Sorted array of nearest-neighbor distances
 */

/**
 * Service for computing similarity and distance metrics between prototypes.
 * Handles cosine similarity, Euclidean weight distances, combined distances,
 * distance distribution caching, percentile and z-score calculations.
 */
class PrototypeSimilarityMetrics {
  /** @type {import('./PrototypeGateChecker.js').default} */
  #prototypeGateChecker;

  /** @type {Map<string, DistanceDistribution|null>} */
  #distanceDistributionCache;

  /**
   * @param {object} deps
   * @param {object} deps.logger - Logger instance (used for validation context)
   * @param {object} deps.prototypeGateChecker - Gate checker for distance computation
   */
  constructor({ logger, prototypeGateChecker }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(prototypeGateChecker, 'IPrototypeGateChecker', logger, {
      requiredMethods: ['buildGateConstraints', 'computeGateDistance'],
    });

    this.#prototypeGateChecker = prototypeGateChecker;
    this.#distanceDistributionCache = new Map();
  }

  /**
   * Computes cosine similarity between a target signature and prototype weights.
   *
   * @param {Map<string, {direction: number, importance: number}>} targetSignature - Target axis signature
   * @param {Object<string, number>} protoWeights - Prototype weights by axis
   * @returns {number} Cosine similarity in range [-1, 1]
   */
  computeCosineSimilarity(targetSignature, protoWeights) {
    const allAxes = new Set([...targetSignature.keys(), ...Object.keys(protoWeights)]);

    let dot = 0;
    let targetMag = 0;
    let protoMag = 0;

    for (const axis of allAxes) {
      const entry = targetSignature.get(axis);
      const t = entry ? entry.direction * entry.importance : 0;
      const p = protoWeights[axis] || 0;

      dot += t * p;
      targetMag += t * t;
      protoMag += p * p;
    }

    const mag = Math.sqrt(targetMag) * Math.sqrt(protoMag);
    return mag === 0 ? 0 : dot / mag;
  }

  /**
   * Computes normalized Euclidean distance between two weight vectors.
   *
   * @param {Object<string, number>} desiredWeights - Desired weights by axis
   * @param {Object<string, number>} protoWeights - Prototype weights by axis
   * @returns {number} Normalized Euclidean distance
   */
  computeWeightDistance(desiredWeights, protoWeights) {
    const allAxes = new Set([...Object.keys(desiredWeights), ...Object.keys(protoWeights)]);

    let sumSquares = 0;
    for (const axis of allAxes) {
      const desired = desiredWeights[axis] || 0;
      const proto = protoWeights[axis] || 0;
      sumSquares += Math.pow(desired - proto, 2);
    }

    // Normalize by number of axes
    return allAxes.size > 0 ? Math.sqrt(sumSquares / allAxes.size) : 0;
  }

  /**
   * Computes combined distance between two prototypes using bidirectional gate distance.
   * Uses weighting: 0.7 * weightDistance + 0.3 * gateDistance
   *
   * @param {Object} protoA - First prototype with weights and gates
   * @param {Object} protoB - Second prototype with weights and gates
   * @returns {number} Combined distance
   */
  computeCombinedDistance(protoA, protoB) {
    const weightDist = this.computeWeightDistance(protoA.weights || {}, protoB.weights || {});
    const gatesA = this.#prototypeGateChecker.buildGateConstraints(protoA.gates);
    const gatesB = this.#prototypeGateChecker.buildGateConstraints(protoB.gates);
    const gateDistAB = this.#prototypeGateChecker.computeGateDistance(gatesA, protoB.gates);
    const gateDistBA = this.#prototypeGateChecker.computeGateDistance(gatesB, protoA.gates);
    const gateDist = (gateDistAB + gateDistBA) / 2;

    return 0.7 * weightDist + 0.3 * gateDist;
  }

  /**
   * Gets or computes distance distribution for a set of prototypes.
   * Computes nearest-neighbor distances between all prototype pairs.
   *
   * @param {string} cacheKey - Cache key for distribution
   * @param {Object[]} prototypes - Array of prototypes with weights and gates
   * @returns {DistanceDistribution|null} Distribution stats or null if insufficient prototypes
   */
  getDistanceDistribution(cacheKey, prototypes) {
    if (this.#distanceDistributionCache.has(cacheKey)) {
      return this.#distanceDistributionCache.get(cacheKey);
    }

    if (!prototypes || prototypes.length < 2) {
      this.#distanceDistributionCache.set(cacheKey, null);
      return null;
    }

    const nearestDistances = [];

    for (let i = 0; i < prototypes.length; i++) {
      let nearest = Infinity;
      for (let j = 0; j < prototypes.length; j++) {
        if (i === j) continue;
        const dist = this.computeCombinedDistance(prototypes[i], prototypes[j]);
        if (dist < nearest) {
          nearest = dist;
        }
      }
      nearestDistances.push(nearest);
    }

    const sortedDistances = [...nearestDistances].sort((a, b) => a - b);
    const mean = sortedDistances.reduce((sum, value) => sum + value, 0) / sortedDistances.length;
    const variance = sortedDistances.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0)
      / sortedDistances.length;
    const std = Math.sqrt(variance);

    const stats = { mean, std, sortedDistances };
    this.#distanceDistributionCache.set(cacheKey, stats);
    return stats;
  }

  /**
   * Builds a cache key based on type detection flags.
   *
   * @param {Object} typesToFetch - Type detection flags
   * @param {boolean} [typesToFetch.hasEmotions] - Whether emotions are included
   * @param {boolean} [typesToFetch.hasSexualStates] - Whether sexual states are included
   * @returns {string} Cache key string
   */
  buildDistanceStatsCacheKey(typesToFetch) {
    const emotions = typesToFetch?.hasEmotions ? 'emotion' : 'no-emotion';
    const sexual = typesToFetch?.hasSexualStates ? 'sexual' : 'no-sexual';
    return `${emotions}|${sexual}`;
  }

  /**
   * Computes percentile rank of a distance value within sorted distances.
   *
   * @param {number[]} sortedDistances - Sorted array of distances
   * @param {number} value - Distance value to rank
   * @returns {number} Percentile as ratio (0-1)
   */
  computeDistancePercentile(sortedDistances, value) {
    if (!sortedDistances || sortedDistances.length === 0) {
      return 0;
    }

    let count = 0;
    for (const dist of sortedDistances) {
      if (value >= dist) {
        count++;
      } else {
        break;
      }
    }

    return count / sortedDistances.length;
  }

  /**
   * Computes z-score for a distance value.
   *
   * @param {number} mean - Distribution mean
   * @param {number} std - Distribution standard deviation
   * @param {number} value - Distance value
   * @returns {number} Z-score (0 if std <= 0)
   */
  computeDistanceZScore(mean, std, value) {
    if (std <= 0) {
      return 0;
    }

    return (value - mean) / std;
  }

  /**
   * Builds a human-readable distance context string.
   *
   * @param {number} distance - The distance value
   * @param {number|null} percentile - Percentile rank (0-1) or null
   * @param {number|null} zScore - Z-score or null
   * @returns {string|null} Formatted context string or null if no percentile
   */
  buildDistanceContext(distance, percentile, zScore) {
    if (percentile === null || percentile === undefined) {
      return null;
    }

    const percentileLabel = Math.round(percentile * 100);
    let context = `Distance ${distance.toFixed(2)} is farther than ${percentileLabel}% of prototype nearest-neighbor distances`;

    if (typeof zScore === 'number') {
      context += ` (z=${zScore.toFixed(2)})`;
    }

    return `${context}.`;
  }

  /**
   * Clears the distance distribution cache.
   */
  clearCache() {
    this.#distanceDistributionCache.clear();
  }
}

export default PrototypeSimilarityMetrics;
