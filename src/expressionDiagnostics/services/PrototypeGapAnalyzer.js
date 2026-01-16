/**
 * @file Gap detection and prototype synthesis for filling coverage gaps
 * @description Extracted from PrototypeFitRankingService as part of PROFITRANSERREFPLA-014
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

// Gap detection constants
const GAP_DISTANCE_THRESHOLD = 0.5;
const GAP_INTENSITY_THRESHOLD = 0.3;
const K_NEIGHBORS = 5;

/**
 * @typedef {Object} TargetSignatureEntry
 * @property {number} direction - Direction indicator (-1, 0, 1)
 * @property {number} tightness - Constraint range tightness (0-1)
 * @property {number} lastMileWeight - Weight from clause failures
 * @property {number} importance - Combined importance score
 */

/**
 * @typedef {Object} SynthesizedPrototype
 * @property {Object<string, number>} weights - Synthesized axis weights
 * @property {string[]} gates - Gates derived from constraints
 * @property {string} rationale - Explanation of synthesis method
 */

/**
 * Handles gap detection and prototype synthesis for expression diagnostics.
 * Builds target signatures from constraints, identifies k-nearest neighbors,
 * detects gaps in prototype coverage, and synthesizes new prototypes to fill gaps.
 */
class PrototypeGapAnalyzer {
  #prototypeRegistryService;

  /**
   * @param {Object} deps
   * @param {Object} deps.logger - ILogger instance
   * @param {Object} deps.prototypeSimilarityMetrics - IPrototypeSimilarityMetrics instance
   * @param {Object} deps.prototypeGateChecker - IPrototypeGateChecker instance
   * @param {Object} deps.prototypeRegistryService - IPrototypeRegistryService instance
   */
  constructor({
    logger,
    prototypeSimilarityMetrics,
    prototypeGateChecker,
    prototypeRegistryService,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(
      prototypeSimilarityMetrics,
      'IPrototypeSimilarityMetrics',
      logger,
      {
        requiredMethods: ['computeWeightDistance', 'computeCosineSimilarity'],
      }
    );
    validateDependency(prototypeGateChecker, 'IPrototypeGateChecker', logger, {
      requiredMethods: ['inferGatesFromConstraints'],
    });
    validateDependency(
      prototypeRegistryService,
      'IPrototypeRegistryService',
      logger,
      {
        requiredMethods: ['getAllPrototypes'],
      }
    );

    this.#prototypeRegistryService = prototypeRegistryService;
  }

  /**
   * Build target signature from constraints and failures.
   *
   * @param {Map<string, {min: number, max: number}>} constraints - Axis constraints
   * @param {Array<Object>} clauseFailures - Clause failures for last-mile weighting
   * @returns {Map<string, TargetSignatureEntry>} Target signature map
   */
  buildTargetSignature(constraints, clauseFailures) {
    const signature = new Map();

    if (!constraints || constraints.size === 0) {
      return signature;
    }

    for (const [axis, constraint] of constraints) {
      const direction = this.#inferDirection(constraint);
      const tightness = this.#computeTightness(constraint);
      const lastMileWeight = this.#getLastMileWeightForAxis(
        axis,
        clauseFailures
      );
      const importance = 0.5 * tightness + 0.5 * lastMileWeight;

      signature.set(axis, { direction, tightness, lastMileWeight, importance });
    }

    return signature;
  }

  /**
   * Convert target signature to weight vector.
   *
   * @param {Map<string, TargetSignatureEntry>} targetSignature - Target signature
   * @returns {Object<string, number>} Weight vector
   */
  targetSignatureToWeights(targetSignature) {
    const weights = {};
    for (const [axis, entry] of targetSignature) {
      weights[axis] = entry.direction * entry.importance;
    }
    return weights;
  }

  /**
   * Detect if gap exists based on nearest distance and intensity.
   *
   * @param {number} nearestDistance - Distance to nearest prototype
   * @param {number} bestIntensityRate - Best intensity rate among neighbors
   * @returns {boolean} True if gap detected
   */
  detectGap(nearestDistance, bestIntensityRate) {
    return (
      nearestDistance > GAP_DISTANCE_THRESHOLD &&
      bestIntensityRate < GAP_INTENSITY_THRESHOLD
    );
  }

  /**
   * Synthesize new prototype from neighbors.
   *
   * @param {Array<Object>} kNearest - K nearest neighbors with distance info
   * @param {Object<string, number>} desiredWeights - Desired weight vector
   * @param {Map<string, {min: number, max: number}>} constraints - Axis constraints
   * @returns {SynthesizedPrototype} Synthesized prototype
   */
  synthesizePrototype(kNearest, desiredWeights, constraints) {
    const weights = {};
    let totalWeight = 0;

    // Distance-weighted average of neighbors
    for (const neighbor of kNearest) {
      const w = 1 / (neighbor.combinedDistance + 0.01);
      totalWeight += w;

      const proto = this.#prototypeRegistryService
        .getAllPrototypes()
        .find((p) => p.id === neighbor.prototypeId);
      if (proto) {
        for (const [axis, value] of Object.entries(proto.weights)) {
          weights[axis] = (weights[axis] || 0) + value * w;
        }
      }
    }

    // Normalize
    for (const axis of Object.keys(weights)) {
      weights[axis] /= totalWeight;
    }

    // Derive gates from constraints
    const gates = [];
    for (const [axis, constraint] of constraints) {
      if (constraint.min > -1) {
        gates.push(`${axis} >= ${constraint.min.toFixed(2)}`);
      }
      if (constraint.max < 1) {
        gates.push(`${axis} <= ${constraint.max.toFixed(2)}`);
      }
    }

    return {
      weights,
      gates,
      rationale: `Synthesized from ${kNearest.length} nearest neighbors using distance-weighted averaging`,
    };
  }

  /**
   * Get gap detection thresholds for testing and debugging.
   *
   * @returns {{distance: number, intensity: number, k: number}} Threshold values
   */
  getThresholds() {
    return {
      distance: GAP_DISTANCE_THRESHOLD,
      intensity: GAP_INTENSITY_THRESHOLD,
      k: K_NEIGHBORS,
    };
  }

  /**
   * Get the k-neighbors constant value.
   *
   * @returns {number} K neighbors value
   */
  getKNeighbors() {
    return K_NEIGHBORS;
  }

  /**
   * Infer direction from constraint midpoint.
   *
   * @private
   * @param {{min: number, max: number}} constraint - Constraint bounds
   * @returns {number} Direction: 1 (positive), -1 (negative), or 0 (neutral)
   */
  #inferDirection(constraint) {
    const mid = (constraint.min + constraint.max) / 2;
    if (mid > 0.1) return 1;
    if (mid < -0.1) return -1;
    return 0;
  }

  /**
   * Compute tightness of constraint range.
   *
   * @private
   * @param {{min: number, max: number}} constraint - Constraint bounds
   * @returns {number} Tightness value (0-1)
   */
  #computeTightness(constraint) {
    const range = constraint.max - constraint.min;
    // Full range is 2 (-1 to 1), so normalize
    return Math.max(0, 1 - range / 2);
  }

  /**
   * Get last-mile weight for an axis based on clause failures.
   *
   * @private
   * @param {string} axis - Axis name
   * @param {Array<Object>} clauseFailures - Array of clause failure objects
   * @returns {number} Weight value (default 0.5)
   */
  #getLastMileWeightForAxis(axis, clauseFailures) {
    if (!clauseFailures || clauseFailures.length === 0) return 0.5;

    // Find failures mentioning this axis
    for (const failure of clauseFailures) {
      if (failure.clauseDescription && failure.clauseDescription.includes(axis)) {
        return failure.lastMileFailRate || 0.5;
      }
    }

    return 0.5;
  }
}

export default PrototypeGapAnalyzer;
