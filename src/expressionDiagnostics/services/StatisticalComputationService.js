/**
 * @file StatisticalComputationService - Statistical calculations and gate analysis for reports
 *
 * This service encapsulates statistical computation methods extracted from
 * MonteCarloReportGenerator as part of the refactoring effort (MONCARREPGENREFANA-003).
 *
 * Methods handle:
 * - Distribution statistics (percentiles, mean, median)
 * - Wilson confidence intervals
 * - Gate pass/failure rate calculations
 * - Axis contribution analysis
 * - Conditional pass rate computations
 *
 * @see reports/monteCarloReportGenerator-refactoring-analysis.md
 */

import GateConstraint from '../models/GateConstraint.js';
import {
  resolveAxisValue,
  normalizeMoodAxes,
  normalizeSexualAxes,
  normalizeAffectTraits,
} from '../utils/axisNormalizationUtils.js';
import { computeIntensitySignals } from '../utils/intensitySignalUtils.js';
import { evaluateConstraint } from '../utils/moodRegimeUtils.js';

/**
 * Service for statistical computations used in Monte Carlo report generation.
 * This class contains no state and all methods are pure computations.
 */
class StatisticalComputationService {
  // ===========================================================================
  // Pure Statistical Methods
  // ===========================================================================

  /**
   * Computes distribution statistics for a set of numeric values.
   *
   * @param {number[]} values - Array of numeric values to analyze
   * @returns {{min: number, median: number, p90: number, p95: number, max: number, mean: number, count: number}|null} Distribution stats or null if empty
   */
  computeDistributionStats(values) {
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const p90Index = Math.min(n - 1, Math.floor(n * 0.9));
    const p95Index = Math.min(n - 1, Math.floor(n * 0.95));

    return {
      min: sorted[0],
      median: sorted[Math.floor(n / 2)],
      p90: sorted[p90Index],
      p95: sorted[p95Index],
      max: sorted[n - 1],
      mean: values.reduce((a, b) => a + b, 0) / n,
      count: n,
    };
  }

  /**
   * Calculates Wilson score confidence interval for a proportion.
   *
   * Wilson score interval provides better coverage than normal approximation,
   * especially for proportions near 0 or 1, or with small sample sizes.
   *
   * @param {number} successes - Number of successes
   * @param {number} total - Total number of trials
   * @param {number} [z] - Z-score for confidence level (default 95%)
   * @returns {{low: number, high: number}} Confidence interval bounds
   */
  calculateWilsonInterval(successes, total, z = 1.96) {
    if (total === 0) return { low: 0, high: 1 };

    const p = successes / total;
    const denominator = 1 + (z * z) / total;
    const center = p + (z * z) / (2 * total);
    const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);

    return {
      low: Math.max(0, (center - spread) / denominator),
      high: Math.min(1, (center + spread) / denominator),
    };
  }

  // ===========================================================================
  // Axis Contribution Analysis
  // ===========================================================================

  /**
   * Computes axis contributions to prototype intensity across contexts.
   *
   * Analyzes how each weighted axis contributes to the overall intensity
   * score, accounting for both mood and sexual state axes.
   *
   * @param {object[]} contexts - Array of stored contexts with mood/sexual data
   * @param {object} weights - Map of axis names to their weights
   * @returns {object} Map of axis names to contribution statistics
   */
  computeAxisContributions(contexts, weights) {
    const contributions = {};

    // Sexual axes that are stored in sexualStates rather than moodAxes
    const sexualAxes = [
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
      'sexual_arousal',
      'sexual_inhibition',
    ];

    for (const [axis, weight] of Object.entries(weights)) {
      const axisContribs = contexts.map((ctx) => {
        // Get axis value from appropriate source
        const isSexualAxis = sexualAxes.includes(axis);
        const sourcePath = isSexualAxis
          ? `sexualStates.${axis}`
          : `moodAxes.${axis}`;
        const axisValue = this.getNestedValue(ctx, sourcePath) ?? 0;
        const normalizedValue = this.#normalizeAxisValue(axis, axisValue);
        return normalizedValue * weight;
      });

      const meanAxisValues = contexts.map((ctx) => {
        const isSexualAxis = sexualAxes.includes(axis);
        const sourcePath = isSexualAxis
          ? `sexualStates.${axis}`
          : `moodAxes.${axis}`;
        return this.getNestedValue(ctx, sourcePath) ?? 0;
      });

      contributions[axis] = {
        weight,
        meanContribution:
          axisContribs.reduce((a, b) => a + b, 0) / axisContribs.length,
        meanAxisValue:
          meanAxisValues.reduce((a, b) => a + b, 0) / meanAxisValues.length,
      };
    }

    return contributions;
  }

  // ===========================================================================
  // Gate Pass/Failure Rate Calculations
  // ===========================================================================

  /**
   * Computes failure rate for each gate across stored contexts.
   *
   * @param {string[]} gates - Array of gate constraint strings (e.g., "valence >= 0.3")
   * @param {object[]} storedContexts - Array of stored simulation contexts
   * @returns {Map<string, number>} Map of gate string to failure rate (0-1)
   */
  computeGateFailureRates(gates, storedContexts) {
    const rates = new Map();

    if (
      !gates ||
      gates.length === 0 ||
      !storedContexts ||
      storedContexts.length === 0
    ) {
      return rates;
    }

    const parsedGates = gates
      .map((gateStr) => {
        try {
          return { gateStr, constraint: GateConstraint.parse(gateStr) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (parsedGates.length === 0) {
      return rates;
    }

    const normalizedContexts = storedContexts.map((context) =>
      this.normalizeContextAxes(context)
    );

    for (const { gateStr, constraint } of parsedGates) {
      let failCount = 0;
      const total = normalizedContexts.length;

      for (const normalized of normalizedContexts) {
        const axisValue = resolveAxisValue(
          constraint.axis,
          normalized.moodAxes,
          normalized.sexualAxes,
          normalized.traitAxes
        );

        if (!constraint.isSatisfiedBy(axisValue)) {
          failCount++;
        }
      }

      if (total > 0) {
        rates.set(gateStr, failCount / total);
      }
    }

    return rates;
  }

  /**
   * Computes overall pass rate for all gates across stored contexts.
   *
   * A context passes only if ALL gates are satisfied.
   *
   * @param {string[]} gates - Array of gate constraint strings
   * @param {object[]} storedContexts - Array of stored simulation contexts
   * @returns {number|null} Pass rate (0-1) or null if no contexts
   */
  computeGatePassRate(gates, storedContexts) {
    if (!storedContexts || storedContexts.length === 0) return null;
    if (!gates || gates.length === 0) return 1;

    const parsedGates = gates
      .map((gateStr) => {
        try {
          return GateConstraint.parse(gateStr);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (parsedGates.length === 0) {
      return 1;
    }

    let passCount = 0;
    const total = storedContexts.length;

    for (const context of storedContexts) {
      const normalized = this.normalizeContextAxes(context);
      let allPass = true;

      for (const constraint of parsedGates) {
        const axisValue = resolveAxisValue(
          constraint.axis,
          normalized.moodAxes,
          normalized.sexualAxes,
          normalized.traitAxes
        );

        if (!constraint.isSatisfiedBy(axisValue)) {
          allPass = false;
          break;
        }
      }

      if (allPass) {
        passCount++;
      }
    }

    return total > 0 ? passCount / total : null;
  }

  // ===========================================================================
  // Prototype Regime Statistics
  // ===========================================================================

  /**
   * Computes distribution statistics for a prototype's intensity across contexts.
   *
   * This method handles multiple data sources:
   * 1. Pre-computed gate trace signals (if available in context)
   * 2. Real-time intensity signal computation (if weights provided)
   * 3. Direct value extraction from varPath (fallback)
   *
   * @param {object[]} contexts - Array of stored contexts
   * @param {string} varPath - Path to the variable (e.g., "emotions.joy")
   * @param {string[]} gates - Gate constraint strings
   * @param {object|null} weights - Axis weights for intensity calculation
   * @param {object} [callbacks] - Optional callback functions for data extraction
   * @param {Function} [callbacks.resolveGateTraceTarget] - Resolves varPath to gate trace target
   * @param {Function} [callbacks.getGateTraceSignals] - Gets gate trace signals from context
   * @returns {object|null} Regime statistics or null if no contexts
   */
  computePrototypeRegimeStats(
    contexts,
    varPath,
    gates,
    weights = null,
    callbacks = {}
  ) {
    if (!contexts || contexts.length === 0) {
      return null;
    }

    const { resolveGateTraceTarget, getGateTraceSignals } = callbacks;

    const rawValues = [];
    const finalValues = [];
    let gatePassCount = 0;
    const traceTarget = resolveGateTraceTarget
      ? resolveGateTraceTarget(varPath)
      : null;

    for (const context of contexts) {
      if (traceTarget && getGateTraceSignals) {
        const traceSignals = getGateTraceSignals(
          context,
          traceTarget.type,
          traceTarget.prototypeId
        );
        if (traceSignals) {
          rawValues.push(traceSignals.raw);
          finalValues.push(traceSignals.final);
          if (traceSignals.gatePass) {
            gatePassCount++;
          }
          continue;
        }
      }

      if (weights && Object.keys(weights).length > 0) {
        const normalized = this.normalizeContextAxes(context);
        const signals = computeIntensitySignals({
          weights,
          gates,
          normalizedMood: normalized.moodAxes,
          normalizedSexual: normalized.sexualAxes,
          normalizedTraits: normalized.traitAxes,
        });

        rawValues.push(signals.raw);
        finalValues.push(signals.final);
        if (signals.gatePass) {
          gatePassCount++;
        }
        continue;
      }

      const value = this.getNestedValue(context, varPath);
      if (typeof value === 'number') {
        finalValues.push(value);
      }
    }

    if (
      (!weights || Object.keys(weights).length === 0) &&
      rawValues.length === 0
    ) {
      gatePassCount = null;
    }

    const rawDistribution =
      rawValues.length > 0 ? this.computeDistributionStats(rawValues) : null;
    const finalDistribution = this.computeDistributionStats(finalValues);
    const gatePassRate =
      gatePassCount === null
        ? this.computeGatePassRate(gates, contexts)
        : contexts.length > 0
          ? gatePassCount / contexts.length
          : null;

    return {
      rawDistribution,
      finalDistribution,
      gatePassRate,
      count: finalValues.length,
    };
  }

  // ===========================================================================
  // Conditional Pass Rate Calculations
  // ===========================================================================

  /**
   * Computes conditional pass rates for emotion conditions within filtered contexts.
   *
   * Returns results sorted by pass rate ascending (hardest conditions first).
   *
   * @param {object[]} filteredContexts - Pre-filtered array of contexts
   * @param {object[]} emotionConditions - Array of condition objects
   * @param {string} emotionConditions[].varPath - Path to evaluate (e.g., "emotions.joy")
   * @param {string} emotionConditions[].operator - Comparison operator (>=, >, <=, <)
   * @param {number} emotionConditions[].threshold - Threshold value
   * @param {string} emotionConditions[].display - Human-readable condition description
   * @returns {object[]} Array of condition results sorted by pass rate ascending
   */
  computeConditionalPassRates(filteredContexts, emotionConditions) {
    const results = [];
    const total = filteredContexts.length;

    for (const condition of emotionConditions) {
      const passes = filteredContexts.filter((ctx) => {
        const value = this.getNestedValue(ctx, condition.varPath);
        return this.#evaluateComparison(
          value,
          condition.operator,
          condition.threshold
        );
      }).length;

      const rate = total > 0 ? passes / total : 0;
      const ci = this.calculateWilsonInterval(passes, total);

      results.push({
        condition: condition.display,
        conditionalPassRate: rate,
        passes,
        total,
        ci,
      });
    }

    // Sort by conditional pass rate ascending (lowest first - hardest to pass)
    results.sort((a, b) => a.conditionalPassRate - b.conditionalPassRate);

    return results;
  }

  // ===========================================================================
  // Public Helpers
  // ===========================================================================

  /**
   * Extracts a nested value from an object using dot-notation path.
   *
   * @param {object} obj - Source object
   * @param {string} path - Dot-separated path (e.g., "emotions.joy.value")
   * @returns {*} Value at path or undefined if not found
   */
  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Normalizes an axis value based on its type.
   * Sexual axes are already normalized; mood axes need [-100, 100] -> [-1, 1].
   *
   * @param {string} axis - Axis name
   * @param {number} value - Raw axis value
   * @returns {number} Normalized value
   * @private
   */
  #normalizeAxisValue(axis, value) {
    // Sexual axes are already normalized
    const sexualAxes = [
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
      'sexual_arousal',
    ];
    if (sexualAxes.includes(axis)) {
      return value;
    }

    // Mood axes need normalization from [-100, 100] to [-1, 1]
    return value / 100;
  }

  /**
   * Normalizes all axis types in a context to standard ranges.
   *
   * @param {object} context - Raw context with mood/sexual/trait data
   * @returns {object} Normalized context with moodAxes, sexualAxes, traitAxes
   */
  normalizeContextAxes(context) {
    const moodAxes = normalizeMoodAxes(
      context?.moodAxes ?? context?.mood ?? {}
    );
    const sexualAxes = normalizeSexualAxes(
      context?.sexualAxes ?? context?.sexual ?? null,
      context?.sexualArousal ?? null
    );
    const traitAxes = normalizeAffectTraits(context?.affectTraits);

    return { moodAxes, sexualAxes, traitAxes };
  }

  /**
   * Evaluates a comparison between a value and threshold.
   *
   * @param {number} value - Value to compare
   * @param {string} operator - Comparison operator (>=, >, <=, <)
   * @param {number} threshold - Threshold to compare against
   * @returns {boolean} Result of comparison
   * @private
   */
  #evaluateComparison(value, operator, threshold) {
    return evaluateConstraint(value, operator, threshold);
  }
}

export default StatisticalComputationService;
