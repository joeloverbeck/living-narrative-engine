/**
 * @file PrototypeFitRankingService.js
 * @description Analyzes all emotion prototypes to rank them by fit to an expression's
 * mood regime. Provides three analysis features:
 * 1. Prototype Fit & Substitution - Ranks prototypes by gate pass rate, intensity, conflicts
 * 2. Implied Prototype - Converts prerequisites to target signature, finds best matches
 * 3. Gap Detection - Identifies missing prototype coverage
 * @see PrototypeConstraintAnalyzer.js - Used for individual prototype analysis
 * @see MonteCarloReportGenerator.js - Consumes analysis results for reports
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import ContextAxisNormalizer from './ContextAxisNormalizer.js';
import PrototypeGateChecker from './PrototypeGateChecker.js';
import PrototypeRegistryService from './PrototypeRegistryService.js';
import PrototypeIntensityCalculator from './PrototypeIntensityCalculator.js';
import PrototypeSimilarityMetrics from './PrototypeSimilarityMetrics.js';
import PrototypeGapAnalyzer from './PrototypeGapAnalyzer.js';
import PrototypeTypeDetector from './PrototypeTypeDetector.js';

/**
 * @typedef {object} PrototypeFitResult
 * @property {string} prototypeId - Emotion prototype ID
 * @property {number} gatePassRate - P(gates pass | mood_regime) [0,1]
 * @property {object} intensityDistribution - Intensity stats given gates pass
 * @property {number} intensityDistribution.p50 - Median intensity
 * @property {number} intensityDistribution.p90 - 90th percentile
 * @property {number} intensityDistribution.p95 - 95th percentile
 * @property {number} intensityDistribution.pAboveThreshold - P(intensity >= threshold)
 * @property {number} conflictScore - #conflicting_axes / #constrained_axes [0,1]
 * @property {number} conflictMagnitude - Sum of |weight| over conflicting axes
 * @property {Array<{axis: string, weight: number, direction: string}>} conflictingAxes
 * @property {number} compositeScore - Weighted ranking score
 * @property {number} rank - Position in leaderboard (1 = best)
 */

/**
 * @typedef {object} PrototypeFitAnalysis
 * @property {PrototypeFitResult[]} leaderboard - Top 10 ranked prototypes
 * @property {PrototypeFitResult|null} currentPrototype - Analysis of expression's prototype
 * @property {string|null} bestAlternative - Prototype ID of best alternative
 * @property {number|null} improvementFactor - How much better the alternative is
 */

/**
 * @typedef {object} TargetSignatureEntry
 * @property {number} direction - +1, -1, or 0
 * @property {number} tightness - Constraint tightness (0-1)
 * @property {number} lastMileWeight - Weight from last-mile failures
 * @property {number} importance - Combined importance
 */

/**
 * @typedef {object} ImpliedPrototypeAnalysis
 * @property {Map<string, TargetSignatureEntry>} targetSignature - Target vector
 * @property {Array<{prototypeId: string, cosineSimilarity: number, gatePassRate: number, combinedScore: number}>} bySimilarity
 * @property {Array<{prototypeId: string, cosineSimilarity: number, gatePassRate: number, combinedScore: number}>} byGatePass
 * @property {Array<{prototypeId: string, cosineSimilarity: number, gatePassRate: number, combinedScore: number}>} byCombined
 */

/**
 * @typedef {object} GapDetectionResult
 * @property {boolean} gapDetected - True if prototype gap exists
 * @property {number} nearestDistance - Distance to closest prototype
 * @property {Array<{prototypeId: string, weightDistance: number, gateDistance: number, combinedDistance: number, pIntensityAbove: number}>} kNearestNeighbors
 * @property {string|null} coverageWarning - Human-readable warning
 * @property {object|null} suggestedPrototype - Auto-synthesized prototype
 * @property {number} gapThreshold - Distance threshold used
 * @property {number|null} distanceZScore - Z-score vs prototype nearest-neighbor distances
 * @property {number|null} distancePercentile - Percentile vs prototype nearest-neighbor distances (0-1)
 * @property {string|null} distanceContext - Human-readable distance calibration context
 */

/**
 * @typedef {object} PrototypeTypeDetection
 * @property {boolean} hasEmotions - True if emotions.* references found
 * @property {boolean} hasSexualStates - True if sexualStates.* references found
 */

/**
 * @typedef {object} PrototypeRef
 * @property {string} id - Prototype ID
 * @property {'emotion'|'sexual'} type - Prototype type
 */

// Gap detection thresholds now managed by PrototypeGapAnalyzer

/**
 * Analyzes all emotion prototypes to rank them by fit to an expression's mood regime.
 */
class PrototypeFitRankingService {
  /** @type {object} */
  #logger;

  /** @type {object} */
  #prototypeRegistryService;

  /** @type {object} */
  #prototypeTypeDetector;

  /** @type {object} */
  #contextAxisNormalizer;

  /** @type {object} */
  #prototypeGateChecker;

  /** @type {object} */
  #prototypeIntensityCalculator;

  /** @type {object} */
  #prototypeSimilarityMetrics;

  /** @type {object} */
  #prototypeGapAnalyzer;

  /**
   * @param {object} deps
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger
   * @param {object} [deps.prototypeConstraintAnalyzer] - Optional IPrototypeConstraintAnalyzer for extracting axis constraints
   * @param {object} [deps.prototypeRegistryService] - Optional IPrototypeRegistryService for prototype lookups
   * @param {object} [deps.prototypeTypeDetector] - Optional IPrototypeTypeDetector for type detection
   * @param {object} [deps.contextAxisNormalizer] - Optional IContextAxisNormalizer for axis normalization
   * @param {object} [deps.prototypeGateChecker] - Optional IPrototypeGateChecker for gate evaluation
   * @param {object} [deps.prototypeIntensityCalculator] - Optional IPrototypeIntensityCalculator for intensity calculations
   * @param {object} [deps.prototypeSimilarityMetrics] - Optional IPrototypeSimilarityMetrics for similarity/distance computations
   * @param {object} [deps.prototypeGapAnalyzer] - Optional IPrototypeGapAnalyzer for gap detection and synthesis
   */
  constructor({
    dataRegistry,
    logger,
    prototypeConstraintAnalyzer = null,
    prototypeRegistryService = null,
    prototypeTypeDetector = null,
    contextAxisNormalizer = null,
    prototypeGateChecker = null,
    prototypeIntensityCalculator = null,
    prototypeSimilarityMetrics = null,
    prototypeGapAnalyzer = null,
  }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getLookupData'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#prototypeRegistryService =
      prototypeRegistryService ||
      new PrototypeRegistryService({ dataRegistry, logger });
    validateDependency(
      this.#prototypeRegistryService,
      'IPrototypeRegistryService',
      logger,
      {
        requiredMethods: [
          'getPrototypesByType',
          'getAllPrototypes',
          'getPrototypeDefinitions',
          'getPrototype',
        ],
      }
    );
    this.#prototypeTypeDetector =
      prototypeTypeDetector || new PrototypeTypeDetector({ logger });
    validateDependency(
      this.#prototypeTypeDetector,
      'IPrototypeTypeDetector',
      logger,
      {
        requiredMethods: ['detectReferencedTypes', 'extractCurrentPrototype'],
      }
    );
    this.#contextAxisNormalizer =
      contextAxisNormalizer ||
      new ContextAxisNormalizer({
        logger,
        prototypeConstraintAnalyzer,
      });
    validateDependency(
      this.#contextAxisNormalizer,
      'IContextAxisNormalizer',
      logger,
      {
        requiredMethods: ['filterToMoodRegime', 'normalizeConstraints', 'getNormalizedAxes'],
      }
    );
    this.#prototypeGateChecker =
      prototypeGateChecker ||
      new PrototypeGateChecker({
        logger,
        contextAxisNormalizer: this.#contextAxisNormalizer,
        prototypeConstraintAnalyzer,
      });
    validateDependency(this.#prototypeGateChecker, 'IPrototypeGateChecker', logger, {
      requiredMethods: [
        'checkAllGatesPass',
        'computeGatePassRate',
        'getGateCompatibility',
        'inferGatesFromConstraints',
        'computeGateDistance',
        'buildGateConstraints',
      ],
    });
    this.#prototypeIntensityCalculator =
      prototypeIntensityCalculator ||
      new PrototypeIntensityCalculator({
        logger,
        contextAxisNormalizer: this.#contextAxisNormalizer,
        prototypeGateChecker: this.#prototypeGateChecker,
      });
    validateDependency(
      this.#prototypeIntensityCalculator,
      'IPrototypeIntensityCalculator',
      logger,
      {
        requiredMethods: [
          'computeDistribution',
          'computeIntensity',
          'percentile',
          'analyzeConflicts',
          'computeCompositeScore',
          'getScoringWeights',
        ],
      }
    );
    this.#prototypeSimilarityMetrics =
      prototypeSimilarityMetrics ||
      new PrototypeSimilarityMetrics({
        logger,
        prototypeGateChecker: this.#prototypeGateChecker,
      });
    validateDependency(
      this.#prototypeSimilarityMetrics,
      'IPrototypeSimilarityMetrics',
      logger,
      {
        requiredMethods: [
          'computeCosineSimilarity',
          'computeWeightDistance',
          'computeCombinedDistance',
          'getDistanceDistribution',
          'buildDistanceStatsCacheKey',
          'computeDistancePercentile',
          'computeDistanceZScore',
          'buildDistanceContext',
        ],
      }
    );
    this.#prototypeGapAnalyzer =
      prototypeGapAnalyzer ||
      new PrototypeGapAnalyzer({
        logger,
        prototypeSimilarityMetrics: this.#prototypeSimilarityMetrics,
        prototypeGateChecker: this.#prototypeGateChecker,
        prototypeRegistryService: this.#prototypeRegistryService,
      });
    validateDependency(
      this.#prototypeGapAnalyzer,
      'IPrototypeGapAnalyzer',
      logger,
      {
        requiredMethods: [
          'buildTargetSignature',
          'targetSignatureToWeights',
          'detectGap',
          'synthesizePrototype',
          'getThresholds',
          'getKNeighbors',
        ],
      }
    );
  }

  // ============================================================================
  // FEATURE 1: Prototype Fit & Substitution Analysis
  // ============================================================================

  /**
   * Analyze all prototypes for fit to the expression's mood regime
   *
   * @param {Array|object} prerequisitesOrExpression - Expression prerequisites array OR expression object
   * @param {Array<object>} storedContexts - MC sample contexts
   * @param {Map<string, {min: number, max: number}>|undefined} [axisConstraintsParam] - Optional pre-extracted constraints
   * @param {number} [threshold=0.3] - Expression's emotion threshold
   * @returns {PrototypeFitAnalysis}
   */
  analyzeAllPrototypeFit(prerequisitesOrExpression, storedContexts, axisConstraintsParam, threshold = 0.3) {
    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.debug('PrototypeFitRankingService: No stored contexts for analysis');
      return { leaderboard: [], currentPrototype: null, bestAlternative: null, improvementFactor: null };
    }

    // Detect which prototype types are referenced in expression
    const typesToFetch = this.#prototypeTypeDetector.detectReferencedTypes(prerequisitesOrExpression);
    const expression = Array.isArray(prerequisitesOrExpression) ? null : prerequisitesOrExpression;

    // Early return if no prototype references found
    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      // Fall back to emotion prototypes for backward compatibility
      typesToFetch.hasEmotions = true;
    }

    const allPrototypes = this.#prototypeRegistryService.getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      this.#logger.warn('PrototypeFitRankingService: No prototypes found');
      return { leaderboard: [], currentPrototype: null, bestAlternative: null, improvementFactor: null };
    }

    // Normalize axis constraints - handle both prerequisites array and pre-extracted Map
    const axisConstraints = axisConstraintsParam instanceof Map
      ? axisConstraintsParam
      : this.#contextAxisNormalizer.normalizeConstraints(prerequisitesOrExpression);

    // Filter contexts to mood regime
    const regimeContexts = this.#contextAxisNormalizer.filterToMoodRegime(
      storedContexts,
      axisConstraints
    );
    this.#logger.debug(
      `PrototypeFitRankingService: ${regimeContexts.length}/${storedContexts.length} contexts in regime`
    );

    // Extract current prototype from expression (if any)
    const currentProtoRef = this.#prototypeTypeDetector.extractCurrentPrototype(expression);

    // Analyze each prototype
    const results = allPrototypes.map((proto) => {
      const gatePassRate = this.#prototypeGateChecker.computeGatePassRate(proto, regimeContexts);
      const intensityDist = this.#computeIntensityDistribution(
        proto,
        regimeContexts,
        threshold
      );
      const gateCompatibility = this.#prototypeGateChecker.getGateCompatibility(
        proto,
        axisConstraints,
        threshold
      );
      const inRegimeAchievableRange = {
        min: Number.isFinite(intensityDist.min) ? intensityDist.min : null,
        max: Number.isFinite(intensityDist.max) ? intensityDist.max : null,
      };
      const conflicts = this.#analyzeConflicts(proto.weights, axisConstraints);
      const exclusionCompat = 1.0; // TODO: implement exclusion compatibility

      const compositeScore = this.#computeCompositeScore({
        gatePassRate,
        pIntensityAbove: intensityDist.pAboveThreshold,
        conflictScore: conflicts.score,
        exclusionCompatibility: exclusionCompat,
      });

      return {
        prototypeId: proto.id,
        type: proto.type, // Include type in result
        gatePassRate,
        intensityDistribution: intensityDist,
        conflictScore: conflicts.score,
        conflictMagnitude: conflicts.magnitude,
        conflictingAxes: conflicts.axes,
        compositeScore,
        gateCompatibility,
        inRegimeAchievableRange,
        rank: 0, // Will be set after sorting
      };
    });

    // Sort by composite score descending
    results.sort((a, b) => b.compositeScore - a.compositeScore);

    // Assign ranks
    results.forEach((r, i) => {
      r.rank = i + 1;
    });

    // Build leaderboard (top 10)
    const leaderboard = results.slice(0, 10);

    // Find current prototype result (match by both id and type)
    const currentPrototype = currentProtoRef
      ? results.find((r) => r.prototypeId === currentProtoRef.id && r.type === currentProtoRef.type) || null
      : null;

    // Determine best alternative
    let bestAlternative = null;
    let improvementFactor = null;

    if (currentPrototype && leaderboard.length > 0 && leaderboard[0].prototypeId !== currentProtoRef?.id) {
      bestAlternative = leaderboard[0].prototypeId;
      if (currentPrototype.compositeScore > 0) {
        improvementFactor = leaderboard[0].compositeScore / currentPrototype.compositeScore;
      }
    }

    return { leaderboard, currentPrototype, bestAlternative, improvementFactor };
  }

  /**
   * Analyze all prototypes for fit to the expression's mood regime, yielding between chunks.
   *
   * @param {Array|object} prerequisitesOrExpression - Expression prerequisites array OR expression object
   * @param {Array<object>} storedContexts - MC sample contexts
   * @param {Map<string, {min: number, max: number}>|undefined} [axisConstraintsParam] - Optional pre-extracted constraints
   * @param {number} [threshold=0.3] - Expression's emotion threshold
   * @param {{ maxChunkMs?: number }} [options] - Yield tuning options
   * @returns {Promise<PrototypeFitAnalysis>}
   */
  async analyzeAllPrototypeFitAsync(
    prerequisitesOrExpression,
    storedContexts,
    axisConstraintsParam,
    threshold = 0.3,
    options = {}
  ) {
    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.debug('PrototypeFitRankingService: No stored contexts for analysis');
      return { leaderboard: [], currentPrototype: null, bestAlternative: null, improvementFactor: null };
    }

    const maxChunkMs = Number.isFinite(options.maxChunkMs) ? options.maxChunkMs : 12;
    const typesToFetch = this.#prototypeTypeDetector.detectReferencedTypes(prerequisitesOrExpression);
    const expression = Array.isArray(prerequisitesOrExpression) ? null : prerequisitesOrExpression;

    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      typesToFetch.hasEmotions = true;
    }

    const allPrototypes = this.#prototypeRegistryService.getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      this.#logger.warn('PrototypeFitRankingService: No prototypes found');
      return { leaderboard: [], currentPrototype: null, bestAlternative: null, improvementFactor: null };
    }

    const axisConstraints = axisConstraintsParam instanceof Map
      ? axisConstraintsParam
      : this.#contextAxisNormalizer.normalizeConstraints(prerequisitesOrExpression);

    const regimeContexts = this.#contextAxisNormalizer.filterToMoodRegime(
      storedContexts,
      axisConstraints
    );
    this.#logger.debug(
      `PrototypeFitRankingService: ${regimeContexts.length}/${storedContexts.length} contexts in regime`
    );

    const currentProtoRef = this.#prototypeTypeDetector.extractCurrentPrototype(expression);
    const results = [];
    let chunkStart = this.#now();

    for (const proto of allPrototypes) {
      const gatePassRate = this.#prototypeGateChecker.computeGatePassRate(proto, regimeContexts);
      const intensityDist = this.#computeIntensityDistribution(
        proto,
        regimeContexts,
        threshold
      );
      const gateCompatibility = this.#prototypeGateChecker.getGateCompatibility(
        proto,
        axisConstraints,
        threshold
      );
      const inRegimeAchievableRange = {
        min: Number.isFinite(intensityDist.min) ? intensityDist.min : null,
        max: Number.isFinite(intensityDist.max) ? intensityDist.max : null,
      };
      const conflicts = this.#analyzeConflicts(proto.weights, axisConstraints);
      const exclusionCompat = 1.0;

      const compositeScore = this.#computeCompositeScore({
        gatePassRate,
        pIntensityAbove: intensityDist.pAboveThreshold,
        conflictScore: conflicts.score,
        exclusionCompatibility: exclusionCompat,
      });

      results.push({
        prototypeId: proto.id,
        type: proto.type,
        gatePassRate,
        intensityDistribution: intensityDist,
        conflictScore: conflicts.score,
        conflictMagnitude: conflicts.magnitude,
        conflictingAxes: conflicts.axes,
        compositeScore,
        gateCompatibility,
        inRegimeAchievableRange,
        rank: 0,
      });

      if (this.#now() - chunkStart >= maxChunkMs) {
        await this.#yieldToBrowser();
        chunkStart = this.#now();
      }
    }

    results.sort((a, b) => b.compositeScore - a.compositeScore);
    results.forEach((r, i) => {
      r.rank = i + 1;
    });

    const leaderboard = results.slice(0, 10);
    const currentPrototype = currentProtoRef
      ? results.find((r) => r.prototypeId === currentProtoRef.id && r.type === currentProtoRef.type) || null
      : null;

    let bestAlternative = null;
    let improvementFactor = null;

    if (currentPrototype && leaderboard.length > 0 && leaderboard[0].prototypeId !== currentProtoRef?.id) {
      bestAlternative = leaderboard[0].prototypeId;
      if (currentPrototype.compositeScore > 0) {
        improvementFactor = leaderboard[0].compositeScore / currentPrototype.compositeScore;
      }
    }

    return { leaderboard, currentPrototype, bestAlternative, improvementFactor };
  }

  // ============================================================================
  // FEATURE 2: Implied Prototype from Prerequisites
  // ============================================================================

  /**
   * Compute implied prototype from expression prerequisites
   *
   * @param {Array|Map<string, {min: number, max: number}>|object} prerequisitesOrAxisConstraintsOrExpression - Prerequisites array, pre-extracted axis constraints, or expression object
   * @param {Array<object>} storedContexts - MC sample contexts (or clauseFailures if 3 args)
   * @param {Array<object>} [clauseFailuresParam] - Optional clause failure data for last-mile weighting
   * @returns {ImpliedPrototypeAnalysis}
   */
  computeImpliedPrototype(prerequisitesOrAxisConstraintsOrExpression, storedContexts, clauseFailuresParam) {
    // Normalize axis constraints - handle both prerequisites array and pre-extracted Map
    const axisConstraints = this.#contextAxisNormalizer.normalizeConstraints(
      prerequisitesOrAxisConstraintsOrExpression
    );

    // Get clauseFailures - may be passed as storedContexts if caller used old signature
    const clauseFailures = clauseFailuresParam || [];

    // Build target signature from constraints
    const targetSignature = this.#prototypeGapAnalyzer.buildTargetSignature(axisConstraints, clauseFailures);

    // Detect which prototype types to fetch (if expression provided)
    const typesToFetch = this.#prototypeTypeDetector.detectReferencedTypes(
      prerequisitesOrAxisConstraintsOrExpression
    );

    // Fall back to emotion prototypes for backward compatibility
    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      typesToFetch.hasEmotions = true;
    }

    const allPrototypes = this.#prototypeRegistryService.getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      return {
        targetSignature,
        bySimilarity: [],
        byGatePass: [],
        byCombined: [],
      };
    }

    const regimeContexts = this.#contextAxisNormalizer.filterToMoodRegime(
      storedContexts,
      axisConstraints
    );

    // Compute similarity for each prototype
    const similarities = allPrototypes.map((proto) => {
      const cosineSim = this.#prototypeSimilarityMetrics.computeCosineSimilarity(targetSignature, proto.weights);
      const gatePassRate = this.#prototypeGateChecker.computeGatePassRate(proto, regimeContexts);
      const combinedScore = 0.6 * cosineSim + 0.4 * gatePassRate;

      return {
        prototypeId: proto.id,
        type: proto.type, // Include type in result
        cosineSimilarity: cosineSim,
        gatePassRate,
        combinedScore,
      };
    });

    // Sort and get top 5 by each metric
    const bySimilarity = [...similarities]
      .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity)
      .slice(0, 5);

    const byGatePass = [...similarities]
      .sort((a, b) => b.gatePassRate - a.gatePassRate)
      .slice(0, 5);

    const byCombined = [...similarities]
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 5);

    return { targetSignature, bySimilarity, byGatePass, byCombined };
  }

  /**
   * Compute implied prototype from expression prerequisites, yielding between chunks.
   *
   * @param {Array|Map<string, {min: number, max: number}>|object} prerequisitesOrAxisConstraintsOrExpression
   * @param {Array<object>} storedContexts
   * @param {Array<object>} [clauseFailuresParam]
   * @param {{ maxChunkMs?: number }} [options]
   * @returns {Promise<ImpliedPrototypeAnalysis>}
   */
  async computeImpliedPrototypeAsync(
    prerequisitesOrAxisConstraintsOrExpression,
    storedContexts,
    clauseFailuresParam,
    options = {}
  ) {
    const axisConstraints = this.#contextAxisNormalizer.normalizeConstraints(
      prerequisitesOrAxisConstraintsOrExpression
    );
    const clauseFailures = clauseFailuresParam || [];
    const targetSignature = this.#prototypeGapAnalyzer.buildTargetSignature(axisConstraints, clauseFailures);
    const typesToFetch = this.#prototypeTypeDetector.detectReferencedTypes(
      prerequisitesOrAxisConstraintsOrExpression
    );

    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      typesToFetch.hasEmotions = true;
    }

    const allPrototypes = this.#prototypeRegistryService.getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      return {
        targetSignature,
        bySimilarity: [],
        byGatePass: [],
        byCombined: [],
      };
    }

    const regimeContexts = this.#contextAxisNormalizer.filterToMoodRegime(
      storedContexts,
      axisConstraints
    );
    const similarities = [];
    const maxChunkMs = Number.isFinite(options.maxChunkMs) ? options.maxChunkMs : 12;
    let chunkStart = this.#now();

    for (const proto of allPrototypes) {
      const cosineSim = this.#prototypeSimilarityMetrics.computeCosineSimilarity(targetSignature, proto.weights);
      const gatePassRate = this.#prototypeGateChecker.computeGatePassRate(proto, regimeContexts);
      const combinedScore = 0.6 * cosineSim + 0.4 * gatePassRate;

      similarities.push({
        prototypeId: proto.id,
        type: proto.type,
        cosineSimilarity: cosineSim,
        gatePassRate,
        combinedScore,
      });

      if (this.#now() - chunkStart >= maxChunkMs) {
        await this.#yieldToBrowser();
        chunkStart = this.#now();
      }
    }

    const bySimilarity = [...similarities]
      .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity)
      .slice(0, 5);

    const byGatePass = [...similarities]
      .sort((a, b) => b.gatePassRate - a.gatePassRate)
      .slice(0, 5);

    const byCombined = [...similarities]
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 5);

    return { targetSignature, bySimilarity, byGatePass, byCombined };
  }

  // ============================================================================
  // FEATURE 3: Gap Detection
  // ============================================================================

  /**
   * Detect prototype coverage gaps
   *
   * @param {Array|Map<string, TargetSignatureEntry>|object} prerequisitesOrTargetSignatureOrExpression - Prerequisites array, target signature, or expression object
   * @param {Array<object>} storedContexts - MC sample contexts
   * @param {Map<string, {min: number, max: number}>|undefined} [axisConstraintsParam] - Optional pre-extracted constraints
   * @param {number} [threshold=0.3] - Intensity threshold
   * @returns {GapDetectionResult}
   */
  detectPrototypeGaps(prerequisitesOrTargetSignatureOrExpression, storedContexts, axisConstraintsParam, threshold = 0.3) {
    // Detect which prototype types to fetch (if expression provided)
    const typesToFetch = this.#prototypeTypeDetector.detectReferencedTypes(
      prerequisitesOrTargetSignatureOrExpression
    );

    // Fall back to emotion prototypes for backward compatibility
    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      typesToFetch.hasEmotions = true;
    }

    const thresholds = this.#prototypeGapAnalyzer.getThresholds();
    const kNeighborsCount = this.#prototypeGapAnalyzer.getKNeighbors();

    const allPrototypes = this.#prototypeRegistryService.getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      return {
        gapDetected: false,
        nearestDistance: Infinity,
        kNearestNeighbors: [],
        coverageWarning: null,
        suggestedPrototype: null,
        gapThreshold: thresholds.distance,
      };
    }

    // Normalize axis constraints - handle both prerequisites array and pre-extracted Map
    const axisConstraints = axisConstraintsParam instanceof Map
      ? axisConstraintsParam
      : this.#contextAxisNormalizer.normalizeConstraints(
        prerequisitesOrTargetSignatureOrExpression
      );

    // Get or compute target signature
    let targetSignature;
    if (prerequisitesOrTargetSignatureOrExpression instanceof Map && !Array.isArray(prerequisitesOrTargetSignatureOrExpression)) {
      // Passed a Map - assume it's a target signature if it looks like one
      const firstVal = prerequisitesOrTargetSignatureOrExpression.values().next().value;
      if (firstVal && 'direction' in firstVal && 'importance' in firstVal) {
        targetSignature = prerequisitesOrTargetSignatureOrExpression;
      } else {
        // It's an axisConstraints map, build target signature from it
        targetSignature = this.#prototypeGapAnalyzer.buildTargetSignature(prerequisitesOrTargetSignatureOrExpression, []);
      }
    } else {
      // Passed prerequisites array or expression, compute target signature
      targetSignature = this.#prototypeGapAnalyzer.buildTargetSignature(axisConstraints, []);
    }

    // Build desired point from target signature
    const desiredWeights = this.#prototypeGapAnalyzer.targetSignatureToWeights(targetSignature);
    const desiredGates = this.#prototypeGateChecker.inferGatesFromConstraints(axisConstraints);

    const regimeContexts = this.#contextAxisNormalizer.filterToMoodRegime(
      storedContexts,
      axisConstraints
    );

    // Compute distance to each prototype
    const distances = allPrototypes.map((proto) => {
      const weightDist = this.#prototypeSimilarityMetrics.computeWeightDistance(desiredWeights, proto.weights);
      const gateDist = this.#prototypeGateChecker.computeGateDistance(desiredGates, proto.gates);
      const combinedDist = 0.7 * weightDist + 0.3 * gateDist;

      const intensityDist = this.#computeIntensityDistribution(
        proto,
        regimeContexts,
        threshold
      );

      return {
        prototypeId: proto.id,
        type: proto.type, // Include type in result
        weightDistance: weightDist,
        gateDistance: gateDist,
        combinedDistance: combinedDist,
        pIntensityAbove: intensityDist.pAboveThreshold,
      };
    });

    // Sort by combined distance, get k-nearest
    distances.sort((a, b) => a.combinedDistance - b.combinedDistance);
    const kNearest = distances.slice(0, kNeighborsCount);

    const nearestDist = kNearest[0]?.combinedDistance ?? Infinity;
    const bestIntensity = Math.max(...kNearest.map((d) => d.pIntensityAbove));

    const gapDetected = this.#prototypeGapAnalyzer.detectGap(nearestDist, bestIntensity);

    const distanceStatsKey = this.#prototypeSimilarityMetrics.buildDistanceStatsCacheKey(typesToFetch);
    const distanceStats = this.#prototypeSimilarityMetrics.getDistanceDistribution(distanceStatsKey, allPrototypes);
    const distancePercentile = distanceStats
      ? this.#prototypeSimilarityMetrics.computeDistancePercentile(distanceStats.sortedDistances, nearestDist)
      : null;
    const distanceZScore = distanceStats
      ? this.#prototypeSimilarityMetrics.computeDistanceZScore(distanceStats.mean, distanceStats.std, nearestDist)
      : null;
    const distanceContext = distanceStats
      ? this.#prototypeSimilarityMetrics.buildDistanceContext(nearestDist, distancePercentile, distanceZScore)
      : null;

    let coverageWarning = null;
    let suggestedPrototype = null;

    if (gapDetected) {
      coverageWarning =
        `No prototype within distance ${thresholds.distance.toFixed(2)}. ` +
        `Best achieves only ${(bestIntensity * 100).toFixed(1)}% intensity rate.`;
      suggestedPrototype = this.#prototypeGapAnalyzer.synthesizePrototype(kNearest, desiredWeights, axisConstraints);
    }

    return {
      gapDetected,
      nearestDistance: nearestDist,
      kNearestNeighbors: kNearest,
      coverageWarning,
      suggestedPrototype,
      gapThreshold: thresholds.distance,
      distanceZScore,
      distancePercentile,
      distanceContext,
    };
  }

  /**
   * Detect prototype coverage gaps, yielding between chunks.
   *
   * @param {Array|Map<string, TargetSignatureEntry>|object} prerequisitesOrTargetSignatureOrExpression
   * @param {Array<object>} storedContexts
   * @param {Map<string, {min: number, max: number}>|undefined} [axisConstraintsParam]
   * @param {number} [threshold=0.3]
   * @param {{ maxChunkMs?: number }} [options]
   * @returns {Promise<GapDetectionResult>}
   */
  async detectPrototypeGapsAsync(
    prerequisitesOrTargetSignatureOrExpression,
    storedContexts,
    axisConstraintsParam,
    threshold = 0.3,
    options = {}
  ) {
    const typesToFetch = this.#prototypeTypeDetector.detectReferencedTypes(
      prerequisitesOrTargetSignatureOrExpression
    );

    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      typesToFetch.hasEmotions = true;
    }

    const thresholds = this.#prototypeGapAnalyzer.getThresholds();
    const kNeighborsCount = this.#prototypeGapAnalyzer.getKNeighbors();

    const allPrototypes = this.#prototypeRegistryService.getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      return {
        gapDetected: false,
        nearestDistance: Infinity,
        kNearestNeighbors: [],
        coverageWarning: null,
        suggestedPrototype: null,
        gapThreshold: thresholds.distance,
        distanceZScore: null,
        distancePercentile: null,
        distanceContext: null,
      };
    }

    const axisConstraints = axisConstraintsParam instanceof Map
      ? axisConstraintsParam
      : this.#contextAxisNormalizer.normalizeConstraints(
        prerequisitesOrTargetSignatureOrExpression
      );

    let targetSignature;
    if (prerequisitesOrTargetSignatureOrExpression instanceof Map && !Array.isArray(prerequisitesOrTargetSignatureOrExpression)) {
      const firstVal = prerequisitesOrTargetSignatureOrExpression.values().next().value;
      if (firstVal && 'direction' in firstVal && 'importance' in firstVal) {
        targetSignature = prerequisitesOrTargetSignatureOrExpression;
      } else {
        targetSignature = this.#prototypeGapAnalyzer.buildTargetSignature(prerequisitesOrTargetSignatureOrExpression, []);
      }
    } else {
      targetSignature = this.#prototypeGapAnalyzer.buildTargetSignature(axisConstraints, []);
    }

    const desiredWeights = this.#prototypeGapAnalyzer.targetSignatureToWeights(targetSignature);
    const desiredGates = this.#prototypeGateChecker.inferGatesFromConstraints(axisConstraints);
    const regimeContexts = this.#contextAxisNormalizer.filterToMoodRegime(
      storedContexts,
      axisConstraints
    );
    const distances = [];
    const maxChunkMs = Number.isFinite(options.maxChunkMs) ? options.maxChunkMs : 12;
    let chunkStart = this.#now();

    for (const proto of allPrototypes) {
      const weightDist = this.#prototypeSimilarityMetrics.computeWeightDistance(desiredWeights, proto.weights);
      const gateDist = this.#prototypeGateChecker.computeGateDistance(desiredGates, proto.gates);
      const combinedDist = 0.7 * weightDist + 0.3 * gateDist;

      const intensityDist = this.#computeIntensityDistribution(
        proto,
        regimeContexts,
        threshold
      );

      distances.push({
        prototypeId: proto.id,
        type: proto.type,
        weightDistance: weightDist,
        gateDistance: gateDist,
        combinedDistance: combinedDist,
        pIntensityAbove: intensityDist.pAboveThreshold,
      });

      if (this.#now() - chunkStart >= maxChunkMs) {
        await this.#yieldToBrowser();
        chunkStart = this.#now();
      }
    }

    distances.sort((a, b) => a.combinedDistance - b.combinedDistance);
    const kNearest = distances.slice(0, kNeighborsCount);

    const nearestDist = kNearest[0]?.combinedDistance ?? Infinity;
    const bestIntensity = Math.max(...kNearest.map((d) => d.pIntensityAbove));
    const gapDetected = this.#prototypeGapAnalyzer.detectGap(nearestDist, bestIntensity);

    const distanceStatsKey = this.#prototypeSimilarityMetrics.buildDistanceStatsCacheKey(typesToFetch);
    const distanceStats = this.#prototypeSimilarityMetrics.getDistanceDistribution(distanceStatsKey, allPrototypes);
    const distancePercentile = distanceStats
      ? this.#prototypeSimilarityMetrics.computeDistancePercentile(distanceStats.sortedDistances, nearestDist)
      : null;
    const distanceZScore = distanceStats
      ? this.#prototypeSimilarityMetrics.computeDistanceZScore(distanceStats.mean, distanceStats.std, nearestDist)
      : null;
    const distanceContext = distanceStats
      ? this.#prototypeSimilarityMetrics.buildDistanceContext(nearestDist, distancePercentile, distanceZScore)
      : null;

    let coverageWarning = null;
    let suggestedPrototype = null;

    if (gapDetected) {
      coverageWarning =
        `No prototype within distance ${thresholds.distance.toFixed(2)}. ` +
        `Best achieves only ${(bestIntensity * 100).toFixed(1)}% intensity rate.`;
      suggestedPrototype = this.#prototypeGapAnalyzer.synthesizePrototype(kNearest, desiredWeights, axisConstraints);
    }

    return {
      gapDetected,
      nearestDistance: nearestDist,
      kNearestNeighbors: kNearest,
      coverageWarning,
      suggestedPrototype,
      gapThreshold: thresholds.distance,
      distanceZScore,
      distancePercentile,
      distanceContext,
    };
  }


  /**
   * Get prototype definitions for specified prototype references.
   * Returns weights and gates for each requested prototype.
   *
   * @param {Array<{id: string, type: 'emotion'|'sexual'}>} prototypeRefs - Array of prototype references
   * @returns {Record<string, {weights: Record<string, number>, gates: string[]}>} Definitions keyed by qualified ID
   */
  getPrototypeDefinitions(prototypeRefs) {
    return this.#prototypeRegistryService.getPrototypeDefinitions(prototypeRefs);
  }

  async #yieldToBrowser() {
    await new Promise((resolve) => {
      if (typeof globalThis.requestIdleCallback === 'function') {
        globalThis.requestIdleCallback(resolve, { timeout: 0 });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  #now() {
    return typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================


  /**
   * Compute intensity distribution for a prototype
   * @param {{weights: object, gates: string[]}} proto
   * @param {Array<object>} contexts
   * @param {number} threshold
   * @returns {{p50: number, p90: number, p95: number, pAboveThreshold: number, min: number|null, max: number|null}}
   */
  #computeIntensityDistribution(proto, contexts, threshold) {
    return this.#prototypeIntensityCalculator.computeDistribution(proto, contexts, threshold);
  }

  /**
   * Analyze conflicts between prototype weights and axis constraints
   * @param {object} weights
   * @param {Map<string, {min: number, max: number}>} constraints
   * @returns {{score: number, magnitude: number, axes: Array}}
   */
  #analyzeConflicts(weights, constraints) {
    return this.#prototypeIntensityCalculator.analyzeConflicts(weights, constraints);
  }

  /**
   * Compute composite score for ranking
   * @param {{gatePassRate: number, pIntensityAbove: number, conflictScore: number, exclusionCompatibility: number}} params
   * @returns {number}
   */
  #computeCompositeScore({ gatePassRate, pIntensityAbove, conflictScore, exclusionCompatibility }) {
    return this.#prototypeIntensityCalculator.computeCompositeScore({
      gatePassRate,
      pIntensityAbove,
      conflictScore,
      exclusionCompatibility,
    });
  }
}

export default PrototypeFitRankingService;
