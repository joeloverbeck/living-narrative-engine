/**
 * @file PrototypeOverlapAnalyzer - Main orchestrator for prototype overlap analysis pipeline
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} AnalysisOptions
 * @property {'emotion'|'sexual'} [prototypeFamily='emotion'] - Family of prototypes to analyze
 * @property {number} [sampleCount] - Override sample count per pair
 * @property {function(string, number, number): void} [onProgress] - Progress callback (stage, completed, total)
 */

/**
 * @typedef {object} AnalysisMetadata
 * @property {'emotion'|'sexual'} prototypeFamily - Family analyzed
 * @property {number} totalPrototypes - Number of prototypes in family
 * @property {number} candidatePairsFound - Candidate pairs from Stage A
 * @property {number} candidatePairsEvaluated - Pairs actually evaluated (may be limited)
 * @property {number} redundantPairsFound - Pairs classified as merge or subsumed
 * @property {number} sampleCountPerPair - Sample count used
 */

/**
 * @typedef {object} AnalysisResult
 * @property {Array<object>} recommendations - Recommendations sorted by severity descending
 * @property {AnalysisMetadata} metadata - Analysis metadata
 */

/**
 * Orchestrator service that coordinates the full overlap analysis pipeline.
 * Ties together candidate filtering, behavioral evaluation, classification,
 * and recommendation building.
 */
class PrototypeOverlapAnalyzer {
  #prototypeRegistryService;
  #candidatePairFilter;
  #behavioralOverlapEvaluator;
  #overlapClassifier;
  #overlapRecommendationBuilder;
  #gateBandingSuggestionBuilder;
  #config;
  #logger;

  /**
   * Constructs a new PrototypeOverlapAnalyzer instance.
   *
   * @param {object} deps - Dependencies object
   * @param {object} deps.prototypeRegistryService - IPrototypeRegistryService with getPrototypesByType()
   * @param {object} deps.candidatePairFilter - ICandidatePairFilter with filterCandidates()
   * @param {object} deps.behavioralOverlapEvaluator - IBehavioralOverlapEvaluator with evaluate()
   * @param {object} deps.overlapClassifier - IOverlapClassifier with classify()
   * @param {object} deps.overlapRecommendationBuilder - IOverlapRecommendationBuilder with build()
   * @param {object} deps.gateBandingSuggestionBuilder - IGateBandingSuggestionBuilder with buildSuggestions()
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG with maxCandidatePairs, sampleCountPerPair
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger - ILogger
   */
  constructor({
    prototypeRegistryService,
    candidatePairFilter,
    behavioralOverlapEvaluator,
    overlapClassifier,
    overlapRecommendationBuilder,
    gateBandingSuggestionBuilder,
    config,
    logger,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });

    validateDependency(
      prototypeRegistryService,
      'IPrototypeRegistryService',
      logger,
      { requiredMethods: ['getPrototypesByType'] }
    );

    validateDependency(candidatePairFilter, 'ICandidatePairFilter', logger, {
      requiredMethods: ['filterCandidates'],
    });

    validateDependency(
      behavioralOverlapEvaluator,
      'IBehavioralOverlapEvaluator',
      logger,
      { requiredMethods: ['evaluate'] }
    );

    validateDependency(overlapClassifier, 'IOverlapClassifier', logger, {
      requiredMethods: ['classify'],
    });

    validateDependency(
      overlapRecommendationBuilder,
      'IOverlapRecommendationBuilder',
      logger,
      { requiredMethods: ['build'] }
    );

    validateDependency(
      gateBandingSuggestionBuilder,
      'IGateBandingSuggestionBuilder',
      logger,
      { requiredMethods: ['buildSuggestions'] }
    );

    this.#validateConfig(config, logger);

    this.#prototypeRegistryService = prototypeRegistryService;
    this.#candidatePairFilter = candidatePairFilter;
    this.#behavioralOverlapEvaluator = behavioralOverlapEvaluator;
    this.#overlapClassifier = overlapClassifier;
    this.#overlapRecommendationBuilder = overlapRecommendationBuilder;
    this.#gateBandingSuggestionBuilder = gateBandingSuggestionBuilder;
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Run the full prototype overlap analysis pipeline.
   *
   * @param {AnalysisOptions} [options] - Analysis options
   * @returns {Promise<AnalysisResult>} Analysis results with recommendations and metadata
   */
  async analyze(options = {}) {
    const prototypeFamily = options.prototypeFamily ?? 'emotion';
    const sampleCount = options.sampleCount ?? this.#config.sampleCountPerPair;
    const onProgress = options.onProgress;

    // Stage 1: Get prototypes from registry
    const prototypes =
      this.#prototypeRegistryService.getPrototypesByType(prototypeFamily);

    this.#logger.debug(
      `PrototypeOverlapAnalyzer: Found ${prototypes.length} prototypes for family '${prototypeFamily}'`
    );

    if (prototypes.length < 2) {
      this.#logger.info(
        `PrototypeOverlapAnalyzer: Fewer than 2 prototypes (${prototypes.length}), no analysis needed`
      );
      return this.#buildEmptyResult(prototypeFamily, prototypes.length);
    }

    // Stage 2: Filter candidates (Stage A)
    onProgress?.('filtering', { current: 0, total: 1 });

    const { candidates: candidatePairs, stats: filteringStats } =
      this.#candidatePairFilter.filterCandidates(prototypes);

    onProgress?.('filtering', { current: 1, total: 1 });

    this.#logger.debug(
      `PrototypeOverlapAnalyzer: Stage A found ${candidatePairs.length} candidate pairs`
    );

    // Apply safety limit
    const maxPairs = this.#config.maxCandidatePairs ?? 5000;
    const pairsToEvaluate = candidatePairs.slice(0, maxPairs);

    if (candidatePairs.length > maxPairs) {
      this.#logger.warn(
        `PrototypeOverlapAnalyzer: Truncated candidate pairs from ${candidatePairs.length} to ${maxPairs} (safety limit)`
      );
    }

    // Stage 3: Evaluate each pair and build recommendations
    const recommendations = [];
    const nearMisses = [];
    const totalPairs = pairsToEvaluate.length;

    // Track classification breakdown (v2 types)
    const classificationBreakdown = {
      mergeRecommended: 0,
      subsumedRecommended: 0,
      nestedSiblings: 0,
      needsSeparation: 0,
      convertToExpression: 0,
      keepDistinct: 0,
    };

    // Track closest pair for summary insight using composite score
    // Composite score addresses selection bias by weighting gate overlap,
    // correlation, and global output similarity together
    let closestPair = null;
    let highestCompositeScore = -Infinity;

    for (let i = 0; i < totalPairs; i++) {
      const { prototypeA, prototypeB, candidateMetrics } = pairsToEvaluate[i];

      // Stage B: Behavioral evaluation (async with sample-level progress)
      const behaviorResult = await this.#behavioralOverlapEvaluator.evaluate(
        prototypeA,
        prototypeB,
        sampleCount,
        (sampleIndex, sampleTotal) => {
          onProgress?.('evaluating', {
            pairIndex: i,
            pairTotal: totalPairs,
            sampleIndex,
            sampleTotal,
          });
        }
      );

      // Stage C: Classification
      const classification = this.#overlapClassifier.classify(
        candidateMetrics,
        {
          gateOverlap: behaviorResult.gateOverlap,
          intensity: behaviorResult.intensity,
          passRates: behaviorResult.passRates,
          gateImplication: behaviorResult.gateImplication,
        }
      );

      // Update classification breakdown (v2 types)
      switch (classification.type) {
        case 'merge_recommended':
          classificationBreakdown.mergeRecommended++;
          break;
        case 'subsumed_recommended':
          classificationBreakdown.subsumedRecommended++;
          break;
        case 'nested_siblings':
          classificationBreakdown.nestedSiblings++;
          break;
        case 'needs_separation':
          classificationBreakdown.needsSeparation++;
          break;
        case 'convert_to_expression':
          classificationBreakdown.convertToExpression++;
          break;
        default:
          classificationBreakdown.keepDistinct++;
      }

      // Track closest pair for summary insight using composite score
      const metrics = classification.metrics ?? {};
      const compositeScore = this.#computeCompositeScore(
        metrics.gateOverlapRatio ?? 0,
        metrics.pearsonCorrelation ?? NaN,
        metrics.globalMeanAbsDiff ?? NaN
      );

      if (
        Number.isFinite(compositeScore) &&
        compositeScore > highestCompositeScore
      ) {
        highestCompositeScore = compositeScore;
        closestPair = {
          prototypeA: prototypeA.id,
          prototypeB: prototypeB.id,
          correlation: metrics.pearsonCorrelation ?? NaN,
          gateOverlapRatio: metrics.gateOverlapRatio ?? 0,
          compositeScore,
          globalMeanAbsDiff: metrics.globalMeanAbsDiff ?? NaN,
          globalL2Distance: metrics.globalL2Distance ?? NaN,
          globalOutputCorrelation: metrics.globalOutputCorrelation ?? NaN,
        };
      }

      // Build recommendations for pairs that need action (v2 types)
      const RECOMMENDATION_TYPES = [
        'merge_recommended',
        'subsumed_recommended',
        'nested_siblings',
        'needs_separation',
        'convert_to_expression',
      ];

      if (RECOMMENDATION_TYPES.includes(classification.type)) {
        // Generate banding suggestions for nested_siblings and needs_separation
        const BANDING_TYPES = ['nested_siblings', 'needs_separation'];
        const bandingSuggestions = BANDING_TYPES.includes(classification.type)
          ? this.#gateBandingSuggestionBuilder.buildSuggestions(
              behaviorResult.gateImplication,
              classification.type
            )
          : [];

        const recommendation = this.#overlapRecommendationBuilder.build(
          prototypeA,
          prototypeB,
          classification,
          candidateMetrics,
          {
            gateOverlap: behaviorResult.gateOverlap,
            intensity: behaviorResult.intensity,
            passRates: behaviorResult.passRates,
            highCoactivation: behaviorResult.highCoactivation,
            gateImplication: behaviorResult.gateImplication,
          },
          behaviorResult.divergenceExamples,
          bandingSuggestions,
          prototypeFamily
        );
        recommendations.push(recommendation);
      } else {
        // Check for near-misses (pairs that came close to redundancy thresholds)
        const nearMissInfo = this.#overlapClassifier.checkNearMiss?.(
          candidateMetrics,
          { gateOverlap: behaviorResult.gateOverlap, intensity: behaviorResult.intensity }
        );
        if (nearMissInfo?.isNearMiss) {
          nearMisses.push({
            prototypeA: prototypeA.id,
            prototypeB: prototypeB.id,
            nearMissInfo,
            candidateMetrics,
            behaviorMetrics: {
              gateOverlap: behaviorResult.gateOverlap,
              intensity: behaviorResult.intensity,
            },
          });
        }
      }
    }

    // Final progress update - report completion state
    if (onProgress && totalPairs > 0) {
      onProgress('evaluating', {
        pairIndex: totalPairs,
        pairTotal: totalPairs,
        sampleIndex: sampleCount,
        sampleTotal: sampleCount,
      });
    }

    // Sort recommendations by severity descending
    recommendations.sort((a, b) => b.severity - a.severity);

    // Sort near-misses by correlation descending
    nearMisses.sort(
      (a, b) =>
        (b.nearMissInfo?.metrics?.pearsonCorrelation ?? 0) -
        (a.nearMissInfo?.metrics?.pearsonCorrelation ?? 0)
    );

    // Generate summary insight
    const summaryInsight = this.#generateSummaryInsight(
      totalPairs,
      recommendations.length,
      nearMisses.length,
      closestPair,
      classificationBreakdown
    );

    this.#logger.info(
      `PrototypeOverlapAnalyzer: Analysis complete - ${recommendations.length} redundant pairs found from ${totalPairs} candidates`
    );

    return {
      recommendations,
      nearMisses: nearMisses.slice(0, this.#config.maxNearMissPairsToReport ?? 10),
      metadata: {
        prototypeFamily,
        totalPrototypes: prototypes.length,
        candidatePairsFound: candidatePairs.length,
        candidatePairsEvaluated: totalPairs,
        redundantPairsFound: recommendations.length,
        sampleCountPerPair: sampleCount,
        filteringStats,
        classificationBreakdown,
        summaryInsight,
      },
    };
  }

  /**
   * Build empty result for edge cases (not enough prototypes).
   *
   * @param {'emotion'|'sexual'} prototypeFamily - Family analyzed
   * @param {number} totalPrototypes - Number of prototypes
   * @returns {AnalysisResult} Empty result
   */
  #buildEmptyResult(prototypeFamily, totalPrototypes) {
    return {
      recommendations: [],
      nearMisses: [],
      metadata: {
        prototypeFamily,
        totalPrototypes,
        candidatePairsFound: 0,
        candidatePairsEvaluated: 0,
        redundantPairsFound: 0,
        sampleCountPerPair: this.#config.sampleCountPerPair,
        filteringStats: {
          totalPossiblePairs: 0,
          passedFiltering: 0,
          rejectedByActiveAxisOverlap: 0,
          rejectedBySignAgreement: 0,
          rejectedByCosineSimilarity: 0,
          prototypesWithValidWeights: totalPrototypes,
        },
        classificationBreakdown: {
          mergeRecommended: 0,
          subsumedRecommended: 0,
          nestedSiblings: 0,
          needsSeparation: 0,
          convertToExpression: 0,
          keepDistinct: 0,
        },
        summaryInsight: {
          status: 'insufficient_data',
          message:
            totalPrototypes < 2
              ? 'Fewer than 2 prototypes available for analysis.'
              : 'No candidate pairs found for evaluation.',
          closestPair: null,
        },
      },
    };
  }


  /**
   * Generate a summary insight based on analysis results.
   *
   * @param {number} totalPairsEvaluated - Total pairs that were evaluated
   * @param {number} redundantCount - Number of redundant pairs found
   * @param {number} nearMissCount - Number of near-miss pairs found
   * @param {object|null} closestPair - Info about the closest pair
   * @param {object} classificationBreakdown - Breakdown of v2 classification types
   * @returns {object} Summary insight object
   */
  #generateSummaryInsight(
    totalPairsEvaluated,
    redundantCount,
    nearMissCount,
    closestPair,
    classificationBreakdown
  ) {
    // Case 1: No pairs to evaluate
    if (totalPairsEvaluated === 0) {
      return {
        status: 'no_candidates',
        message:
          'No structurally similar pairs found. Prototypes are already well-differentiated at the structural level.',
        closestPair: null,
      };
    }

    // Case 2: Found redundant pairs (v2 types)
    if (redundantCount > 0) {
      const mergeCount = classificationBreakdown.mergeRecommended;
      const subsumedCount = classificationBreakdown.subsumedRecommended;
      let message = `Found ${redundantCount} redundant pair(s)`;
      if (mergeCount > 0 && subsumedCount > 0) {
        message += ` (${mergeCount} merge, ${subsumedCount} subsumed)`;
      } else if (mergeCount > 0) {
        message += ` recommended for merging`;
      } else {
        message += ` with subsumption relationships`;
      }
      message += '. Review recommendations above.';

      return {
        status: 'redundant_found',
        message,
        closestPair,
      };
    }

    // Case 3: No redundancy but some near-misses
    if (nearMissCount > 0) {
      return {
        status: 'near_misses',
        message: `All ${totalPairsEvaluated} structurally similar pairs were behaviorally distinct, but ${nearMissCount} pair(s) came close to redundancy thresholds.`,
        closestPair,
      };
    }

    // Case 4: All pairs well-differentiated
    return {
      status: 'well_differentiated',
      message: `All ${totalPairsEvaluated} structurally similar pairs were behaviorally distinct. Your prototypes are well-differentiated.`,
      closestPair,
    };
  }

  /**
   * Compute composite score for closest pair ranking.
   * Addresses selection bias by weighting gate overlap, correlation,
   * and global output similarity together.
   *
   * Formula: gateOverlapRatio × 0.5 + normalizedCorrelation × 0.3 + (1 - globalMeanAbsDiff) × 0.2
   *
   * @param {number} gateOverlapRatio - Ratio of co-pass to either-pass [0, 1]
   * @param {number} correlation - Pearson correlation (co-pass only) [-1, 1] or NaN
   * @param {number} globalMeanAbsDiff - Mean absolute difference over ALL samples [0, 1] or NaN
   * @returns {number} Composite score [0, 1] or NaN if insufficient data
   */
  #computeCompositeScore(gateOverlapRatio, correlation, globalMeanAbsDiff) {
    // All inputs must be valid numbers for a meaningful composite score
    if (
      !Number.isFinite(gateOverlapRatio) ||
      !Number.isFinite(correlation) ||
      !Number.isFinite(globalMeanAbsDiff)
    ) {
      // Fallback: if we have gateOverlapRatio and correlation but missing global,
      // use a simplified formula (legacy behavior compatible)
      if (Number.isFinite(gateOverlapRatio) && Number.isFinite(correlation)) {
        // Normalize correlation from [-1, 1] to [0, 1]
        const normalizedCorr = (correlation + 1) / 2;
        return gateOverlapRatio * 0.6 + normalizedCorr * 0.4;
      }
      return NaN;
    }

    // Normalize correlation from [-1, 1] to [0, 1]
    const normalizedCorr = (correlation + 1) / 2;

    // Clamp globalMeanAbsDiff to [0, 1] for safety
    const clampedGlobalDiff = Math.max(0, Math.min(1, globalMeanAbsDiff));

    // Composite formula: higher is "closer" / more similar
    // - gateOverlapRatio: how often both fire together (50% weight)
    // - normalizedCorr: how correlated intensities are when both fire (30% weight)
    // - (1 - globalMeanAbsDiff): low global difference = high similarity (20% weight)
    return (
      gateOverlapRatio * 0.5 +
      normalizedCorr * 0.3 +
      (1 - clampedGlobalDiff) * 0.2
    );
  }

  /**
   * Validate that config has required fields.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   */
  #validateConfig(config, logger) {
    if (!config || typeof config !== 'object') {
      logger.error('PrototypeOverlapAnalyzer: Missing or invalid config');
      throw new Error(
        'PrototypeOverlapAnalyzer requires a valid config object'
      );
    }

    const requiredKeys = ['sampleCountPerPair', 'maxCandidatePairs'];

    for (const key of requiredKeys) {
      if (typeof config[key] !== 'number') {
        logger.error(
          `PrototypeOverlapAnalyzer: Missing or invalid config.${key} (expected number)`
        );
        throw new Error(
          `PrototypeOverlapAnalyzer config requires numeric ${key}`
        );
      }
    }
  }
}

export default PrototypeOverlapAnalyzer;
