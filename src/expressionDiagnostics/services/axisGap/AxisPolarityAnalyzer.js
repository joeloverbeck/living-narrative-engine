/**
 * @file Analyzer for axis polarity coverage across prototypes.
 * @description Detects axes with imbalanced positive/negative weight distributions,
 * which may indicate underutilized semantic ranges or missing prototype coverage.
 */

import { getAxisCategory } from '../../../constants/prototypeAxisConstants.js';

/**
 * @typedef {object} PolarityStats
 * @property {number} positive - Count of prototypes with positive weights (>0)
 * @property {number} negative - Count of prototypes with negative weights (<0)
 * @property {number} zero - Count of prototypes with zero/undefined weights
 * @property {number} total - Total prototypes using this axis (positive + negative)
 * @property {number} ratio - Ratio of dominant direction (0.5 = balanced, 1.0 = all one direction)
 * @property {'positive'|'negative'|'balanced'} dominantDirection - Which direction dominates
 */

/**
 * @typedef {object} ImbalancedAxis
 * @property {string} axis - The axis name
 * @property {'positive'|'negative'} direction - The dominant direction
 * @property {number} ratio - How imbalanced (0.5-1.0, higher = more imbalanced)
 * @property {number} dominant - Count in dominant direction
 * @property {number} minority - Count in minority direction
 * @property {boolean} expectedImbalance - True when positive bias is expected (unipolar axes)
 */

/**
 * @typedef {object} PolarityAnalysisResult
 * @property {Map<string, PolarityStats>} polarityByAxis - Stats for each axis
 * @property {ImbalancedAxis[]} imbalancedAxes - Axes with significant imbalance
 * @property {string[]} warnings - Human-readable warnings about coverage issues
 * @property {number} totalAxesAnalyzed - Number of axes analyzed
 * @property {number} imbalancedCount - Number of imbalanced axes
 */

/**
 * Default configuration for polarity analysis.
 *
 * @type {object}
 */
const DEFAULT_CONFIG = {
  /**
   * Threshold ratio above which an axis is considered imbalanced.
   * 0.75 means 75%+ weights in one direction triggers a warning.
   */
  imbalanceThreshold: 0.75,

  /**
   * Minimum number of prototypes using an axis before analyzing polarity.
   * Axes used by fewer prototypes are skipped (not enough data).
   */
  minUsageCount: 3,

  /**
   * Weight value threshold for considering a weight as "active".
   * Values with |weight| < epsilon are treated as zero/unused.
   */
  activeWeightEpsilon: 0.001,
};

/**
 * Analyzes polarity distribution across axes to detect coverage imbalances.
 *
 * An "imbalanced" axis is one where prototype weights are predominantly
 * positive or predominantly negative, suggesting the other polarity is
 * underrepresented in the prototype set.
 */
export class AxisPolarityAnalyzer {
  #config;

  /**
   * Creates an AxisPolarityAnalyzer instance.
   *
   * @param {object} [config] - Configuration options
   * @param {number} [config.imbalanceThreshold] - Ratio threshold for imbalance detection
   * @param {number} [config.minUsageCount] - Minimum prototypes per axis
   * @param {number} [config.activeWeightEpsilon] - Epsilon for zero-weight detection
   */
  constructor(config = {}) {
    this.#config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyzes polarity distribution across all axes in the prototype set.
   *
   * @param {Array<{id?: string, prototypeId?: string, weights?: object}>} prototypes - Prototypes to analyze
   * @returns {PolarityAnalysisResult} Analysis results
   */
  analyze(prototypes) {
    const emptyResult = this.#createEmptyResult();

    if (!Array.isArray(prototypes) || prototypes.length === 0) {
      return emptyResult;
    }

    // Collect all axis names and their polarity counts
    const polarityByAxis = new Map();

    for (const proto of prototypes) {
      const weights = proto?.weights;
      if (!weights || typeof weights !== 'object') continue;

      for (const [axis, weight] of Object.entries(weights)) {
        if (typeof weight !== 'number' || !Number.isFinite(weight)) continue;

        if (!polarityByAxis.has(axis)) {
          polarityByAxis.set(axis, { positive: 0, negative: 0, zero: 0 });
        }

        const stats = polarityByAxis.get(axis);
        const absWeight = Math.abs(weight);

        if (absWeight < this.#config.activeWeightEpsilon) {
          stats.zero++;
        } else if (weight > 0) {
          stats.positive++;
        } else {
          stats.negative++;
        }
      }
    }

    // Compute derived stats and identify imbalanced axes
    const imbalancedAxes = [];
    const warnings = [];

    for (const [axis, stats] of polarityByAxis) {
      stats.total = stats.positive + stats.negative;

      // Skip axes with insufficient usage
      if (stats.total < this.#config.minUsageCount) {
        stats.ratio = 0.5;
        stats.dominantDirection = 'balanced';
        continue;
      }

      // Calculate imbalance ratio
      const dominant = Math.max(stats.positive, stats.negative);
      const minority = Math.min(stats.positive, stats.negative);
      stats.ratio = stats.total > 0 ? dominant / stats.total : 0.5;

      if (stats.positive > stats.negative) {
        stats.dominantDirection = 'positive';
      } else if (stats.negative > stats.positive) {
        stats.dominantDirection = 'negative';
      } else {
        stats.dominantDirection = 'balanced';
      }

      // Check for imbalance
      if (stats.ratio >= this.#config.imbalanceThreshold) {
        const direction = stats.dominantDirection;
        if (direction !== 'balanced') {
          const category = getAxisCategory(axis);
          const isUnipolar = category === 'affect_trait' || category === 'sexual';
          const expectedImbalance = isUnipolar && direction === 'positive';

          imbalancedAxes.push({
            axis,
            direction,
            ratio: stats.ratio,
            dominant,
            minority,
            expectedImbalance,
          });

          const pct = Math.round(stats.ratio * 100);
          const oppositeDir = direction === 'positive' ? 'negative' : 'positive';
          if (expectedImbalance) {
            warnings.push(
              `Axis "${axis}" is ${pct}% ${direction}: ` +
                `${dominant} prototypes use ${direction} weights, ` +
                `only ${minority} use ${oppositeDir}. ` +
                `Positive weight bias is expected for this unipolar axis.`
            );
          } else {
            warnings.push(
              `Axis "${axis}" is ${pct}% ${direction}: ` +
                `${dominant} prototypes use ${direction} weights, ` +
                `only ${minority} use ${oppositeDir}. ` +
                `Consider adding prototypes with ${oppositeDir} "${axis}" weights.`
            );
          }
        }
      }
    }

    // Sort imbalanced axes by severity (highest ratio first)
    imbalancedAxes.sort((a, b) => b.ratio - a.ratio);

    return {
      polarityByAxis,
      imbalancedAxes,
      warnings,
      totalAxesAnalyzed: polarityByAxis.size,
      imbalancedCount: imbalancedAxes.length,
    };
  }

  /**
   * Creates an empty result structure.
   *
   * @returns {PolarityAnalysisResult} Empty polarity analysis result
   */
  #createEmptyResult() {
    return {
      polarityByAxis: new Map(),
      imbalancedAxes: [],
      warnings: [],
      totalAxesAnalyzed: 0,
      imbalancedCount: 0,
    };
  }
}

export default AxisPolarityAnalyzer;
