/**
 * @file PrototypeOverlapAnalyzer - Main orchestrator for prototype overlap analysis pipeline
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} AnalysisOptions
 * @property {'emotion'|'sexual'|'both'} [prototypeFamily='emotion'] - Family of prototypes to analyze
 * @property {number} [sampleCount] - Override sample count per pair
 * @property {function(string, number, number): void} [onProgress] - Progress callback (stage, completed, total)
 */

/**
 * @typedef {object} AnalysisMetadata
 * @property {'emotion'|'sexual'|'both'} prototypeFamily - Family analyzed
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

  // V3 services (optional - when present, enables V3 pipeline)
  #sharedContextPoolGenerator;
  #prototypeVectorEvaluator;
  #prototypeProfileCalculator;
  #axisGapAnalyzer;


  /**
   * Yield to the event loop to prevent UI blocking.
   * Uses requestIdleCallback when available, falls back to setTimeout.
   *
   * @returns {Promise<void>}
   */
  async #yieldToEventLoop() {
    await new Promise((resolve) => {
      if (typeof globalThis.requestIdleCallback === 'function') {
        globalThis.requestIdleCallback(resolve, { timeout: 0 });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

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
   * @param {object} [deps.sharedContextPoolGenerator] - V3: ISharedContextPoolGenerator with generate() (optional)
   * @param {object} [deps.prototypeVectorEvaluator] - V3: IPrototypeVectorEvaluator with evaluateAll() (optional)
   * @param {object} [deps.prototypeProfileCalculator] - V3: IPrototypeProfileCalculator with calculateSingle() (optional)
   * @param {object} [deps.axisGapAnalyzer] - V3: IAxisGapAnalyzer with analyze() (optional, Stage C.5)
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
    // V3 services (optional - enables V3 analysis pipeline when all three provided)
    sharedContextPoolGenerator = null,
    prototypeVectorEvaluator = null,
    prototypeProfileCalculator = null,
    // V3 Stage C.5: Axis gap analysis (optional, requires V3 mode)
    axisGapAnalyzer = null,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });

    validateDependency(
      prototypeRegistryService,
      'IPrototypeRegistryService',
      logger,
      { requiredMethods: ['getPrototypesByType', 'getAllPrototypes'] }
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

    // V3 services validation (optional - validate only if provided)
    if (sharedContextPoolGenerator) {
      validateDependency(
        sharedContextPoolGenerator,
        'ISharedContextPoolGenerator',
        logger,
        { requiredMethods: ['generate'] }
      );
    }
    if (prototypeVectorEvaluator) {
      validateDependency(
        prototypeVectorEvaluator,
        'IPrototypeVectorEvaluator',
        logger,
        { requiredMethods: ['evaluateAll'] }
      );
    }
    if (prototypeProfileCalculator) {
      validateDependency(
        prototypeProfileCalculator,
        'IPrototypeProfileCalculator',
        logger,
        { requiredMethods: ['calculateSingle'] }
      );
    }
    if (axisGapAnalyzer) {
      validateDependency(axisGapAnalyzer, 'IAxisGapAnalyzer', logger, {
        requiredMethods: ['analyze'],
      });
    }

    this.#prototypeRegistryService = prototypeRegistryService;
    this.#candidatePairFilter = candidatePairFilter;
    this.#behavioralOverlapEvaluator = behavioralOverlapEvaluator;
    this.#overlapClassifier = overlapClassifier;
    this.#overlapRecommendationBuilder = overlapRecommendationBuilder;
    this.#gateBandingSuggestionBuilder = gateBandingSuggestionBuilder;
    this.#config = config;
    this.#logger = logger;

    // V3 services (optional)
    this.#sharedContextPoolGenerator = sharedContextPoolGenerator;
    this.#prototypeVectorEvaluator = prototypeVectorEvaluator;
    this.#prototypeProfileCalculator = prototypeProfileCalculator;
    this.#axisGapAnalyzer = axisGapAnalyzer;
  }

  /**
   * Run the full prototype overlap analysis pipeline.
   *
   * @param {AnalysisOptions} [options] - Analysis options
   * @returns {Promise<AnalysisResult>} Analysis results with recommendations and metadata
   */
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
    const TOTAL_STAGES_V2 = 4;
    const TOTAL_STAGES_V3 = 5; // V3 adds setup stage
    const CLASSIFICATION_YIELD_INTERVAL = 10;

    // Stage 1: Get prototypes from registry
    let prototypes;
    if (prototypeFamily === 'both') {
      prototypes = this.#prototypeRegistryService.getAllPrototypes({
        hasEmotions: true,
        hasSexualStates: true,
      });
    } else {
      prototypes = this.#prototypeRegistryService.getPrototypesByType(prototypeFamily);
    }

    this.#logger.debug(
      `PrototypeOverlapAnalyzer: Found ${prototypes.length} prototypes for family '${prototypeFamily}'`
    );

    if (prototypes.length < 2) {
      this.#logger.info(
        `PrototypeOverlapAnalyzer: Fewer than 2 prototypes (${prototypes.length}), no analysis needed`
      );
      return this.#buildEmptyResult(prototypeFamily, prototypes.length);
    }

    // V3 Setup: Generate shared context pool and evaluate all prototypes upfront
    // This enables O(n) vector comparisons instead of O(n²) Monte Carlo sampling
    const isV3Mode =
      this.#sharedContextPoolGenerator &&
      this.#prototypeVectorEvaluator &&
      this.#prototypeProfileCalculator;

    // Determine total stages based on mode
    const TOTAL_STAGES = isV3Mode ? TOTAL_STAGES_V3 : TOTAL_STAGES_V2;

    let contextPool = null;
    let outputVectors = null;
    let profiles = null;
    let axisGapAnalysis = null;
    // Track classification results for axis gap analysis (V3 Stage C.5)
    const pairResults = [];

    if (isV3Mode) {
      // Report setup start
      onProgress?.('setup', {
        phase: 'pool',
        poolCurrent: 0,
        poolTotal: 1,
        stageNumber: 1,
        totalStages: TOTAL_STAGES,
      });

      // Generate shared context pool with progress (now async)
      contextPool = await this.#sharedContextPoolGenerator.generate((current, total) => {
        onProgress?.('setup', {
          phase: 'pool',
          poolCurrent: current,
          poolTotal: total,
          stageNumber: 1,
          totalStages: TOTAL_STAGES,
        });
      });
      this.#logger.info(
        `PrototypeOverlapAnalyzer V3: Generated shared context pool with ${contextPool.length} contexts`
      );

      // Report vector evaluation phase start
      onProgress?.('setup', {
        phase: 'vectors',
        vectorCurrent: 0,
        vectorTotal: prototypes.length,
        stageNumber: 1,
        totalStages: TOTAL_STAGES,
      });

      // Evaluate all prototypes on shared pool with progress reporting
      outputVectors = await this.#prototypeVectorEvaluator.evaluateAll(
        prototypes,
        contextPool,
        (current, total) => {
          onProgress?.('setup', {
            phase: 'vectors',
            vectorCurrent: current,
            vectorTotal: total,
            stageNumber: 1,
            totalStages: TOTAL_STAGES,
          });
        }
      );
      this.#logger.info(
        `PrototypeOverlapAnalyzer V3: Evaluated ${outputVectors.size} prototypes on shared pool`
      );

      // Report profile computation phase start
      onProgress?.('setup', {
        phase: 'profiles',
        stageNumber: 1,
        totalStages: TOTAL_STAGES,
      });

      // Compute profiles for all prototypes
      profiles = new Map();
      for (const proto of prototypes) {
        const protoId = proto.id ?? proto;
        const vector = outputVectors.get(protoId);
        if (vector) {
          profiles.set(
            protoId,
            this.#prototypeProfileCalculator.calculateSingle(proto, vector)
          );
        }
      }
      this.#logger.info(
        `PrototypeOverlapAnalyzer V3: Computed ${profiles.size} prototype profiles`
      );
    }

    // Stage numbers are offset by 1 in V3 mode (setup is stage 1)
    const STAGE_OFFSET = isV3Mode ? 1 : 0;
    const FILTERING_STAGE = 1 + STAGE_OFFSET;
    const EVALUATING_STAGE = 2 + STAGE_OFFSET;
    const CLASSIFYING_STAGE = 3 + STAGE_OFFSET;
    const RECOMMENDING_STAGE = 4 + STAGE_OFFSET;

    // Filter candidates (Stage A) - now async with progress
    onProgress?.('filtering', { current: 0, total: 1, stageNumber: FILTERING_STAGE, totalStages: TOTAL_STAGES });

    const { candidates: candidatePairs, stats: filteringStats } =
      await this.#candidatePairFilter.filterCandidates(prototypes, (progress) => {
        onProgress?.('filtering', {
          ...progress,
          stageNumber: FILTERING_STAGE,
          totalStages: TOTAL_STAGES
        });
      });

    onProgress?.('filtering', { current: 1, total: 1, stageNumber: FILTERING_STAGE, totalStages: TOTAL_STAGES });

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
      const protoIdA = prototypeA.id ?? prototypeA;
      const protoIdB = prototypeB.id ?? prototypeB;

      // Stage B: Behavioral evaluation
      // V3 mode: Use pre-computed vectors for O(n) comparison
      // V2 mode: Monte Carlo sampling with progress callback
      let behaviorResult;
      if (isV3Mode && outputVectors.has(protoIdA) && outputVectors.has(protoIdB)) {
        // V3: Vector-based evaluation (no sampling, uses pre-computed data)
        behaviorResult = await this.#behavioralOverlapEvaluator.evaluate(
          prototypeA,
          prototypeB,
          {
            vectorA: outputVectors.get(protoIdA),
            vectorB: outputVectors.get(protoIdB),
          }
        );
        // Report progress for V3 (no sample-level progress, report pair completion)
        onProgress?.('evaluating', {
          pairIndex: i + 1,
          pairTotal: totalPairs,
          sampleIndex: contextPool.length,
          sampleTotal: contextPool.length,
          stageNumber: EVALUATING_STAGE,
          totalStages: TOTAL_STAGES,
        });
      } else {
        // V2: Monte Carlo sampling with sample-level progress
        behaviorResult = await this.#behavioralOverlapEvaluator.evaluate(
          prototypeA,
          prototypeB,
          sampleCount,
          (sampleIndex, sampleTotal) => {
            onProgress?.('evaluating', {
              pairIndex: i,
              pairTotal: totalPairs,
              sampleIndex,
              sampleTotal,
              stageNumber: EVALUATING_STAGE,
              totalStages: TOTAL_STAGES,
            });
          }
        );
      }

      // Stage C: Classification
      // V3 mode: Use classifyV3 with profiles and agreement metrics
      // V2 mode: Use classify with behavioral metrics
      let classification;
      if (
        isV3Mode &&
        behaviorResult.agreementMetrics &&
        profiles.has(protoIdA) &&
        profiles.has(protoIdB)
      ) {
        // V3: Classification with profiles and agreement metrics
        classification = this.#overlapClassifier.classifyV3({
          agreementMetrics: behaviorResult.agreementMetrics,
          profileA: profiles.get(protoIdA),
          profileB: profiles.get(protoIdB),
        });
      } else {
        // V2: Classification with behavioral metrics
        classification = this.#overlapClassifier.classify(
          candidateMetrics,
          {
            gateOverlap: behaviorResult.gateOverlap,
            intensity: behaviorResult.intensity,
            passRates: behaviorResult.passRates,
            gateImplication: behaviorResult.gateImplication,
          }
        );
      }

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

      // Track pair result for axis gap analysis (V3 Stage C.5)
      pairResults.push({
        prototypeA,
        prototypeB,
        classification,
        candidateMetrics,
        behaviorResult,
      });

      // Yield to event loop periodically during classification
      if (i > 0 && i % CLASSIFICATION_YIELD_INTERVAL === 0) {
        await this.#yieldToEventLoop();
        onProgress?.('classifying', {
          pairIndex: i,
          pairTotal: totalPairs,
          stageNumber: CLASSIFYING_STAGE,
          totalStages: TOTAL_STAGES
        });
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
          effectiveCorrelation: metrics.effectiveCorrelation ?? NaN,
          correlationSource: metrics.correlationSource ?? 'none',
          correlationConfidence: metrics.correlationConfidence ?? 'none',
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
        recommendation.allMatchingClassifications =
          classification.allMatchingClassifications ?? [];
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

      // Yield to event loop periodically during recommendation building
      if (i > 0 && i % CLASSIFICATION_YIELD_INTERVAL === 0) {
        await this.#yieldToEventLoop();
        onProgress?.('recommending', {
          pairIndex: i,
          pairTotal: totalPairs,
          stageNumber: RECOMMENDING_STAGE,
          totalStages: TOTAL_STAGES
        });
      }
    }

    // Final progress update - report completion state
    if (onProgress && totalPairs > 0) {
      onProgress('evaluating', {
        pairIndex: totalPairs,
        pairTotal: totalPairs,
        sampleIndex: sampleCount,
        sampleTotal: sampleCount,
        stageNumber: EVALUATING_STAGE,
        totalStages: TOTAL_STAGES,
      });
    }

    // Stage C.5: Axis Gap Analysis (V3 only, when enabled)
    if (
      isV3Mode &&
      this.#axisGapAnalyzer &&
      this.#config.enableAxisGapDetection !== false
    ) {
      onProgress?.('axis_gap_analysis', {
        stageNumber: TOTAL_STAGES,
        totalStages: TOTAL_STAGES,
      });

      try {
        axisGapAnalysis = this.#axisGapAnalyzer.analyze(
          prototypes,
          outputVectors,
          profiles,
          pairResults,
          (stage, current, total) => {
            onProgress?.('axis_gap_analysis', {
              stage,
              current,
              total,
              stageNumber: TOTAL_STAGES,
              totalStages: TOTAL_STAGES,
            });
          }
        );
        this.#logger.info(
          `PrototypeOverlapAnalyzer V3: Axis gap analysis complete`
        );
      } catch (err) {
        this.#logger.error(
          'PrototypeOverlapAnalyzer: Axis gap analysis failed',
          err
        );
        // Continue without axis gap analysis - it's optional
        axisGapAnalysis = null;
      }
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

    // V3 performance logging
    if (isV3Mode) {
      const poolSize = contextPool?.length ?? 0;
      const prototypeCount = outputVectors?.size ?? 0;
      this.#logger.info(
        `PrototypeOverlapAnalyzer V3: Analysis complete\n` +
          `  Pool size: ${poolSize} contexts\n` +
          `  Prototypes evaluated: ${prototypeCount}\n` +
          `  Pairs analyzed: ${totalPairs}\n` +
          `  Complexity: O(${prototypeCount} × ${poolSize}) setup + O(${totalPairs}) vector ops\n` +
          `  vs V2: O(${totalPairs} × ${sampleCount}) Monte Carlo samples`
      );
    } else {
      this.#logger.info(
        `PrototypeOverlapAnalyzer: Analysis complete - ${recommendations.length} redundant pairs found from ${totalPairs} candidates`
      );
    }

    return {
      recommendations,
      nearMisses: nearMisses.slice(0, this.#config.maxNearMissPairsToReport ?? 10),
      axisGapAnalysis,
      metadata: {
        prototypeFamily,
        totalPrototypes: prototypes.length,
        candidatePairsFound: candidatePairs.length,
        candidatePairsEvaluated: totalPairs,
        redundantPairsFound: recommendations.length,
        sampleCountPerPair: isV3Mode ? contextPool?.length ?? sampleCount : sampleCount,
        filteringStats,
        classificationBreakdown,
        summaryInsight,
        // V3 metadata (when applicable)
        ...(isV3Mode && {
          analysisMode: 'v3',
          v3Metrics: {
            sharedPoolSize: contextPool?.length ?? 0,
            prototypeVectorsComputed: outputVectors?.size ?? 0,
            profilesComputed: profiles?.size ?? 0,
          },
        }),
        ...(!isV3Mode && { analysisMode: 'v2' }),
      },
    };
  }

  /**
   * Build empty result for edge cases (not enough prototypes).
   *
   * @param {'emotion'|'sexual'|'both'} prototypeFamily - Family analyzed
   * @param {number} totalPrototypes - Number of prototypes
   * @returns {AnalysisResult} Empty result
   */
  #buildEmptyResult(prototypeFamily, totalPrototypes) {
    return {
      recommendations: [],
      nearMisses: [],
      axisGapAnalysis: null,
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
   * Formula: gateOverlapRatio × w_gate + normalizedCorrelation × w_corr + (1 - globalMeanAbsDiff) × w_diff
   *
   * Default weights prioritize globalMeanAbsDiff (MAE metric) as primary,
   * since it directly measures "how similar are actual outputs" across ALL samples,
   * not just co-pass samples.
   *
   * @param {number} gateOverlapRatio - Ratio of co-pass to either-pass [0, 1]
   * @param {number} correlation - Pearson correlation (co-pass only) [-1, 1] or NaN
   * @param {number} globalMeanAbsDiff - Mean absolute difference over ALL samples [0, 1] or NaN
   * @returns {number} Composite score [0, 1] or NaN if insufficient data
   */
  #computeCompositeScore(gateOverlapRatio, correlation, globalMeanAbsDiff) {
    const wGate = this.#config.compositeScoreGateOverlapWeight ?? 0.3;
    const wCorr = this.#config.compositeScoreCorrelationWeight ?? 0.2;
    const wDiff = this.#config.compositeScoreGlobalDiffWeight ?? 0.5;

    // All inputs must be valid numbers for a meaningful composite score
    if (
      !Number.isFinite(gateOverlapRatio) ||
      !Number.isFinite(correlation) ||
      !Number.isFinite(globalMeanAbsDiff)
    ) {
      // Fallback: if we have gateOverlapRatio and correlation but missing global,
      // use a simplified formula with renormalized weights
      if (Number.isFinite(gateOverlapRatio) && Number.isFinite(correlation)) {
        // Normalize correlation from [-1, 1] to [0, 1]
        const normalizedCorr = (correlation + 1) / 2;
        const totalFallbackWeight = wGate + wCorr;
        if (!Number.isFinite(totalFallbackWeight) || totalFallbackWeight <= 0) {
          return NaN;
        }
        const normGate = wGate / totalFallbackWeight;
        const normCorr = wCorr / totalFallbackWeight;
        return gateOverlapRatio * normGate + normalizedCorr * normCorr;
      }
      return NaN;
    }

    // Normalize correlation from [-1, 1] to [0, 1]
    const normalizedCorr = (correlation + 1) / 2;

    // Clamp globalMeanAbsDiff to [0, 1] for safety
    const clampedGlobalDiff = Math.max(0, Math.min(1, globalMeanAbsDiff));

    // Composite formula: higher is "closer" / more similar
    // - gateOverlapRatio: how often both fire together
    // - normalizedCorr: how correlated intensities are when both fire
    // - (1 - globalMeanAbsDiff): low global difference = high similarity (primary signal)
    return (
      gateOverlapRatio * wGate +
      normalizedCorr * wCorr +
      (1 - clampedGlobalDiff) * wDiff
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
