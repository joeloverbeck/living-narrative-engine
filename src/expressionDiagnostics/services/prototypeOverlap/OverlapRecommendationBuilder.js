/**
 * @file OverlapRecommendationBuilder - Builds actionable recommendations from overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} SharedDriver
 * @property {string} axis - Axis name
 * @property {number} weightA - Weight in prototype A
 * @property {number} weightB - Weight in prototype B
 */

/**
 * @typedef {object} KeyDifferentiator
 * @property {string} axis - Axis name
 * @property {string} reason - Explanation of difference (e.g., "opposite_sign", "only_in_A")
 */

/**
 * @typedef {object} DivergenceExample
 * @property {object} context - Random context where divergence occurred
 * @property {number} intensityA - Intensity of prototype A
 * @property {number} intensityB - Intensity of prototype B
 * @property {number} absDiff - Absolute difference |intensityA - intensityB|
 */

/**
 * @typedef {object} OverlapEvidence
 * @property {SharedDriver[]} sharedDrivers - Axes with significant weight in both prototypes
 * @property {KeyDifferentiator[]} keyDifferentiators - Axes that distinguish the prototypes
 * @property {DivergenceExample[]} divergenceExamples - Top K divergence examples
 */

/**
 * @typedef {object} CandidateMetrics
 * @property {number} activeAxisOverlap - Jaccard overlap of active axes
 * @property {number} signAgreement - Sign agreement ratio
 * @property {number} weightCosineSimilarity - Cosine similarity of weight vectors
 */

/**
 * @typedef {object} BehaviorMetrics
 * @property {number} onEitherRate - Rate at which either prototype fires
 * @property {number} onBothRate - Rate at which both fire together
 * @property {number} pOnlyRate - Rate at which only A fires
 * @property {number} qOnlyRate - Rate at which only B fires
 * @property {number} pearsonCorrelation - Correlation of intensities when both fire
 * @property {number} meanAbsDiff - Mean |intensityA - intensityB|
 * @property {number} dominanceP - Fraction where A dominates B
 * @property {number} dominanceQ - Fraction where B dominates A
 */

/**
 * @typedef {object} OverlapRecommendation
 * @property {'prototype_merge_suggestion'|'prototype_subsumption_suggestion'|'prototype_overlap_info'} type - Recommendation type based on classification
 * @property {'emotion'|'sexual'} prototypeFamily - Family of prototypes being analyzed
 * @property {{a: string, b: string}} prototypes - Prototype IDs
 * @property {number} severity - 0-1 score indicating urgency
 * @property {number} confidence - 0-1 score indicating data quality
 * @property {string[]} actions - Suggested actions
 * @property {CandidateMetrics} candidateMetrics - Stage A metrics
 * @property {BehaviorMetrics} behaviorMetrics - Stage B flattened metrics
 * @property {OverlapEvidence} evidence - Supporting evidence
 */

/**
 * Builds actionable recommendations from prototype overlap analysis results.
 *
 * Transforms raw classification data into user-friendly recommendations with:
 * - Severity scores indicating urgency
 * - Confidence scores indicating data quality
 * - Actionable suggestions
 * - Supporting evidence
 */
class OverlapRecommendationBuilder {
  #config;
  #logger;

  /**
   * Constructs a new OverlapRecommendationBuilder instance.
   *
   * @param {object} deps - Dependencies object
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG with activeAxisEpsilon
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - ILogger
   */
  constructor({ config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#validateConfig(config, logger);

    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Build a recommendation from analysis results.
   *
   * @param {object} prototypeA - First prototype with id, gates, weights
   * @param {object} prototypeB - Second prototype with id, gates, weights
   * @param {object} classification - From OverlapClassifier
   * @param {object} candidateMetrics - From CandidatePairFilter
   * @param {object} behaviorMetrics - From BehavioralOverlapEvaluator
   * @param {Array<DivergenceExample>} divergenceExamples - Top K divergence examples
   * @param {'emotion'|'sexual'} [prototypeFamily] - Family of prototypes being analyzed
   * @returns {OverlapRecommendation} Complete recommendation
   */
  build(
    prototypeA,
    prototypeB,
    classification,
    candidateMetrics,
    behaviorMetrics,
    divergenceExamples,
    prototypeFamily = 'emotion'
  ) {
    const type = this.#mapClassificationToType(classification);
    const severity = this.#computeSeverity(classification, behaviorMetrics);
    const confidence = this.#computeConfidence(behaviorMetrics);
    const actions = this.#buildActions(classification, prototypeA, prototypeB);
    const evidence = this.#buildEvidence(
      prototypeA,
      prototypeB,
      behaviorMetrics,
      divergenceExamples
    );

    const flatBehaviorMetrics = this.#flattenBehaviorMetrics(behaviorMetrics);
    const thresholdAnalysis = this.#buildThresholdAnalysis(classification);

    this.#logger.debug(
      `OverlapRecommendationBuilder: Built ${type} recommendation - ` +
        `severity=${severity.toFixed(3)}, confidence=${confidence.toFixed(3)}`
    );

    return {
      type,
      prototypeFamily,
      prototypes: {
        a: prototypeA?.id ?? 'unknown_a',
        b: prototypeB?.id ?? 'unknown_b',
      },
      severity,
      confidence,
      actions,
      candidateMetrics: candidateMetrics ?? {
        activeAxisOverlap: 0,
        signAgreement: 0,
        weightCosineSimilarity: 0,
      },
      behaviorMetrics: flatBehaviorMetrics,
      evidence,
      thresholdAnalysis,
    };
  }


  /**
   * Build threshold analysis showing how metrics compared to required thresholds.
   * This provides transparency about why a pair was classified the way it was.
   *
   * @param {object} classification - Classification result with thresholds and metrics
   * @returns {object} Threshold analysis with values, requirements, and met status
   */
  #buildThresholdAnalysis(classification) {
    const { type, thresholds, metrics } = classification;

    if (!thresholds || !metrics) {
      return null;
    }

    // Build analysis based on classification type
    if (type === 'merge') {
      return {
        classificationType: 'merge',
        mergeThresholds: {
          onEitherRate: {
            value: this.#safeNumber(metrics.onEitherRate),
            required: thresholds.minOnEitherRateForMerge,
            met: metrics.onEitherRate >= thresholds.minOnEitherRateForMerge,
          },
          gateOverlapRatio: {
            value: this.#safeNumber(metrics.gateOverlapRatio),
            required: thresholds.minGateOverlapRatio,
            met: metrics.gateOverlapRatio >= thresholds.minGateOverlapRatio,
          },
          correlation: {
            value: this.#safeNumber(metrics.pearsonCorrelation),
            required: thresholds.minCorrelationForMerge,
            met:
              !Number.isNaN(metrics.pearsonCorrelation) &&
              metrics.pearsonCorrelation >= thresholds.minCorrelationForMerge,
          },
          meanAbsDiff: {
            value: this.#safeNumber(metrics.meanAbsDiff),
            required: thresholds.maxMeanAbsDiffForMerge,
            met:
              !Number.isNaN(metrics.meanAbsDiff) &&
              metrics.meanAbsDiff <= thresholds.maxMeanAbsDiffForMerge,
          },
        },
        allThresholdsMet: true,
        failureReason: null,
      };
    }

    if (type === 'subsumed') {
      const subsumedPrototype = classification.subsumedPrototype;
      return {
        classificationType: 'subsumed',
        subsumedPrototype,
        subsumptionThresholds: {
          correlation: {
            value: this.#safeNumber(metrics.pearsonCorrelation),
            required: thresholds.minCorrelationForSubsumption,
            met:
              !Number.isNaN(metrics.pearsonCorrelation) &&
              metrics.pearsonCorrelation >= thresholds.minCorrelationForSubsumption,
          },
          exclusiveRate: {
            pOnlyRate: this.#safeNumber(metrics.pOnlyRate),
            qOnlyRate: this.#safeNumber(metrics.qOnlyRate),
            required: thresholds.maxExclusiveRateForSubsumption,
            metP: metrics.pOnlyRate <= thresholds.maxExclusiveRateForSubsumption,
            metQ: metrics.qOnlyRate <= thresholds.maxExclusiveRateForSubsumption,
          },
          dominance: {
            dominanceP: this.#safeNumber(metrics.dominanceP),
            dominanceQ: this.#safeNumber(metrics.dominanceQ),
            required: thresholds.minDominanceForSubsumption,
            metP: metrics.dominanceP >= thresholds.minDominanceForSubsumption,
            metQ: metrics.dominanceQ >= thresholds.minDominanceForSubsumption,
          },
        },
        allThresholdsMet: true,
        failureReason: null,
      };
    }

    // For not_redundant, show what failed
    const failureReasons = [];

    // Check merge thresholds and identify what failed
    if (metrics.onEitherRate < thresholds.minOnEitherRateForMerge) {
      failureReasons.push(
        `onEitherRate too low (${metrics.onEitherRate.toFixed(3)} vs ${thresholds.minOnEitherRateForMerge} required)`
      );
    }
    if (metrics.gateOverlapRatio < thresholds.minGateOverlapRatio) {
      failureReasons.push(
        `gateOverlapRatio too low (${metrics.gateOverlapRatio.toFixed(3)} vs ${thresholds.minGateOverlapRatio} required)`
      );
    }
    if (
      Number.isNaN(metrics.pearsonCorrelation) ||
      metrics.pearsonCorrelation < thresholds.minCorrelationForMerge
    ) {
      const corrValue = Number.isNaN(metrics.pearsonCorrelation)
        ? 'NaN'
        : metrics.pearsonCorrelation.toFixed(3);
      failureReasons.push(
        `correlation too low (${corrValue} vs ${thresholds.minCorrelationForMerge} required)`
      );
    }
    if (
      Number.isNaN(metrics.meanAbsDiff) ||
      metrics.meanAbsDiff > thresholds.maxMeanAbsDiffForMerge
    ) {
      const diffValue = Number.isNaN(metrics.meanAbsDiff)
        ? 'NaN'
        : metrics.meanAbsDiff.toFixed(3);
      failureReasons.push(
        `meanAbsDiff too high (${diffValue} vs ${thresholds.maxMeanAbsDiffForMerge} max)`
      );
    }

    return {
      classificationType: 'not_redundant',
      mergeThresholds: {
        onEitherRate: {
          value: this.#safeNumber(metrics.onEitherRate),
          required: thresholds.minOnEitherRateForMerge,
          met: metrics.onEitherRate >= thresholds.minOnEitherRateForMerge,
        },
        gateOverlapRatio: {
          value: this.#safeNumber(metrics.gateOverlapRatio),
          required: thresholds.minGateOverlapRatio,
          met: metrics.gateOverlapRatio >= thresholds.minGateOverlapRatio,
        },
        correlation: {
          value: this.#safeNumber(metrics.pearsonCorrelation),
          required: thresholds.minCorrelationForMerge,
          met:
            !Number.isNaN(metrics.pearsonCorrelation) &&
            metrics.pearsonCorrelation >= thresholds.minCorrelationForMerge,
        },
        meanAbsDiff: {
          value: this.#safeNumber(metrics.meanAbsDiff),
          required: thresholds.maxMeanAbsDiffForMerge,
          met:
            !Number.isNaN(metrics.meanAbsDiff) &&
            metrics.meanAbsDiff <= thresholds.maxMeanAbsDiffForMerge,
        },
      },
      allThresholdsMet: false,
      failureReason:
        failureReasons.length > 0 ? failureReasons.join('; ') : 'Unknown',
    };
  }

  /**
   * Map classification type to recommendation type.
   *
   * @param {object} classification - Classification result
   * @returns {'prototype_merge_suggestion'|'prototype_subsumption_suggestion'|'prototype_overlap_info'} Recommendation type
   */
  #mapClassificationToType(classification) {
    const classType = classification?.type ?? 'not_redundant';

    switch (classType) {
      case 'merge':
        return 'prototype_merge_suggestion';
      case 'subsumed':
        return 'prototype_subsumption_suggestion';
      default:
        return 'prototype_overlap_info';
    }
  }

  /**
   * Compute severity score based on overlap strength.
   *
   * Severity formulas:
   * - MERGE: (correlation + gateOverlapRatio) / 2 - meanAbsDiff
   * - SUBSUMED: max(dominanceP, dominanceQ)
   * - NOT_REDUNDANT: weightCosineSimilarity * 0.3
   *
   * @param {object} classification - Classification result with metrics
   * @param {object} behaviorMetrics - Behavioral metrics from evaluator
   * @returns {number} Severity in [0, 1]
   */
  #computeSeverity(classification, behaviorMetrics) {
    const classType = classification?.type ?? 'not_redundant';
    const metrics = classification?.metrics ?? {};
    const gateOverlap = behaviorMetrics?.gateOverlap ?? {};
    const intensity = behaviorMetrics?.intensity ?? {};

    let severity = 0;

    switch (classType) {
      case 'merge': {
        const correlation = this.#safeNumber(intensity.pearsonCorrelation, 0);
        const onEither = this.#safeNumber(gateOverlap.onEitherRate, 0);
        const onBoth = this.#safeNumber(gateOverlap.onBothRate, 0);
        const gateOverlapRatio = onEither > 0 ? onBoth / onEither : 0;
        const meanAbsDiff = this.#safeNumber(intensity.meanAbsDiff, 0);

        severity = (correlation + gateOverlapRatio) / 2 - meanAbsDiff;
        break;
      }
      case 'subsumed': {
        const dominanceP = this.#safeNumber(intensity.dominanceP, 0);
        const dominanceQ = this.#safeNumber(intensity.dominanceQ, 0);
        severity = Math.max(dominanceP, dominanceQ);
        break;
      }
      default: {
        const cosineSim = this.#safeNumber(metrics.weightCosineSimilarity, 0);
        severity = cosineSim * 0.3;
        break;
      }
    }

    return Math.max(0, Math.min(1, severity));
  }

  /**
   * Compute confidence score based on sample quality.
   *
   * Confidence is primarily based on onEitherRate (how often at least one fires):
   * - onEitherRate >= 0.2 → confidence = 0.9-1.0
   * - onEitherRate >= 0.1 → confidence = 0.7-0.9
   * - onEitherRate >= 0.05 → confidence = 0.5-0.7
   * - onEitherRate < 0.05 → confidence = 0.3-0.5
   *
   * @param {object} behaviorMetrics - Behavioral metrics from evaluator
   * @returns {number} Confidence in [0, 1]
   */
  #computeConfidence(behaviorMetrics) {
    const gateOverlap = behaviorMetrics?.gateOverlap ?? {};
    const onEitherRate = this.#safeNumber(gateOverlap.onEitherRate, 0);

    // Map onEitherRate to confidence bands
    if (onEitherRate >= 0.2) {
      // Linear interpolation from 0.9 to 1.0 as onEitherRate goes from 0.2 to 1.0
      return 0.9 + 0.1 * Math.min(1, (onEitherRate - 0.2) / 0.8);
    }
    if (onEitherRate >= 0.1) {
      // Linear interpolation from 0.7 to 0.9 as onEitherRate goes from 0.1 to 0.2
      return 0.7 + 0.2 * ((onEitherRate - 0.1) / 0.1);
    }
    if (onEitherRate >= 0.05) {
      // Linear interpolation from 0.5 to 0.7 as onEitherRate goes from 0.05 to 0.1
      return 0.5 + 0.2 * ((onEitherRate - 0.05) / 0.05);
    }
    // Linear interpolation from 0.3 to 0.5 as onEitherRate goes from 0 to 0.05
    return 0.3 + 0.2 * (onEitherRate / 0.05);
  }

  /**
   * Generate action suggestions based on classification.
   *
   * @param {object} classification - Classification result
   * @param {object} prototypeA - First prototype
   * @param {object} prototypeB - Second prototype
   * @returns {string[]} Suggested actions
   */
  #buildActions(classification, prototypeA, prototypeB) {
    const classType = classification?.type ?? 'not_redundant';
    const nameA = prototypeA?.id ?? 'prototype A';
    const nameB = prototypeB?.id ?? 'prototype B';

    switch (classType) {
      case 'merge':
        return [
          `Consider merging "${nameA}" and "${nameB}" — they behave nearly identically`,
          `Alias one to the other to reduce redundancy`,
        ];
      case 'subsumed': {
        const subsumed = classification?.subsumedPrototype ?? 'a';
        const subsumedName = subsumed === 'a' ? nameA : nameB;
        const dominantName = subsumed === 'a' ? nameB : nameA;
        return [
          `Consider removing "${subsumedName}" — it's effectively a subset of "${dominantName}"`,
          `Tighten "${subsumedName}"'s gates to differentiate it from "${dominantName}"`,
        ];
      }
      default:
        return [
          'No action needed — prototypes are structurally similar but behaviorally distinct',
        ];
    }
  }

  /**
   * Build evidence structure with shared drivers, differentiators, and divergence examples.
   *
   * @param {object} prototypeA - First prototype
   * @param {object} prototypeB - Second prototype
   * @param {object} behaviorMetrics - Behavioral metrics
   * @param {Array<DivergenceExample>} divergenceExamples - Top K divergence examples
   * @returns {OverlapEvidence} Evidence structure
   */
  #buildEvidence(prototypeA, prototypeB, behaviorMetrics, divergenceExamples) {
    const weightsA = prototypeA?.weights ?? {};
    const weightsB = prototypeB?.weights ?? {};

    const sharedDrivers = this.#extractSharedDrivers(weightsA, weightsB);
    const keyDifferentiators = this.#identifyDifferentiators(
      weightsA,
      weightsB
    );

    // Pass through divergence examples as-is (they're already validated)
    const validDivergence = Array.isArray(divergenceExamples)
      ? divergenceExamples
      : [];

    return {
      sharedDrivers,
      keyDifferentiators,
      divergenceExamples: validDivergence,
    };
  }

  /**
   * Extract shared axis drivers from overlapping weights.
   * An axis is a "shared driver" if both prototypes have significant weight on it.
   *
   * @param {object} weightsA - Weights for prototype A
   * @param {object} weightsB - Weights for prototype B
   * @returns {SharedDriver[]} Shared drivers sorted by combined magnitude
   */
  #extractSharedDrivers(weightsA, weightsB) {
    const epsilon = this.#config?.activeAxisEpsilon ?? 0.08;
    const sharedDrivers = [];

    const allAxes = new Set([
      ...Object.keys(weightsA),
      ...Object.keys(weightsB),
    ]);

    for (const axis of allAxes) {
      const weightA = typeof weightsA[axis] === 'number' ? weightsA[axis] : 0;
      const weightB = typeof weightsB[axis] === 'number' ? weightsB[axis] : 0;

      // Both must have significant weight (above epsilon)
      if (Math.abs(weightA) >= epsilon && Math.abs(weightB) >= epsilon) {
        sharedDrivers.push({ axis, weightA, weightB });
      }
    }

    // Sort by combined magnitude (most important drivers first)
    sharedDrivers.sort(
      (a, b) =>
        Math.abs(b.weightA) +
        Math.abs(b.weightB) -
        (Math.abs(a.weightA) + Math.abs(a.weightB))
    );

    return sharedDrivers;
  }

  /**
   * Identify key differentiators between prototypes.
   *
   * Differentiators include:
   * - Opposite signs: Both have significant weight but different signs
   * - Only in A: Significant weight in A, negligible in B
   * - Only in B: Significant weight in B, negligible in A
   *
   * @param {object} weightsA - Weights for prototype A
   * @param {object} weightsB - Weights for prototype B
   * @returns {KeyDifferentiator[]} Key differentiators
   */
  #identifyDifferentiators(weightsA, weightsB) {
    const epsilon = this.#config?.activeAxisEpsilon ?? 0.08;
    const differentiators = [];

    const allAxes = new Set([
      ...Object.keys(weightsA),
      ...Object.keys(weightsB),
    ]);

    for (const axis of allAxes) {
      const weightA = typeof weightsA[axis] === 'number' ? weightsA[axis] : 0;
      const weightB = typeof weightsB[axis] === 'number' ? weightsB[axis] : 0;

      const aSignificant = Math.abs(weightA) >= epsilon;
      const bSignificant = Math.abs(weightB) >= epsilon;

      if (aSignificant && bSignificant) {
        // Check for opposite signs
        if (Math.sign(weightA) !== Math.sign(weightB)) {
          differentiators.push({ axis, reason: 'opposite_sign' });
        }
      } else if (aSignificant && !bSignificant) {
        differentiators.push({ axis, reason: 'only_in_A' });
      } else if (!aSignificant && bSignificant) {
        differentiators.push({ axis, reason: 'only_in_B' });
      }
    }

    return differentiators;
  }

  /**
   * Flatten behavioral metrics from nested structure to flat structure.
   *
   * @param {object} behaviorMetrics - Nested behavior metrics
   * @returns {BehaviorMetrics} Flattened metrics
   */
  #flattenBehaviorMetrics(behaviorMetrics) {
    const gateOverlap = behaviorMetrics?.gateOverlap ?? {};
    const intensity = behaviorMetrics?.intensity ?? {};

    return {
      onEitherRate: this.#safeNumber(gateOverlap.onEitherRate, 0),
      onBothRate: this.#safeNumber(gateOverlap.onBothRate, 0),
      pOnlyRate: this.#safeNumber(gateOverlap.pOnlyRate, 0),
      qOnlyRate: this.#safeNumber(gateOverlap.qOnlyRate, 0),
      pearsonCorrelation: this.#safeNumber(intensity.pearsonCorrelation, NaN),
      meanAbsDiff: this.#safeNumber(intensity.meanAbsDiff, NaN),
      dominanceP: this.#safeNumber(intensity.dominanceP, 0),
      dominanceQ: this.#safeNumber(intensity.dominanceQ, 0),
    };
  }

  /**
   * Safely convert a value to a number, returning default if NaN or invalid.
   *
   * @param {number|undefined|null} value - Value to convert
   * @param {number} defaultValue - Default if invalid
   * @returns {number} Safe number
   */
  #safeNumber(value, defaultValue) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return defaultValue;
    }
    return value;
  }

  /**
   * Validate that config has required fields.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   */
  #validateConfig(config, logger) {
    if (!config || typeof config !== 'object') {
      logger.error('OverlapRecommendationBuilder: Missing or invalid config');
      throw new Error(
        'OverlapRecommendationBuilder requires a valid config object'
      );
    }

    if (typeof config.activeAxisEpsilon !== 'number') {
      logger.error(
        'OverlapRecommendationBuilder: Missing or invalid config.activeAxisEpsilon'
      );
      throw new Error(
        'OverlapRecommendationBuilder config requires numeric activeAxisEpsilon'
      );
    }
  }
}

export default OverlapRecommendationBuilder;
