/**
 * @file Multi-axis conflict detection for prototype weight analysis.
 * @description Detects prototypes with unusually high axis loadings or sign tensions.
 */

import { computeMedianAndIQR } from '../../utils/statisticalUtils.js';

/**
 * @typedef {object} ConflictResult
 * @property {string} prototypeId - Prototype identifier.
 * @property {number} activeAxisCount - Number of active axes (|weight| >= activeAxisEpsilon).
 * @property {number} [strongAxisCount] - Number of strongly used axes (|weight| >= strongAxisThreshold).
 * @property {string[]} [strongAxes] - Axes with weights >= strongAxisThreshold (sorted).
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
   * @param {number} [config.activeAxisEpsilon] - Minimum weight for active axis (default: 0.08).
   * @param {number} [config.strongAxisThreshold] - Minimum weight for strongly used axis (default: 0.25).
   * @param {number} [config.highAxisLoadingThreshold] - IQR multiplier for high loading (default: 1.5).
   * @param {number} [config.minIQRFloor] - Minimum IQR value to prevent sparsity when data is homogeneous (default: 0.5).
   * @param {number} [config.signTensionMinMagnitude] - Minimum |weight| for sign tension (default: 0.2).
   * @param {number} [config.signTensionMinHighAxes] - Minimum high-magnitude axes (default: 2).
   * @param {number} [config.multiAxisSignBalanceThreshold] - Sign balance threshold (default: 0.4).
   */
  constructor(config = {}) {
    this.#config = {
      activeAxisEpsilon: config.activeAxisEpsilon ?? 0.08,
      strongAxisThreshold: config.strongAxisThreshold ?? 0.25,
      highAxisLoadingThreshold:
        config.highAxisLoadingThreshold ?? config.multiAxisUsageThreshold ?? 1.5,
      minIQRFloor: config.minIQRFloor ?? 0.5,
      signTensionMinMagnitude: config.signTensionMinMagnitude ?? 0.2,
      signTensionMinHighAxes: config.signTensionMinHighAxes ?? 2,
      multiAxisSignBalanceThreshold: config.multiAxisSignBalanceThreshold ?? 0.4,
    };
  }

  /**
   * Detect all multi-axis conflicts in prototypes.
   *
   * Returns structured result with separated conflict types:
   * - conflicts: Union of all conflict types (backward compatible array)
   * - highAxisLoadings: Prototypes with unusually high active axis count
   * - signTensions: Prototypes with mixed positive/negative weights (METADATA ONLY - not actionable)
   *
   * NOTE: signTensions are informational metadata and should NOT:
   * - Contribute to confidence scoring
   * - Trigger recommendations
   * - Be counted as actionable conflicts
   * Mixed positive/negative weights are NORMAL for emotional prototypes.
   *
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @returns {{conflicts: ConflictResult[], highAxisLoadings: ConflictResult[], signTensions: ConflictResult[]}} Structured conflict results.
   */
  detect(prototypes) {
    const protoArray = Array.isArray(prototypes) ? prototypes : [];
    if (protoArray.length < 2) {
      return { conflicts: [], highAxisLoadings: [], signTensions: [] };
    }

    const highAxisLoadings = this.detectHighAxisLoadings(protoArray);
    const signTensions = this.detectSignTensions(protoArray);

    // Union with deduplication by prototypeId for backward compatibility
    // Only highAxisLoadings contribute to actionable conflicts
    const conflictMap = new Map();

    for (const entry of highAxisLoadings) {
      conflictMap.set(entry.prototypeId, entry);
    }

    // Sign tensions are metadata only - add additionalFlagReason if prototype
    // also has high axis loading, but don't add as standalone conflict
    for (const entry of signTensions) {
      if (conflictMap.has(entry.prototypeId)) {
        // Merge: add secondary flag reason if different
        const existing = conflictMap.get(entry.prototypeId);
        if (existing.flagReason !== entry.flagReason) {
          existing.additionalFlagReason = entry.flagReason;
        }
      }
      // Note: We no longer add sign_tension-only entries to conflicts
      // They are returned separately as metadata
    }

    return {
      conflicts: Array.from(conflictMap.values()),
      highAxisLoadings,
      signTensions,
    };
  }

  /**
   * Detect prototypes with unusually high active axis count.
   * Uses Tukey's fence (Q3 + k*IQR) with an IQR floor to prevent false positives
   * when axis counts are homogeneous.
   *
   * @param {Array} prototypes - Prototype objects.
   * @returns {ConflictResult[]} Prototypes with high axis loading.
   */
  detectHighAxisLoadings(prototypes) {
    if (!Array.isArray(prototypes) || prototypes.length < 2) {
      return [];
    }

    const epsilon = Math.max(0, this.#config.activeAxisEpsilon);
    const strongThreshold = Math.max(0, this.#config.strongAxisThreshold);
    const usageThreshold = this.#config.highAxisLoadingThreshold;
    const minIQRFloor = this.#config.minIQRFloor;

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

      // Compute strong axis count (axes with |weight| >= strongAxisThreshold)
      const { positiveAxes: strongPositive, negativeAxes: strongNegative } =
        this.#categorizeAxes(weights, strongThreshold);
      const strongAxisCount = strongPositive.length + strongNegative.length;
      const strongAxes = [...strongPositive, ...strongNegative].sort();

      return {
        prototypeId,
        activeAxisCount,
        strongAxisCount,
        strongAxes,
        signBalance,
        positiveAxes: positiveAxes.slice().sort(),
        negativeAxes: negativeAxes.slice().sort(),
        flagReason: 'high_axis_loading',
      };
    });

    const counts = summaries.map((entry) => entry.activeAxisCount);
    const { iqr, q3 } = computeMedianAndIQR(counts);
    // Apply IQR floor to prevent massive false positives when data is homogeneous
    const effectiveIQR = Math.max(iqr, minIQRFloor);
    // Standard Tukey's fence: Q3 + k*IQR
    const axisThreshold = q3 + effectiveIQR * usageThreshold;

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
