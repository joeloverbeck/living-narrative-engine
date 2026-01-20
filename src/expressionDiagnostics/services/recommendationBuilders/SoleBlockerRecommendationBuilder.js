/**
 * @file SoleBlockerRecommendationBuilder - Builds sole_blocker_edit recommendations.
 * @description Extracted from RecommendationEngine to handle the logic for
 * determining when to suggest threshold edits for clauses that are frequently
 * the sole blocker (all other clauses pass but this one fails).
 *
 * Emission logic:
 *   - Last-mile fail rate >= 10% (significant sole-blocker frequency)
 *   - Sample count >= 10 (statistical validity)
 *   - Valid percentile data exists (P50 at minimum)
 *
 * @see RecommendationEngine.js (orchestrator that delegates to this builder)
 */

import { getConfidence, getSeverity } from '../utils/recommendationUtils.js';

// === CONSTANTS ===

/** Minimum sole-blocker rate to trigger recommendation */
export const SOLE_BLOCKER_MIN_RATE = 0.1;

/** Minimum sample count for statistical validity */
export const SOLE_BLOCKER_MIN_SAMPLES = 10;

/**
 * Builder class for sole_blocker_edit recommendations.
 *
 * Responsible for:
 * - Determining when sole-blocker edit recommendations should be suggested
 * - Calculating threshold suggestions at P50 and P90 percentiles
 * - Building evidence and confidence assessments
 *
 * This builder is stateless and requires no constructor dependencies.
 */
class SoleBlockerRecommendationBuilder {
  /**
   * Build a sole_blocker_edit recommendation from clause facts.
   *
   * Generates actionable threshold suggestions when a clause is frequently
   * the decisive blocker (all other clauses pass but this one fails).
   *
   * @param {object} clause - Clause object with sole-blocker statistics.
   * @returns {object|null} The recommendation object, or null if no recommendation should be emitted.
   */
  build(clause) {
    const lastMileFailRate = clause?.lastMileFailRate;
    if (typeof lastMileFailRate !== 'number') {
      return null;
    }

    // Must have significant sole-blocker rate
    if (lastMileFailRate < SOLE_BLOCKER_MIN_RATE) {
      return null;
    }

    const soleBlockerSampleCount = clause?.soleBlockerSampleCount ?? 0;
    // Must have sufficient samples for statistical validity
    if (soleBlockerSampleCount < SOLE_BLOCKER_MIN_SAMPLES) {
      return null;
    }

    const soleBlockerP50 = clause?.soleBlockerP50;
    const soleBlockerP90 = clause?.soleBlockerP90;
    const thresholdValue = clause?.thresholdValue;
    const operator = clause?.operator;

    // Must have valid percentile data and threshold
    if (
      typeof soleBlockerP50 !== 'number' ||
      typeof thresholdValue !== 'number'
    ) {
      return null;
    }

    // Determine threshold edit direction
    const isLowerBetter = operator === '>=' || operator === '>';
    const direction = isLowerBetter ? 'lower' : 'raise';

    // Build threshold suggestions
    const thresholdSuggestions = this.#buildThresholdSuggestions({
      soleBlockerP50,
      soleBlockerP90,
      direction,
    });

    if (thresholdSuggestions.length === 0) {
      return null;
    }

    const impact = typeof clause.impact === 'number' ? clause.impact : 0;
    const confidence = getConfidence(soleBlockerSampleCount);

    const variableLabel = clause.clauseLabel || 'this clause';
    const ratePercent = (lastMileFailRate * 100).toFixed(0);

    const whyParts = this.#buildWhyParts({
      ratePercent,
      soleBlockerSampleCount,
      confidence,
    });

    const evidence = this.#buildEvidence({
      thresholdValue,
      ratePercent,
      soleBlockerSampleCount,
      soleBlockerP50,
      soleBlockerP90,
    });

    const actions = this.#buildActions({
      thresholdSuggestions,
      direction,
    });

    return {
      id: `sole_blocker_edit:${clause.clauseId ?? 'unknown'}`,
      type: 'sole_blocker_edit',
      severity: getSeverity(impact),
      confidence,
      title: `Best First Edit: ${direction === 'lower' ? 'Lower' : 'Raise'} threshold for ${variableLabel}`,
      why: whyParts.join(' '),
      evidence,
      actions,
      predictedEffect:
        'Editing this threshold is the most impactful single change to improve pass rate.',
      relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
      thresholdSuggestions,
    };
  }

  // === PRIVATE METHODS ===

  /**
   * Build threshold suggestions at P50 and P90 percentiles.
   *
   * @param {object} params
   * @param {number} params.soleBlockerP50 - 50th percentile value
   * @param {number|undefined} params.soleBlockerP90 - 90th percentile value
   * @param {string} params.direction - Edit direction ('lower' or 'raise')
   * @returns {Array<object>} Array of threshold suggestion objects
   */
  #buildThresholdSuggestions({ soleBlockerP50, soleBlockerP90, direction }) {
    const suggestions = [];

    if (typeof soleBlockerP50 === 'number') {
      suggestions.push({
        targetPassRate: 0.5,
        suggestedThreshold: soleBlockerP50,
        direction,
        percentile: 'P50',
      });
    }

    if (typeof soleBlockerP90 === 'number') {
      suggestions.push({
        targetPassRate: 0.9,
        suggestedThreshold: soleBlockerP90,
        direction,
        percentile: 'P90',
      });
    }

    return suggestions;
  }

  /**
   * Build the "why" explanation parts.
   *
   * @param {object} params
   * @param {string} params.ratePercent - Formatted rate percentage
   * @param {number} params.soleBlockerSampleCount - Number of samples
   * @param {string} params.confidence - Confidence level
   * @returns {Array<string>} Array of explanation strings
   */
  #buildWhyParts({ ratePercent, soleBlockerSampleCount, confidence }) {
    const parts = [
      `This clause is the decisive blocker in ${ratePercent}% of failed samples.`,
      `Based on ${soleBlockerSampleCount} sole-blocker observations.`,
    ];

    if (confidence === 'low') {
      parts.push(
        'Low confidence - consider running more simulations for better percentile estimates.'
      );
    }

    return parts;
  }

  /**
   * Build evidence array for the recommendation.
   *
   * @param {object} params
   * @param {number} params.thresholdValue - Current threshold value
   * @param {string} params.ratePercent - Formatted rate percentage
   * @param {number} params.soleBlockerSampleCount - Number of samples
   * @param {number} params.soleBlockerP50 - 50th percentile value
   * @param {number|undefined} params.soleBlockerP90 - 90th percentile value
   * @returns {Array<object>} Array of evidence objects
   */
  #buildEvidence({
    thresholdValue,
    ratePercent,
    soleBlockerSampleCount,
    soleBlockerP50,
    soleBlockerP90,
  }) {
    const evidence = [
      { label: 'Current threshold', value: thresholdValue.toFixed(2) },
      { label: 'Sole-blocker rate', value: `${ratePercent}%` },
      { label: 'Sample count', value: String(soleBlockerSampleCount) },
    ];

    if (typeof soleBlockerP50 === 'number') {
      evidence.push({
        label: 'P50 (50% pass)',
        value: soleBlockerP50.toFixed(2),
      });
    }

    if (typeof soleBlockerP90 === 'number') {
      evidence.push({
        label: 'P90 (90% pass)',
        value: soleBlockerP90.toFixed(2),
      });
    }

    return evidence;
  }

  /**
   * Build actions array for the recommendation.
   *
   * @param {object} params
   * @param {Array<object>} params.thresholdSuggestions - Threshold suggestions
   * @param {string} params.direction - Edit direction
   * @returns {Array<object>} Array of action objects
   */
  #buildActions({ thresholdSuggestions, direction }) {
    return thresholdSuggestions.map((suggestion) => ({
      label: `${direction === 'lower' ? 'Lower' : 'Raise'} threshold to ${suggestion.suggestedThreshold.toFixed(2)}`,
      detail: `Would pass ~${(suggestion.targetPassRate * 100).toFixed(0)}% of sole-blocker samples (${suggestion.percentile})`,
    }));
  }
}

export default SoleBlockerRecommendationBuilder;
