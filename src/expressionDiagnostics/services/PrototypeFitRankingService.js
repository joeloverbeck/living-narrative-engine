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

import GateConstraint from '../models/GateConstraint.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

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

// Composite score weights
const WEIGHT_GATE_PASS = 0.30;
const WEIGHT_INTENSITY = 0.35;
const WEIGHT_CONFLICT = 0.20;
const WEIGHT_EXCLUSION = 0.15;

// Gap detection thresholds
const GAP_DISTANCE_THRESHOLD = 0.5;
const GAP_INTENSITY_THRESHOLD = 0.3;
const K_NEIGHBORS = 5;

/**
 * Analyzes all emotion prototypes to rank them by fit to an expression's mood regime.
 */
class PrototypeFitRankingService {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /** @type {object|null} */
  #prototypeConstraintAnalyzer;

  /** @type {Map<string, {mean: number, std: number, sortedDistances: number[]}>} */
  #distanceDistributionCache;

  /**
   * @param {object} deps
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger
   * @param {object} [deps.prototypeConstraintAnalyzer] - Optional IPrototypeConstraintAnalyzer for extracting axis constraints
   */
  constructor({ dataRegistry, logger, prototypeConstraintAnalyzer = null }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getLookupData'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#distanceDistributionCache = new Map();
  }

  /**
   * Extract or normalize axis constraints from prerequisites or pre-extracted constraints.
   * @private
   * @param {Array|Map|null} constraintsOrPrerequisites - Prerequisites array or pre-extracted Map
   * @returns {Map<string, {min: number, max: number}>} Axis constraints as Map
   */
  #normalizeAxisConstraints(constraintsOrPrerequisites) {
    // Already a Map - return as-is
    if (constraintsOrPrerequisites instanceof Map) {
      return constraintsOrPrerequisites;
    }

    // Array of prerequisites - extract using analyzer
    if (Array.isArray(constraintsOrPrerequisites) && this.#prototypeConstraintAnalyzer) {
      try {
        return this.#prototypeConstraintAnalyzer.extractAxisConstraints(constraintsOrPrerequisites);
      } catch (err) {
        this.#logger.warn('Failed to extract axis constraints from prerequisites:', err.message);
        return new Map();
      }
    }

    // Null, undefined, or no analyzer available
    return new Map();
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
    const typesToFetch = this.#detectReferencedPrototypeTypes(prerequisitesOrExpression);
    const expression = Array.isArray(prerequisitesOrExpression) ? null : prerequisitesOrExpression;

    // Early return if no prototype references found
    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      // Fall back to emotion prototypes for backward compatibility
      typesToFetch.hasEmotions = true;
    }

    const allPrototypes = this.#getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      this.#logger.warn('PrototypeFitRankingService: No prototypes found');
      return { leaderboard: [], currentPrototype: null, bestAlternative: null, improvementFactor: null };
    }

    // Normalize axis constraints - handle both prerequisites array and pre-extracted Map
    const axisConstraints = axisConstraintsParam instanceof Map
      ? axisConstraintsParam
      : this.#normalizeAxisConstraints(prerequisitesOrExpression);

    // Filter contexts to mood regime
    const regimeContexts = this.#filterToMoodRegime(storedContexts, axisConstraints);
    this.#logger.debug(
      `PrototypeFitRankingService: ${regimeContexts.length}/${storedContexts.length} contexts in regime`
    );

    // Extract current prototype from expression (if any)
    const currentProtoRef = this.#extractExpressionPrototype(expression);

    // Analyze each prototype
    const results = allPrototypes.map((proto) => {
      const gatePassRate = this.#computeGatePassRate(proto, regimeContexts);
      const intensityDist = this.#computeIntensityDistribution(
        proto,
        regimeContexts,
        threshold
      );
      const gateCompatibility = this.#getGateCompatibility(
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
    const axisConstraints = this.#normalizeAxisConstraints(prerequisitesOrAxisConstraintsOrExpression);

    // Get clauseFailures - may be passed as storedContexts if caller used old signature
    const clauseFailures = clauseFailuresParam || [];

    // Build target signature from constraints
    const targetSignature = this.#buildTargetSignature(axisConstraints, clauseFailures);

    // Detect which prototype types to fetch (if expression provided)
    const typesToFetch = this.#detectReferencedPrototypeTypes(prerequisitesOrAxisConstraintsOrExpression);

    // Fall back to emotion prototypes for backward compatibility
    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      typesToFetch.hasEmotions = true;
    }

    const allPrototypes = this.#getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      return {
        targetSignature,
        bySimilarity: [],
        byGatePass: [],
        byCombined: [],
      };
    }

    const regimeContexts = this.#filterToMoodRegime(storedContexts, axisConstraints);

    // Compute similarity for each prototype
    const similarities = allPrototypes.map((proto) => {
      const cosineSim = this.#computeCosineSimilarity(targetSignature, proto.weights);
      const gatePassRate = this.#computeGatePassRate(proto, regimeContexts);
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
    const typesToFetch = this.#detectReferencedPrototypeTypes(prerequisitesOrTargetSignatureOrExpression);

    // Fall back to emotion prototypes for backward compatibility
    if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
      typesToFetch.hasEmotions = true;
    }

    const allPrototypes = this.#getAllPrototypes(typesToFetch);
    if (allPrototypes.length === 0) {
      return {
        gapDetected: false,
        nearestDistance: Infinity,
        kNearestNeighbors: [],
        coverageWarning: null,
        suggestedPrototype: null,
        gapThreshold: GAP_DISTANCE_THRESHOLD,
      };
    }

    // Normalize axis constraints - handle both prerequisites array and pre-extracted Map
    const axisConstraints = axisConstraintsParam instanceof Map
      ? axisConstraintsParam
      : this.#normalizeAxisConstraints(prerequisitesOrTargetSignatureOrExpression);

    // Get or compute target signature
    let targetSignature;
    if (prerequisitesOrTargetSignatureOrExpression instanceof Map && !Array.isArray(prerequisitesOrTargetSignatureOrExpression)) {
      // Passed a Map - assume it's a target signature if it looks like one
      const firstVal = prerequisitesOrTargetSignatureOrExpression.values().next().value;
      if (firstVal && 'direction' in firstVal && 'importance' in firstVal) {
        targetSignature = prerequisitesOrTargetSignatureOrExpression;
      } else {
        // It's an axisConstraints map, build target signature from it
        targetSignature = this.#buildTargetSignature(prerequisitesOrTargetSignatureOrExpression, []);
      }
    } else {
      // Passed prerequisites array or expression, compute target signature
      targetSignature = this.#buildTargetSignature(axisConstraints, []);
    }

    // Build desired point from target signature
    const desiredWeights = this.#targetSignatureToWeights(targetSignature);
    const desiredGates = this.#inferGatesFromConstraints(axisConstraints);

    const regimeContexts = this.#filterToMoodRegime(storedContexts, axisConstraints);

    // Compute distance to each prototype
    const distances = allPrototypes.map((proto) => {
      const weightDist = this.#computeWeightDistance(desiredWeights, proto.weights);
      const gateDist = this.#computeGateDistance(desiredGates, proto.gates);
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
    const kNearest = distances.slice(0, K_NEIGHBORS);

    const nearestDist = kNearest[0]?.combinedDistance ?? Infinity;
    const bestIntensity = Math.max(...kNearest.map((d) => d.pIntensityAbove));

    const gapDetected = nearestDist > GAP_DISTANCE_THRESHOLD && bestIntensity < GAP_INTENSITY_THRESHOLD;

    const distanceStatsKey = this.#buildDistanceStatsCacheKey(typesToFetch);
    const distanceStats = this.#getDistanceDistribution(distanceStatsKey, allPrototypes);
    const distancePercentile = distanceStats
      ? this.#computeDistancePercentile(distanceStats.sortedDistances, nearestDist)
      : null;
    const distanceZScore = distanceStats
      ? this.#computeDistanceZScore(distanceStats.mean, distanceStats.std, nearestDist)
      : null;
    const distanceContext = distanceStats
      ? this.#buildDistanceContext(nearestDist, distancePercentile, distanceZScore)
      : null;

    let coverageWarning = null;
    let suggestedPrototype = null;

    if (gapDetected) {
      coverageWarning =
        `No prototype within distance ${GAP_DISTANCE_THRESHOLD.toFixed(2)}. ` +
        `Best achieves only ${(bestIntensity * 100).toFixed(1)}% intensity rate.`;
      suggestedPrototype = this.#synthesizePrototype(kNearest, desiredWeights, axisConstraints);
    }

    return {
      gapDetected,
      nearestDistance: nearestDist,
      kNearestNeighbors: kNearest,
      coverageWarning,
      suggestedPrototype,
      gapThreshold: GAP_DISTANCE_THRESHOLD,
      distanceZScore,
      distancePercentile,
      distanceContext,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Detect which prototype types are referenced in expression prerequisites.
   * Scans JSON Logic for emotions.* and sexualStates.* variable paths.
   * @private
   * @param {object|null} expression - Expression with prerequisites
   * @returns {PrototypeTypeDetection}
   */
  #detectReferencedPrototypeTypes(expressionOrPrerequisites) {
    const result = { hasEmotions: false, hasSexualStates: false };
    const prerequisites = Array.isArray(expressionOrPrerequisites)
      ? expressionOrPrerequisites
      : expressionOrPrerequisites?.prerequisites;

    if (!prerequisites || prerequisites.length === 0) return result;

    for (const prereq of prerequisites) {
      this.#scanLogicForPrototypeTypes(prereq.logic, result);
      // Early exit if both found
      if (result.hasEmotions && result.hasSexualStates) break;
    }

    return result;
  }

  /**
   * Recursively scan JSON Logic for prototype type references.
   * @private
   * @param {*} logic - JSON Logic node
   * @param {PrototypeTypeDetection} result - Mutated detection result
   */
  #scanLogicForPrototypeTypes(logic, result) {
    if (!logic || typeof logic !== 'object') return;

    // Check var nodes
    if (logic.var && typeof logic.var === 'string') {
      if (logic.var.startsWith('emotions.')) {
        result.hasEmotions = true;
      } else if (logic.var.startsWith('sexualStates.')) {
        result.hasSexualStates = true;
      }
      return;
    }

    // Check comparison operators
    for (const op of ['>=', '>', '<=', '<', '==', '!=']) {
      if (logic[op] && Array.isArray(logic[op])) {
        for (const operand of logic[op]) {
          this.#scanLogicForPrototypeTypes(operand, result);
        }
      }
    }

    // Recurse into nested logic
    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        this.#scanLogicForPrototypeTypes(clause, result);
      }
    }
  }

  /**
   * Get prototypes by type from registry.
   * @private
   * @param {'emotion'|'sexual'} type - Prototype type
   * @returns {Array<{id: string, type: 'emotion'|'sexual', weights: object, gates: string[]}>}
   */
  #getPrototypesByType(type) {
    const lookupKey = type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.getLookupData(lookupKey);

    if (!lookup?.entries) {
      return [];
    }

    return Object.entries(lookup.entries).map(([id, proto]) => ({
      id,
      type,
      weights: proto.weights || {},
      gates: proto.gates || [],
    }));
  }

  /**
   * Get all prototypes from registry, filtered by types to fetch.
   * @private
   * @param {PrototypeTypeDetection} [typesToFetch] - Which types to fetch
   * @returns {Array<{id: string, type: 'emotion'|'sexual', weights: object, gates: string[]}>}
   */
  #getAllPrototypes(typesToFetch) {
    const result = [];

    // Default to fetching emotions only (backward compatibility)
    const fetchEmotions = !typesToFetch || typesToFetch.hasEmotions !== false;
    const fetchSexual = typesToFetch?.hasSexualStates === true;

    if (fetchEmotions) {
      result.push(...this.#getPrototypesByType('emotion'));
    }

    if (fetchSexual) {
      result.push(...this.#getPrototypesByType('sexual'));
    }

    return result;
  }

  /**
   * Extract the prototype reference from expression prerequisites.
   * Returns the first prototype reference found (for determining "current" prototype).
   * @private
   * @param {object} expression
   * @returns {PrototypeRef|null}
   */
  #extractExpressionPrototype(expression) {
    if (!expression?.prerequisites) return null;

    // Look for emotion/sexual conditions in prerequisites
    for (const prereq of expression.prerequisites) {
      const protoRef = this.#findPrototypeRefInLogic(prereq.logic);
      if (protoRef) return protoRef;
    }

    return null;
  }

  /**
   * Recursively find prototype reference in JSON Logic.
   * Searches for emotions.* and sexualStates.* variable paths.
   * @private
   * @param {object} logic
   * @returns {PrototypeRef|null}
   */
  #findPrototypeRefInLogic(logic) {
    if (!logic || typeof logic !== 'object') return null;

    // Check comparison operators
    for (const op of ['>=', '>', '<=', '<']) {
      if (logic[op]) {
        const [left] = logic[op];
        if (typeof left === 'object' && left.var) {
          const varPath = left.var;
          if (varPath.startsWith('emotions.')) {
            return { id: varPath.replace('emotions.', ''), type: 'emotion' };
          }
          if (varPath.startsWith('sexualStates.')) {
            return { id: varPath.replace('sexualStates.', ''), type: 'sexual' };
          }
        }
      }
    }

    // Recurse into nested logic
    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        const found = this.#findPrototypeRefInLogic(clause);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Filter contexts to those within the mood regime
   * @param {Array<object>} contexts
   * @param {Map<string, {min: number, max: number}>} constraints
   * @returns {Array<object>}
   */
  #filterToMoodRegime(contexts, constraints) {
    if (!constraints || constraints.size === 0) {
      return contexts;
    }

    return contexts.filter((ctx) => {
      for (const [axis, constraint] of constraints) {
        const value = this.#getAxisValue(ctx, axis);
        if (value < constraint.min || value > constraint.max) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get axis value from context, normalizing to [-1, 1] or [0, 1] range.
   * Monte Carlo contexts store raw values (mood: [-100, 100], sexual: [0, 100])
   * but prototype gates and weights expect normalized ranges.
   * @param {object} ctx
   * @param {string} axis
   * @returns {number} Normalized value in [-1, 1] for mood axes or [0, 1] for sexual axes
   */
  #getAxisValue(ctx, axis) {
    // Try moodAxes first - normalize from [-100, 100] to [-1, 1] if needed
    if (ctx.moodAxes && axis in ctx.moodAxes) {
      const raw = ctx.moodAxes[axis];
      // Monte Carlo contexts store raw [-100, 100] values; normalize for comparison
      return Math.abs(raw) <= 1 ? raw : raw / 100;
    }
    // Try sexualStates - normalize from [0, 100] to [0, 1] if needed
    if (ctx.sexualStates && axis in ctx.sexualStates) {
      const raw = ctx.sexualStates[axis];
      return raw <= 1 ? raw : raw / 100;
    }
    return 0;
  }

  /**
   * Compute gate pass rate for a prototype
   * @param {{gates: string[]}} proto
   * @param {Array<object>} contexts
   * @returns {number}
   */
  #computeGatePassRate(proto, contexts) {
    if (!contexts || contexts.length === 0) return 0;
    if (!proto.gates || proto.gates.length === 0) return 1;

    let passCount = 0;
    for (const ctx of contexts) {
      if (this.#checkAllGatesPass(proto.gates, ctx)) {
        passCount++;
      }
    }

    return passCount / contexts.length;
  }

  /**
   * Check if all gates pass for a context
   * @param {string[]} gates
   * @param {object} ctx
   * @returns {boolean}
   */
  #checkAllGatesPass(gates, ctx) {
    for (const gateStr of gates) {
      let parsed;
      try {
        parsed = GateConstraint.parse(gateStr);
      } catch (err) {
        continue;
      }

      const value = this.#getAxisValue(ctx, parsed.axis);
      if (!parsed.isSatisfiedBy(value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Compute intensity distribution for a prototype
   * @param {{weights: object, gates: string[]}} proto
   * @param {Array<object>} contexts
   * @param {number} threshold
   * @returns {{p50: number, p90: number, p95: number, pAboveThreshold: number, min: number|null, max: number|null}}
   */
  #computeIntensityDistribution(proto, contexts, threshold) {
    if (!contexts || contexts.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        pAboveThreshold: 0,
        min: null,
        max: null,
      };
    }

    // Filter to contexts where gates pass
    const gatePassContexts = contexts.filter((ctx) =>
      this.#checkAllGatesPass(proto.gates || [], ctx)
    );

    if (gatePassContexts.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        pAboveThreshold: 0,
        min: null,
        max: null,
      };
    }

    // Compute intensity for each context
    const intensities = gatePassContexts.map((ctx) =>
      this.#computeIntensity(proto.weights, ctx)
    );

    intensities.sort((a, b) => a - b);

    const p50 = this.#percentile(intensities, 0.5);
    const p90 = this.#percentile(intensities, 0.9);
    const p95 = this.#percentile(intensities, 0.95);
    const min = intensities[0];
    const max = intensities[intensities.length - 1];

    const aboveCount = intensities.filter((i) => i >= threshold).length;
    const pAboveThreshold = aboveCount / intensities.length;

    return { p50, p90, p95, pAboveThreshold, min, max };
  }

  /**
   * Check if prototype gates are compatible with the mood regime constraints.
   *
   * @private
   * @param {object} proto
   * @param {Map<string, {min: number, max: number}>} axisConstraints
   * @param {number} threshold
   * @returns {{compatible: boolean, reason: string|null}|null}
   */
  #getGateCompatibility(proto, axisConstraints, threshold) {
    if (!this.#prototypeConstraintAnalyzer) {
      return null;
    }

    try {
      const analysis =
        this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
          proto.id,
          proto.type,
          threshold,
          axisConstraints,
          '>='
        );
      const blocking = analysis.gateStatus?.blockingGates ?? [];
      return {
        compatible: analysis.gateStatus?.allSatisfiable ?? true,
        reason: blocking.length > 0 ? blocking[0].reason : null,
      };
    } catch (err) {
      this.#logger.warn(
        `PrototypeFitRankingService: Gate compatibility check failed for ${proto.id}: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Compute emotion intensity from weights and context
   * @param {object} weights
   * @param {object} ctx
   * @returns {number}
   */
  #computeIntensity(weights, ctx) {
    let rawSum = 0;
    let sumAbsWeights = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const value = this.#getAxisValue(ctx, axis);
      rawSum += weight * value;
      sumAbsWeights += Math.abs(weight);
    }

    if (sumAbsWeights === 0) return 0;
    return Math.max(0, Math.min(1, rawSum / sumAbsWeights));
  }

  /**
   * Compute percentile from sorted array
   * @param {number[]} sortedArr
   * @param {number} p
   * @returns {number}
   */
  #percentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    const idx = Math.floor(p * (sortedArr.length - 1));
    return sortedArr[idx];
  }

  /**
   * Analyze conflicts between prototype weights and axis constraints
   * @param {object} weights
   * @param {Map<string, {min: number, max: number}>} constraints
   * @returns {{score: number, magnitude: number, axes: Array}}
   */
  #analyzeConflicts(weights, constraints) {
    if (!constraints || constraints.size === 0) {
      return { score: 0, magnitude: 0, axes: [] };
    }

    const conflictingAxes = [];
    let conflictMagnitude = 0;

    for (const [axis, constraint] of constraints) {
      const weight = weights[axis];
      if (weight === undefined || weight === 0) continue;

      // Determine constraint direction
      const constraintMidpoint = (constraint.min + constraint.max) / 2;
      const constraintDirection = constraintMidpoint >= 0 ? 1 : -1;

      // Check for conflict
      const weightDirection = weight > 0 ? 1 : -1;
      if (weightDirection !== constraintDirection) {
        conflictingAxes.push({
          axis,
          weight,
          direction: weightDirection > 0 ? 'positive' : 'negative',
        });
        conflictMagnitude += Math.abs(weight);
      }
    }

    const constrainedCount = constraints.size;
    const score = constrainedCount > 0 ? conflictingAxes.length / constrainedCount : 0;

    return { score, magnitude: conflictMagnitude, axes: conflictingAxes };
  }

  /**
   * Compute composite score for ranking
   * @param {{gatePassRate: number, pIntensityAbove: number, conflictScore: number, exclusionCompatibility: number}} params
   * @returns {number}
   */
  #computeCompositeScore({ gatePassRate, pIntensityAbove, conflictScore, exclusionCompatibility }) {
    return (
      WEIGHT_GATE_PASS * gatePassRate +
      WEIGHT_INTENSITY * pIntensityAbove +
      WEIGHT_CONFLICT * (1 - conflictScore) +
      WEIGHT_EXCLUSION * exclusionCompatibility
    );
  }

  /**
   * Build target signature from axis constraints
   * @param {Map<string, {min: number, max: number}>} constraints
   * @param {Array<object>} clauseFailures
   * @returns {Map<string, TargetSignatureEntry>}
   */
  #buildTargetSignature(constraints, clauseFailures) {
    const signature = new Map();

    if (!constraints || constraints.size === 0) {
      return signature;
    }

    for (const [axis, constraint] of constraints) {
      const direction = this.#inferDirection(constraint);
      const tightness = this.#computeTightness(constraint);
      const lastMileWeight = this.#getLastMileWeightForAxis(axis, clauseFailures);
      const importance = 0.5 * tightness + 0.5 * lastMileWeight;

      signature.set(axis, { direction, tightness, lastMileWeight, importance });
    }

    return signature;
  }

  /**
   * Infer direction from constraint
   * @param {{min: number, max: number}} constraint
   * @returns {number}
   */
  #inferDirection(constraint) {
    const mid = (constraint.min + constraint.max) / 2;
    if (mid > 0.1) return 1;
    if (mid < -0.1) return -1;
    return 0;
  }

  /**
   * Compute constraint tightness (narrower = tighter)
   * @param {{min: number, max: number}} constraint
   * @returns {number}
   */
  #computeTightness(constraint) {
    const range = constraint.max - constraint.min;
    // Full range is 2 (-1 to 1), so normalize
    return Math.max(0, 1 - range / 2);
  }

  /**
   * Get last-mile failure weight for axis
   * @param {string} axis
   * @param {Array<object>} clauseFailures
   * @returns {number}
   */
  #getLastMileWeightForAxis(axis, clauseFailures) {
    if (!clauseFailures || clauseFailures.length === 0) return 0.5;

    // Find failures mentioning this axis
    for (const failure of clauseFailures) {
      if (failure.clauseDescription && failure.clauseDescription.includes(axis)) {
        return failure.lastMileFailRate || 0.5;
      }
    }

    return 0.5;
  }

  /**
   * Compute cosine similarity between target signature and prototype weights
   * @param {Map<string, TargetSignatureEntry>} targetSignature
   * @param {object} protoWeights
   * @returns {number}
   */
  #computeCosineSimilarity(targetSignature, protoWeights) {
    const allAxes = new Set([...targetSignature.keys(), ...Object.keys(protoWeights)]);

    let dot = 0;
    let targetMag = 0;
    let protoMag = 0;

    for (const axis of allAxes) {
      const entry = targetSignature.get(axis);
      const t = entry ? entry.direction * entry.importance : 0;
      const p = protoWeights[axis] || 0;

      dot += t * p;
      targetMag += t * t;
      protoMag += p * p;
    }

    const mag = Math.sqrt(targetMag) * Math.sqrt(protoMag);
    return mag === 0 ? 0 : dot / mag;
  }

  /**
   * Convert target signature to weights map
   * @param {Map<string, TargetSignatureEntry>} targetSignature
   * @returns {object}
   */
  #targetSignatureToWeights(targetSignature) {
    const weights = {};
    for (const [axis, entry] of targetSignature) {
      weights[axis] = entry.direction * entry.importance;
    }
    return weights;
  }

  /**
   * Infer gates from constraints
   * @param {Map<string, {min: number, max: number}>} constraints
   * @returns {object}
   */
  #inferGatesFromConstraints(constraints) {
    const gates = {};
    for (const [axis, constraint] of constraints) {
      gates[axis] = {
        min: constraint.min,
        max: constraint.max,
      };
    }
    return gates;
  }

  /**
   * Compute Euclidean weight distance
   * @param {object} desiredWeights
   * @param {object} protoWeights
   * @returns {number}
   */
  #computeWeightDistance(desiredWeights, protoWeights) {
    const allAxes = new Set([...Object.keys(desiredWeights), ...Object.keys(protoWeights)]);

    let sumSquares = 0;
    for (const axis of allAxes) {
      const desired = desiredWeights[axis] || 0;
      const proto = protoWeights[axis] || 0;
      sumSquares += Math.pow(desired - proto, 2);
    }

    // Normalize by number of axes
    return allAxes.size > 0 ? Math.sqrt(sumSquares / allAxes.size) : 0;
  }

  /**
   * Compute gate compatibility distance
   * @param {object} desiredGates
   * @param {string[]} protoGates
   * @returns {number}
   */
  #computeGateDistance(desiredGates, protoGates) {
    if (!protoGates || protoGates.length === 0) return 0;

    let conflicts = 0;
    let total = Object.keys(desiredGates).length;

    for (const [axis, desired] of Object.entries(desiredGates)) {
      for (const gateStr of protoGates) {
        let parsed;
        try {
          parsed = GateConstraint.parse(gateStr);
        } catch (err) {
          continue;
        }
        if (parsed.axis === axis) {
          // Check if proto gate conflicts with desired range
          if (parsed.operator === '>=' && desired.max < parsed.value) {
            conflicts++;
          } else if (parsed.operator === '<=' && desired.min > parsed.value) {
            conflicts++;
          } else if (parsed.operator === '>' && desired.max <= parsed.value) {
            conflicts++;
          } else if (parsed.operator === '<' && desired.min >= parsed.value) {
            conflicts++;
          } else if (
            parsed.operator === '==' &&
            (parsed.value < desired.min || parsed.value > desired.max)
          ) {
            conflicts++;
          }
        }
      }
    }

    return total > 0 ? conflicts / total : 0;
  }

  /**
   * Build gate constraint ranges from prototype gate strings.
   * @param {string[]} protoGates
   * @returns {object}
   */
  #buildGateConstraints(protoGates) {
    const constraints = {};
    if (!protoGates || protoGates.length === 0) {
      return constraints;
    }

    for (const gateStr of protoGates) {
      let parsed;
      try {
        parsed = GateConstraint.parse(gateStr);
      } catch (err) {
        continue;
      }

      const axis = parsed.axis;
      if (!constraints[axis]) {
        constraints[axis] = { min: -1, max: 1 };
      }

      if (parsed.operator === '>=' || parsed.operator === '>') {
        constraints[axis].min = Math.max(constraints[axis].min, parsed.value);
      } else if (parsed.operator === '<=' || parsed.operator === '<') {
        constraints[axis].max = Math.min(constraints[axis].max, parsed.value);
      } else if (parsed.operator === '==') {
        constraints[axis].min = parsed.value;
        constraints[axis].max = parsed.value;
      }
    }

    return constraints;
  }

  /**
   * Compute combined distance between two prototypes for calibration.
   * @param {object} protoA
   * @param {object} protoB
   * @returns {number}
   */
  #computePrototypeCombinedDistance(protoA, protoB) {
    const weightDist = this.#computeWeightDistance(protoA.weights || {}, protoB.weights || {});
    const gatesA = this.#buildGateConstraints(protoA.gates);
    const gatesB = this.#buildGateConstraints(protoB.gates);
    const gateDistAB = this.#computeGateDistance(gatesA, protoB.gates);
    const gateDistBA = this.#computeGateDistance(gatesB, protoA.gates);
    const gateDist = (gateDistAB + gateDistBA) / 2;

    return 0.7 * weightDist + 0.3 * gateDist;
  }

  /**
   * Compute nearest-neighbor distance distribution for prototypes.
   * @param {string} cacheKey
   * @param {Array<object>} prototypes
   * @returns {{mean: number, std: number, sortedDistances: number[]} | null}
   */
  #getDistanceDistribution(cacheKey, prototypes) {
    if (this.#distanceDistributionCache.has(cacheKey)) {
      return this.#distanceDistributionCache.get(cacheKey);
    }

    if (!prototypes || prototypes.length < 2) {
      this.#distanceDistributionCache.set(cacheKey, null);
      return null;
    }

    const nearestDistances = [];

    for (let i = 0; i < prototypes.length; i++) {
      let nearest = Infinity;
      for (let j = 0; j < prototypes.length; j++) {
        if (i === j) continue;
        const dist = this.#computePrototypeCombinedDistance(prototypes[i], prototypes[j]);
        if (dist < nearest) {
          nearest = dist;
        }
      }
      nearestDistances.push(nearest);
    }

    const sortedDistances = [...nearestDistances].sort((a, b) => a - b);
    const mean = sortedDistances.reduce((sum, value) => sum + value, 0) / sortedDistances.length;
    const variance = sortedDistances.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0)
      / sortedDistances.length;
    const std = Math.sqrt(variance);

    const stats = { mean, std, sortedDistances };
    this.#distanceDistributionCache.set(cacheKey, stats);
    return stats;
  }

  /**
   * Build cache key for distance stats based on prototype types.
   * @param {PrototypeTypeDetection} typesToFetch
   * @returns {string}
   */
  #buildDistanceStatsCacheKey(typesToFetch) {
    const emotions = typesToFetch?.hasEmotions ? 'emotion' : 'no-emotion';
    const sexual = typesToFetch?.hasSexualStates ? 'sexual' : 'no-sexual';
    return `${emotions}|${sexual}`;
  }

  /**
   * Compute percentile for distance value against sorted distances.
   * @param {number[]} sortedDistances
   * @param {number} value
   * @returns {number}
   */
  #computeDistancePercentile(sortedDistances, value) {
    if (!sortedDistances || sortedDistances.length === 0) {
      return 0;
    }

    let count = 0;
    for (const dist of sortedDistances) {
      if (value >= dist) {
        count++;
      } else {
        break;
      }
    }

    return count / sortedDistances.length;
  }

  /**
   * Compute z-score for distance value.
   * @param {number} mean
   * @param {number} std
   * @param {number} value
   * @returns {number}
   */
  #computeDistanceZScore(mean, std, value) {
    if (std <= 0) {
      return 0;
    }

    return (value - mean) / std;
  }

  /**
   * Build human-readable context string for distance calibration.
   * @param {number} distance
   * @param {number|null} percentile
   * @param {number|null} zScore
   * @returns {string|null}
   */
  #buildDistanceContext(distance, percentile, zScore) {
    if (percentile === null || percentile === undefined) {
      return null;
    }

    const percentileLabel = Math.round(percentile * 100);
    let context = `Distance ${distance.toFixed(2)} is farther than ${percentileLabel}% of prototype nearest-neighbor distances`;

    if (typeof zScore === 'number') {
      context += ` (z=${zScore.toFixed(2)})`;
    }

    return `${context}.`;
  }

  /**
   * Synthesize a prototype from nearest neighbors
   * @param {Array<{prototypeId: string, combinedDistance: number}>} kNearest
   * @param {object} desiredWeights
   * @param {Map<string, {min: number, max: number}>} constraints
   * @returns {object}
   */
  #synthesizePrototype(kNearest, desiredWeights, constraints) {
    const weights = {};
    let totalWeight = 0;

    // Distance-weighted average of neighbors
    for (const neighbor of kNearest) {
      const w = 1 / (neighbor.combinedDistance + 0.01);
      totalWeight += w;

      const proto = this.#getAllPrototypes().find((p) => p.id === neighbor.prototypeId);
      if (proto) {
        for (const [axis, value] of Object.entries(proto.weights)) {
          weights[axis] = (weights[axis] || 0) + value * w;
        }
      }
    }

    // Normalize
    for (const axis of Object.keys(weights)) {
      weights[axis] /= totalWeight;
    }

    // Derive gates from constraints
    const gates = [];
    for (const [axis, constraint] of constraints) {
      if (constraint.min > -1) {
        gates.push(`${axis} >= ${constraint.min.toFixed(2)}`);
      }
      if (constraint.max < 1) {
        gates.push(`${axis} <= ${constraint.max.toFixed(2)}`);
      }
    }

    return {
      weights,
      gates,
      rationale: `Synthesized from ${kNearest.length} nearest neighbors using distance-weighted averaging`,
    };
  }
}

export default PrototypeFitRankingService;
