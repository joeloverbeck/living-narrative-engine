/**
 * @file MonteCarloSimulator - Statistical trigger probability estimation
 * @see specs/expression-diagnostics.md Layer C
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import jsonLogic from 'json-logic-js';
import HierarchicalClauseNode from '../models/HierarchicalClauseNode.js';
import { collectVarPaths } from '../../utils/jsonLogicVarExtractor.js';
import { getEpsilonForVariable } from '../config/advancedMetricsConfig.js';
import GateConstraint from '../models/GateConstraint.js';
import AxisInterval from '../models/AxisInterval.js';
import {
  createSamplingCoverageCalculator,
} from './monteCarloSamplingCoverage.js';

const DEFAULT_SAMPLING_COVERAGE_CONFIG = {
  enabled: true,
  binCount: 10,
  minSamplesPerBin: 1,
  tailPercent: 0.1,
};

const SAMPLING_COVERAGE_DOMAIN_RANGES = [
  { pattern: /^previousMoodAxes\./, domain: 'previousMoodAxes', min: -100, max: 100 },
  { pattern: /^previousEmotions\./, domain: 'previousEmotions', min: 0, max: 1 },
  {
    pattern: /^previousSexualStates\./,
    domain: 'previousSexualStates',
    min: 0,
    max: 1,
  },
  { pattern: /^moodAxes\./, domain: 'moodAxes', min: -100, max: 100 },
  { pattern: /^mood\./, domain: 'moodAxes', min: -100, max: 100 },
  { pattern: /^emotions\./, domain: 'emotions', min: 0, max: 1 },
  { pattern: /^sexualStates\./, domain: 'sexualStates', min: 0, max: 1 },
  { pattern: /^sexual\./, domain: 'sexualStates', min: 0, max: 1 },
];

/**
 * @typedef {'uniform' | 'gaussian'} DistributionType
 */

/**
 * @typedef {object} SimulationConfig
 * @property {number} sampleCount - Number of samples (default 10000)
 * @property {DistributionType} distribution - Distribution type
 * @property {boolean} trackClauses - Track per-clause failures
 * @property {number} confidenceLevel - CI level (default 0.95)
 * @property {(completed: number, total: number) => void} [onProgress] - Progress callback
 * @property {boolean} [validateVarPaths=true] - Enable pre-simulation var path validation
 * @property {boolean} [failOnUnseededVars=false] - Throw error if unseeded vars found
 * @property {boolean} [storeSamplesForSensitivity=false] - Store contexts for sensitivity analysis
 * @property {number} [sensitivitySampleLimit=10000] - Max samples to store for sensitivity (memory optimization)
 * @property {number} [maxWitnesses=5] - Maximum number of ground-truth witnesses to capture
 * @property {SamplingCoverageConfig} [samplingCoverageConfig] - Coverage tracking config
 */

/**
 * @typedef {object} SamplingCoverageConfig
 * @property {boolean} [enabled=true] - Toggle coverage tracking
 * @property {number} [binCount=10] - Histogram bin count
 * @property {number} [minSamplesPerBin=1] - Minimum samples per bin
 * @property {number} [tailPercent=0.1] - Tail percent for low/high buckets
 */

/**
 * @typedef {object} SensitivityPoint
 * @property {number} threshold - Threshold value
 * @property {number} passRate - Rate at which samples pass this threshold
 * @property {number} passCount - Count of samples passing
 * @property {number} sampleCount - Total samples evaluated
 */

/**
 * @typedef {object} SensitivityResult
 * @property {string} conditionPath - Path to the condition (e.g., 'emotions.anger')
 * @property {string} operator - Comparison operator (e.g., '>=')
 * @property {number} originalThreshold - Original threshold value
 * @property {SensitivityPoint[]} grid - Sensitivity grid data
 */

/**
 * @typedef {object} UnseededVarWarning
 * @property {string} path - The problematic variable path
 * @property {'unknown_root' | 'unknown_nested_key' | 'invalid_nesting'} reason - Category of issue
 * @property {string} suggestion - Human-readable explanation
 */

/**
 * @typedef {object} ClauseResult
 * @property {string} clauseDescription
 * @property {number} failureCount
 * @property {number} failureRate
 * @property {number} averageViolation
 * @property {number|null} violationP50 - Median violation
 * @property {number|null} violationP90 - 90th percentile violation
 * @property {number|null} nearMissRate - Proportion of samples within epsilon
 * @property {number|null} nearMissEpsilon - The epsilon value used
 * @property {number} clauseIndex
 * @property {object | null} [hierarchicalBreakdown] - Tree structure for compound clauses
 */

/**
 * @typedef {object} SimulationResult
 * @property {number} triggerRate - Probability of triggering [0, 1]
 * @property {number} triggerCount - Number of successful triggers
 * @property {number} sampleCount - Total samples evaluated
 * @property {{ low: number, high: number }} confidenceInterval
 * @property {ClauseResult[]} clauseFailures - Per-clause failure data
 * @property {DistributionType} distribution
 * @property {UnseededVarWarning[]} unseededVarWarnings - Warnings for unseeded variable paths
 * @property {object} [samplingCoverage] - Coverage payload (when enabled and applicable)
 */

/**
 * Monte Carlo simulator for expression trigger probability estimation.
 * Samples random mood/sexual states, evaluates expressions, and calculates
 * trigger rates with confidence intervals and per-clause failure tracking.
 */
class MonteCarloSimulator {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /** @type {object} */
  #emotionCalculatorAdapter;

  /** @type {object} */
  #randomStateGenerator;

  /**
   * @param {object} deps
   * @param {object} deps.dataRegistry - IDataRegistry
   * @param {object} deps.logger - ILogger
   * @param {object} deps.emotionCalculatorAdapter - IEmotionCalculatorAdapter
   * @param {object} deps.randomStateGenerator - IRandomStateGenerator
   */
  constructor({
    dataRegistry,
    logger,
    emotionCalculatorAdapter,
    randomStateGenerator,
  }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(
      emotionCalculatorAdapter,
      'IEmotionCalculatorAdapter',
      logger,
      {
        requiredMethods: [
          'calculateEmotions',
          'calculateEmotionsFiltered',
          'calculateSexualArousal',
          'calculateSexualStates',
        ],
      }
    );
    validateDependency(
      randomStateGenerator,
      'IRandomStateGenerator',
      logger,
      {
        requiredMethods: ['generate'],
      }
    );

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#emotionCalculatorAdapter = emotionCalculatorAdapter;
    this.#randomStateGenerator = randomStateGenerator;
  }

  /**
   * Run Monte Carlo simulation for an expression
   *
   * @param {object} expression - Expression to evaluate
   * @param {SimulationConfig} [config]
   * @returns {SimulationResult}
   */
  /**
   * Run Monte Carlo simulation for an expression
   *
   * @param {object} expression - Expression to evaluate
   * @param {SimulationConfig} [config]
   * @returns {Promise<SimulationResult>}
   */
  async simulate(expression, config = {}) {
    const {
      sampleCount = 10000,
      distribution = 'uniform',
      trackClauses = true,
      confidenceLevel = 0.95,
      onProgress,
      validateVarPaths = true,
      failOnUnseededVars = false,
      // Sampling mode: 'static' (prototype-gated) or 'dynamic' (coupled with Gaussian delta)
      // Default is 'static' - tests logical feasibility within the emotion model
      samplingMode = 'static',
      // Sensitivity analysis options
      storeSamplesForSensitivity = false,
      sensitivitySampleLimit = 10000,
      // Maximum number of ground-truth witnesses to capture (states that triggered the expression)
      maxWitnesses = 5,
      samplingCoverageConfig = {},
    } = config;

    // Pre-simulation variable path validation
    let unseededVarWarnings = [];
    if (validateVarPaths) {
      const validation = this.#validateExpressionVarPaths(expression);
      unseededVarWarnings = validation.warnings;

      if (unseededVarWarnings.length > 0) {
        // Log warnings
        for (const warning of unseededVarWarnings) {
          this.#logger.warn(
            `MonteCarloSimulator: Unseeded var "${warning.path}" (${warning.reason}): ${warning.suggestion}`
          );
        }

        // Fail-fast if configured
        if (failOnUnseededVars) {
          const pathList = unseededVarWarnings.map((w) => w.path).join(', ');
          throw new Error(
            `MonteCarloSimulator: Expression "${expression?.id ?? 'unknown'}" uses unseeded variables: ${pathList}`
          );
        }
      }
    }

    const CHUNK_SIZE = 1000;
    let triggerCount = 0;
    const clauseTracking = trackClauses
      ? this.#initClauseTracking(expression)
      : null;

    const moodConstraints = this.#extractMoodConstraints(
      expression?.prerequisites
    );
    const moodRegimeDefined = moodConstraints.length > 0;
    const gateCompatibility = this.#computeGateCompatibility(
      expression,
      moodConstraints
    );
    let inRegimeSampleCount = 0;

    // Track ground-truth witnesses (first N triggered samples) and nearest miss
    const witnesses = [];
    let nearestMiss = null;
    let nearestMissFailedCount = Infinity;

    // Extract referenced emotions once before simulation loop for witness capture
    const referencedEmotions = this.#extractReferencedEmotions(expression);

    // Sensitivity analysis: store built contexts for post-hoc threshold evaluation
    const storedContexts = storeSamplesForSensitivity ? [] : null;

    const resolvedSamplingCoverageConfig = {
      ...DEFAULT_SAMPLING_COVERAGE_CONFIG,
      ...(samplingCoverageConfig ?? {}),
    };

    const samplingCoverageVariables = resolvedSamplingCoverageConfig.enabled
      ? this.#collectSamplingCoverageVariables(expression)
      : [];

    const samplingCoverageCalculator =
      resolvedSamplingCoverageConfig.enabled &&
      samplingCoverageVariables.length > 0
        ? createSamplingCoverageCalculator({
            variables: samplingCoverageVariables,
            binCount: resolvedSamplingCoverageConfig.binCount,
            minSamplesPerBin: resolvedSamplingCoverageConfig.minSamplesPerBin,
            tailPercent: resolvedSamplingCoverageConfig.tailPercent,
          })
        : null;

    // Process samples in chunks to avoid blocking the main thread
    for (let processed = 0; processed < sampleCount; ) {
      const chunkEnd = Math.min(processed + CHUNK_SIZE, sampleCount);

      // Process chunk synchronously (fast enough not to block)
      for (let i = processed; i < chunkEnd; i++) {
        const { current, previous, affectTraits } =
          this.#randomStateGenerator.generate(distribution, samplingMode);

        // Build context once for potential storage and evaluation
        const context = this.#buildContext(
          current,
          previous,
          affectTraits,
          referencedEmotions
        );

        // Store context for sensitivity analysis if enabled and within limit
        if (
          storedContexts !== null &&
          storedContexts.length < sensitivitySampleLimit
        ) {
          storedContexts.push(context);
        }

        if (samplingCoverageCalculator) {
          for (const variable of samplingCoverageVariables) {
            const value = this.#getNestedValue(context, variable.variablePath);
            samplingCoverageCalculator.recordObservation(
              variable.variablePath,
              value
            );
          }
        }

        const inRegime = moodRegimeDefined
          ? this.#evaluateMoodConstraints(moodConstraints, context)
          : true;
        if (inRegime) {
          inRegimeSampleCount++;
        }

        const result = this.#evaluateWithTracking(
          expression,
          context,
          clauseTracking,
          inRegime
        );

        if (result.triggered) {
          triggerCount++;
          // Store ground-truth witnesses (up to maxWitnesses)
          if (witnesses.length < maxWitnesses) {
            witnesses.push({
              current,
              previous,
              affectTraits,
              // Include computed emotions (filtered to only referenced ones)
              computedEmotions: this.#filterEmotions(
                context.emotions,
                referencedEmotions
              ),
              previousComputedEmotions: this.#filterEmotions(
                context.previousEmotions,
                referencedEmotions
              ),
            });
          }
        } else if (clauseTracking) {
          // Track nearest miss: sample with fewest failing clauses
          const failedCount = this.#countFailedClauses(
            clauseTracking,
            expression,
            context
          );
          if (failedCount < nearestMissFailedCount) {
            nearestMissFailedCount = failedCount;
            nearestMiss = {
              sample: { current, previous, affectTraits },
              failedLeafCount: failedCount,
              failedLeaves: this.#getFailedLeavesSummary(
                clauseTracking,
                expression,
                context
              ),
            };
          }
        }
      }

      processed = chunkEnd;

      // Yield to browser and report progress between chunks
      if (processed < sampleCount) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        onProgress?.(processed, sampleCount);
      }
    }

    // Report 100% completion
    onProgress?.(sampleCount, sampleCount);

    const triggerRate = triggerCount / sampleCount;
    const confidenceInterval = this.#calculateConfidenceInterval(
      triggerRate,
      sampleCount,
      confidenceLevel
    );

    this.#logger.debug(
      `MonteCarloSimulator: ${expression?.id ?? 'unknown'} ` +
        `triggerRate=${triggerRate.toFixed(4)} ` +
        `(${triggerCount}/${sampleCount}, ${distribution})`
    );

    // Build sampling metadata to clarify what the simulation tests
    const samplingMetadata = {
      mode: samplingMode,
      description:
        samplingMode === 'static'
          ? 'Prototype-gated sampling (emotions derived from mood axes; not independent)'
          : 'Coupled sampling with Gaussian deltas (tests fixed transition model)',
      note:
        samplingMode === 'static'
          ? 'Emotions are computed via prototype gates, so emotion variables are not independent of mood axes.'
          : 'Uses fixed σ values (mood: 15, sexual: 12) that may not reflect actual LLM behavior.',
    };

    // Build witness analysis for debugging
    // witnesses: array of ground-truth samples that triggered the expression
    // bestWitness: kept for backward compatibility (first witness or null)
    const witnessAnalysis = {
      witnesses,
      bestWitness: witnesses.length > 0 ? witnesses[0] : null,
      nearestMiss: nearestMiss ?? null,
    };

    const resultPayload = {
      triggerRate,
      triggerCount,
      sampleCount,
      inRegimeSampleCount,
      inRegimeSampleRate:
        sampleCount > 0 ? inRegimeSampleCount / sampleCount : 0,
      moodRegimeDefined,
      confidenceInterval,
      clauseFailures: clauseTracking
        ? this.#finalizeClauseResults(clauseTracking, sampleCount)
        : [],
      distribution,
      samplingMode,
      samplingMetadata,
      gateCompatibility,
      witnessAnalysis,
      unseededVarWarnings,
      // Stored contexts for sensitivity analysis (null if not enabled)
      storedContexts,
    };

    if (samplingCoverageCalculator) {
      resultPayload.samplingCoverage = samplingCoverageCalculator.finalize();
    }

    return resultPayload;
  }

  /**
   * Initialize clause tracking data structure with hierarchical breakdown
   *
   * @private
   * @param {object} expression
   * @returns {Array}
   */
  #initClauseTracking(expression) {
    const clauses = [];
    if (!expression?.prerequisites) return clauses;

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      clauses.push({
        clauseIndex: i,
        description: this.#describeClause(prereq),
        failureCount: 0,
        violationSum: 0,
        inRegimeFailureCount: 0,
        inRegimeEvaluationCount: 0,
        // Build hierarchical tree for compound clauses
        hierarchicalTree: this.#buildHierarchicalTree(prereq.logic, `${i}`),
      });
    }

    // Mark single-clause case for last-mile tracking
    const isSingleClause = clauses.length === 1;
    for (const clause of clauses) {
      if (clause.hierarchicalTree) {
        clause.hierarchicalTree.isSingleClause = isSingleClause;
      }
    }

    return clauses;
  }

  /**
   * Describe a clause in human-readable form
   *
   * @private
   * @param {object} prerequisite
   * @returns {string}
   */
  #describeClause(prerequisite) {
    const logic = prerequisite?.logic;
    if (!logic) return 'Unknown clause';

    // Simple description extraction
    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        return `${left.var} >= ${right}`;
      }
    }

    if (logic['<=']) {
      const [left, right] = logic['<='];
      if (left?.var && typeof right === 'number') {
        return `${left.var} <= ${right}`;
      }
    }

    if (logic.and || logic.or) {
      const op = logic.and ? 'AND' : 'OR';
      const count = (logic.and || logic.or).length;
      return `${op} of ${count} conditions`;
    }

    return JSON.stringify(logic).substring(0, 50);
  }

  /**
   * Evaluate expression with clause tracking (includes hierarchical breakdown)
   *
   * @private
   * @param {object} expression - The expression to evaluate
   * @param {object} context - Prebuilt evaluation context
   * @param {Array|null} clauseTracking - Tracking array for clause failures
   * @param {boolean} inRegime - Whether mood constraints passed for this sample
   * @returns {{triggered: boolean}}
   */
  #evaluateWithTracking(expression, context, clauseTracking, inRegime) {
    // Two-phase evaluation for last-mile tracking
    if (clauseTracking && expression?.prerequisites) {
      // Phase 1: Evaluate all clauses and collect results
      const clauseResults = [];
      for (let i = 0; i < expression.prerequisites.length; i++) {
        const prereq = expression.prerequisites[i];
        const clause = clauseTracking[i];
        let passed;

        // Use hierarchical evaluation if tree exists
        if (clause.hierarchicalTree) {
          passed = this.#evaluateHierarchicalNode(
            clause.hierarchicalTree,
            context,
            inRegime
          );
          if (!passed) {
            clause.failureCount++;
            // Violation is tracked at leaf level in the tree
          }
        } else {
          // Fallback to atomic evaluation
          passed = this.#evaluatePrerequisite(prereq, context);
          if (!passed) {
            clause.failureCount++;
            const violation = this.#estimateViolation(prereq, context);
            clause.violationSum += violation;
          }
          if (inRegime) {
            clause.inRegimeEvaluationCount++;
            if (!passed) {
              clause.inRegimeFailureCount++;
            }
          }
        }

        clauseResults.push({ clause, passed });
      }

      // Phase 2: Calculate last-mile for each clause
      for (let i = 0; i < clauseResults.length; i++) {
        const { clause: currentClause, passed: currentPassed } =
          clauseResults[i];

        // Check if all OTHER clauses passed
        const othersPassed = clauseResults.every(
          (result, j) => j === i || result.passed
        );

        if (othersPassed && currentClause.hierarchicalTree) {
          currentClause.hierarchicalTree.recordOthersPassed();

          if (!currentPassed) {
            currentClause.hierarchicalTree.recordLastMileFail();
          }
        }
      }
    }

    // Full evaluation
    const triggered = this.#evaluateAllPrerequisites(expression, context);
    return { triggered };
  }

  /**
   * Build evaluation context from current and previous states
   *
   * Calculates derived emotions and sexual states from both current and previous
   * mood/sexual axes, enabling "persistence-style" expressions that compare
   * current vs previous values or check delta magnitudes.
   *
   * @private
   * @param {{mood: object, sexual: object}} currentState - Current mood and sexual state
   * @param {{mood: object, sexual: object}} previousState - Previous mood and sexual state
   * @param {{affective_empathy: number, cognitive_empathy: number, harm_aversion: number}|null} [affectTraits] - Affect traits for gate checking
   * @param {Set<string>|null|undefined} [emotionFilter] - Emotion names to calculate
   * @returns {object} Context object with moodAxes, emotions, sexualStates, affectTraits, and their previous counterparts
   */
  #buildContext(
    currentState,
    previousState,
    affectTraits = null,
    emotionFilter
  ) {
    // Calculate current emotions from current mood using prototypes
    // Adapter mirrors runtime calculations (mood, sexual state, optional traits)
    const emotions = this.#emotionCalculatorAdapter.calculateEmotionsFiltered(
      currentState.mood,
      currentState.sexual,
      affectTraits,
      emotionFilter
    );

    // Calculate current sexualArousal from raw sexual state (derived value)
    const sexualArousal =
      this.#emotionCalculatorAdapter.calculateSexualArousal(
        currentState.sexual
      );

    // Calculate current sexual states, passing the derived sexualArousal for prototype weights
    const sexualStates =
      this.#emotionCalculatorAdapter.calculateSexualStates(
        currentState.mood,
        currentState.sexual,
        sexualArousal
      );

    // Calculate previous emotions from previous mood (NOT zeroed!)
    // This enables "persistence-style" expressions like lingering_guilt
    const previousEmotions = this.#emotionCalculatorAdapter.calculateEmotionsFiltered(
      previousState.mood,
      previousState.sexual,
      affectTraits,
      emotionFilter
    );

    // Calculate previous sexual arousal and states from previous state
    const previousSexualArousal =
      this.#emotionCalculatorAdapter.calculateSexualArousal(
        previousState.sexual
      );
    const previousSexualStates =
      this.#emotionCalculatorAdapter.calculateSexualStates(
        previousState.mood,
        previousState.sexual,
        previousSexualArousal
      );

    // Previous mood axes directly from previous state
    const previousMoodAxes = previousState.mood;

    // Default affect traits for backwards compatibility
    const defaultTraits = {
      affective_empathy: 50,
      cognitive_empathy: 50,
      harm_aversion: 50,
    };

    return {
      mood: currentState.mood,
      moodAxes: currentState.mood, // Alias for expressions that check moodAxes.*
      emotions,
      sexualStates,
      sexualArousal, // Derived value available for expression evaluation
      previousEmotions,
      previousSexualStates,
      previousMoodAxes,
      previousSexualArousal, // Derived value for previous state arousal comparisons
      affectTraits: affectTraits ?? defaultTraits, // Include affect traits in context
    };
  }

  /**
   * Check if all gates pass for a prototype.
   * Gates must ALL pass for the emotion to be calculated; otherwise intensity = 0.
   * This matches EmotionCalculatorService.#checkGates() behavior.
   *
   * @private
   * @param {string[] | undefined} gates - Array of gate strings
   * @param {object} normalizedAxes - Normalized axis values (in [-1, 1] or [0, 1] range)
   * @returns {boolean} - True if all gates pass or no gates defined
   */
  #checkGates(gates, normalizedAxes) {
    if (!gates || !Array.isArray(gates) || gates.length === 0) return true;

    for (const gate of gates) {
      let constraint;
      try {
        constraint = GateConstraint.parse(gate);
      } catch {
        continue;
      }

      const axisValue = normalizedAxes[constraint.axis];
      if (axisValue === undefined) continue;

      if (!constraint.isSatisfiedBy(axisValue)) return false;
    }
    return true;
  }

  /**
   * Evaluate a single prerequisite
   *
   * @private
   * @param {object} prereq
   * @param {object} context
   * @returns {boolean}
   */
  #evaluatePrerequisite(prereq, context) {
    try {
      return jsonLogic.apply(prereq.logic, context);
    } catch {
      return false;
    }
  }

  /**
   * Evaluate all prerequisites
   *
   * @private
   * @param {object} expression
   * @param {object} context
   * @returns {boolean}
   */
  #evaluateAllPrerequisites(expression, context) {
    if (!expression?.prerequisites) return true;

    for (const prereq of expression.prerequisites) {
      if (!this.#evaluatePrerequisite(prereq, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Estimate violation magnitude for a failed prerequisite
   *
   * @private
   * @param {object} prereq
   * @param {object} context
   * @returns {number}
   */
  #estimateViolation(prereq, context) {
    const logic = prereq?.logic;
    if (!logic) return 0;

    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        const actual = this.#getNestedValue(context, left.var);
        if (typeof actual === 'number') {
          return Math.max(0, right - actual);
        }
      }
    }

    return 0.1; // Default small violation
  }

  /**
   * Get nested value from object using dot notation
   *
   * @private
   * @param {object} obj
   * @param {string} path
   * @returns {*}
   */
  #getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * Extract ceiling data from the worst leaf in a hierarchical tree.
   * For compound nodes (AND/OR), finds the leaf with the largest ceiling gap.
   *
   * @private
   * @param {HierarchicalClauseNode|null} tree
   * @returns {{ceilingGap: number|null, maxObserved: number|null, thresholdValue: number|null}}
   */
  #extractCeilingData(tree) {
    if (!tree) {
      return { ceilingGap: null, maxObserved: null, thresholdValue: null };
    }

    // For leaf nodes, extract directly
    if (tree.nodeType === 'leaf') {
      return {
        ceilingGap: tree.ceilingGap,
        maxObserved: tree.maxObservedValue,
        thresholdValue: tree.thresholdValue,
      };
    }

    // For compound nodes, find the worst ceiling among children
    let worstCeiling = { ceilingGap: null, maxObserved: null, thresholdValue: null };
    let worstGap = -Infinity;

    for (const child of tree.children || []) {
      const childCeiling = this.#extractCeilingData(child);
      if (childCeiling.ceilingGap !== null && childCeiling.ceilingGap > worstGap) {
        worstGap = childCeiling.ceilingGap;
        worstCeiling = childCeiling;
      }
    }

    return worstCeiling;
  }

  /**
   * Finalize clause results with rates and hierarchical breakdown
   *
   * @private
   * @param {Array} clauseTracking
   * @param {number} sampleCount
   * @returns {ClauseResult[]}
   */
  #finalizeClauseResults(clauseTracking, sampleCount) {
    return clauseTracking
      .map((c) => {
        // Extract ceiling data from the worst leaf in the tree
        const ceilingData = this.#extractCeilingData(c.hierarchicalTree);
        const leafOnly = c.hierarchicalTree?.nodeType === 'leaf';
        const inRegimeFailureRate =
          c.hierarchicalTree?.inRegimeFailureRate ??
          (c.inRegimeEvaluationCount > 0
            ? c.inRegimeFailureCount / c.inRegimeEvaluationCount
            : null);
        const inRegimePassRate =
          typeof inRegimeFailureRate === 'number'
            ? 1 - inRegimeFailureRate
            : null;
        const achievableRange = leafOnly
          ? {
              min: c.hierarchicalTree?.minObservedValue ?? null,
              max: c.hierarchicalTree?.maxObservedValue ?? null,
            }
          : null;
        const inRegimeAchievableRange = leafOnly
          ? {
              min: c.hierarchicalTree?.inRegimeMinObservedValue ?? null,
              max: c.hierarchicalTree?.inRegimeMaxObservedValue ?? null,
            }
          : null;

        return {
          clauseDescription: c.description,
          clauseIndex: c.clauseIndex,
          failureCount: c.failureCount,
          failureRate: c.failureCount / sampleCount,
          inRegimeFailureRate,
          inRegimePassRate,
          averageViolation:
            c.failureCount > 0 ? c.violationSum / c.failureCount : 0,
          violationP50: c.hierarchicalTree?.violationP50 ?? null,
          violationP90: c.hierarchicalTree?.violationP90 ?? null,
          nearMissRate: c.hierarchicalTree?.nearMissRate ?? null,
          nearMissEpsilon: c.hierarchicalTree?.nearMissEpsilon ?? null,
          // Last-mile tracking fields
          lastMileFailRate: c.hierarchicalTree?.lastMileFailRate ?? null,
          lastMileContext: {
            othersPassedCount: c.hierarchicalTree?.othersPassedCount ?? 0,
            lastMileFailCount: c.hierarchicalTree?.lastMileFailCount ?? 0,
          },
          isSingleClause: c.hierarchicalTree?.isSingleClause ?? false,
          // Ceiling detection fields (from worst leaf)
          ceilingGap: ceilingData.ceilingGap,
          maxObserved: ceilingData.maxObserved,
          thresholdValue: ceilingData.thresholdValue,
          achievableRange,
          inRegimeAchievableRange,
          redundantInRegime: leafOnly
            ? c.hierarchicalTree?.redundantInRegime ?? null
            : null,
          tuningDirection: leafOnly
            ? c.hierarchicalTree?.tuningDirection ?? null
            : null,
          // Include hierarchical breakdown if available
          hierarchicalBreakdown: c.hierarchicalTree?.toJSON() ?? null,
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Calculate Wilson score confidence interval
   *
   * @private
   * @param {number} rate
   * @param {number} n
   * @param {number} level
   * @returns {{low: number, high: number}}
   */
  #calculateConfidenceInterval(rate, n, level) {
    // Wilson score interval for binomial proportion
    const z = this.#getZScore(level);
    const denominator = 1 + (z * z) / n;
    const center = rate + (z * z) / (2 * n);
    const margin =
      z * Math.sqrt((rate * (1 - rate) + (z * z) / (4 * n)) / n);

    return {
      low: Math.max(0, (center - margin) / denominator),
      high: Math.min(1, (center + margin) / denominator),
    };
  }

  /**
   * Get z-score for confidence level
   *
   * @private
   * @param {number} level
   * @returns {number}
   */
  #getZScore(level) {
    // Common z-scores
    if (level >= 0.99) return 2.576;
    if (level >= 0.95) return 1.96;
    if (level >= 0.9) return 1.645;
    return 1.96; // Default to 95%
  }

  // ============================================================
  // Hierarchical Tree Building and Evaluation Methods
  // ============================================================

  /**
   * Build a hierarchical tracking tree from a JSON Logic expression.
   *
   * @private
   * @param {object} logic - The JSON Logic object
   * @param {string} pathPrefix - Path prefix for node IDs
   * @param {'and' | 'or' | 'root'} parentNodeType - The parent node's type for context-aware analysis
   * @returns {HierarchicalClauseNode}
   */
  #buildHierarchicalTree(logic, pathPrefix = '0', parentNodeType = 'root') {
    if (!logic || typeof logic !== 'object') {
      const node = new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'leaf',
        description: this.#describeLeafCondition(logic),
        logic,
      });
      node.parentNodeType = parentNodeType;
      const thresholdInfo = this.#extractThresholdFromLogic(logic);
      if (thresholdInfo) {
        node.setThresholdMetadata(
          thresholdInfo.threshold,
          thresholdInfo.operator,
          thresholdInfo.variablePath
        );
      }
      return node;
    }

    // Handle AND nodes
    if (logic.and && Array.isArray(logic.and)) {
      const children = logic.and.map((child, i) =>
        this.#buildHierarchicalTree(child, `${pathPrefix}.${i}`, 'and')
      );
      const node = new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'and',
        description: `AND of ${logic.and.length} conditions`,
        logic,
        children,
      });
      node.parentNodeType = parentNodeType;
      return node;
    }

    // Handle OR nodes
    if (logic.or && Array.isArray(logic.or)) {
      const children = logic.or.map((child, i) =>
        this.#buildHierarchicalTree(child, `${pathPrefix}.${i}`, 'or')
      );
      const node = new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'or',
        description: `OR of ${logic.or.length} conditions`,
        logic,
        children,
      });
      node.parentNodeType = parentNodeType;
      return node;
    }

    // Leaf node (comparison operator)
    const node = new HierarchicalClauseNode({
      id: pathPrefix,
      nodeType: 'leaf',
      description: this.#describeLeafCondition(logic),
      logic,
    });
    node.parentNodeType = parentNodeType;
    const thresholdInfo = this.#extractThresholdFromLogic(logic);
    if (thresholdInfo) {
      node.setThresholdMetadata(
        thresholdInfo.threshold,
        thresholdInfo.operator,
        thresholdInfo.variablePath
      );
    }
    return node;
  }

  /**
   * Describe a leaf condition in human-readable form.
   *
   * @private
   * @param {object} logic
   * @returns {string}
   */
  #describeLeafCondition(logic) {
    if (!logic || typeof logic !== 'object') return String(logic);

    const operators = ['>=', '<=', '>', '<', '==', '!='];
    for (const op of operators) {
      if (logic[op]) {
        const [left, right] = logic[op];
        const leftStr = this.#describeOperand(left);
        const rightStr = this.#describeOperand(right);
        return `${leftStr} ${op} ${rightStr}`;
      }
    }

    // Handle other patterns - try to make them readable
    return JSON.stringify(logic).substring(0, 60);
  }

  /**
   * Describe an operand (left or right side of comparison).
   *
   * @private
   * @param {*} operand
   * @returns {string}
   */
  #describeOperand(operand) {
    if (operand === null || operand === undefined) return 'null';
    if (typeof operand === 'number') return String(operand);
    if (typeof operand === 'string') return `"${operand}"`;
    if (operand?.var) return operand.var;

    // Handle arithmetic expressions like { "-": [...] }
    if (operand['-']) {
      const [a, b] = operand['-'];
      return `(${this.#describeOperand(a)} - ${this.#describeOperand(b)})`;
    }
    if (operand['+']) {
      const [a, b] = operand['+'];
      return `(${this.#describeOperand(a)} + ${this.#describeOperand(b)})`;
    }
    if (operand['*']) {
      const [a, b] = operand['*'];
      return `(${this.#describeOperand(a)} * ${this.#describeOperand(b)})`;
    }
    if (operand['/']) {
      const [a, b] = operand['/'];
      return `(${this.#describeOperand(a)} / ${this.#describeOperand(b)})`;
    }

    return JSON.stringify(operand).substring(0, 30);
  }

  /**
   * Extract threshold metadata from a JSON Logic comparison.
   *
   * @private
   * @param {object} logic - The JSON Logic object
   * @returns {{threshold: number, operator: string, variablePath: string}|null}
   */
  #extractThresholdFromLogic(logic) {
    if (!logic || typeof logic !== 'object') return null;

    const operators = ['>=', '<=', '>', '<', '=='];

    for (const op of operators) {
      if (logic[op] && Array.isArray(logic[op]) && logic[op].length === 2) {
        const [left, right] = logic[op];

        // Pattern: {"op": [{"var": "path"}, threshold]}
        if (left?.var && typeof right === 'number') {
          return {
            threshold: right,
            operator: op,
            variablePath: left.var,
          };
        }

        // Pattern: {"op": [threshold, {"var": "path"}]} (reversed)
        if (right?.var && typeof left === 'number') {
          return {
            threshold: left,
            operator: this.#reverseOperator(op),
            variablePath: right.var,
          };
        }
      }
    }

    return null;
  }

  /**
   * Reverse a comparison operator (for when threshold is on the left).
   *
   * @private
   * @param {string} op
   * @returns {string}
   */
  #reverseOperator(op) {
    const reverseMap = {
      '>=': '<=',
      '<=': '>=',
      '>': '<',
      '<': '>',
      '==': '==',
    };
    return reverseMap[op] || op;
  }

  /**
   * Extract mood constraints from expression prerequisites.
   * Mood constraints are conditions on moodAxes.* or mood.* paths.
   *
   * @private
   * @param {Array} prerequisites
   * @returns {Array<{varPath: string, operator: string, threshold: number}>}
   */
  #extractMoodConstraints(prerequisites) {
    const constraints = [];
    if (!prerequisites || !Array.isArray(prerequisites)) {
      return constraints;
    }

    for (const prereq of prerequisites) {
      this.#extractMoodConstraintsFromLogic(prereq.logic, constraints);
    }

    return constraints;
  }

  /**
   * Recursively extract mood constraints from JSON Logic (AND blocks only).
   *
   * @private
   * @param {object} logic
   * @param {Array} constraints
   */
  #extractMoodConstraintsFromLogic(logic, constraints) {
    if (!logic || typeof logic !== 'object') return;

    const operators = ['>=', '<=', '>', '<', '=='];
    for (const op of operators) {
      if (logic[op]) {
        const [left, right] = logic[op];
        if (typeof left === 'object' && left.var && typeof right === 'number') {
          const varPath = left.var;
          if (varPath.startsWith('moodAxes.') || varPath.startsWith('mood.')) {
            constraints.push({
              varPath,
              operator: op,
              threshold: right,
            });
          }
        }
      }
    }

    if (logic.and && Array.isArray(logic.and)) {
      for (const clause of logic.and) {
        this.#extractMoodConstraintsFromLogic(clause, constraints);
      }
    }
  }

  /**
   * Evaluate mood constraints against a context.
   *
   * @private
   * @param {Array<{varPath: string, operator: string, threshold: number}>} constraints
   * @param {object} context
   * @returns {boolean}
   */
  #evaluateMoodConstraints(constraints, context) {
    if (!constraints || constraints.length === 0) return true;

    return constraints.every((constraint) => {
      const value = this.#getNestedValue(context, constraint.varPath);
      if (typeof value !== 'number') return false;
      switch (constraint.operator) {
        case '>=':
          return value >= constraint.threshold;
        case '>':
          return value > constraint.threshold;
        case '<=':
          return value <= constraint.threshold;
        case '<':
          return value < constraint.threshold;
        case '==':
          return value === constraint.threshold;
        default:
          return false;
      }
    });
  }

  /**
   * Compute gate compatibility for prototypes referenced in prerequisites.
   *
   * @private
   * @param {object} expression
   * @param {Array<{varPath: string, operator: string, threshold: number}>} moodConstraints
   * @returns {{emotions: Record<string, {compatible: boolean, reason: string|null}>, sexualStates: Record<string, {compatible: boolean, reason: string|null}>}}
   */
  #computeGateCompatibility(expression, moodConstraints) {
    const references = this.#extractPrototypeReferences(
      expression?.prerequisites
    );
    const axisIntervals = this.#buildAxisIntervalsFromMoodConstraints(
      moodConstraints
    );

    const result = { emotions: {}, sexualStates: {} };

    for (const prototypeId of references.emotions) {
      result.emotions[prototypeId] = this.#checkPrototypeCompatibility(
        prototypeId,
        'emotion',
        axisIntervals
      );
    }

    for (const prototypeId of references.sexualStates) {
      result.sexualStates[prototypeId] = this.#checkPrototypeCompatibility(
        prototypeId,
        'sexual',
        axisIntervals
      );
    }

    return result;
  }

  /**
   * Check if a prototype's gates are compatible with mood regime constraints.
   *
   * @private
   * @param {string} prototypeId
   * @param {'emotion'|'sexual'} type
   * @param {Map<string, AxisInterval>} axisIntervals
   * @returns {{compatible: boolean, reason: string|null}}
   */
  #checkPrototypeCompatibility(prototypeId, type, axisIntervals) {
    const prototype = this.#getPrototype(prototypeId, type);
    if (!prototype) {
      return { compatible: false, reason: 'prototype not found' };
    }

    const gates = Array.isArray(prototype.gates) ? prototype.gates : [];
    if (gates.length === 0) {
      return { compatible: true, reason: null };
    }

    for (const gateStr of gates) {
      let constraint;
      try {
        constraint = GateConstraint.parse(gateStr);
      } catch {
        continue;
      }

      const interval =
        axisIntervals.get(constraint.axis) ??
        this.#getDefaultIntervalForAxis(constraint.axis);
      const constrained = constraint.applyTo(interval);
      if (constrained.isEmpty()) {
        const reason = `gate \"${gateStr}\" conflicts with mood regime ${constraint.axis} in [${interval.min}, ${interval.max}]`;
        return { compatible: false, reason };
      }
    }

    return { compatible: true, reason: null };
  }

  /**
   * Build axis intervals (normalized) from mood constraints.
   *
   * @private
   * @param {Array<{varPath: string, operator: string, threshold: number}>} moodConstraints
   * @returns {Map<string, AxisInterval>}
   */
  #buildAxisIntervalsFromMoodConstraints(moodConstraints) {
    const intervals = new Map();
    for (const constraint of moodConstraints || []) {
      const axis = constraint.varPath
        .replace('moodAxes.', '')
        .replace('mood.', '');
      const normalizedValue = this.#normalizeMoodAxisValue(
        constraint.threshold
      );
      const current =
        intervals.get(axis) ?? this.#getDefaultIntervalForAxis(axis);
      const updated = current.applyConstraint(
        constraint.operator,
        normalizedValue
      );
      intervals.set(axis, updated);
    }
    return intervals;
  }

  /**
   * Normalize mood axis values to [-1, 1] scale when raw inputs are provided.
   *
   * @private
   * @param {number} value
   * @returns {number}
   */
  #normalizeMoodAxisValue(value) {
    return Math.abs(value) <= 1 ? value : value / 100;
  }

  /**
   * Get default interval bounds for an axis (normalized).
   *
   * @private
   * @param {string} axis
   * @returns {AxisInterval}
   */
  #getDefaultIntervalForAxis(axis) {
    const sexualAxes = [
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
      'sexual_arousal',
    ];
    if (sexualAxes.includes(axis)) {
      return AxisInterval.forSexualAxis();
    }
    return AxisInterval.forMoodAxis();
  }

  /**
   * Extract prototype references from prerequisites.
   *
   * @private
   * @param {Array} prerequisites
   * @returns {{emotions: string[], sexualStates: string[]}}
   */
  #extractPrototypeReferences(prerequisites) {
    const emotions = new Set();
    const sexualStates = new Set();

    if (!Array.isArray(prerequisites)) {
      return { emotions: [], sexualStates: [] };
    }

    for (const prereq of prerequisites) {
      this.#collectPrototypeReferencesFromLogic(
        prereq.logic,
        emotions,
        sexualStates
      );
    }

    return {
      emotions: [...emotions],
      sexualStates: [...sexualStates],
    };
  }

  /**
   * Recursively collect prototype references from JSON Logic.
   *
   * @private
   * @param {object} logic
   * @param {Set<string>} emotions
   * @param {Set<string>} sexualStates
   */
  #collectPrototypeReferencesFromLogic(logic, emotions, sexualStates) {
    if (!logic || typeof logic !== 'object') return;

    for (const op of ['>=', '<=', '>', '<', '==']) {
      if (logic[op]) {
        const [left, right] = logic[op];
        const candidates = [left, right];
        for (const candidate of candidates) {
          if (candidate?.var && typeof candidate.var === 'string') {
            if (candidate.var.startsWith('emotions.')) {
              emotions.add(candidate.var.replace('emotions.', ''));
            } else if (candidate.var.startsWith('sexualStates.')) {
              sexualStates.add(candidate.var.replace('sexualStates.', ''));
            }
          }
        }
      }
    }

    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        this.#collectPrototypeReferencesFromLogic(
          clause,
          emotions,
          sexualStates
        );
      }
    }
  }

  /**
   * Get prototype definition from dataRegistry.
   *
   * @private
   * @param {string} prototypeId
   * @param {'emotion'|'sexual'} type
   * @returns {object|null}
   */
  #getPrototype(prototypeId, type) {
    const lookupId =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.get('lookups', lookupId);
    return lookup?.entries?.[prototypeId] || null;
  }

  /**
   * Recursively evaluate a hierarchical tree node and update stats.
   * Evaluates ALL children (no short-circuit) to collect accurate stats.
   * Also tracks sibling-conditioned stats for leaves within compound nodes.
   *
   * @private
   * @param {HierarchicalClauseNode} node
   * @param {object} context
   * @returns {boolean} - Whether the node evaluated to true
   */
  #evaluateHierarchicalNode(node, context, inRegime) {
    if (node.nodeType === 'leaf') {
      const passed = this.#evaluateLeafCondition(node.logic, context);
      const violation = passed
        ? 0
        : this.#estimateLeafViolation(node.logic, context);

      // Record the actual observed value for ceiling analysis
      const actualValue = this.#extractActualValue(node.logic, context);
      if (actualValue !== null) {
        if (inRegime) {
          node.recordObservedValueInRegime(actualValue);
        } else {
          node.recordObservedValue(actualValue);
        }
      }

      // Record near-miss if threshold metadata available
      if (actualValue !== null && node.thresholdValue !== null && node.variablePath) {
        const epsilon = getEpsilonForVariable(node.variablePath);
        node.recordNearMiss(actualValue, node.thresholdValue, epsilon);
      }

      node.recordEvaluation(passed, violation);
      if (inRegime) {
        node.recordInRegimeEvaluation(passed);
      }
      return passed;
    }

    if (node.nodeType === 'and') {
      // For AND: all children must pass; evaluate ALL to track stats
      const childResults = [];
      for (const child of node.children) {
        const childPassed = this.#evaluateHierarchicalNode(
          child,
          context,
          inRegime
        );
        childResults.push({ child, passed: childPassed });
      }

      // Track sibling-conditioned stats for each child
      this.#recordSiblingConditionedStats(childResults);

      const allPassed = childResults.every((r) => r.passed);
      node.recordEvaluation(allPassed);
      if (inRegime) {
        node.recordInRegimeEvaluation(allPassed);
      }
      return allPassed;
    }

    if (node.nodeType === 'or') {
      // For OR: any child must pass; evaluate ALL to track stats
      const childResults = [];
      for (const child of node.children) {
        const childPassed = this.#evaluateHierarchicalNode(
          child,
          context,
          inRegime
        );
        childResults.push({ child, passed: childPassed });
      }

      // Track sibling-conditioned stats for each child
      this.#recordSiblingConditionedStats(childResults);

      const anyPassed = childResults.some((r) => r.passed);

      // Track OR contribution: which alternative fired first when OR succeeded
      if (anyPassed) {
        let firstContributorFound = false;
        for (let i = 0; i < childResults.length; i++) {
          const { child, passed } = childResults[i];
          // All children get their orSuccessCount incremented
          child.recordOrSuccess();
          if (passed) {
            child.recordOrPass();
          }
          // Only the first passing alternative gets contribution credit
          if (passed && !firstContributorFound) {
            child.recordOrContribution();
            firstContributorFound = true;
          }
          if (passed) {
            const siblingsFailed = childResults.every(
              (result, j) => j === i || !result.passed
            );
            if (siblingsFailed) {
              child.recordOrExclusivePass();
            }
          }
        }
      }

      node.recordEvaluation(anyPassed);
      if (inRegime) {
        node.recordInRegimeEvaluation(anyPassed);
      }
      return anyPassed;
    }

    // Unknown node type - use json-logic directly
    try {
      const passed = jsonLogic.apply(node.logic, context);
      node.recordEvaluation(passed);
      if (inRegime) {
        node.recordInRegimeEvaluation(passed);
      }
      return passed;
    } catch {
      node.recordEvaluation(false);
      if (inRegime) {
        node.recordInRegimeEvaluation(false);
      }
      return false;
    }
  }

  /**
   * Record sibling-conditioned stats for children of a compound node.
   * For each child, if all siblings passed and this child failed,
   * record a sibling-conditioned failure.
   *
   * @private
   * @param {Array<{child: HierarchicalClauseNode, passed: boolean}>} childResults
   */
  #recordSiblingConditionedStats(childResults) {
    for (let i = 0; i < childResults.length; i++) {
      const { child: currentChild, passed: currentPassed } = childResults[i];

      // Check if all siblings (other children) passed
      const siblingsPassed = childResults.every(
        (result, j) => j === i || result.passed
      );

      if (siblingsPassed) {
        currentChild.recordSiblingsPassed();
        if (!currentPassed) {
          currentChild.recordSiblingConditionedFail();
        }
      }
    }
  }

  /**
   * Evaluate a leaf condition directly.
   *
   * @private
   * @param {object} logic
   * @param {object} context
   * @returns {boolean}
   */
  #evaluateLeafCondition(logic, context) {
    try {
      return jsonLogic.apply(logic, context);
    } catch {
      return false;
    }
  }

  /**
   * Estimate violation magnitude for a leaf condition.
   *
   * @private
   * @param {object} logic
   * @param {object} context
   * @returns {number}
   */
  #estimateLeafViolation(logic, context) {
    if (!logic) return 0;

    // Handle >= operator
    if (logic['>=']) {
      const [left, right] = logic['>='];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return Math.max(0, threshold - actual);
      }
    }

    // Handle <= operator
    if (logic['<=']) {
      const [left, right] = logic['<='];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return Math.max(0, actual - threshold);
      }
    }

    // Handle < operator
    if (logic['<']) {
      const [left, right] = logic['<'];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return actual >= threshold ? actual - threshold + 0.01 : 0;
      }
    }

    // Handle > operator
    if (logic['>']) {
      const [left, right] = logic['>'];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return actual <= threshold ? threshold - actual + 0.01 : 0;
      }
    }

    return 0.1; // Default small violation for unknown operators
  }

  /**
   * Resolve a value from context (handles {var: "path"}, literals, and expressions).
   *
   * @private
   * @param {*} expr
   * @param {object} context
   * @returns {*}
   */
  #resolveValue(expr, context) {
    if (expr?.var) {
      return this.#getNestedValue(context, expr.var);
    }
    if (typeof expr === 'number' || typeof expr === 'string') {
      return expr;
    }
    // Try evaluating as json-logic expression (e.g., arithmetic)
    try {
      return jsonLogic.apply(expr, context);
    } catch {
      return expr;
    }
  }

  /**
   * Extract the actual value being compared in a condition.
   * Used for ceiling analysis (max observed value tracking).
   *
   * @private
   * @param {Object} logic - JSON Logic condition
   * @param {Object} context - Evaluation context
   * @returns {number|null} The actual value, or null for non-numeric comparisons
   */
  #extractActualValue(logic, context) {
    if (!logic) return null;

    const operators = ['>=', '<=', '>', '<', '=='];

    for (const op of operators) {
      if (logic[op]) {
        const [left, right] = logic[op];

        // Pattern: {"op": [{"var": "path"}, threshold]}
        if (left?.var) {
          const value = this.#resolveValue(left, context);
          return typeof value === 'number' ? value : null;
        }

        // Pattern: {"op": [threshold, {"var": "path"}]}
        if (right?.var) {
          const value = this.#resolveValue(right, context);
          return typeof value === 'number' ? value : null;
        }
      }
    }

    return null;
  }

  // ============================================================
  // Unseeded Variable Detection Methods
  // ============================================================

  /**
   * Build the set of known context keys from static definitions and prototype registries.
   *
   * @private
   * @returns {{ topLevel: Set<string>, nestedKeys: Record<string, Set<string>>, scalarKeys: Set<string> }}
   */
  #buildKnownContextKeys() {
    // Static top-level keys that are always seeded
    const topLevel = new Set([
      'mood',
      'moodAxes',
      'emotions',
      'sexualStates',
      'sexualArousal',
      'previousEmotions',
      'previousSexualStates',
      'previousMoodAxes',
      'previousSexualArousal',
      'affectTraits', // NEW: Affect traits are now seeded
    ]);

    // Keys that are scalar (cannot have nested properties)
    const scalarKeys = new Set(['sexualArousal', 'previousSexualArousal']);

    // All 8 mood axes (affiliation added for AFFTRAANDAFFAXI spec)
    const moodAxisSet = new Set([
      'valence',
      'arousal',
      'agency_control',
      'threat',
      'engagement',
      'future_expectancy',
      'self_evaluation',
      'affiliation',
    ]);

    // Nested keys for each category (from prototypes + hardcoded mood axes)
    const nestedKeys = {
      mood: moodAxisSet,
      moodAxes: new Set(moodAxisSet),
      previousMoodAxes: new Set(moodAxisSet),
    };

    // Affect traits nested keys
    nestedKeys.affectTraits = new Set([
      'affective_empathy',
      'cognitive_empathy',
      'harm_aversion',
    ]);

    // Get dynamic keys from emotion prototypes
    const emotionLookup = this.#dataRegistry.get(
      'lookups',
      'core:emotion_prototypes'
    );
    if (emotionLookup?.entries) {
      const emotionKeys = new Set(Object.keys(emotionLookup.entries));
      nestedKeys.emotions = emotionKeys;
      nestedKeys.previousEmotions = emotionKeys;
    } else {
      nestedKeys.emotions = new Set();
      nestedKeys.previousEmotions = new Set();
    }

    // Get dynamic keys from sexual prototypes
    const sexualLookup = this.#dataRegistry.get(
      'lookups',
      'core:sexual_prototypes'
    );
    if (sexualLookup?.entries) {
      const sexualKeys = new Set(Object.keys(sexualLookup.entries));
      nestedKeys.sexualStates = sexualKeys;
      nestedKeys.previousSexualStates = sexualKeys;
    } else {
      nestedKeys.sexualStates = new Set();
      nestedKeys.previousSexualStates = new Set();
    }

    return { topLevel, nestedKeys, scalarKeys };
  }

  /**
   * Validate a single variable path against known context keys.
   *
   * @private
   * @param {string} path - The variable path to validate (e.g., "emotions.joy")
   * @param {{ topLevel: Set<string>, nestedKeys: Record<string, Set<string>>, scalarKeys: Set<string> }} knownKeys
   * @returns {{ isValid: boolean, reason?: 'unknown_root' | 'unknown_nested_key' | 'invalid_nesting', suggestion?: string }}
   */
  #validateVarPath(path, knownKeys) {
    const parts = path.split('.');
    const root = parts[0];

    // Check if root is known
    if (!knownKeys.topLevel.has(root)) {
      return {
        isValid: false,
        reason: 'unknown_root',
        suggestion: `Unknown root variable "${root}". Valid roots: ${[...knownKeys.topLevel].sort().join(', ')}`,
      };
    }

    // Check if trying to nest on a scalar
    if (parts.length > 1 && knownKeys.scalarKeys.has(root)) {
      return {
        isValid: false,
        reason: 'invalid_nesting',
        suggestion: `"${root}" is a scalar value and cannot have nested properties like "${path}"`,
      };
    }

    // Check nested key validity (if applicable)
    if (parts.length > 1) {
      const nestedKey = parts[1];
      const validNestedKeys = knownKeys.nestedKeys[root];

      if (validNestedKeys && !validNestedKeys.has(nestedKey)) {
        const knownList =
          validNestedKeys.size > 0
            ? [...validNestedKeys].sort().slice(0, 5).join(', ') +
              (validNestedKeys.size > 5 ? '...' : '')
            : '(none available)';
        return {
          isValid: false,
          reason: 'unknown_nested_key',
          suggestion: `Unknown key "${nestedKey}" in "${root}". Known keys: ${knownList}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate all variable paths in an expression's prerequisites.
   *
   * @private
   * @param {object} expression - Expression with prerequisites array
   * @returns {{ warnings: UnseededVarWarning[] }}
   */
  #validateExpressionVarPaths(expression) {
    const warnings = [];
    const knownKeys = this.#buildKnownContextKeys();

    if (!expression?.prerequisites) {
      return { warnings };
    }

    // Collect all var paths from all prerequisites
    const allPaths = [];
    for (const prereq of expression.prerequisites) {
      if (prereq?.logic) {
        collectVarPaths(prereq.logic, allPaths);
      }
    }

    // Deduplicate paths for validation (but track all occurrences for warnings)
    const seenPaths = new Set();
    for (const path of allPaths) {
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);

      const result = this.#validateVarPath(path, knownKeys);
      if (!result.isValid) {
        warnings.push({
          path,
          reason: result.reason,
          suggestion: result.suggestion,
        });
      }
    }

    return { warnings };
  }

  /**
   * Collect sampling coverage variables referenced by the expression.
   *
   * @private
   * @param {object} expression
   * @returns {Array<{variablePath: string, domain: string, min: number, max: number}>}
   */
  #collectSamplingCoverageVariables(expression) {
    if (!expression?.prerequisites) {
      return [];
    }

    const allPaths = [];
    for (const prereq of expression.prerequisites) {
      if (prereq?.logic) {
        collectVarPaths(prereq.logic, allPaths);
      }
    }

    const uniquePaths = new Set(allPaths);
    const variables = [];

    for (const path of uniquePaths) {
      const variable = this.#resolveSamplingCoverageVariable(path);
      if (variable) {
        variables.push(variable);
      }
    }

    return variables;
  }

  /**
   * Resolve sampling coverage config for a variable path.
   *
   * @private
   * @param {string} variablePath
   * @returns {{variablePath: string, domain: string, min: number, max: number} | null}
   */
  #resolveSamplingCoverageVariable(variablePath) {
    if (!variablePath || typeof variablePath !== 'string') {
      return null;
    }

    for (const domainConfig of SAMPLING_COVERAGE_DOMAIN_RANGES) {
      if (domainConfig.pattern.test(variablePath)) {
        return {
          variablePath,
          domain: domainConfig.domain,
          min: domainConfig.min,
          max: domainConfig.max,
        };
      }
    }

    return null;
  }

  /**
   * Count the number of failed leaf clauses for a given sample.
   * Used for nearest-miss tracking.
   *
   * @private
   * @param {object[]} clauseTracking - Clause tracking array
   * @param {object} expression - Expression being evaluated
   * @param {object} context - Evaluation context
   * @returns {number} Count of failed leaf clauses
   */
  #countFailedClauses(clauseTracking, expression, context) {
    let failedCount = 0;

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      const clause = clauseTracking[i];

      if (clause.hierarchicalTree) {
        // Count failed leaves in hierarchical tree
        failedCount += this.#countFailedLeavesInTree(clause.hierarchicalTree, context);
      } else {
        // Simple atomic clause - check if it fails
        const result = this.#evaluatePrerequisite(prereq, context);
        if (!result) {
          failedCount++;
        }
      }
    }

    return failedCount;
  }

  /**
   * Count failed leaf nodes in a hierarchical tree.
   *
   * @private
   * @param {object} node - Hierarchical tree node
   * @param {object} context - Evaluation context
   * @returns {number} Count of failed leaf clauses
   */
  #countFailedLeavesInTree(node, context) {
    if (!node.isCompound) {
      // Leaf node - evaluate and count if failed
      try {
        const result = jsonLogic.apply(node.logic, context);
        return result ? 0 : 1;
      } catch {
        return 1; // Treat errors as failures
      }
    }

    // Compound node - sum failed children
    let failedCount = 0;
    for (const child of node.children || []) {
      failedCount += this.#countFailedLeavesInTree(child, context);
    }
    return failedCount;
  }

  /**
   * Get summary of failed leaf conditions for a sample.
   * Returns information useful for debugging nearest misses.
   *
   * @private
   * @param {object[]} clauseTracking - Clause tracking array
   * @param {object} expression - Expression being evaluated
   * @param {object} context - Evaluation context
   * @returns {Array<{description: string, actual: number|null, threshold: number|null, violation: number|null}>}
   */
  #getFailedLeavesSummary(clauseTracking, expression, context) {
    const failedLeaves = [];

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      const clause = clauseTracking[i];

      if (clause.hierarchicalTree) {
        // Collect failed leaves from tree
        this.#collectFailedLeaves(clause.hierarchicalTree, context, failedLeaves);
      } else {
        // Simple atomic clause
        const result = this.#evaluatePrerequisite(prereq, context);
        if (!result) {
          failedLeaves.push({
            description: clause.description || `Clause ${i + 1}`,
            actual: null,
            threshold: null,
            violation: null,
          });
        }
      }
    }

    // Limit to first 5 failed leaves for brevity
    return failedLeaves.slice(0, 5);
  }

  /**
   * Recursively collect failed leaf descriptions from a hierarchical tree.
   *
   * @private
   * @param {object} node - Hierarchical tree node
   * @param {object} context - Evaluation context
   * @param {Array} failedLeaves - Array to collect failed leaves into
   */
  #collectFailedLeaves(node, context, failedLeaves) {
    if (!node.isCompound) {
      // Leaf node - evaluate and collect if failed
      let passed = false;
      try {
        passed = jsonLogic.apply(node.logic, context);
      } catch {
        passed = false;
      }
      if (!passed) {
        // Try to extract threshold info from node
        const violationInfo = this.#extractViolationInfo(node.logic, context);
        failedLeaves.push({
          description: node.description || 'Unknown condition',
          actual: violationInfo.actual,
          threshold: violationInfo.threshold,
          violation: violationInfo.violation,
        });
      }
      return;
    }

    // Compound node - recurse into children
    for (const child of node.children || []) {
      this.#collectFailedLeaves(child, context, failedLeaves);
    }
  }

  /**
   * Safely evaluate an operand in a JSON Logic expression.
   *
   * @private
   * @param {*} operand - The operand to evaluate (literal, var reference, or expression)
   * @param {object} context - Evaluation context
   * @returns {*} The evaluated value, or null if evaluation fails
   */
  #safeEvalOperand(operand, context) {
    // Handle literal values
    if (typeof operand === 'number' || typeof operand === 'string' || typeof operand === 'boolean') {
      return operand;
    }

    // Handle null/undefined
    if (operand === null || operand === undefined) {
      return null;
    }

    // Handle var reference
    if (typeof operand === 'object' && operand.var) {
      try {
        return jsonLogic.apply(operand, context);
      } catch {
        return null;
      }
    }

    // Handle other expressions (arithmetic, etc.)
    if (typeof operand === 'object') {
      try {
        return jsonLogic.apply(operand, context);
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Extract threshold violation information from a comparison expression.
   *
   * @private
   * @param {object} logic - JSON Logic expression
   * @param {object} context - Evaluation context
   * @returns {{actual: number|null, threshold: number|null, violation: number|null}}
   */
  #extractViolationInfo(logic, context) {
    // Guard against null/undefined logic
    if (!logic || typeof logic !== 'object') {
      return { actual: null, threshold: null, violation: null };
    }

    // Check for comparison operators
    const operators = ['>=', '<=', '>', '<', '=='];
    for (const op of operators) {
      if (logic[op]) {
        const [leftExpr, rightExpr] = logic[op];

        // Try to evaluate both sides
        const left = this.#safeEvalOperand(leftExpr, context);
        const right = this.#safeEvalOperand(rightExpr, context);

        if (typeof left === 'number' && typeof right === 'number') {
          // Determine which is actual and which is threshold
          // Typically var references are on the left, thresholds on the right
          const isLeftVar = typeof leftExpr === 'object' && leftExpr?.var;
          const actual = isLeftVar ? left : right;
          const threshold = isLeftVar ? right : left;
          const violation = Math.abs(actual - threshold);

          return { actual, threshold, violation };
        }
      }
    }

    return { actual: null, threshold: null, violation: null };
  }

  /**
   * Compute threshold sensitivity for a given condition path.
   *
   * Given stored contexts from a simulation, this evaluates how changing
   * a threshold value affects the pass rate for that condition.
   *
   * @param {object[]} storedContexts - Array of contexts from simulation
   * @param {string} varPath - Variable path (e.g., 'emotions.anger')
   * @param {string} operator - Comparison operator ('>=', '<=', '>', '<')
   * @param {number} originalThreshold - Original threshold value
   * @param {object} [options] - Options
   * @param {number} [options.steps=9] - Number of grid points
   * @param {number} [options.stepSize=0.05] - Step size for threshold grid
   * @returns {SensitivityResult}
   */
  computeThresholdSensitivity(
    storedContexts,
    varPath,
    operator,
    originalThreshold,
    options = {}
  ) {
    const { steps = 9, stepSize = 0.05 } = options;

    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.warn(
        'MonteCarloSimulator: No stored contexts for sensitivity analysis'
      );
      return {
        conditionPath: varPath,
        operator,
        originalThreshold,
        grid: [],
      };
    }

    const grid = [];

    // Generate threshold grid centered on original value
    const halfSteps = Math.floor(steps / 2);
    for (let i = -halfSteps; i <= halfSteps; i++) {
      const threshold = originalThreshold + i * stepSize;
      let passCount = 0;

      for (const context of storedContexts) {
        const actualValue = this.#getNestedValue(context, varPath);
        if (actualValue === undefined || actualValue === null) continue;

        const passes = this.#evaluateThresholdCondition(
          actualValue,
          operator,
          threshold
        );
        if (passes) passCount++;
      }

      const passRate = passCount / storedContexts.length;

      grid.push({
        threshold,
        passRate,
        passCount,
        sampleCount: storedContexts.length,
      });
    }

    return {
      conditionPath: varPath,
      operator,
      originalThreshold,
      grid,
    };
  }


  /**
   * Compute sensitivity for the ENTIRE expression, not just a single clause.
   * This evaluates how changing a single variable's threshold affects the
   * overall expression trigger rate.
   *
   * @param {object[]} storedContexts - Stored simulation contexts
   * @param {object} expressionLogic - Full expression JSON Logic (e.g., prerequisite.logic)
   * @param {string} varPath - Variable path to vary (e.g., "emotions.anger")
   * @param {string} operator - Comparison operator (e.g., ">=", "<=")
   * @param {number} originalThreshold - Original threshold value
   * @param {object} options - Configuration options
   * @param {number} [options.steps=9] - Number of grid points
   * @param {number} [options.stepSize=0.05] - Step size between grid points
   * @returns {{varPath: string, operator: string, originalThreshold: number, grid: {threshold: number, triggerRate: number, triggerCount: number, sampleCount: number}[], isExpressionLevel: boolean}}
   */
  computeExpressionSensitivity(
    storedContexts,
    expressionLogic,
    varPath,
    operator,
    originalThreshold,
    options = {}
  ) {
    const { steps = 9, stepSize = 0.05 } = options;

    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.warn(
        'MonteCarloSimulator: No stored contexts for expression sensitivity analysis'
      );
      return {
        varPath,
        operator,
        originalThreshold,
        grid: [],
        isExpressionLevel: true,
      };
    }

    if (!expressionLogic) {
      this.#logger.warn(
        'MonteCarloSimulator: No expression logic for expression sensitivity analysis'
      );
      return {
        varPath,
        operator,
        originalThreshold,
        grid: [],
        isExpressionLevel: true,
      };
    }

    const grid = [];

    // Generate threshold grid centered on original value
    const halfSteps = Math.floor(steps / 2);
    for (let i = -halfSteps; i <= halfSteps; i++) {
      const threshold = originalThreshold + i * stepSize;
      const modifiedLogic = this.#replaceThresholdInLogic(
        expressionLogic,
        varPath,
        operator,
        threshold
      );

      let triggerCount = 0;
      for (const context of storedContexts) {
        try {
          const result = jsonLogic.apply(modifiedLogic, context);
          if (result) triggerCount++;
        } catch {
          // Skip contexts that cause evaluation errors
        }
      }

      const triggerRate = triggerCount / storedContexts.length;

      grid.push({
        threshold,
        triggerRate,
        triggerCount,
        sampleCount: storedContexts.length,
      });
    }

    return {
      varPath,
      operator,
      originalThreshold,
      grid,
      isExpressionLevel: true,
    };
  }

  /**
   * Replace a threshold in a JSON Logic tree for sensitivity analysis.
   * Finds conditions matching the varPath and operator, and replaces the threshold.
   *
   * @private
   * @param {object} logic - JSON Logic object to modify
   * @param {string} varPath - Variable path to match (e.g., "emotions.anger")
   * @param {string} operator - Operator to match (e.g., ">=")
   * @param {number} newThreshold - New threshold value
   * @returns {object} - Modified JSON Logic object (deep clone)
   */
  #replaceThresholdInLogic(logic, varPath, operator, newThreshold) {
    // Deep clone to avoid mutating original
    const clone = JSON.parse(JSON.stringify(logic));
    this.#replaceThresholdRecursive(clone, varPath, operator, newThreshold);
    return clone;
  }

  /**
   * Recursively replace threshold values in a JSON Logic tree.
   *
   * @private
   * @param {object} node - Current node being processed (mutated in place)
   * @param {string} varPath - Variable path to match
   * @param {string} operator - Operator to match
   * @param {number} newThreshold - New threshold value
   */
  #replaceThresholdRecursive(node, varPath, operator, newThreshold) {
    if (!node || typeof node !== 'object') return;

    // Check if this node matches our target condition
    // Pattern: {">=": [{"var": "emotions.anger"}, 0.4]}
    if (node[operator] && Array.isArray(node[operator])) {
      const [left, right] = node[operator];

      // Check pattern: {"op": [{"var": "path"}, threshold]}
      if (left?.var === varPath && typeof right === 'number') {
        node[operator][1] = newThreshold;
        return;
      }

      // Check pattern: {"op": [threshold, {"var": "path"}]}
      if (right?.var === varPath && typeof left === 'number') {
        node[operator][0] = newThreshold;
        return;
      }
    }

    // Recurse into compound nodes (and, or, if, etc.)
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object') {
            this.#replaceThresholdRecursive(child, varPath, operator, newThreshold);
          }
        }
      } else if (value && typeof value === 'object') {
        this.#replaceThresholdRecursive(value, varPath, operator, newThreshold);
      }
    }
  }

  /**
   * Evaluate a threshold condition (helper for sensitivity analysis).
   *
   * @private
   * @param {number} actual - Actual value from context
   * @param {string} operator - Comparison operator
   * @param {number} threshold - Threshold value
   * @returns {boolean} Whether condition passes
   */
  #evaluateThresholdCondition(actual, operator, threshold) {
    switch (operator) {
      case '>=':
        return actual >= threshold;
      case '>':
        return actual > threshold;
      case '<=':
        return actual <= threshold;
      case '<':
        return actual < threshold;
      default:
        return false;
    }
  }

  /**
   * Extract all emotion variable names referenced in an expression's prerequisites.
   * Walks the JSON Logic tree to find all 'emotions.*' and 'previousEmotions.*' var paths.
   *
   * @private
   * @param {object} expression - The expression containing prerequisites
   * @returns {Set<string>} Set of emotion names (e.g., 'anger', 'grief')
   */
  #extractReferencedEmotions(expression) {
    const emotionNames = new Set();

    const extractFromLogic = (logic) => {
      if (!logic || typeof logic !== 'object') return;

      // Handle {"var": "emotions.anger"} or {"var": "previousEmotions.anger"}
      if (logic.var && typeof logic.var === 'string') {
        const match = logic.var.match(/^(?:previous)?[Ee]motions\.(\w+)$/);
        if (match) {
          emotionNames.add(match[1]);
        }
        return;
      }

      // Recurse into arrays and objects
      for (const key in logic) {
        const value = logic[key];
        if (Array.isArray(value)) {
          value.forEach(extractFromLogic);
        } else if (typeof value === 'object') {
          extractFromLogic(value);
        }
      }
    };

    if (expression?.prerequisites) {
      for (const prereq of expression.prerequisites) {
        extractFromLogic(prereq);
      }
    }

    return emotionNames;
  }

  /**
   * Filter computed emotions to include only those referenced in the expression.
   *
   * @private
   * @param {object} allEmotions - Full computed emotions object
   * @param {Set<string>} referencedNames - Set of referenced emotion names
   * @returns {object} Filtered emotions object containing only referenced emotions
   */
  #filterEmotions(allEmotions, referencedNames) {
    if (!allEmotions || referencedNames.size === 0) return {};

    const filtered = {};
    for (const name of referencedNames) {
      if (name in allEmotions) {
        filtered[name] = allEmotions[name];
      }
    }
    return filtered;
  }
}

export default MonteCarloSimulator;
