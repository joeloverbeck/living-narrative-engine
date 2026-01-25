/**
 * @file Analyzer for prototype complexity and axis co-occurrence patterns.
 * @description Detects complexity distribution statistics and identifies
 * frequently co-occurring axis bundles that might suggest new composite concepts.
 */

/**
 * @typedef {object} ComplexityDistribution
 * @property {Array<{bin: number, count: number}>} histogram - Histogram of axis counts
 * @property {number} median - Median number of active axes
 * @property {number} q1 - First quartile (25th percentile)
 * @property {number} q3 - Third quartile (75th percentile)
 * @property {number} min - Minimum axis count
 * @property {number} max - Maximum axis count
 * @property {number} mean - Mean axis count
 * @property {Array<{prototypeId: string, axisCount: number}>} outliers - Prototypes with unusually high/low complexity
 */

/**
 * @typedef {object} AxisBundle
 * @property {string[]} axes - The axes that frequently appear together
 * @property {number} frequency - Number of prototypes containing all these axes
 * @property {number} support - Frequency as proportion of total prototypes
 * @property {string} suggestedConcept - AI-suggested name for the bundle concept
 */

/**
 * @typedef {object} ComplexityRecommendation
 * @property {'consider_new_axis'|'reduce_complexity'|'balance_complexity'} type - Recommendation type
 * @property {string[]} bundle - Related axes if applicable
 * @property {string} reason - Explanation for the recommendation
 * @property {string} [action] - Suggested action to take
 */

/**
 * @typedef {object} ComplexityAnalysisResult
 * @property {ComplexityDistribution} distribution - Complexity distribution statistics
 * @property {{bundles: AxisBundle[]}} coOccurrence - Co-occurrence analysis results
 * @property {ComplexityRecommendation[]} recommendations - Generated recommendations
 * @property {number} totalPrototypes - Number of prototypes analyzed
 * @property {number} averageComplexity - Average axis count per prototype
 */

/**
 * Default configuration for complexity analysis.
 *
 * @type {object}
 */
const DEFAULT_CONFIG = {
  /**
   * Minimum number of axes to be considered "active" for a prototype.
   * Values with |weight| < this threshold are ignored.
   */
  activeWeightEpsilon: 0.001,

  /**
   * Minimum frequency (proportion of prototypes) for a bundle to be reported.
   * 0.1 means at least 10% of prototypes must contain the bundle.
   */
  minBundleSupport: 0.1,

  /**
   * Minimum number of axes in a bundle to be considered interesting.
   */
  minBundleSize: 2,

  /**
   * Maximum number of axes in a bundle to analyze.
   * Higher values exponentially increase computation.
   */
  maxBundleSize: 4,

  /**
   * Number of standard deviations from mean to flag as outlier.
   */
  outlierStdDevThreshold: 2.0,

  /**
   * Minimum prototypes needed for meaningful statistics.
   */
  minPrototypesForAnalysis: 5,
};

/**
 * Analyzes prototype complexity distribution and axis co-occurrence patterns.
 *
 * Complexity is measured by the number of "active" axes (non-zero weights)
 * each prototype uses. This helps identify:
 * - Overly complex prototypes that might be split
 * - Overly simple prototypes that might lack nuance
 * - Frequently co-occurring axes that might suggest new composite concepts
 */
export class PrototypeComplexityAnalyzer {
  #config;

  /**
   * Creates a PrototypeComplexityAnalyzer instance.
   *
   * @param {object} [config] - Configuration options
   * @param {number} [config.activeWeightEpsilon] - Threshold for active weight detection
   * @param {number} [config.minBundleSupport] - Minimum bundle support ratio
   * @param {number} [config.minBundleSize] - Minimum axes in a bundle
   * @param {number} [config.maxBundleSize] - Maximum axes in a bundle
   * @param {number} [config.outlierStdDevThreshold] - Outlier detection threshold
   * @param {number} [config.minPrototypesForAnalysis] - Minimum prototypes needed
   */
  constructor(config = {}) {
    this.#config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyzes complexity distribution and co-occurrence patterns across prototypes.
   *
   * @param {Array<{id?: string, prototypeId?: string, weights?: object}>} prototypes - Prototypes to analyze
   * @returns {ComplexityAnalysisResult} Analysis results
   */
  analyze(prototypes) {
    const emptyResult = this.#createEmptyResult();

    if (!Array.isArray(prototypes) || prototypes.length === 0) {
      return emptyResult;
    }

    // Calculate active axis count for each prototype
    const complexityData = this.#calculateComplexityData(prototypes);

    if (complexityData.length < this.#config.minPrototypesForAnalysis) {
      return {
        ...emptyResult,
        totalPrototypes: complexityData.length,
      };
    }

    // Calculate distribution statistics
    const distribution = this.#calculateDistribution(complexityData);

    // Find co-occurring axis bundles
    const coOccurrence = this.#findCoOccurrences(complexityData);

    // Generate recommendations
    const recommendations = this.#generateRecommendations(
      distribution,
      coOccurrence,
      complexityData.length
    );

    // Calculate average complexity
    const totalAxes = complexityData.reduce((sum, d) => sum + d.axisCount, 0);
    const averageComplexity =
      complexityData.length > 0 ? totalAxes / complexityData.length : 0;

    return {
      distribution,
      coOccurrence,
      recommendations,
      totalPrototypes: complexityData.length,
      averageComplexity: Math.round(averageComplexity * 100) / 100,
    };
  }

  /**
   * Calculates complexity data for each prototype.
   *
   * @param {Array<object>} prototypes - Prototype objects
   * @returns {Array<{prototypeId: string, axisCount: number, activeAxes: string[]}>} Complexity data
   */
  #calculateComplexityData(prototypes) {
    const data = [];

    for (const proto of prototypes) {
      const weights = proto?.weights;
      if (!weights || typeof weights !== 'object') continue;

      const prototypeId = proto.id ?? proto.prototypeId ?? 'unknown';
      const activeAxes = [];

      for (const [axis, weight] of Object.entries(weights)) {
        if (typeof weight !== 'number' || !Number.isFinite(weight)) continue;
        if (Math.abs(weight) >= this.#config.activeWeightEpsilon) {
          activeAxes.push(axis);
        }
      }

      data.push({
        prototypeId,
        axisCount: activeAxes.length,
        activeAxes: activeAxes.sort(), // Sort for consistent bundle comparison
      });
    }

    return data;
  }

  /**
   * Calculates distribution statistics.
   *
   * @param {Array<{prototypeId: string, axisCount: number}>} data - Complexity data
   * @returns {ComplexityDistribution} Distribution statistics
   */
  #calculateDistribution(data) {
    const axisCounts = data.map((d) => d.axisCount).sort((a, b) => a - b);
    const n = axisCounts.length;

    // Basic statistics
    const min = axisCounts[0] ?? 0;
    const max = axisCounts[n - 1] ?? 0;
    const sum = axisCounts.reduce((s, v) => s + v, 0);
    const mean = n > 0 ? sum / n : 0;

    // Percentiles
    const median = this.#percentile(axisCounts, 50);
    const q1 = this.#percentile(axisCounts, 25);
    const q3 = this.#percentile(axisCounts, 75);

    // Standard deviation for outlier detection
    const variance =
      n > 0
        ? axisCounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n
        : 0;
    const stdDev = Math.sqrt(variance);

    // Identify outliers
    const lowerBound = mean - this.#config.outlierStdDevThreshold * stdDev;
    const upperBound = mean + this.#config.outlierStdDevThreshold * stdDev;
    const outliers = data
      .filter((d) => d.axisCount < lowerBound || d.axisCount > upperBound)
      .map((d) => ({ prototypeId: d.prototypeId, axisCount: d.axisCount }));

    // Build histogram
    const histogram = this.#buildHistogram(axisCounts);

    return {
      histogram,
      median,
      q1,
      q3,
      min,
      max,
      mean: Math.round(mean * 100) / 100,
      outliers,
    };
  }

  /**
   * Calculates percentile value from sorted array.
   *
   * @param {number[]} sortedArray - Sorted array of values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  #percentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const fraction = index - lower;

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    if (lower === upper) return sortedArray[lower];

    return sortedArray[lower] * (1 - fraction) + sortedArray[upper] * fraction;
  }

  /**
   * Builds histogram from axis counts.
   *
   * @param {number[]} axisCounts - Array of axis counts
   * @returns {Array<{bin: number, count: number}>} Histogram bins
   */
  #buildHistogram(axisCounts) {
    if (axisCounts.length === 0) return [];

    const countMap = new Map();
    for (const count of axisCounts) {
      countMap.set(count, (countMap.get(count) ?? 0) + 1);
    }

    const histogram = Array.from(countMap.entries())
      .map(([bin, count]) => ({ bin, count }))
      .sort((a, b) => a.bin - b.bin);

    return histogram;
  }

  /**
   * Finds frequently co-occurring axis bundles.
   *
   * @param {Array<{activeAxes: string[]}>} data - Complexity data with active axes
   * @returns {{bundles: AxisBundle[]}} Co-occurrence results
   */
  #findCoOccurrences(data) {
    const bundleCounts = new Map();
    const n = data.length;

    // Count all axis pair/triple/quad combinations
    for (const { activeAxes } of data) {
      const combos = this.#generateCombinations(
        activeAxes,
        this.#config.minBundleSize,
        Math.min(this.#config.maxBundleSize, activeAxes.length)
      );

      for (const combo of combos) {
        const key = combo.join('|');
        bundleCounts.set(key, (bundleCounts.get(key) ?? 0) + 1);
      }
    }

    // Filter by minimum support
    const minCount = Math.ceil(n * this.#config.minBundleSupport);
    const bundles = [];

    for (const [key, count] of bundleCounts) {
      if (count >= minCount) {
        const axes = key.split('|');
        bundles.push({
          axes,
          frequency: count,
          support: Math.round((count / n) * 1000) / 1000,
          suggestedConcept: this.#suggestConceptName(axes),
        });
      }
    }

    // Sort by frequency descending, then by bundle size descending
    bundles.sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return b.axes.length - a.axes.length;
    });

    // Limit to top bundles to avoid overwhelming output
    return { bundles: bundles.slice(0, 20) };
  }

  /**
   * Generates all combinations of size minSize to maxSize from array.
   *
   * @param {string[]} arr - Array to generate combinations from
   * @param {number} minSize - Minimum combination size
   * @param {number} maxSize - Maximum combination size
   * @returns {string[][]} Array of combinations
   */
  #generateCombinations(arr, minSize, maxSize) {
    const results = [];

    const generate = (start, current) => {
      if (current.length >= minSize) {
        results.push([...current]);
      }
      if (current.length >= maxSize) return;

      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        generate(i + 1, current);
        current.pop();
      }
    };

    generate(0, []);
    return results;
  }

  /**
   * Suggests a concept name for an axis bundle.
   *
   * @param {string[]} axes - Bundle axes
   * @returns {string} Suggested concept name
   */
  #suggestConceptName(axes) {
    // Simple heuristic: join axis names with underscores
    // In production, this could be enhanced with LLM suggestions
    const shortNames = axes.map((a) =>
      a
        .replace(/^(valence|arousal|dominance|intensity)$/i, (m) =>
          m.charAt(0).toUpperCase()
        )
        .replace(/_/g, '')
    );

    if (axes.length === 2) {
      return `${shortNames[0]}_${shortNames[1]}_composite`;
    }
    return `multi_axis_bundle_${axes.length}`;
  }

  /**
   * Generates recommendations based on analysis.
   *
   * @param {ComplexityDistribution} distribution - Distribution statistics
   * @param {{bundles: AxisBundle[]}} coOccurrence - Co-occurrence results
   * @param {number} totalPrototypes - Total number of prototypes
   * @returns {ComplexityRecommendation[]} Generated recommendations
   */
  #generateRecommendations(distribution, coOccurrence, totalPrototypes) {
    const recommendations = [];

    // Check for high-frequency bundles that might suggest new axes
    for (const bundle of coOccurrence.bundles) {
      if (bundle.support >= 0.5 && bundle.axes.length >= 3) {
        recommendations.push({
          type: 'consider_new_axis',
          bundle: bundle.axes,
          reason: `${Math.round(bundle.support * 100)}% of prototypes (${bundle.frequency}/${totalPrototypes}) use all these axes together`,
          action: `Consider creating a composite axis "${bundle.suggestedConcept}" to reduce redundancy`,
        });
      }
    }

    // Check for high complexity outliers
    const highComplexityOutliers = distribution.outliers.filter(
      (o) => o.axisCount > distribution.mean
    );
    if (highComplexityOutliers.length > 0) {
      recommendations.push({
        type: 'reduce_complexity',
        bundle: highComplexityOutliers.map((o) => o.prototypeId),
        reason: `${highComplexityOutliers.length} prototype(s) have unusually high axis counts (>${Math.round(distribution.mean + 2)} axes)`,
        action: 'Review these prototypes for potential simplification or splitting',
      });
    }

    // Check for low complexity outliers
    const lowComplexityOutliers = distribution.outliers.filter(
      (o) => o.axisCount < distribution.mean
    );
    if (lowComplexityOutliers.length > 0) {
      recommendations.push({
        type: 'balance_complexity',
        bundle: lowComplexityOutliers.map((o) => o.prototypeId),
        reason: `${lowComplexityOutliers.length} prototype(s) have unusually low axis counts (<${Math.round(Math.max(0, distribution.mean - 2))} axes)`,
        action:
          'Review these prototypes for potential enrichment with additional axes',
      });
    }

    // Check for imbalanced distribution (high variance)
    const iqr = distribution.q3 - distribution.q1;
    if (iqr > distribution.median && distribution.median > 0) {
      recommendations.push({
        type: 'balance_complexity',
        bundle: [],
        reason: `High complexity variance detected (IQR: ${iqr}, median: ${distribution.median})`,
        action:
          'Consider standardizing prototype complexity across the collection',
      });
    }

    return recommendations;
  }

  /**
   * Creates an empty result structure.
   *
   * @returns {ComplexityAnalysisResult} Empty complexity analysis result
   */
  #createEmptyResult() {
    return {
      distribution: {
        histogram: [],
        median: 0,
        q1: 0,
        q3: 0,
        min: 0,
        max: 0,
        mean: 0,
        outliers: [],
      },
      coOccurrence: { bundles: [] },
      recommendations: [],
      totalPrototypes: 0,
      averageComplexity: 0,
    };
  }
}

export default PrototypeComplexityAnalyzer;
