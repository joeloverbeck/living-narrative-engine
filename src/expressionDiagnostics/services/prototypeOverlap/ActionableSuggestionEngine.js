/**
 * @file ActionableSuggestionEngine - Data-driven threshold suggestions via decision stumps.
 * @see specs/prototype-analysis-overhaul-v3.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import {
  ALL_PROTOTYPE_WEIGHT_AXES,
  getAxisCategory,
} from '../../../constants/prototypeAxisConstants.js';
import { resolveAxisValue } from '../../utils/axisNormalizationUtils.js';

const DEFAULT_CONFIG = Object.freeze({
  minSamplesForStump: 100,
  minInfoGainForSuggestion: 0.05,
  divergenceThreshold: 0.1,
  maxSuggestionsPerPair: 3,
  minOverlapReductionForSuggestion: 0.1,
  minActivationRateAfterSuggestion: 0.01,
});

const DEFAULT_AXIS_RANGE_BY_CATEGORY = Object.freeze({
  mood: { min: -1, max: 1 },
  affect_trait: { min: 0, max: 1 },
  sexual: { min: 0, max: 1 },
});

const buildDefaultAxisRanges = () => {
  const ranges = {};
  for (const axis of ALL_PROTOTYPE_WEIGHT_AXES) {
    const category = getAxisCategory(axis);
    const defaultRange = DEFAULT_AXIS_RANGE_BY_CATEGORY[category];
    if (defaultRange) {
      ranges[axis] = { ...defaultRange };
    }
  }
  return ranges;
};

const DEFAULT_AXIS_RANGES = Object.freeze(buildDefaultAxisRanges());

class ActionableSuggestionEngine {
  #config;
  #axisRanges;
  #logger;
  #contextAxisNormalizer;

  /**
   * Create a suggestion engine for data-driven thresholding.
   *
   * @param {object} options - Constructor options.
   * @param {object} [options.config] - Configuration overrides.
   * @param {import('../../../interfaces/coreServices.js').ILogger} options.logger - Logger instance.
   * @param {object} options.contextAxisNormalizer - ContextAxisNormalizer instance.
   */
  constructor({ config = {}, logger, contextAxisNormalizer }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(contextAxisNormalizer, 'IContextAxisNormalizer', logger, {
      requiredMethods: ['getNormalizedAxes'],
    });

    if (config && typeof config !== 'object') {
      const message =
        'ActionableSuggestionEngine: config must be an object when provided.';
      logger.error(message, { configType: typeof config });
      throw new Error(message);
    }

    const axisRanges = {
      ...DEFAULT_AXIS_RANGES,
      ...(config?.axisRanges ?? {}),
    };

    this.#config = {
      ...DEFAULT_CONFIG,
      ...config,
      axisRanges,
    };
    this.#axisRanges = axisRanges;
    this.#logger = logger;
    this.#contextAxisNormalizer = contextAxisNormalizer;
  }

  /**
   * Generate actionable suggestions for a classified pair.
   *
   * @param {PrototypeOutputVector} vectorA - Output vector for prototype A.
   * @param {PrototypeOutputVector} vectorB - Output vector for prototype B.
   * @param {Array<object>} contextPool - Shared context pool aligned to vectors.
   * @param {string} classification - Classification label for logging context.
   * @returns {Array<ActionableSuggestion>} Suggestions with validation metadata.
   */
  generateSuggestions(vectorA, vectorB, contextPool, classification) {
    const { gateResults: gateResultsA, intensities: intensitiesA } =
      this.#validateVector(vectorA, 'vectorA');
    const { gateResults: gateResultsB, intensities: intensitiesB } =
      this.#validateVector(vectorB, 'vectorB');

    if (!Array.isArray(contextPool)) {
      throw new Error(
        'ActionableSuggestionEngine.generateSuggestions expects contextPool array'
      );
    }

    if (gateResultsA.length !== gateResultsB.length) {
      const message =
        'ActionableSuggestionEngine: gateResults lengths must match.';
      this.#logger.error(message, {
        lengthA: gateResultsA.length,
        lengthB: gateResultsB.length,
      });
      throw new Error(message);
    }

    if (gateResultsA.length !== contextPool.length) {
      const message =
        'ActionableSuggestionEngine: contextPool length must match vector length.';
      this.#logger.error(message, {
        contextPoolLength: contextPool.length,
        vectorLength: gateResultsA.length,
      });
      throw new Error(message);
    }

    if (contextPool.length === 0) {
      this.#logger.warn(
        'ActionableSuggestionEngine: contextPool is empty; no suggestions generated.',
        { classification }
      );
      return [];
    }

    const samples = this.#buildSamples(
      gateResultsA,
      gateResultsB,
      intensitiesA,
      intensitiesB,
      contextPool
    );
    const divergentSamples = this.#filterDivergentSamples(samples);

    if (divergentSamples.length < this.#config.minSamplesForStump) {
      this.#logger.debug(
        'ActionableSuggestionEngine: insufficient divergent samples for stump.',
        {
          classification,
          divergentSamples: divergentSamples.length,
          minSamplesForStump: this.#config.minSamplesForStump,
        }
      );
      return [];
    }

    const splitCandidates = this.#rankSplitCandidates(divergentSamples);
    if (splitCandidates.length === 0) {
      this.#logger.debug(
        'ActionableSuggestionEngine: no viable split candidates found.',
        { classification }
      );
      return [];
    }

    const suggestions = [];
    const seen = new Set();

    for (const candidate of splitCandidates) {
      if (suggestions.length >= this.#config.maxSuggestionsPerPair) {
        break;
      }
      const suggestion = this.#buildSuggestion(candidate, samples);
      if (!suggestion) {
        continue;
      }
      const key = `${suggestion.targetPrototype}:${suggestion.axis}:${suggestion.operator}:${suggestion.threshold.toFixed(4)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      suggestions.push(suggestion);
    }

    this.#logger.debug(
      `ActionableSuggestionEngine: generated ${suggestions.length} suggestions.`,
      {
        classification,
        totalCandidates: splitCandidates.length,
      }
    );

    return suggestions;
  }

  /**
   * Validate a suggestion against constraints.
   *
   * @param {ActionableSuggestion} suggestion - Suggestion to validate.
   * @param {object} [context] - Evaluation context.
   * @param {number} [context.activationRateAfter] - Activation rate after applying.
   * @param {boolean} [context.clamped] - Whether threshold was clamped.
   * @returns {{valid: boolean, message: string}} Validation result.
   */
  validateSuggestion(suggestion, context = {}) {
    if (!suggestion || typeof suggestion !== 'object') {
      return { valid: false, message: 'Suggestion must be an object.' };
    }

    const axisRange = this.#getAxisRange(suggestion.axis);
    if (!axisRange) {
      return {
        valid: false,
        message: `Unknown axis range for "${suggestion.axis}".`,
      };
    }

    if (
      suggestion.threshold < axisRange.min ||
      suggestion.threshold > axisRange.max
    ) {
      return {
        valid: false,
        message: 'Threshold falls outside the legal axis range.',
      };
    }

    if (
      typeof suggestion.overlapReductionEstimate === 'number' &&
      suggestion.overlapReductionEstimate <
        this.#config.minOverlapReductionForSuggestion
    ) {
      return {
        valid: false,
        message: `Overlap reduction below minimum (${this.#config.minOverlapReductionForSuggestion}).`,
      };
    }

    if (
      typeof context.activationRateAfter === 'number' &&
      context.activationRateAfter <
        this.#config.minActivationRateAfterSuggestion
    ) {
      return {
        valid: false,
        message: `Activation rate below minimum (${this.#config.minActivationRateAfterSuggestion}).`,
      };
    }

    const messages = [];
    if (context.clamped) {
      messages.push('Threshold clamped to axis range.');
    }

    return {
      valid: true,
      message: messages.length > 0 ? messages.join(' ') : 'OK',
    };
  }

  /**
   * Estimate impact of applying a suggestion.
   *
   * @param {ActionableSuggestion} suggestion - Suggestion to apply.
   * @param {PrototypeOutputVector} vectorA - Output vector for prototype A.
   * @param {PrototypeOutputVector} vectorB - Output vector for prototype B.
   * @param {Array<object>} contextPool - Shared context pool aligned to vectors.
   * @returns {{overlapReduction: number, activationImpact: number}} Impact estimates.
   */
  estimateImpact(suggestion, vectorA, vectorB, contextPool) {
    const { gateResults: gateResultsA, intensities: intensitiesA } =
      this.#validateVector(vectorA, 'vectorA');
    const { gateResults: gateResultsB, intensities: intensitiesB } =
      this.#validateVector(vectorB, 'vectorB');

    if (!Array.isArray(contextPool)) {
      throw new Error(
        'ActionableSuggestionEngine.estimateImpact expects contextPool array'
      );
    }

    if (gateResultsA.length !== gateResultsB.length) {
      throw new Error(
        'ActionableSuggestionEngine: vector lengths must match for impact estimation.'
      );
    }

    if (gateResultsA.length !== contextPool.length) {
      throw new Error(
        'ActionableSuggestionEngine: contextPool length must match vector length for impact estimation.'
      );
    }

    const samples = this.#buildSamples(
      gateResultsA,
      gateResultsB,
      intensitiesA,
      intensitiesB,
      contextPool
    );
    const impact = this.#estimateImpactFromSamples(suggestion, samples);

    return {
      overlapReduction: impact.overlapReduction,
      activationImpact: impact.activationImpact,
    };
  }

  #validateVector(vector, label) {
    if (!vector || typeof vector !== 'object') {
      const message = `ActionableSuggestionEngine: ${label} must be an object.`;
      this.#logger.error(message, { vector });
      throw new Error(message);
    }

    const { gateResults, intensities } = vector;
    if (!gateResults || typeof gateResults.length !== 'number') {
      const message = `ActionableSuggestionEngine: ${label}.gateResults must be array-like.`;
      this.#logger.error(message, { gateResults });
      throw new Error(message);
    }

    if (!intensities || typeof intensities.length !== 'number') {
      const message = `ActionableSuggestionEngine: ${label}.intensities must be array-like.`;
      this.#logger.error(message, { intensities });
      throw new Error(message);
    }

    if (gateResults.length !== intensities.length) {
      const message = `ActionableSuggestionEngine: ${label} vector lengths must match.`;
      this.#logger.error(message, {
        gateResultsLength: gateResults.length,
        intensitiesLength: intensities.length,
      });
      throw new Error(message);
    }

    return { gateResults, intensities };
  }

  #buildSamples(
    gateResultsA,
    gateResultsB,
    intensitiesA,
    intensitiesB,
    contextPool
  ) {
    const samples = [];

    for (let i = 0; i < contextPool.length; i += 1) {
      const normalized = this.#contextAxisNormalizer.getNormalizedAxes(
        contextPool[i]
      );
      const passA = gateResultsA[i] > 0;
      const passB = gateResultsB[i] > 0;
      const intensityA = intensitiesA[i] ?? 0;
      const intensityB = intensitiesB[i] ?? 0;

      samples.push({
        normalized,
        passA,
        passB,
        intensityA,
        intensityB,
        label: this.#resolveLabel(passA, passB, intensityA, intensityB),
      });
    }

    return samples;
  }

  #filterDivergentSamples(samples) {
    const threshold = this.#config.divergenceThreshold;
    return samples.filter(
      (sample) =>
        sample.passA !== sample.passB ||
        Math.abs(sample.intensityA - sample.intensityB) > threshold
    );
  }

  #resolveLabel(passA, passB, intensityA, intensityB) {
    if (passA && !passB) {
      return 'a';
    }
    if (!passA && passB) {
      return 'b';
    }
    return intensityA >= intensityB ? 'a' : 'b';
  }

  #rankSplitCandidates(divergentSamples) {
    const totalCounts = { a: 0, b: 0 };
    for (const sample of divergentSamples) {
      totalCounts[sample.label] += 1;
    }

    const baseEntropy = this.#entropy(totalCounts.a, totalCounts.b);
    if (baseEntropy === 0) {
      return [];
    }

    const candidates = [];
    const totalCount = divergentSamples.length;

    for (const axis of ALL_PROTOTYPE_WEIGHT_AXES) {
      const axisRange = this.#getAxisRange(axis);
      if (!axisRange) {
        continue;
      }

      const axisValues = divergentSamples.map((sample) => ({
        value: this.#resolveAxisValue(sample.normalized, axis),
        label: sample.label,
      }));
      axisValues.sort((a, b) => a.value - b.value);

      const leftCounts = { a: 0, b: 0 };

      for (let i = 0; i < axisValues.length - 1; i += 1) {
        const current = axisValues[i];
        leftCounts[current.label] += 1;

        if (axisValues[i].value === axisValues[i + 1].value) {
          continue;
        }

        const threshold =
          (axisValues[i].value + axisValues[i + 1].value) / 2;

        const leftCount = leftCounts.a + leftCounts.b;
        const rightCount = totalCount - leftCount;
        if (leftCount === 0 || rightCount === 0) {
          continue;
        }

        const rightCounts = {
          a: totalCounts.a - leftCounts.a,
          b: totalCounts.b - leftCounts.b,
        };

        const infoGain = this.#informationGain({
          baseEntropy,
          leftCounts,
          rightCounts,
          totalCount,
          leftCount,
          rightCount,
        });

        if (infoGain < this.#config.minInfoGainForSuggestion) {
          continue;
        }

        const leftDominant = this.#dominantSide(leftCounts);
        const rightDominant = this.#dominantSide(rightCounts);

        if (leftDominant.label === rightDominant.label) {
          continue;
        }

        const chosen = this.#chooseDominantSide(leftDominant, rightDominant);
        const confidenceScore = this.#computeConfidence(
          infoGain,
          baseEntropy,
          chosen.purity
        );

        candidates.push({
          axis,
          threshold,
          infoGain,
          targetPrototype: chosen.label,
          operator: chosen.operator,
          confidenceScore,
        });
      }
    }

    return candidates.sort((a, b) => {
      if (b.infoGain !== a.infoGain) {
        return b.infoGain - a.infoGain;
      }
      return b.confidenceScore - a.confidenceScore;
    });
  }

  #informationGain({
    baseEntropy,
    leftCounts,
    rightCounts,
    totalCount,
    leftCount,
    rightCount,
  }) {
    const leftEntropy = this.#entropy(leftCounts.a, leftCounts.b);
    const rightEntropy = this.#entropy(rightCounts.a, rightCounts.b);

    const weightedEntropy =
      (leftCount / totalCount) * leftEntropy +
      (rightCount / totalCount) * rightEntropy;

    return baseEntropy - weightedEntropy;
  }

  #entropy(countA, countB) {
    const total = countA + countB;
    if (total === 0) {
      return 0;
    }
    const pA = countA / total;
    const pB = countB / total;
    let entropy = 0;
    if (pA > 0) {
      entropy -= pA * Math.log2(pA);
    }
    if (pB > 0) {
      entropy -= pB * Math.log2(pB);
    }
    return entropy;
  }

  #dominantSide(counts) {
    const total = counts.a + counts.b;
    const label = counts.a >= counts.b ? 'a' : 'b';
    const dominantCount = Math.max(counts.a, counts.b);
    const purity = total > 0 ? dominantCount / total : 0;
    return { label, purity, count: total };
  }

  #chooseDominantSide(left, right) {
    if (left.purity > right.purity) {
      return { label: left.label, operator: '<=', purity: left.purity };
    }
    if (right.purity > left.purity) {
      return { label: right.label, operator: '>=', purity: right.purity };
    }
    if (left.count >= right.count) {
      return { label: left.label, operator: '<=', purity: left.purity };
    }
    return { label: right.label, operator: '>=', purity: right.purity };
  }

  #computeConfidence(infoGain, baseEntropy, purity) {
    if (baseEntropy === 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, (infoGain / baseEntropy) * purity));
  }

  #buildSuggestion(candidate, samples) {
    const axisRange = this.#getAxisRange(candidate.axis);
    if (!axisRange) {
      this.#logger.warn(
        'ActionableSuggestionEngine: missing axis range for suggestion.',
        { axis: candidate.axis }
      );
      return null;
    }

    let threshold = candidate.threshold;
    let clamped = false;
    if (threshold < axisRange.min) {
      threshold = axisRange.min;
      clamped = true;
    } else if (threshold > axisRange.max) {
      threshold = axisRange.max;
      clamped = true;
    }

    const suggestion = {
      targetPrototype: candidate.targetPrototype,
      axis: candidate.axis,
      operator: candidate.operator,
      threshold,
      confidenceScore: candidate.confidenceScore,
      overlapReductionEstimate: 0,
      activationImpactEstimate: 0,
      isValid: false,
      validationMessage: '',
    };

    const impact = this.#estimateImpactFromSamples(suggestion, samples);
    suggestion.overlapReductionEstimate = impact.overlapReduction;
    suggestion.activationImpactEstimate = impact.activationImpact;

    const validation = this.validateSuggestion(suggestion, {
      activationRateAfter: impact.activationRateAfter,
      clamped,
    });

    suggestion.isValid = validation.valid;
    suggestion.validationMessage = validation.message;

    if (!suggestion.isValid) {
      return null;
    }

    return suggestion;
  }

  #estimateImpactFromSamples(suggestion, samples) {
    const targetIsA = suggestion.targetPrototype === 'a';
    let targetActivationCount = 0;
    let targetActivationAfter = 0;
    let overlapCount = 0;
    let overlapAfter = 0;

    for (const sample of samples) {
      const passA = sample.passA;
      const passB = sample.passB;
      const targetPass = targetIsA ? passA : passB;
      const otherPass = targetIsA ? passB : passA;

      if (targetPass) {
        targetActivationCount += 1;
      }
      if (passA && passB) {
        overlapCount += 1;
      }

      if (targetPass && this.#evaluateSuggestion(sample, suggestion)) {
        targetActivationAfter += 1;
        if (otherPass) {
          overlapAfter += 1;
        }
      }
    }

    const total = samples.length;
    const activationRateAfter = total > 0 ? targetActivationAfter / total : 0;

    const activationImpact =
      targetActivationCount > 0
        ? (targetActivationAfter - targetActivationCount) /
          targetActivationCount
        : 0;

    const overlapReduction =
      overlapCount > 0 ? (overlapCount - overlapAfter) / overlapCount : 0;

    return { overlapReduction, activationImpact, activationRateAfter };
  }

  #evaluateSuggestion(sample, suggestion) {
    const value = this.#resolveAxisValue(sample.normalized, suggestion.axis);
    switch (suggestion.operator) {
      case '>':
        return value > suggestion.threshold;
      case '>=':
        return value >= suggestion.threshold;
      case '<':
        return value < suggestion.threshold;
      case '<=':
        return value <= suggestion.threshold;
      default:
        return false;
    }
  }

  #resolveAxisValue(normalized, axis) {
    return resolveAxisValue(
      axis,
      normalized.moodAxes,
      normalized.sexualAxes,
      normalized.traitAxes
    );
  }

  #getAxisRange(axis) {
    return this.#axisRanges[axis] ?? null;
  }
}

export default ActionableSuggestionEngine;

/**
 * @typedef {object} PrototypeOutputVector
 * @property {string} prototypeId - Prototype identifier.
 * @property {Float32Array} gateResults - Binary gate outcomes per context.
 * @property {Float32Array} intensities - Intensity values per context.
 * @property {number} activationRate - Activation fraction across the pool.
 * @property {number} meanIntensity - Mean intensity on activation.
 * @property {number} stdIntensity - Std dev of intensity on activation.
 */

/**
 * @typedef {object} ActionableSuggestion
 * @property {string} targetPrototype - 'a' | 'b'
 * @property {string} axis - The axis to constrain
 * @property {string} operator - '>=' | '<=' | '>' | '<'
 * @property {number} threshold - The suggested threshold value
 * @property {number} confidenceScore - Confidence in suggestion [0,1]
 * @property {number} overlapReductionEstimate - Estimated % reduction in overlap
 * @property {number} activationImpactEstimate - Estimated % change in activation
 * @property {boolean} isValid - Whether suggestion is within legal axis range
 * @property {string} validationMessage - Human-readable validation status
 */
