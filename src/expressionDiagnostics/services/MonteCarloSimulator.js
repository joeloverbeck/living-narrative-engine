/**
 * @file MonteCarloSimulator - Statistical trigger probability estimation
 * @see specs/expression-diagnostics.md Layer C
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import jsonLogic from 'json-logic-js';
import {
  classifyPrerequisiteTypes,
  evaluateConstraint,
  extractMergedMoodConstraints,
  getNestedValue,
} from '../utils/moodRegimeUtils.js';
import {
  buildPopulationHash,
  buildPopulationPredicate,
} from '../utils/populationHashUtils.js';
import {
  createSamplingCoverageCalculator,
} from './monteCarloSamplingCoverage.js';
import AblationImpactCalculator from './AblationImpactCalculator.js';
import ContextBuilder from './simulatorCore/ContextBuilder.js';
import ExpressionEvaluator from './simulatorCore/ExpressionEvaluator.js';
import GateEvaluator from './simulatorCore/GateEvaluator.js';
import PrototypeEvaluator from './simulatorCore/PrototypeEvaluator.js';
import ViolationEstimator from './simulatorCore/ViolationEstimator.js';
import VariablePathValidator from './simulatorCore/VariablePathValidator.js';

const DEFAULT_SAMPLING_COVERAGE_CONFIG = {
  enabled: true,
  binCount: 10,
  minSamplesPerBin: 1,
  tailPercent: 0.1,
};

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
 * @property {number} [moodRegimeSampleReservoirLimit=0] - Max samples to store for mood-regime replay (0 disables storage)
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
 * @typedef {'marginalClausePassRateSweep' | 'expressionTriggerRateSweep'} SensitivityResultKind
 */

/**
 * @typedef {object} SensitivityResult
 * @property {SensitivityResultKind} kind - Discriminator for the sweep type
 * @property {string} conditionPath - Path to the condition (e.g., 'emotions.anger')
 * @property {string} operator - Comparison operator (e.g., '>=')
 * @property {number} originalThreshold - Original threshold value
 * @property {SensitivityPoint[]} grid - Sensitivity grid data
 * @property {string} [populationHash] - Hash for stored-context population
 */

/**
 * @typedef {object} ExpressionSensitivityResult
 * @property {SensitivityResultKind} kind - Discriminator for the sweep type
 * @property {string} varPath - Variable path to vary (e.g., "emotions.anger")
 * @property {string} operator - Comparison operator (e.g., ">=", "<=")
 * @property {number} originalThreshold - Original threshold value
 * @property {{threshold: number, triggerRate: number, triggerCount: number, sampleCount: number}[]} grid - Trigger rate grid
 * @property {boolean} isExpressionLevel - Flag for expression-level sweep
 * @property {string} [populationHash] - Hash for stored-context population
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
 * @property {number|null} [gatePassRateInRegime] - P(gate pass | mood regime) for leaf emotion clauses
 * @property {number|null} [gateClampRateInRegime] - P(gate fail | mood regime) for leaf emotion clauses
 * @property {number|null} [passRateGivenGateInRegime] - P(clause pass | gate pass, mood regime)
 * @property {number|null} [gatePassInRegimeCount] - Gate pass count within mood regime
 * @property {number|null} [gateFailInRegimeCount] - Gate fail count within mood regime
 * @property {number|null} [gatePassAndClausePassInRegimeCount] - Gate pass + clause pass within mood regime
 * @property {number|null} [gatePassAndClauseFailInRegimeCount] - Gate pass + clause fail within mood regime
 * @property {number|null} [rawPassInRegimeCount] - Raw pass count (>= threshold before gating) within mood regime
 * @property {number|null} [lostPassInRegimeCount] - Raw pass that are lost after gating within mood regime
 * @property {number|null} [lostPassRateInRegime] - Lost pass rate within mood regime
 * @property {number|null} [gatedPassInRegimeCount] - Gated pass count within mood regime
 */

/**
 * @typedef {object} GatePredicateInfo
 * @property {string} axis
 * @property {string} operator
 * @property {number} thresholdNormalized
 * @property {number|null} thresholdRaw
 */

/**
 * @typedef {object} GateClampClauseInfo
 * @property {string} prototypeId
 * @property {'emotion' | 'sexual'} type
 * @property {boolean} usePrevious
 * @property {GatePredicateInfo[]} gatePredicates
 */

/**
 * @typedef {object} GateClampRegimePlan
 * @property {string[]} trackedGateAxes
 * @property {Record<string, GateClampClauseInfo>} clauseGateMap
 */

/**
 * @typedef {object} MoodRegimeAxisHistogram
 * @property {string} axis
 * @property {number} min
 * @property {number} max
 * @property {number} binCount
 * @property {number[]} bins
 * @property {number} sampleCount
 */

/**
 * @typedef {object} MoodRegimeSampleReservoir
 * @property {number} sampleCount
 * @property {number} storedCount
 * @property {number} limit
 * @property {Array<Record<string, number>>} samples
 */

/**
 * @typedef {object} SimulationResult
 * @property {number} triggerRate - Probability of triggering [0, 1]
 * @property {number} triggerCount - Number of successful triggers
 * @property {number} sampleCount - Total samples evaluated
 * @property {{ low: number, high: number }} confidenceInterval
 * @property {ClauseResult[]} clauseFailures - Per-clause failure data
 * @property {AblationImpactResult|null} [ablationImpact] - Optional ablation impact payload
 * @property {DistributionType} distribution
 * @property {UnseededVarWarning[]} unseededVarWarnings - Warnings for unseeded variable paths
 * @property {object} [populationSummary] - Population counts for full samples vs stored contexts
 * @property {object} [samplingCoverage] - Coverage payload (when enabled and applicable)
 * @property {PrototypeEvaluationSummary|null} [prototypeEvaluationSummary] - Aggregated per-prototype gate stats
 * @property {GateClampRegimePlan} [gateClampRegimePlan] - Gate predicate plan for regime analysis
 * @property {Record<string, MoodRegimeAxisHistogram>} [moodRegimeAxisHistograms]
 * @property {MoodRegimeSampleReservoir|null} [moodRegimeSampleReservoir]
 */

/**
 * @typedef {object} AblationImpactResult
 * @property {number} originalPassRate
 * @property {Array<{clauseId: string, passWithoutRate: number, passWithoutCount: number, sampleCount: number, impact: number, chokeRank: number}>} clauseImpacts
 * @property {Array<{clauseIndex: number, passWithoutRate: number, passWithoutCount: number, sampleCount: number, impact: number}>} topLevelImpacts
 */

/**
 * @typedef {object} PrototypeEvaluationStats
 * @property {number} moodSampleCount
 * @property {number} gatePassCount
 * @property {number} gateFailCount
 * @property {Record<string, number>} failedGateCounts
 * @property {number} rawScoreSum
 * @property {number} valueSum
 * @property {number} valueSumGivenGate
 */

/**
 * @typedef {object} PrototypeEvaluationSummary
 * @property {Record<string, PrototypeEvaluationStats>} emotions
 * @property {Record<string, PrototypeEvaluationStats>} sexualStates
 */

/**
 * Monte Carlo simulator for expression trigger probability estimation.
 * Samples random mood/sexual states, evaluates expressions, and calculates
 * trigger rates with confidence intervals and per-clause failure tracking.
 */
class MonteCarloSimulator {
  /** @type {object} */
  #logger;

  /** @type {object} */
  #randomStateGenerator;

  /** @type {object} */
  #contextBuilder;

  /** @type {object} */
  #expressionEvaluator;

  /** @type {object} */
  #gateEvaluator;

  /** @type {object} */
  #prototypeEvaluator;

  /** @type {object} */
  #violationEstimator;

  /** @type {object} */
  #variablePathValidator;

  /** @type {object} */
  #dataRegistry;

  /**
   * @param {object} deps
   * @param {object} deps.dataRegistry - IDataRegistry
   * @param {object} deps.logger - ILogger
   * @param {object} deps.emotionCalculatorAdapter - IEmotionCalculatorAdapter
   * @param {object} deps.randomStateGenerator - IRandomStateGenerator
   * @param {object} [deps.contextBuilder] - IMonteCarloContextBuilder
   * @param {object} [deps.expressionEvaluator] - IMonteCarloExpressionEvaluator
   * @param {object} [deps.gateEvaluator] - IMonteCarloGateEvaluator
   * @param {object} [deps.prototypeEvaluator] - IMonteCarloPrototypeEvaluator
   * @param {object} [deps.violationEstimator] - IMonteCarloViolationEstimator
   * @param {object} [deps.variablePathValidator] - IMonteCarloVariablePathValidator
   */
  constructor({
    dataRegistry,
    logger,
    emotionCalculatorAdapter,
    randomStateGenerator,
    contextBuilder,
    expressionEvaluator,
    gateEvaluator,
    prototypeEvaluator,
    violationEstimator,
    variablePathValidator,
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
          'calculateEmotionTraces',
          'calculateEmotionTracesFiltered',
          'calculateSexualStateTraces',
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

    this.#logger = logger;
    this.#randomStateGenerator = randomStateGenerator;
    this.#dataRegistry = dataRegistry;
    if (contextBuilder !== undefined) {
      validateDependency(contextBuilder, 'IMonteCarloContextBuilder', logger, {
        requiredMethods: [
          'buildContext',
          'buildKnownContextKeys',
          'normalizeGateContext',
          'initializeMoodRegimeAxisHistograms',
          'initializeMoodRegimeSampleReservoir',
          'recordMoodRegimeAxisHistograms',
          'recordMoodRegimeSampleReservoir',
        ],
      });
      this.#contextBuilder = contextBuilder;
    } else {
      this.#contextBuilder = new ContextBuilder({
        logger,
        dataRegistry,
        emotionCalculatorAdapter,
      });
    }

    if (expressionEvaluator !== undefined) {
      validateDependency(
        expressionEvaluator,
        'IMonteCarloExpressionEvaluator',
        logger,
        {
          requiredMethods: [
            'initClauseTracking',
            'evaluateWithTracking',
            'evaluatePrerequisite',
            'evaluateAllPrerequisites',
            'finalizeClauseResults',
            'buildHierarchicalTree',
            'evaluateThresholdCondition',
          ],
        }
      );
      this.#expressionEvaluator = expressionEvaluator;
    } else {
      this.#expressionEvaluator = new ExpressionEvaluator();
    }

    if (gateEvaluator !== undefined) {
      validateDependency(gateEvaluator, 'IMonteCarloGateEvaluator', logger, {
        requiredMethods: [
          'buildGateClampRegimePlan',
          'checkGates',
          'checkPrototypeCompatibility',
          'computeGateCompatibility',
          'evaluateGatePass',
          'resolveGateTarget',
          'resolveGateContext',
          'recordGateOutcomeIfApplicable',
          'denormalizeGateThreshold',
          'buildAxisIntervalsFromMoodConstraints',
        ],
      });
      this.#gateEvaluator = gateEvaluator;
    } else {
      this.#gateEvaluator = new GateEvaluator({
        logger,
        dataRegistry,
        contextBuilder: this.#contextBuilder,
      });
    }

    if (prototypeEvaluator !== undefined) {
      validateDependency(
        prototypeEvaluator,
        'IMonteCarloPrototypeEvaluator',
        logger,
        {
          requiredMethods: [
            'extractPrototypeReferences',
            'preparePrototypeEvaluationTargets',
            'initializePrototypeEvaluationSummary',
            'createPrototypeEvaluationStats',
            'updatePrototypeEvaluationSummary',
            'evaluatePrototypeSample',
            'recordPrototypeEvaluation',
            'collectPrototypeReferencesFromLogic',
            'getPrototype',
          ],
        }
      );
      this.#prototypeEvaluator = prototypeEvaluator;
    } else {
      this.#prototypeEvaluator = new PrototypeEvaluator({
        logger,
        dataRegistry,
      });
    }

    if (violationEstimator !== undefined) {
      validateDependency(
        violationEstimator,
        'IMonteCarloViolationEstimator',
        logger,
        {
          requiredMethods: [
            'countFailedClauses',
            'getFailedLeavesSummary',
          ],
        }
      );
      this.#violationEstimator = violationEstimator;
    } else {
      this.#violationEstimator = new ViolationEstimator();
    }

    if (variablePathValidator !== undefined) {
      validateDependency(
        variablePathValidator,
        'IMonteCarloVariablePathValidator',
        logger,
        {
          requiredMethods: [
            'validateExpressionVarPaths',
            'validateVarPath',
            'collectSamplingCoverageVariables',
            'resolveSamplingCoverageVariable',
            'extractReferencedEmotions',
            'filterEmotions',
          ],
        }
      );
      this.#variablePathValidator = variablePathValidator;
    } else {
      this.#variablePathValidator = new VariablePathValidator();
    }
  }

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
      moodRegimeSampleReservoirLimit = 0,
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
      ? this.#expressionEvaluator.initClauseTracking(expression)
      : null;
    const ablationCalculator = clauseTracking
      ? new AblationImpactCalculator(clauseTracking)
      : null;
    const gateClampRegimePlan = this.#buildGateClampRegimePlan(
      expression,
      clauseTracking
    );

    const moodConstraints = extractMergedMoodConstraints(
      expression?.prerequisites,
      this.#dataRegistry,
      { includeMoodAlias: true, andOnly: true }
    );
    const moodRegimeDefined = moodConstraints.length > 0;

    // Classify prerequisite types to detect prototype-only expressions
    const prereqTypes = classifyPrerequisiteTypes(expression?.prerequisites);
    const isPrototypeOnlyExpression = prereqTypes.isPrototypeOnly;

    const gateCompatibility = this.#computeGateCompatibility(
      expression,
      moodConstraints
    );
    let inRegimeSampleCount = 0;
    let intensityPassCount = 0; // Contexts where intensity >= threshold within regime
    const trackedGateAxes = gateClampRegimePlan.trackedGateAxes ?? [];
    const moodRegimeAxisHistograms =
      this.#contextBuilder.initializeMoodRegimeAxisHistograms(trackedGateAxes);
    const moodRegimeHistogramAxes = Object.keys(moodRegimeAxisHistograms);
    const moodRegimeSampleReservoir =
      this.#contextBuilder.initializeMoodRegimeSampleReservoir(
        moodRegimeSampleReservoirLimit
      );

    // Track ground-truth witnesses (first N triggered samples) and nearest miss
    const witnesses = [];
    let nearestMiss = null;
    let nearestMissFailedCount = Infinity;

    // Extract referenced emotions once before simulation loop for witness capture
    const referencedEmotions =
      this.#variablePathValidator.extractReferencedEmotions(expression);
    const prototypeEvaluationTargets =
      this.#prototypeEvaluator.preparePrototypeEvaluationTargets(
        expression?.prerequisites
      );
    const prototypeEvaluationSummary =
      this.#prototypeEvaluator.initializePrototypeEvaluationSummary(
        prototypeEvaluationTargets
      );

    // Sensitivity analysis: store built contexts for post-hoc threshold evaluation
    const storedContexts = storeSamplesForSensitivity ? [] : null;

    const resolvedSamplingCoverageConfig = {
      ...DEFAULT_SAMPLING_COVERAGE_CONFIG,
      ...(samplingCoverageConfig ?? {}),
    };

    const samplingCoverageVariables = resolvedSamplingCoverageConfig.enabled
      ? this.#variablePathValidator.collectSamplingCoverageVariables(expression)
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

    if (sampleCount > 0) {
      await this.#yieldToEventLoop();
    }

    // Process samples in chunks to avoid blocking the main thread
    for (let processed = 0; processed < sampleCount; ) {
      const chunkEnd = Math.min(processed + CHUNK_SIZE, sampleCount);

      // Process chunk synchronously (fast enough not to block)
      for (let i = processed; i < chunkEnd; i++) {
        const { current, previous, affectTraits } =
          this.#randomStateGenerator.generate(distribution, samplingMode);

        const shouldStoreContext =
          storedContexts !== null &&
          storedContexts.length < sensitivitySampleLimit;

        // Build context once for potential storage and evaluation
        const context = this.#contextBuilder.buildContext(
          current,
          previous,
          affectTraits,
          referencedEmotions,
          shouldStoreContext
        );

        // Store context for sensitivity analysis if enabled and within limit
        if (shouldStoreContext) {
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
          if (moodRegimeHistogramAxes.length > 0) {
            this.#contextBuilder.recordMoodRegimeAxisHistograms(
              moodRegimeAxisHistograms,
              context
            );
            this.#contextBuilder.recordMoodRegimeSampleReservoir(
              moodRegimeSampleReservoir,
              moodRegimeHistogramAxes,
              context
            );
          }
          // Track intensity pass rate for prototype-only expressions
          if (isPrototypeOnlyExpression) {
            const intensityResult = this.#evaluatePrototypeIntensities(
              expression,
              context,
              prereqTypes.prototypeRefs
            );
            if (intensityResult.allIntensitiesPass) {
              intensityPassCount++;
            }
          }
        }

        const gateContextCache =
          referencedEmotions.size > 0 || prototypeEvaluationSummary
            ? { context, current: null, previous: null }
            : null;
        if (prototypeEvaluationSummary && inRegime) {
          this.#updatePrototypeEvaluationSummary(
            prototypeEvaluationSummary,
            prototypeEvaluationTargets,
            context,
            gateContextCache
          );
        }
        const result = this.#evaluateWithTracking(
          expression,
          context,
          clauseTracking,
          inRegime,
          gateContextCache
        );
        if (ablationCalculator && result.clauseResults && result.atomTruthMap) {
          ablationCalculator.recordSample({
            clauseResults: result.clauseResults,
            atomTruthMap: result.atomTruthMap,
          });
        }

        if (result.triggered) {
          triggerCount++;
          // Store ground-truth witnesses (up to maxWitnesses)
          if (witnesses.length < maxWitnesses) {
            witnesses.push({
              current,
              previous,
              affectTraits,
              // Include computed emotions (filtered to only referenced ones)
              computedEmotions: this.#variablePathValidator.filterEmotions(
                context.emotions,
                referencedEmotions
              ),
              previousComputedEmotions:
                this.#variablePathValidator.filterEmotions(
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
        await this.#yieldToEventLoop();
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

    const storedContextCount = storedContexts ? storedContexts.length : 0;
    let storedInRegimeCount = 0;
    if (storedContextCount > 0) {
      storedInRegimeCount = moodRegimeDefined
        ? storedContexts.filter((context) =>
            this.#evaluateMoodConstraints(moodConstraints, context)
          ).length
        : storedContextCount;
    }

    const populationMeta = storedContexts !== null
      ? (() => {
        const storedGlobalSampleIds = storedContexts.map((_, index) => index);
        const storedGlobalPredicate = 'all';
        const storedGlobalHash = buildPopulationHash(
          storedGlobalSampleIds,
          storedGlobalPredicate
        );

        const moodPredicate = buildPopulationPredicate(moodConstraints);
        const storedMoodRegimeSampleIds =
          moodConstraints.length > 0
            ? storedContexts.reduce((acc, context, index) => {
              if (this.#evaluateMoodConstraints(moodConstraints, context)) {
                acc.push(index);
              }
              return acc;
            }, [])
            : storedGlobalSampleIds;
        const storedMoodRegimeHash = buildPopulationHash(
          storedMoodRegimeSampleIds,
          moodPredicate
        );

        return {
          storedGlobal: {
            name: 'stored-global',
            predicate: storedGlobalPredicate,
            count: storedGlobalSampleIds.length,
            hash: storedGlobalHash,
          },
          storedMoodRegime: {
            name: 'stored-mood-regime',
            predicate: moodPredicate,
            count: storedMoodRegimeSampleIds.length,
            hash: storedMoodRegimeHash,
          },
        };
      })()
      : null;

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
        ? this.#expressionEvaluator.finalizeClauseResults(
            clauseTracking,
            sampleCount
          )
        : [],
      distribution,
      samplingMode,
      samplingMetadata,
      gateCompatibility,
      gateClampRegimePlan,
      moodRegimeAxisHistograms,
      moodRegimeSampleReservoir,
      witnessAnalysis,
      unseededVarWarnings,
      prototypeEvaluationSummary,
      // Prototype-only expression metrics (for expressions using emotions.*/sexualStates.*)
      isPrototypeOnlyExpression,
      intensityPassRate: isPrototypeOnlyExpression
        ? inRegimeSampleCount > 0
          ? intensityPassCount / inRegimeSampleCount
          : 0
        : null,
      intensityPassCount: isPrototypeOnlyExpression ? intensityPassCount : null,
      moodRegimeSemantics: isPrototypeOnlyExpression
        ? 'prototype-gate-derived'
        : 'direct-mood-constraints',
      // Stored contexts for sensitivity analysis (null if not enabled)
      storedContexts,
      populationSummary: {
        sampleCount,
        inRegimeSampleCount,
        inRegimeSampleRate:
          sampleCount > 0 ? inRegimeSampleCount / sampleCount : 0,
        storedContextCount,
        storedContextLimit: storeSamplesForSensitivity
          ? sensitivitySampleLimit
          : 0,
        storedInRegimeCount,
        storedInRegimeRate:
          storedContextCount > 0 ? storedInRegimeCount / storedContextCount : 0,
      },
      populationMeta,
    };

    if (ablationCalculator) {
      resultPayload.ablationImpact = ablationCalculator.buildResult({
        triggerCount,
        sampleCount,
      });
    }

    if (samplingCoverageCalculator) {
      resultPayload.samplingCoverage = samplingCoverageCalculator.finalize();
    }

    return resultPayload;
  }

  // ============================================================
  // Essential Private Methods (contain actual logic or bindings)
  // ============================================================

  /**
   * Yield to the event loop to avoid blocking.
   *
   * @private
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
   * Build a gate clamp analysis plan for emotion/sexual threshold clauses.
   * Binds buildHierarchicalTree to the expression evaluator module.
   *
   * @private
   * @param {object} expression
   * @param {Array|null} clauseTracking
   * @returns {GateClampRegimePlan}
   */
  #buildGateClampRegimePlan(expression, clauseTracking) {
    return this.#gateEvaluator.buildGateClampRegimePlan(
      expression,
      clauseTracking,
      this.#expressionEvaluator.buildHierarchicalTree.bind(
        this.#expressionEvaluator
      )
    );
  }

  /**
   * Evaluate expression with clause tracking (includes hierarchical breakdown).
   * Binds recordGateOutcomeIfApplicable callback.
   *
   * @private
   * @param {object} expression - The expression to evaluate
   * @param {object} context - Prebuilt evaluation context
   * @param {Array|null} clauseTracking - Tracking array for clause failures
   * @param {boolean} inRegime - Whether mood constraints passed for this sample
   * @param {object|null} gateContextCache - Cache for gate context resolution
   * @returns {{triggered: boolean, clauseResults: Array<{passed: boolean}>|null, atomTruthMap: Map<string, boolean>|null}}
   */
  #evaluateWithTracking(
    expression,
    context,
    clauseTracking,
    inRegime,
    gateContextCache
  ) {
    return this.#expressionEvaluator.evaluateWithTracking(
      expression,
      context,
      clauseTracking,
      inRegime,
      gateContextCache,
      {
        gateOutcomeRecorder: this.#recordGateOutcomeIfApplicable.bind(this),
      }
    );
  }

  /**
   * Record gate pass/fail outcomes for direct emotion-threshold leaf clauses.
   * Binds evaluatePrototypeSample to the prototype evaluator module.
   *
   * @private
   * @param {object} node - Hierarchical clause node
   * @param {object} context - Evaluation context
   * @param {boolean} clausePassed - Whether the clause passed
   * @param {boolean} inRegime - Whether in mood regime
   * @param {object|null} gateContextCache - Cache for gate context resolution
   */
  #recordGateOutcomeIfApplicable(
    node,
    context,
    clausePassed,
    inRegime,
    gateContextCache
  ) {
    return this.#gateEvaluator.recordGateOutcomeIfApplicable(
      node,
      context,
      clausePassed,
      inRegime,
      gateContextCache,
      this.#prototypeEvaluator.evaluatePrototypeSample.bind(
        this.#prototypeEvaluator
      )
    );
  }

  /**
   * Compute gate compatibility for prototypes referenced in prerequisites.
   * Binds extractPrototypeReferences to the prototype evaluator module.
   *
   * @private
   * @param {object} expression
   * @param {Array<{varPath: string, operator: string, threshold: number}>} moodConstraints
   * @returns {{emotions: Record<string, {compatible: boolean, reason: string|null}>, sexualStates: Record<string, {compatible: boolean, reason: string|null}>}}
   */
  #computeGateCompatibility(expression, moodConstraints) {
    return this.#gateEvaluator.computeGateCompatibility(
      expression,
      moodConstraints,
      this.#prototypeEvaluator.extractPrototypeReferences.bind(
        this.#prototypeEvaluator
      )
    );
  }

  /**
   * Count the number of failed leaf clauses for a given sample.
   * Binds evaluatePrerequisite to the expression evaluator module.
   *
   * @private
   * @param {object[]} clauseTracking - Clause tracking array
   * @param {object} expression - Expression being evaluated
   * @param {object} context - Evaluation context
   * @returns {number} Count of failed leaf clauses
   */
  #countFailedClauses(clauseTracking, expression, context) {
    return this.#violationEstimator.countFailedClauses(
      clauseTracking,
      expression,
      context,
      (prereq, ctx) =>
        this.#expressionEvaluator.evaluatePrerequisite(prereq, ctx)
    );
  }

  /**
   * Get summary of failed leaf conditions for a sample.
   * Binds evaluatePrerequisite to the expression evaluator module.
   *
   * @private
   * @param {object[]} clauseTracking - Clause tracking array
   * @param {object} expression - Expression being evaluated
   * @param {object} context - Evaluation context
   * @returns {Array<{description: string, actual: number|null, threshold: number|null, violation: number|null}>}
   */
  #getFailedLeavesSummary(clauseTracking, expression, context) {
    return this.#violationEstimator.getFailedLeavesSummary(
      clauseTracking,
      expression,
      context,
      (prereq, ctx) =>
        this.#expressionEvaluator.evaluatePrerequisite(prereq, ctx)
    );
  }

  /**
   * Get nested value from object using dot notation.
   * Delegates to the canonical implementation in moodRegimeUtils.
   * @private
   * @param {object} obj
   * @param {string} path
   * @returns {*}
   */
  #getNestedValue(obj, path) {
    return getNestedValue(obj, path);
  }

  /**
   * Calculate Wilson score confidence interval.
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
   * Get z-score for confidence level.
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
      return evaluateConstraint(value, constraint.operator, constraint.threshold);
    });
  }

  /**
   * Evaluates prototype intensity thresholds for prototype-only expressions.
   * Extracts intensity comparisons from prerequisites (e.g., emotions.flow >= 0.62)
   * and evaluates them against the context's computed emotion/sexual state values.
   *
   * @private
   * @param {object} expression - The expression with prerequisites
   * @param {object} context - Built context with computed emotions/sexualStates
   * @param {Array<{prototypeId: string, type: string, varPath: string}>} prototypeRefs - Prototype references
   * @returns {{ allIntensitiesPass: boolean, details: Array<{varPath: string, operator: string, threshold: number, actualValue: number, passed: boolean}> }}
   */
  #evaluatePrototypeIntensities(expression, context, prototypeRefs) {
    const details = [];

    if (!expression?.prerequisites || !Array.isArray(expression.prerequisites)) {
      return { allIntensitiesPass: true, details };
    }

    // Extract intensity conditions from prerequisites
    // Look for patterns like: {">=" : [{"var": "emotions.flow"}, 0.62]}
    const intensityConditions = [];
    const comparisonOps = ['>=', '<=', '>', '<', '=='];

    const extractFromLogic = (logic) => {
      if (!logic || typeof logic !== 'object') return;

      for (const op of comparisonOps) {
        if (logic[op] && Array.isArray(logic[op])) {
          const [left, right] = logic[op];

          // Pattern: {"op": [{"var": "emotions.X"}, threshold]}
          if (left?.var && typeof right === 'number') {
            const varPath = left.var;
            // Check if this is a prototype reference (emotions.*, sexualStates.*, previous*)
            if (
              varPath.startsWith('emotions.') ||
              varPath.startsWith('sexualStates.') ||
              varPath.startsWith('previousEmotions.') ||
              varPath.startsWith('previousSexualStates.')
            ) {
              intensityConditions.push({
                varPath,
                operator: op,
                threshold: right,
              });
            }
          }

          // Pattern: {"op": [threshold, {"var": "emotions.X"}]}
          if (right?.var && typeof left === 'number') {
            const varPath = right.var;
            if (
              varPath.startsWith('emotions.') ||
              varPath.startsWith('sexualStates.') ||
              varPath.startsWith('previousEmotions.') ||
              varPath.startsWith('previousSexualStates.')
            ) {
              // Flip operator for reversed operand order
              const flippedOp =
                op === '>=' ? '<=' : op === '<=' ? '>=' : op === '>' ? '<' : op === '<' ? '>' : op;
              intensityConditions.push({
                varPath,
                operator: flippedOp,
                threshold: left,
              });
            }
          }
        }
      }

      // Recurse into and/or blocks
      if (logic.and && Array.isArray(logic.and)) {
        for (const clause of logic.and) {
          extractFromLogic(clause);
        }
      }
      if (logic.or && Array.isArray(logic.or)) {
        for (const clause of logic.or) {
          extractFromLogic(clause);
        }
      }
    };

    for (const prereq of expression.prerequisites) {
      if (prereq?.logic) {
        extractFromLogic(prereq.logic);
      }
    }

    // Evaluate each intensity condition against the context
    let allPass = true;
    for (const condition of intensityConditions) {
      const actualValue = this.#getNestedValue(context, condition.varPath);
      const passed = evaluateConstraint(
        actualValue,
        condition.operator,
        condition.threshold
      );

      details.push({
        varPath: condition.varPath,
        operator: condition.operator,
        threshold: condition.threshold,
        actualValue: typeof actualValue === 'number' ? actualValue : null,
        passed,
      });

      if (!passed) {
        allPass = false;
      }
    }

    return { allIntensitiesPass: allPass, details };
  }

  /**
   * Validate all variable paths in an expression's prerequisites.
   *
   * @private
   * @param {object} expression - Expression with prerequisites array
   * @returns {{ warnings: UnseededVarWarning[] }}
   */
  #validateExpressionVarPaths(expression) {
    const knownKeys = this.#contextBuilder.buildKnownContextKeys();
    const warnings = this.#variablePathValidator.validateExpressionVarPaths(
      expression,
      knownKeys
    );
    return { warnings };
  }

  /**
   * Update prototype evaluation summary for a single sample.
   *
   * @private
   * @param {PrototypeEvaluationSummary} summary
   * @param {{emotions: Array, sexualStates: Array}} targets
   * @param {object} context
   * @param {object|null} gateContextCache
   */
  #updatePrototypeEvaluationSummary(
    summary,
    targets,
    context,
    gateContextCache
  ) {
    if (!summary || !targets || !context) {
      return;
    }

    const normalizedContext = this.#gateEvaluator.resolveGateContext(
      gateContextCache,
      context,
      false
    );
    if (!normalizedContext) {
      return;
    }

    const normalizedMood = normalizedContext.moodAxes ?? {};
    const normalizedSexual = normalizedContext.sexualAxes ?? {};
    const normalizedTraits = normalizedContext.traitAxes ?? {};

    this.#prototypeEvaluator.updatePrototypeEvaluationSummary(
      summary,
      targets,
      normalizedMood,
      normalizedSexual,
      normalizedTraits
    );
  }

  // ============================================================
  // Sensitivity Analysis Methods
  // ============================================================

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
        kind: 'marginalClausePassRateSweep',
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

        const passes = this.#expressionEvaluator.evaluateThresholdCondition(
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
      kind: 'marginalClausePassRateSweep',
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
   * @returns {ExpressionSensitivityResult}
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
        kind: 'expressionTriggerRateSweep',
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
        kind: 'expressionTriggerRateSweep',
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
      kind: 'expressionTriggerRateSweep',
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
    const clone =
      typeof globalThis.structuredClone === 'function'
        ? globalThis.structuredClone(logic)
        : JSON.parse(JSON.stringify(logic));
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
}

export default MonteCarloSimulator;
