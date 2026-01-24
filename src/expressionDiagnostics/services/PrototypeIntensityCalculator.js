/**
 * @file Intensity and scoring calculations for prototype fit analysis.
 * Extracted from PrototypeFitRankingService to enforce Single Responsibility Principle.
 */

import { resolveAxisValue } from '../utils/axisNormalizationUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

// Composite score weights
const WEIGHT_GATE_PASS = 0.3;
const WEIGHT_INTENSITY = 0.35;
const WEIGHT_CONFLICT = 0.2;
const WEIGHT_EXCLUSION = 0.15;

/**
 * @typedef {Object} IntensityDistribution
 * @property {number} p50 - Median intensity
 * @property {number} p90 - 90th percentile
 * @property {number} p95 - 95th percentile
 * @property {number} pAboveThreshold - Proportion above threshold
 * @property {number|null} min - Minimum intensity
 * @property {number|null} max - Maximum intensity
 */

/**
 * @typedef {Object} ConflictAnalysis
 * @property {number} score - Conflict score (0-1)
 * @property {number} magnitude - Sum of conflicting weight magnitudes
 * @property {Array<{axis: string, weight: number, direction: string}>} axes - Conflicting axes
 */

/**
 * Calculates intensity and scoring metrics for prototype fit analysis.
 */
class PrototypeIntensityCalculator {
  #logger;
  #contextAxisNormalizer;
  #prototypeGateChecker;

  /**
   * @param {object} deps
   * @param {object} deps.logger - ILogger instance
   * @param {object} deps.contextAxisNormalizer - IContextAxisNormalizer instance
   * @param {object} deps.prototypeGateChecker - IPrototypeGateChecker instance
   */
  constructor({ logger, contextAxisNormalizer, prototypeGateChecker }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(contextAxisNormalizer, 'IContextAxisNormalizer', logger, {
      requiredMethods: ['getNormalizedAxes'],
    });
    validateDependency(prototypeGateChecker, 'IPrototypeGateChecker', logger, {
      requiredMethods: ['checkAllGatesPass'],
    });
    this.#logger = logger;
    this.#contextAxisNormalizer = contextAxisNormalizer;
    this.#prototypeGateChecker = prototypeGateChecker;
  }

  /**
   * Compute intensity distribution for a prototype.
   * @param {{weights: object, gates: string[]}} proto - Prototype definition
   * @param {Array<object>} contexts - Array of contexts
   * @param {number} threshold - Intensity threshold
   * @returns {IntensityDistribution}
   */
  computeDistribution(proto, contexts, threshold) {
    if (!contexts || contexts.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        pAboveThreshold: 0,
        min: null,
        max: null,
      };
    }

    // Filter to contexts where gates pass
    const gatePassContexts = contexts.filter((ctx) =>
      this.#prototypeGateChecker.checkAllGatesPass(proto.gates || [], ctx)
    );

    if (gatePassContexts.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        pAboveThreshold: 0,
        min: null,
        max: null,
      };
    }

    // Compute intensity for each context
    const intensities = gatePassContexts.map((ctx) =>
      this.computeIntensity(proto.weights, ctx)
    );

    intensities.sort((a, b) => a - b);

    const p50 = this.percentile(intensities, 0.5);
    const p90 = this.percentile(intensities, 0.9);
    const p95 = this.percentile(intensities, 0.95);
    const min = intensities[0];
    const max = intensities[intensities.length - 1];

    const aboveCount = intensities.filter((i) => i >= threshold).length;
    const pAboveThreshold = aboveCount / intensities.length;

    return { p50, p90, p95, pAboveThreshold, min, max };
  }

  /**
   * Compute emotion intensity from weights and context.
   * @param {object} weights - Axis weights
   * @param {object} ctx - Context object
   * @param {object} [options] - Computation options
   * @param {boolean} [options.strict=false] - If true, throws on missing axes
   * @returns {number} Normalized intensity in [0, 1]
   * @throws {Error} If strict=true and any weighted axis is missing from context
   */
  computeIntensity(weights, ctx, options = {}) {
    const { strict = false } = options;
    const normalized = this.#contextAxisNormalizer.getNormalizedAxes(ctx);

    // Validate all axes are present before computing (in strict mode)
    if (strict) {
      const missingAxes = [];
      for (const axis of Object.keys(weights)) {
        const resolved = axis === 'SA' ? 'sexual_arousal' : axis;
        const found =
          Object.prototype.hasOwnProperty.call(normalized.traitAxes, resolved) ||
          Object.prototype.hasOwnProperty.call(normalized.sexualAxes, resolved) ||
          Object.prototype.hasOwnProperty.call(normalized.moodAxes, resolved);
        if (!found) missingAxes.push(resolved);
      }

      if (missingAxes.length > 0) {
        throw new Error(
          `[PrototypeIntensityCalculator] Missing axes: [${missingAxes.join(', ')}]. ` +
            `Available mood: [${Object.keys(normalized.moodAxes).join(', ')}]. ` +
            `Available sexual: [${Object.keys(normalized.sexualAxes).join(', ')}]. ` +
            `Available traits: [${Object.keys(normalized.traitAxes).join(', ')}].`
        );
      }
    }

    let rawSum = 0;
    let sumAbsWeights = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const value = resolveAxisValue(
        axis,
        normalized.moodAxes,
        normalized.sexualAxes,
        normalized.traitAxes
      );
      rawSum += weight * value;
      sumAbsWeights += Math.abs(weight);
    }

    if (sumAbsWeights === 0) return 0;
    return Math.max(0, Math.min(1, rawSum / sumAbsWeights));
  }

  /**
   * Compute emotion intensity from weights using pre-normalized axes.
   * This is the optimized hot path for batch evaluation.
   *
   * @param {object} weights - Axis weights.
   * @param {{moodAxes: object, sexualAxes: object, traitAxes: object}} normalizedAxes - Pre-normalized context axes.
   * @returns {number} Normalized intensity in [0, 1].
   */
  computeIntensityFromNormalized(weights, normalizedAxes) {
    let rawSum = 0;
    let sumAbsWeights = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const value = resolveAxisValue(
        axis,
        normalizedAxes.moodAxes,
        normalizedAxes.sexualAxes,
        normalizedAxes.traitAxes
      );
      rawSum += weight * value;
      sumAbsWeights += Math.abs(weight);
    }

    if (sumAbsWeights === 0) return 0;
    return Math.max(0, Math.min(1, rawSum / sumAbsWeights));
  }

  /**
   * Compute percentile from sorted array.
   * @param {number[]} sortedArr - Sorted array of values
   * @param {number} p - Percentile (0-1)
   * @returns {number}
   */
  percentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    const idx = Math.floor(p * (sortedArr.length - 1));
    return sortedArr[idx];
  }

  /**
   * Analyze conflicts between prototype weights and axis constraints.
   * @param {object} weights - Prototype weights
   * @param {Map<string, {min: number, max: number}>} constraints - Axis constraints
   * @returns {ConflictAnalysis}
   */
  analyzeConflicts(weights, constraints) {
    if (!constraints || constraints.size === 0) {
      return { score: 0, magnitude: 0, axes: [] };
    }

    const conflictingAxes = [];
    let conflictMagnitude = 0;

    for (const [axis, constraint] of constraints) {
      const weight = weights[axis];
      if (weight === undefined || weight === 0) continue;

      // Determine constraint direction
      const constraintMidpoint = (constraint.min + constraint.max) / 2;
      const constraintDirection = constraintMidpoint >= 0 ? 1 : -1;

      // Check for conflict
      const weightDirection = weight > 0 ? 1 : -1;
      if (weightDirection !== constraintDirection) {
        conflictingAxes.push({
          axis,
          weight,
          direction: weightDirection > 0 ? 'positive' : 'negative',
        });
        conflictMagnitude += Math.abs(weight);
      }
    }

    const constrainedCount = constraints.size;
    const score = constrainedCount > 0 ? conflictingAxes.length / constrainedCount : 0;

    return { score, magnitude: conflictMagnitude, axes: conflictingAxes };
  }

  /**
   * Compute composite score for ranking.
   * @param {{gatePassRate: number, pIntensityAbove: number, conflictScore: number, exclusionCompatibility: number}} params
   * @returns {number}
   */
  computeCompositeScore({ gatePassRate, pIntensityAbove, conflictScore, exclusionCompatibility }) {
    return (
      WEIGHT_GATE_PASS * gatePassRate +
      WEIGHT_INTENSITY * pIntensityAbove +
      WEIGHT_CONFLICT * (1 - conflictScore) +
      WEIGHT_EXCLUSION * exclusionCompatibility
    );
  }

  /**
   * Get scoring weight constants (for testing/debugging).
   * @returns {{gatePass: number, intensity: number, conflict: number, exclusion: number}}
   */
  getScoringWeights() {
    return {
      gatePass: WEIGHT_GATE_PASS,
      intensity: WEIGHT_INTENSITY,
      conflict: WEIGHT_CONFLICT,
      exclusion: WEIGHT_EXCLUSION,
    };
  }
}

export default PrototypeIntensityCalculator;
