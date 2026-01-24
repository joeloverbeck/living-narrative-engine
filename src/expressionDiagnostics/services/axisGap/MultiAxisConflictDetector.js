/**
 * @file Multi-axis conflict detection for prototype weight analysis.
 * @description Detects prototypes with unusually high axis loadings or sign tensions.
 */

import { computeMedianAndIQR } from '../../utils/statisticalUtils.js';

/**
 * @typedef {object} ConflictResult
 * @property {string} prototypeId - Prototype identifier.
 * @property {number} activeAxisCount - Number of active axes.
 * @property {number} signBalance - Balance between positive/negative axes (0-1).
 * @property {string[]} positiveAxes - Axes with positive weights.
 * @property {string[]} negativeAxes - Axes with negative weights.
 * @property {string} flagReason - Primary reason for flagging.
 * @property {string} [additionalFlagReason] - Secondary reason if both conditions met.
 */

/**
 * Service for detecting multi-axis conflicts in prototype weights.
 */
export class MultiAxisConflictDetector {
  #config;

  /**
   * Create a MultiAxisConflictDetector.
   *
   * @param {object} [config] - Configuration options.
   * @param {number} [config.activeAxisEpsilon] - Minimum weight for active axis (default: 0).
   * @param {number} [config.highAxisLoadingThreshold] - IQR multiplier for high loading (default: 1.5).
   * @param {number} [config.signTensionMinMagnitude] - Minimum |weight| for sign tension (default: 0.2).
   * @param {number} [config.signTensionMinHighAxes] - Minimum high-magnitude axes (default: 2).
   * @param {number} [config.multiAxisSignBalanceThreshold] - Sign balance threshold (default: 0.4).
   */
  constructor(config = {}) {
    this.#config = {
      activeAxisEpsilon: config.activeAxisEpsilon ?? 0,
      highAxisLoadingThreshold:
        config.highAxisLoadingThreshold ?? config.multiAxisUsageThreshold ?? 1.5,
      signTensionMinMagnitude: config.signTensionMinMagnitude ?? 0.2,
      signTensionMinHighAxes: config.signTensionMinHighAxes ?? 2,
      multiAxisSignBalanceThreshold: config.multiAxisSignBalanceThreshold ?? 0.4,
    };
  }

  /**
   * Detect all multi-axis conflicts in prototypes.
   *
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @returns {ConflictResult[]} Array of conflict results.
   */
  detect(prototypes) {
    const protoArray = Array.isArray(prototypes) ? prototypes : [];
    if (protoArray.length < 2) {
      return [];
    }

    const highAxisLoadings = this.detectHighAxisLoadings(protoArray);
    const signTensions = this.detectSignTensions(protoArray);

    // Union with deduplication by prototypeId
    const conflictMap = new Map();

    for (const entry of highAxisLoadings) {
      conflictMap.set(entry.prototypeId, entry);
    }

    for (const entry of signTensions) {
      if (!conflictMap.has(entry.prototypeId)) {
        conflictMap.set(entry.prototypeId, entry);
      } else {
        // Merge: add secondary flag reason if different
        const existing = conflictMap.get(entry.prototypeId);
        if (existing.flagReason !== entry.flagReason) {
          existing.additionalFlagReason = entry.flagReason;
        }
      }
    }

    return Array.from(conflictMap.values());
  }

  /**
   * Detect prototypes with unusually high active axis count.
   * Uses IQR-based threshold.
   *
   * @param {Array} prototypes - Prototype objects.
   * @returns {ConflictResult[]} Prototypes with high axis loading.
   */
  detectHighAxisLoadings(prototypes) {
    if (!Array.isArray(prototypes) || prototypes.length < 2) {
      return [];
    }

    const epsilon = Math.max(0, this.#config.activeAxisEpsilon);
    const usageThreshold = this.#config.highAxisLoadingThreshold;

    const summaries = prototypes.map((prototype, index) => {
      const prototypeId =
        prototype?.id ?? prototype?.prototypeId ?? `prototype-${index}`;
      const weights = prototype?.weights ?? {};
      const { positiveAxes, negativeAxes } = this.#categorizeAxes(
        weights,
        epsilon
      );
      const activeAxisCount = positiveAxes.length + negativeAxes.length;
      const signBalance = this.#computeSignBalance(
        positiveAxes.length,
        negativeAxes.length,
        activeAxisCount
      );

      return {
        prototypeId,
        activeAxisCount,
        signBalance,
        positiveAxes: positiveAxes.slice().sort(),
        negativeAxes: negativeAxes.slice().sort(),
        flagReason: 'high_axis_loading',
      };
    });

    const counts = summaries.map((entry) => entry.activeAxisCount);
    const { median, iqr } = computeMedianAndIQR(counts);
    const axisThreshold = median + iqr * usageThreshold;

    return summaries.filter((entry) => entry.activeAxisCount > axisThreshold);
  }

  /**
   * Detect prototypes with sign tensions - mixed signs among high-magnitude axes.
   *
   * @param {Array} prototypes - Prototype objects.
   * @returns {ConflictResult[]} Prototypes with sign tensions.
   */
  detectSignTensions(prototypes) {
    if (!Array.isArray(prototypes) || prototypes.length < 2) {
      return [];
    }

    const epsilon = Math.max(0, this.#config.activeAxisEpsilon);
    const minMagnitude = this.#config.signTensionMinMagnitude;
    const minHighAxes = this.#config.signTensionMinHighAxes;
    const signBalanceThreshold = this.#config.multiAxisSignBalanceThreshold;

    const results = [];

    for (let i = 0; i < prototypes.length; i++) {
      const prototype = prototypes[i];
      const prototypeId =
        prototype?.id ?? prototype?.prototypeId ?? `prototype-${i}`;
      const weights = prototype?.weights ?? {};

      // Find high-magnitude axes
      const highMagnitudeAxes = { positive: [], negative: [] };

      for (const [axis, value] of Object.entries(weights)) {
        if (!Number.isFinite(value)) continue;
        const absValue = Math.abs(value);
        if (absValue >= minMagnitude) {
          if (value > 0) {
            highMagnitudeAxes.positive.push({ axis, weight: value });
          } else {
            highMagnitudeAxes.negative.push({ axis, weight: value });
          }
        }
      }

      const totalHighMagnitude =
        highMagnitudeAxes.positive.length + highMagnitudeAxes.negative.length;
      const hasMixedSigns =
        highMagnitudeAxes.positive.length > 0 &&
        highMagnitudeAxes.negative.length > 0;

      if (totalHighMagnitude >= minHighAxes && hasMixedSigns) {
        const { positiveAxes, negativeAxes } = this.#categorizeAxes(
          weights,
          epsilon
        );
        const activeAxisCount = positiveAxes.length + negativeAxes.length;
        const signBalance = this.#computeSignBalance(
          positiveAxes.length,
          negativeAxes.length,
          activeAxisCount
        );

        if (signBalance < signBalanceThreshold) {
          results.push({
            prototypeId,
            activeAxisCount,
            signBalance,
            positiveAxes: positiveAxes.slice().sort(),
            negativeAxes: negativeAxes.slice().sort(),
            highMagnitudePositive: highMagnitudeAxes.positive
              .map((a) => a.axis)
              .sort(),
            highMagnitudeNegative: highMagnitudeAxes.negative
              .map((a) => a.axis)
              .sort(),
            flagReason: 'sign_tension',
          });
        }
      }
    }

    return results;
  }

  /**
   * Categorize axes by sign.
   *
   * @param {Record<string, number>} weights - Weight object.
   * @param {number} epsilon - Minimum magnitude threshold.
   * @returns {{positiveAxes: string[], negativeAxes: string[]}} Categorized axes.
   */
  #categorizeAxes(weights, epsilon) {
    if (!weights || typeof weights !== 'object') {
      return { positiveAxes: [], negativeAxes: [] };
    }

    const positiveAxes = [];
    const negativeAxes = [];

    for (const [axis, value] of Object.entries(weights)) {
      if (!Number.isFinite(value)) continue;
      if (value >= epsilon) {
        positiveAxes.push(axis);
      } else if (value <= -epsilon) {
        negativeAxes.push(axis);
      }
    }

    return { positiveAxes, negativeAxes };
  }

  /**
   * Compute sign balance (how evenly distributed between positive/negative).
   *
   * @param {number} positiveCount - Count of positive axes.
   * @param {number} negativeCount - Count of negative axes.
   * @param {number} totalActive - Total active axis count.
   * @returns {number} Balance value 0-1 (1 = all same sign, 0 = equal mix).
   */
  #computeSignBalance(positiveCount, negativeCount, totalActive) {
    if (!totalActive) {
      return 1;
    }
    return Math.abs(positiveCount - negativeCount) / totalActive;
  }
}
