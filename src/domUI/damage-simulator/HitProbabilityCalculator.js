/**
 * @file Hit probability calculator service for damage simulator
 * @description Calculates hit probability distributions based on part weights
 * @see hitProbabilityWeightUtils.js - Weight utilities this service uses
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} PartData
 * @property {string} id - Part identifier
 * @property {string} name - Human-readable part name
 * @property {object | null} component - The anatomy:part component data
 */

/**
 * @typedef {object} PartProbability
 * @property {string} partId - Part identifier
 * @property {string} partName - Human-readable part name
 * @property {number} weight - Raw weight value
 * @property {number} probability - Percentage (0-100)
 * @property {string} tier - 'high' | 'medium' | 'low' | 'none'
 */

/**
 * @typedef {object} BarData
 * @property {string} partId - Part identifier
 * @property {string} label - Display label
 * @property {number} percentage - Probability percentage
 * @property {number} barWidth - Normalized width (0-100)
 * @property {string} colorClass - CSS class for color coding
 */

/**
 * @typedef {object} VisualizationData
 * @property {Array<BarData>} bars - Bar chart data
 * @property {number} maxProbability - Highest probability value
 * @property {number} totalParts - Number of parts
 */

/**
 * @typedef {object} HitProbabilityWeightUtils
 * @property {function(object | null): number} getEffectiveHitWeight
 * @property {function(Array): Array} filterEligibleHitTargets
 * @property {number} DEFAULT_HIT_PROBABILITY_WEIGHT
 */

/**
 * Pure calculation service for hit probability distributions.
 * Uses existing hitProbabilityWeightUtils for weight resolution.
 */
class HitProbabilityCalculator {
  /** @type {HitProbabilityWeightUtils} */
  #hitProbabilityWeightUtils;
  /** @type {object} */
  #logger;

  /**
   * @param {object} dependencies
   * @param {HitProbabilityWeightUtils} dependencies.hitProbabilityWeightUtils - Weight utilities module
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ hitProbabilityWeightUtils, logger }) {
    validateDependency(hitProbabilityWeightUtils, 'hitProbabilityWeightUtils', logger, {
      requiredMethods: ['getEffectiveHitWeight'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn'],
    });

    this.#hitProbabilityWeightUtils = hitProbabilityWeightUtils;
    this.#logger = logger;
  }

  /**
   * Calculate hit probabilities for all parts.
   *
   * @param {Array<PartData>} parts - Parts with weight data
   * @returns {Array<PartProbability>} Sorted by probability (highest first)
   */
  calculateProbabilities(parts) {
    if (!Array.isArray(parts) || parts.length === 0) {
      this.#logger.debug('[HitProbabilityCalculator] Empty parts array provided');
      return [];
    }

    // Get weights using existing utility
    const weights = parts.map((part) => ({
      partId: part.id,
      partName: part.name || part.id,
      weight: this.#hitProbabilityWeightUtils.getEffectiveHitWeight(part.component),
    }));

    // Calculate total weight
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

    if (totalWeight === 0) {
      this.#logger.debug('[HitProbabilityCalculator] Total weight is 0, all parts have zero probability');
      return weights.map((w) => ({
        ...w,
        probability: 0,
        tier: 'none',
      }));
    }

    // Calculate percentages and sort by probability (highest first)
    const probabilities = weights
      .map((w) => {
        const probability = (w.weight / totalWeight) * 100;
        return {
          ...w,
          probability: Math.round(probability * 10) / 10, // 1 decimal place
          tier: this.#getProbabilityTier(probability),
        };
      })
      .sort((a, b) => b.probability - a.probability);

    this.#logger.debug(`[HitProbabilityCalculator] Calculated probabilities for ${probabilities.length} parts`);
    return probabilities;
  }

  /**
   * Get probability distribution visualization data.
   *
   * @param {Array<PartProbability>} probabilities - Calculated probabilities
   * @returns {VisualizationData}
   */
  getVisualizationData(probabilities) {
    if (!Array.isArray(probabilities) || probabilities.length === 0) {
      return {
        bars: [],
        maxProbability: 0,
        totalParts: 0,
      };
    }

    const maxProbability = Math.max(...probabilities.map((p) => p.probability));

    const bars = probabilities.map((p) => ({
      partId: p.partId,
      label: p.partName,
      percentage: p.probability,
      barWidth: maxProbability > 0 ? (p.probability / maxProbability) * 100 : 0,
      colorClass: this.#getColorClass(p.tier),
    }));

    return {
      bars,
      maxProbability,
      totalParts: probabilities.length,
    };
  }

  /**
   * Calculate cumulative probability up to and including the specified part.
   *
   * @param {Array<PartProbability>} probabilities - Sorted probabilities array
   * @param {string} partId - Target part ID
   * @returns {number} Cumulative probability percentage (0-100)
   */
  getCumulativeProbability(probabilities, partId) {
    if (!Array.isArray(probabilities) || probabilities.length === 0) {
      return 0;
    }

    let cumulative = 0;
    for (const p of probabilities) {
      cumulative += p.probability;
      if (p.partId === partId) {
        return Math.round(cumulative * 10) / 10;
      }
    }

    // Part not found - return total as fallback
    this.#logger.warn(`[HitProbabilityCalculator] Part ID '${partId}' not found in probabilities`);
    return Math.round(cumulative * 10) / 10;
  }

  /**
   * Get parts above probability threshold.
   *
   * @param {Array<PartProbability>} probabilities - Calculated probabilities
   * @param {number} threshold - Minimum percentage (0-100)
   * @returns {Array<PartProbability>} Filtered parts
   */
  getHighProbabilityParts(probabilities, threshold) {
    if (!Array.isArray(probabilities)) {
      return [];
    }

    const numericThreshold = typeof threshold === 'number' ? threshold : 0;
    return probabilities.filter((p) => p.probability >= numericThreshold);
  }

  /**
   * Determine probability tier based on percentage.
   *
   * @private
   * @param {number} percentage - Probability percentage
   * @returns {string} 'high' | 'medium' | 'low' | 'none'
   */
  #getProbabilityTier(percentage) {
    if (percentage <= 0) return 'none';
    if (percentage >= 15) return 'high';
    if (percentage >= 5) return 'medium';
    return 'low';
  }

  /**
   * Get CSS color class for tier.
   *
   * @private
   * @param {string} tier - Probability tier
   * @returns {string} CSS class name
   */
  #getColorClass(tier) {
    switch (tier) {
      case 'high':
        return 'ds-prob-high';
      case 'medium':
        return 'ds-prob-medium';
      case 'low':
        return 'ds-prob-low';
      default:
        return 'ds-prob-none';
    }
  }
}

export default HitProbabilityCalculator;
