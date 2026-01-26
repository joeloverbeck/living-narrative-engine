/**
 * @file BehavioralOverlapEvaluator - Stage B behavioral sampling for overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import {
  MOOD_AXES_SET,
  AFFECT_TRAITS_SET,
} from '../../../constants/moodAffectConstants.js';

/**
 * Set of known sexual axis names for context value resolution.
 *
 * @type {Set<string>}
 */
const SEXUAL_AXIS_NAMES = new Set([
  'sex_excitation',
  'sex_inhibition',
  'baseline_libido',
]);

/**
 * Number of samples to process per chunk before yielding to the event loop.
 * This balances responsiveness (lower = more responsive) with overhead (higher = less overhead).
 */
const CHUNK_SIZE = 500;

/**
 * @typedef {object} GateOverlapStats
 * @property {number} onEitherRate - P(gatesA pass OR gatesB pass)
 * @property {number} onBothRate - P(gatesA pass AND gatesB pass)
 * @property {number} pOnlyRate - P(gatesA pass AND NOT gatesB pass)
 * @property {number} qOnlyRate - P(gatesB pass AND NOT gatesA pass)
 */

/**
 * @typedef {object} IntensityStats
 * @property {number} pearsonCorrelation - Correlation of intensities [-1, 1] or NaN if insufficient data
 * @property {number} meanAbsDiff - Mean |intensityA - intensityB|, or NaN if no joint samples
 * @property {number} rmse - Root mean squared error sqrt(mean(sqDiff)), or NaN if coPassCount < minCoPassSamples
 * @property {number} pctWithinEps - Fraction of samples with |diff| <= intensityEps, or NaN if coPassCount < minCoPassSamples
 * @property {number} dominanceP - P(intensityA > intensityB + delta)
 * @property {number} dominanceQ - P(intensityB > intensityA + delta)
 * @property {number} globalMeanAbsDiff - Mean |outA - outB| over ALL samples (not just co-pass)
 * @property {number} globalL2Distance - RMSE of (outA - outB) over ALL samples (not just co-pass)
 * @property {number} globalOutputCorrelation - Pearson correlation of outputs over ALL samples (not just co-pass)
 */

/**
 * @typedef {object} DivergenceExample
 * @property {object} context - The sampled context
 * @property {number} intensityA - Intensity for prototype A
 * @property {number} intensityB - Intensity for prototype B
 * @property {number} absDiff - |intensityA - intensityB|
 * @property {number} intensityDifference - UI-compatible alias for absDiff
 * @property {string} contextSummary - Human-readable summary of top context values
 */

/**
 * @typedef {object} PassRates
 * @property {number} passARate - P(gatesA pass) = (onBothCount + pOnlyCount) / sampleCount
 * @property {number} passBRate - P(gatesB pass) = (onBothCount + qOnlyCount) / sampleCount
 * @property {number} pA_given_B - P(gatesA pass | gatesB pass) = onBothCount / passBCount, or NaN if passBCount < minPassSamplesForConditional
 * @property {number} pB_given_A - P(gatesB pass | gatesA pass) = onBothCount / passACount, or NaN if passACount < minPassSamplesForConditional
 * @property {number} coPassCount - Number of contexts where both prototypes passed gates.
 *   When coPassCount < config.minCoPassSamples, intensity metrics (pearsonCorrelation, meanAbsDiff)
 *   are set to NaN to prevent false conclusions from sparse data.
 * @property {number} passACount - Total samples where prototype A passed (for transparency/debugging)
 * @property {number} passBCount - Total samples where prototype B passed (for transparency/debugging)
 */

/**
 * @typedef {object} HighCoactivationEntry
 * @property {number} t - Intensity threshold value
 * @property {number} pHighA - P(gatedIntensityA >= t | either passes) over onEitherCount samples
 * @property {number} pHighB - P(gatedIntensityB >= t | either passes) over onEitherCount samples
 * @property {number} pHighBoth - P(both >= t | either passes) over onEitherCount samples
 * @property {number} highJaccard - highBothCount / eitherHighCount, or 0 if eitherHighCount=0
 * @property {number} highAgreement - P(highA === highB | either passes) over onEitherCount samples
 */

/**
 * @typedef {object} HighCoactivation
 * @property {Array<HighCoactivationEntry>} thresholds - High-activation metrics per configured threshold
 */

/**
 * @typedef {object} GateImplicationResult
 * @property {boolean} A_implies_B - True if A's gates imply B's gates
 * @property {boolean} B_implies_A - True if B's gates imply A's gates
 * @property {string[]} counterExampleAxes - Axes where implication fails
 * @property {Array<object>} evidence - Per-axis comparison details
 * @property {'equal'|'narrower'|'wider'|'disjoint'|'overlapping'} relation - Overall relationship
 */

/**
 * @typedef {object} GateParsePrototypeInfo
 * @property {'complete'|'partial'|'failed'} parseStatus - Parse status for this prototype's gates
 * @property {number} parsedGateCount - Number of gates successfully parsed
 * @property {number} totalGateCount - Total number of gates
 * @property {string[]} unparsedGates - List of gates that could not be parsed
 */

/**
 * @typedef {object} GateParseInfo
 * @property {GateParsePrototypeInfo} prototypeA - Parse info for prototype A
 * @property {GateParsePrototypeInfo} prototypeB - Parse info for prototype B
 */

/**
 * @typedef {object} BehavioralMetrics
 * @property {GateOverlapStats} gateOverlap - Gate overlap statistics
 * @property {IntensityStats} intensity - Intensity similarity statistics
 * @property {Array<DivergenceExample>} divergenceExamples - Top-K examples with highest divergence
 * @property {PassRates} passRates - Unconditional pass rates and conditional probabilities
 * @property {HighCoactivation} highCoactivation - High-intensity co-activation metrics per threshold
 * @property {GateImplicationResult|null} gateImplication - Gate implication analysis result, or null if parsing incomplete
 * @property {GateParseInfo} gateParseInfo - Parse coverage information for UI transparency
 */

/**
 * Stage B service for prototype overlap analysis.
 * Performs Monte Carlo sampling to evaluate how two prototypes behave
 * across random contexts, computing gate overlap statistics, intensity
 * correlation, and collecting divergence examples.
 */
class BehavioralOverlapEvaluator {
  #prototypeIntensityCalculator;
  #randomStateGenerator;
  #contextBuilder;
  #prototypeGateChecker;
  #gateConstraintExtractor;
  #gateImplicationEvaluator;
  #config;
  #logger;
  #agreementMetricsCalculator;

  /**
   * Constructs a new BehavioralOverlapEvaluator instance.
   *
   * @param {object} deps - Dependencies object
   * @param {object} deps.prototypeIntensityCalculator - IPrototypeIntensityCalculator with computeIntensity()
   * @param {object} deps.randomStateGenerator - IRandomStateGenerator with generate()
   * @param {object} deps.contextBuilder - IContextBuilder with buildContext()
   * @param {object} deps.prototypeGateChecker - IPrototypeGateChecker with checkAllGatesPass()
   * @param {object} deps.gateConstraintExtractor - IGateConstraintExtractor with extract()
   * @param {object} deps.gateImplicationEvaluator - IGateImplicationEvaluator with evaluate()
   * @param {object} [deps.agreementMetricsCalculator] - IAgreementMetricsCalculator with calculate() (V3 optional)
   * @param {object} deps.config - Configuration with sampleCountPerPair, divergenceExamplesK, dominanceDelta
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - ILogger
   */
  constructor({
    prototypeIntensityCalculator,
    randomStateGenerator,
    contextBuilder,
    prototypeGateChecker,
    gateConstraintExtractor,
    gateImplicationEvaluator,
    agreementMetricsCalculator,
    config,
    logger,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    validateDependency(
      prototypeIntensityCalculator,
      'IPrototypeIntensityCalculator',
      logger,
      { requiredMethods: ['computeIntensity'] }
    );

    validateDependency(randomStateGenerator, 'IRandomStateGenerator', logger, {
      requiredMethods: ['generate'],
    });

    validateDependency(contextBuilder, 'IContextBuilder', logger, {
      requiredMethods: ['buildContext'],
    });

    validateDependency(prototypeGateChecker, 'IPrototypeGateChecker', logger, {
      requiredMethods: ['checkAllGatesPass'],
    });

    validateDependency(
      gateConstraintExtractor,
      'IGateConstraintExtractor',
      logger,
      { requiredMethods: ['extract'] }
    );

    validateDependency(
      gateImplicationEvaluator,
      'IGateImplicationEvaluator',
      logger,
      { requiredMethods: ['evaluate'] }
    );

    // V3 optional dependency (PROANAOVEV3-011): validate only if provided
    if (agreementMetricsCalculator) {
      validateDependency(
        agreementMetricsCalculator,
        'IAgreementMetricsCalculator',
        logger,
        { requiredMethods: ['calculate'] }
      );
    }

    this.#validateConfig(config, logger);

    this.#prototypeIntensityCalculator = prototypeIntensityCalculator;
    this.#randomStateGenerator = randomStateGenerator;
    this.#contextBuilder = contextBuilder;
    this.#prototypeGateChecker = prototypeGateChecker;
    this.#gateConstraintExtractor = gateConstraintExtractor;
    this.#gateImplicationEvaluator = gateImplicationEvaluator;
    this.#agreementMetricsCalculator = agreementMetricsCalculator ?? null;
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Evaluate behavioral overlap between two prototypes.
   *
   * **V2 Mode (Monte Carlo)**: Pass a sample count number for Monte Carlo sampling.
   * Processes samples in chunks and yields to the event loop between chunks
   * to keep the UI responsive during long-running analyses.
   *
   * **V3 Mode (Vector-Based)**: Pass an options object with pre-computed vectors
   * for efficient O(1) vector operations using AgreementMetricsCalculator.
   *
   * @param {object} prototypeA - First prototype with gates and weights properties
   * @param {object} prototypeB - Second prototype with gates and weights properties
   * @param {number|{vectorA: object, vectorB: object}} sampleCountOrOptions - V2: sample count (number), V3: options with vectorA/vectorB
   * @param {function(number, number): void} [onProgress] - Optional progress callback (V2 only)
   * @returns {Promise<BehavioralMetrics>} Computed behavioral metrics
   */
  async evaluate(prototypeA, prototypeB, sampleCountOrOptions, onProgress) {
    // Detect V3 mode: options object with pre-computed vectors
    const isV3Mode =
      typeof sampleCountOrOptions === 'object' &&
      sampleCountOrOptions !== null &&
      'vectorA' in sampleCountOrOptions &&
      'vectorB' in sampleCountOrOptions &&
      sampleCountOrOptions.vectorA &&
      sampleCountOrOptions.vectorB;

    if (isV3Mode) {
      return this.#evaluateViaVectors(
        prototypeA,
        prototypeB,
        sampleCountOrOptions
      );
    }

    // V2 mode: Monte Carlo sampling
    const sampleCount = sampleCountOrOptions;
    const resolvedSampleCount = this.#resolveSampleCount(sampleCount);
    const divergenceK = this.#config.divergenceExamplesK ?? 5;
    const dominanceDelta = this.#config.dominanceDelta ?? 0.05;

    // Gate overlap counters
    let onEitherCount = 0;
    let onBothCount = 0;
    let pOnlyCount = 0;
    let qOnlyCount = 0;

    // Intensity tracking (only for samples where both gates pass)
    const intensitiesA = [];
    const intensitiesB = [];

    // Dominance counters
    let dominancePCount = 0;
    let dominanceQCount = 0;

    // Global output tracking (over ALL samples, not just co-pass)
    // Addresses selection bias critique: co-pass correlation can be misleading
    // when gateOverlapRatio is low (e.g., 5% co-pass with 0.99 correlation)
    const globalOutputsA = [];
    const globalOutputsB = [];
    let globalSumAbsDiff = 0;
    let globalSumSqDiff = 0;

    // Top-K divergence examples (min-heap by absDiff)
    const divergenceHeap = [];

    // High-intensity co-activation counters per threshold
    const highThresholds = this.#config.highThresholds ?? [0.4, 0.6, 0.75];
    const thresholdCounters = highThresholds.map((t) => ({
      t,
      highACount: 0,
      highBCount: 0,
      highBothCount: 0,
      eitherHighCount: 0,
      agreementCount: 0,
    }));

    const gatesA = prototypeA?.gates ?? [];
    const gatesB = prototypeB?.gates ?? [];
    const weightsA = prototypeA?.weights ?? {};
    const weightsB = prototypeB?.weights ?? {};

    // Process samples in chunks to yield to the event loop periodically
    for (let processed = 0; processed < resolvedSampleCount; ) {
      const chunkEnd = Math.min(processed + CHUNK_SIZE, resolvedSampleCount);

      // Process chunk synchronously
      for (let i = processed; i < chunkEnd; i++) {
        // Generate random state and build context
        const state = this.#randomStateGenerator.generate('uniform', 'static');
        const context = this.#contextBuilder.buildContext(
          state.current,
          state.previous,
          state.affectTraits,
          null,
          false
        );

        // Check gates for both prototypes
        const passA = this.#prototypeGateChecker.checkAllGatesPass(
          gatesA,
          context
        );
        const passB = this.#prototypeGateChecker.checkAllGatesPass(
          gatesB,
          context
        );

        // Compute gated intensities once per sample (0 when gate fails)
        // These are reused for both high-threshold tracking and co-pass metrics
        let gatedIntensityA = 0;
        let gatedIntensityB = 0;

        if (passA) {
          gatedIntensityA =
            this.#prototypeIntensityCalculator.computeIntensity(
              weightsA,
              context
            );
        }
        if (passB) {
          gatedIntensityB =
            this.#prototypeIntensityCalculator.computeIntensity(
              weightsB,
              context
            );
        }

        // Track global outputs for ALL samples (not just co-pass)
        // outX = passX ? intensityX : 0 captures behavioral divergence
        // when prototypes have non-overlapping gate regions
        const outA = passA ? gatedIntensityA : 0;
        const outB = passB ? gatedIntensityB : 0;
        globalOutputsA.push(outA);
        globalOutputsB.push(outB);
        const globalDiff = outA - outB;
        globalSumAbsDiff += Math.abs(globalDiff);
        globalSumSqDiff += globalDiff * globalDiff;

        // Track gate overlap stats
        if (passA || passB) {
          onEitherCount++;

          // Track high-intensity counts per threshold using gated intensities
          for (const counter of thresholdCounters) {
            const highA = gatedIntensityA >= counter.t;
            const highB = gatedIntensityB >= counter.t;

            if (highA) counter.highACount++;
            if (highB) counter.highBCount++;
            if (highA && highB) counter.highBothCount++;
            if (highA || highB) counter.eitherHighCount++;
            // Agreement: both high or both low (neither high)
            if (highA === highB) counter.agreementCount++;
          }
        }
        if (passA && passB) {
          onBothCount++;
        }
        if (passA && !passB) {
          pOnlyCount++;
        }
        if (passB && !passA) {
          qOnlyCount++;
        }

        // When both pass, track correlation/divergence using already-computed intensities
        if (passA && passB) {
          intensitiesA.push(gatedIntensityA);
          intensitiesB.push(gatedIntensityB);

          // Dominance tracking
          if (gatedIntensityA > gatedIntensityB + dominanceDelta) {
            dominancePCount++;
          }
          if (gatedIntensityB > gatedIntensityA + dominanceDelta) {
            dominanceQCount++;
          }

          // Track top-K divergence examples
          const absDiff = Math.abs(gatedIntensityA - gatedIntensityB);
          this.#updateTopKDivergence(
            divergenceHeap,
            {
              context,
              intensityA: gatedIntensityA,
              intensityB: gatedIntensityB,
              absDiff,
              // UI-compatible fields (PROREDANAV2 fix)
              intensityDifference: absDiff,
              contextSummary: this.#formatContextSummary(context, weightsA, weightsB, gatesA, gatesB),
            },
            divergenceK
          );
        }
      }

      processed = chunkEnd;

      // Yield to event loop between chunks to keep UI responsive
      if (processed < resolvedSampleCount) {
        await this.#yieldToEventLoop();
      }

      // Report progress after each chunk
      onProgress?.(processed, resolvedSampleCount);
    }

    // Compute final metrics
    const gateOverlap = {
      onEitherRate: resolvedSampleCount > 0 ? onEitherCount / resolvedSampleCount : 0,
      onBothRate: resolvedSampleCount > 0 ? onBothCount / resolvedSampleCount : 0,
      pOnlyRate: resolvedSampleCount > 0 ? pOnlyCount / resolvedSampleCount : 0,
      qOnlyRate: resolvedSampleCount > 0 ? qOnlyCount / resolvedSampleCount : 0,
    };

    const jointCount = intensitiesA.length;
    const meetsMinCoPass = jointCount >= (this.#config.minCoPassSamples ?? 1);

    let pearsonCorrelation = NaN;
    let meanAbsDiff = NaN;
    let rmse = NaN;
    let pctWithinEps = NaN;

    if (meetsMinCoPass) {
      pearsonCorrelation = this.#computePearsonCorrelation(
        intensitiesA,
        intensitiesB
      );

      if (jointCount > 0) {
        const intensityEps = this.#config.intensityEps ?? 0.05;
        let sumAbsDiff = 0;
        let sumSqDiff = 0;
        let withinEpsCount = 0;

        for (let i = 0; i < jointCount; i++) {
          const diff = intensitiesA[i] - intensitiesB[i];
          const absDiff = Math.abs(diff);
          sumAbsDiff += absDiff;
          sumSqDiff += diff * diff;
          if (absDiff <= intensityEps) {
            withinEpsCount++;
          }
        }

        meanAbsDiff = sumAbsDiff / jointCount;
        rmse = Math.sqrt(sumSqDiff / jointCount);
        pctWithinEps = withinEpsCount / jointCount;
      }
    }

    // Compute global output metrics over ALL samples (not just co-pass)
    // These metrics address selection bias when gateOverlapRatio is low
    const globalMeanAbsDiff =
      resolvedSampleCount > 0 ? globalSumAbsDiff / resolvedSampleCount : NaN;
    const globalL2Distance =
      resolvedSampleCount > 0
        ? Math.sqrt(globalSumSqDiff / resolvedSampleCount)
        : NaN;
    const globalOutputCorrelation = this.#computePearsonCorrelation(
      globalOutputsA,
      globalOutputsB
    );

    const intensity = {
      pearsonCorrelation,
      meanAbsDiff,
      rmse,
      pctWithinEps,
      dominanceP: jointCount > 0 ? dominancePCount / jointCount : 0,
      dominanceQ: jointCount > 0 ? dominanceQCount / jointCount : 0,
      globalMeanAbsDiff,
      globalL2Distance,
      globalOutputCorrelation,
    };

    // Compute pass rates and conditional probabilities
    const passACount = onBothCount + pOnlyCount;
    const passBCount = onBothCount + qOnlyCount;
    // Apply guardrail: conditional probabilities require minimum pass samples
    // to prevent statistically unreliable nesting/subsumption conclusions
    const minPassForConditional = this.#config.minPassSamplesForConditional ?? 200;
    const passRates = {
      passARate:
        resolvedSampleCount > 0 ? passACount / resolvedSampleCount : 0,
      passBRate:
        resolvedSampleCount > 0 ? passBCount / resolvedSampleCount : 0,
      pA_given_B: passBCount >= minPassForConditional ? onBothCount / passBCount : NaN,
      pB_given_A: passACount >= minPassForConditional ? onBothCount / passACount : NaN,
      coPassCount: onBothCount,
      passACount,
      passBCount,
    };

    // Compute high-intensity co-activation metrics per threshold
    const highCoactivation = {
      thresholds: thresholdCounters.map((c) => ({
        t: c.t,
        pHighA: onEitherCount > 0 ? c.highACount / onEitherCount : 0,
        pHighB: onEitherCount > 0 ? c.highBCount / onEitherCount : 0,
        pHighBoth: onEitherCount > 0 ? c.highBothCount / onEitherCount : 0,
        highJaccard:
          c.eitherHighCount > 0 ? c.highBothCount / c.eitherHighCount : 0,
        highAgreement: onEitherCount > 0 ? c.agreementCount / onEitherCount : 0,
      })),
    };

    // Extract divergence examples from heap, sorted by absDiff descending
    const divergenceExamples = divergenceHeap
      .sort((a, b) => b.absDiff - a.absDiff)
      .slice(0, divergenceK);

    // Extract gate intervals and compute implication (PROREDANAV2-012)
    const intervalsA = this.#gateConstraintExtractor.extract(gatesA);
    const intervalsB = this.#gateConstraintExtractor.extract(gatesB);

    let gateImplication = null;
    // Only evaluate gate implication when BOTH prototypes have complete parse status.
    // Partial parses would lead to false deterministic nesting claims based on incomplete data.
    if (
      intervalsA.parseStatus === 'complete' &&
      intervalsB.parseStatus === 'complete'
    ) {
      gateImplication = this.#gateImplicationEvaluator.evaluate(
        intervalsA.intervals,
        intervalsB.intervals
      );
    }

    // Build gateParseInfo for UI transparency about parse coverage
    const gateParseInfo = {
      prototypeA: {
        parseStatus: intervalsA.parseStatus,
        parsedGateCount: gatesA.length - (intervalsA.unparsedGates?.length ?? 0),
        totalGateCount: gatesA.length,
        unparsedGates: intervalsA.unparsedGates ?? [],
      },
      prototypeB: {
        parseStatus: intervalsB.parseStatus,
        parsedGateCount: gatesB.length - (intervalsB.unparsedGates?.length ?? 0),
        totalGateCount: gatesB.length,
        unparsedGates: intervalsB.unparsedGates ?? [],
      },
    };

    this.#logger.debug(
      `BehavioralOverlapEvaluator: Completed ${resolvedSampleCount} samples, ` +
        `onBothRate=${gateOverlap.onBothRate.toFixed(4)}, ` +
        `correlation=${Number.isNaN(pearsonCorrelation) ? 'NaN' : pearsonCorrelation.toFixed(4)}, ` +
        `gateImplication=${gateImplication ? gateImplication.relation : 'none'}`
    );

    return {
      gateOverlap,
      intensity,
      divergenceExamples,
      passRates,
      highCoactivation,
      gateImplication,
      gateParseInfo,
    };
  }

  /**
   * Evaluate behavioral overlap using pre-computed prototype output vectors (V3 mode).
   * Uses AgreementMetricsCalculator for efficient O(1) vector operations.
   *
   * @param {object} prototypeA - First prototype (used for logging/context only in V3)
   * @param {object} prototypeB - Second prototype (used for logging/context only in V3)
   * @param {object} options - V3 options with pre-computed vectors
   * @param {object} options.vectorA - Pre-computed output vector for prototype A
   * @param {boolean[]} options.vectorA.gateResults - Array of gate pass results per context
   * @param {number[]} options.vectorA.intensities - Array of computed intensities per context
   * @param {object} options.vectorB - Pre-computed output vector for prototype B
   * @param {boolean[]} options.vectorB.gateResults - Array of gate pass results per context
   * @param {number[]} options.vectorB.intensities - Array of computed intensities per context
   * @returns {BehavioralMetrics} Computed behavioral metrics with agreementMetrics
   * @throws {Error} If agreementMetricsCalculator was not provided to constructor
   */
  #evaluateViaVectors(prototypeA, prototypeB, options) {
    const { vectorA, vectorB } = options;

    if (!this.#agreementMetricsCalculator) {
      throw new Error(
        'BehavioralOverlapEvaluator: agreementMetricsCalculator required for V3 vector-based evaluation'
      );
    }

    // Compute metrics via AgreementMetricsCalculator
    const agreementMetrics = this.#agreementMetricsCalculator.calculate(
      vectorA,
      vectorB
    );

    const sampleCount = vectorA.gateResults?.length ?? 0;

    // Compute derived gate overlap rates from agreement metrics
    // onEitherRate approximation: based on activationJaccard inverse
    // J = coPass / (passA + passB - coPass), so passA + passB - coPass = coPass / J
    // But we don't have passA/passB directly, so we use what's available
    const coPassRate = sampleCount > 0 ? agreementMetrics.coPassCount / sampleCount : 0;

    // Estimate passA and passB by iterating vectors (needed for backward compatibility)
    let passACount = 0;
    let passBCount = 0;
    for (let i = 0; i < sampleCount; i++) {
      if (vectorA.gateResults[i]) passACount++;
      if (vectorB.gateResults[i]) passBCount++;
    }
    const passARate = sampleCount > 0 ? passACount / sampleCount : 0;
    const passBRate = sampleCount > 0 ? passBCount / sampleCount : 0;

    // Compute gate overlap stats
    const onBothCount = agreementMetrics.coPassCount;
    const pOnlyCount = passACount - onBothCount;
    const qOnlyCount = passBCount - onBothCount;
    const onEitherCount = passACount + passBCount - onBothCount;

    const gateOverlap = {
      onEitherRate: sampleCount > 0 ? onEitherCount / sampleCount : 0,
      onBothRate: coPassRate,
      pOnlyRate: sampleCount > 0 ? pOnlyCount / sampleCount : 0,
      qOnlyRate: sampleCount > 0 ? qOnlyCount / sampleCount : 0,
    };

    // Map V3 metrics to backward-compatible intensity format
    const intensity = {
      pearsonCorrelation: agreementMetrics.pearsonCoPass,
      meanAbsDiff: agreementMetrics.maeCoPass,
      rmse: agreementMetrics.rmseCoPass,
      pctWithinEps: NaN, // Not computed in V3 mode
      dominanceP: 0, // Not computed in V3 mode (would need per-sample comparison)
      dominanceQ: 0,
      globalMeanAbsDiff: agreementMetrics.maeGlobal,
      globalL2Distance: agreementMetrics.rmseGlobal,
      globalOutputCorrelation: agreementMetrics.pearsonGlobal,
    };

    // Apply minimum conditional probability guardrail
    const minPassForConditional = this.#config.minPassSamplesForConditional ?? 200;
    const passRates = {
      passARate,
      passBRate,
      pA_given_B: passBCount >= minPassForConditional ? agreementMetrics.pA_given_B : NaN,
      pB_given_A: passACount >= minPassForConditional ? agreementMetrics.pB_given_A : NaN,
      coPassCount: agreementMetrics.coPassCount,
      passACount,
      passBCount,
    };

    this.#logger.debug(
      `BehavioralOverlapEvaluator (V3): Evaluated ${sampleCount} samples via vectors, ` +
        `onBothRate=${gateOverlap.onBothRate.toFixed(4)}, ` +
        `correlation=${Number.isNaN(intensity.pearsonCorrelation) ? 'NaN' : intensity.pearsonCorrelation.toFixed(4)}`
    );

    // Return backward-compatible format with V3 agreementMetrics addition
    return {
      gateOverlap,
      intensity,
      divergenceExamples: [], // Not available in V3 mode (requires per-sample context)
      passRates,
      highCoactivation: null, // Not available in V3 mode (requires threshold tracking)
      gateImplication: null, // Would need separate gate constraint analysis
      gateParseInfo: null, // Would need separate gate parsing
      agreementMetrics, // V3: Full agreement metrics from AgreementMetricsCalculator
    };
  }

  /**
   * Resolve the sample count, ensuring it's a valid positive integer.
   *
   * @param {number} sampleCount - Requested sample count
   * @returns {number} Resolved sample count
   */
  #resolveSampleCount(sampleCount) {
    if (
      typeof sampleCount !== 'number' ||
      !Number.isFinite(sampleCount) ||
      sampleCount < 1
    ) {
      return this.#config.sampleCountPerPair ?? 8000;
    }
    return Math.floor(sampleCount);
  }

  /**
   * Yield to the event loop to allow UI updates and prevent blocking.
   * Uses requestIdleCallback when available for optimal scheduling,
   * with setTimeout(0) as a fallback for environments without it.
   *
   * @returns {Promise<void>} Resolves after yielding
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
   * Compute Pearson correlation coefficient between two arrays.
   *
   * @param {number[]} xs - First array of values
   * @param {number[]} ys - Second array of values
   * @returns {number} Correlation coefficient [-1, 1] or NaN if insufficient data
   */
  #computePearsonCorrelation(xs, ys) {
    const n = xs.length;
    if (n < 2 || n !== ys.length) {
      return NaN;
    }

    // Compute means
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < n; i++) {
      sumX += xs[i];
      sumY += ys[i];
    }
    const meanX = sumX / n;
    const meanY = sumY / n;

    // Compute covariance and standard deviations
    let cov = 0;
    let varX = 0;
    let varY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      cov += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }

    const stdX = Math.sqrt(varX);
    const stdY = Math.sqrt(varY);

    // Handle degenerate cases (constant values)
    if (stdX === 0 || stdY === 0) {
      return NaN;
    }

    const correlation = cov / (stdX * stdY);

    // Clamp to [-1, 1] to handle floating point errors
    return Math.max(-1, Math.min(1, correlation));
  }

  /**
   * Update top-K divergence examples using a min-heap.
   * Maintains the K examples with highest absDiff.
   *
   * @param {Array<DivergenceExample>} heap - Min-heap array
   * @param {DivergenceExample} example - New example to consider
   * @param {number} k - Maximum number of examples to keep
   */
  #updateTopKDivergence(heap, example, k) {
    if (k <= 0) {
      return;
    }

    if (heap.length < k) {
      // Heap not full, just add and heapify up
      heap.push(example);
      this.#heapifyUp(heap, heap.length - 1);
    } else if (example.absDiff > heap[0].absDiff) {
      // New example is larger than min, replace min
      heap[0] = example;
      this.#heapifyDown(heap, 0);
    }
  }

  /**
   * Restore min-heap property by bubbling up.
   *
   * @param {Array<DivergenceExample>} heap - Heap array
   * @param {number} i - Index to heapify from
   */
  #heapifyUp(heap, i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (heap[parent].absDiff <= heap[i].absDiff) {
        break;
      }
      // Swap with parent
      const temp = heap[parent];
      heap[parent] = heap[i];
      heap[i] = temp;
      i = parent;
    }
  }

  /**
   * Restore min-heap property by bubbling down.
   *
   * @param {Array<DivergenceExample>} heap - Heap array
   * @param {number} i - Index to heapify from
   */
  #heapifyDown(heap, i) {
    const n = heap.length;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;

      if (left < n && heap[left].absDiff < heap[smallest].absDiff) {
        smallest = left;
      }
      if (right < n && heap[right].absDiff < heap[smallest].absDiff) {
        smallest = right;
      }

      if (smallest === i) {
        break;
      }

      // Swap with smallest child
      const temp = heap[smallest];
      heap[smallest] = heap[i];
      heap[i] = temp;
      i = smallest;
    }
  }

  /**
   * Validate that config has required numeric thresholds.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   */
  #validateConfig(config, logger) {
    if (!config || typeof config !== 'object') {
      logger.error('BehavioralOverlapEvaluator: Missing or invalid config');
      throw new Error(
        'BehavioralOverlapEvaluator requires a valid config object'
      );
    }

    const requiredKeys = [
      'sampleCountPerPair',
      'divergenceExamplesK',
      'dominanceDelta',
    ];

    for (const key of requiredKeys) {
      if (typeof config[key] !== 'number') {
        logger.error(
          `BehavioralOverlapEvaluator: Missing or invalid config.${key} (expected number)`
        );
        throw new Error(
          `BehavioralOverlapEvaluator config requires numeric ${key}`
        );
      }
    }
  }

  /**
   * Get the set of axes that are relevant to either prototype.
   * Includes axes from weights and gates of both prototypes.
   *
   * @param {object} weightsA - Weights from prototype A
   * @param {object} weightsB - Weights from prototype B
   * @param {string[]} gatesA - Gates from prototype A
   * @param {string[]} gatesB - Gates from prototype B
   * @returns {Set<string>} Set of relevant axis names
   */
  #getRelevantAxes(weightsA, weightsB, gatesA, gatesB) {
    const axes = new Set();

    // Add weight axes from both prototypes
    for (const key of Object.keys(weightsA ?? {})) {
      axes.add(key);
    }
    for (const key of Object.keys(weightsB ?? {})) {
      axes.add(key);
    }

    // Add gate axes (parse gate strings to extract axis names)
    for (const gate of gatesA ?? []) {
      const axis = this.#extractAxisFromGate(gate);
      if (axis) axes.add(axis);
    }
    for (const gate of gatesB ?? []) {
      const axis = this.#extractAxisFromGate(gate);
      if (axis) axes.add(axis);
    }

    return axes;
  }

  /**
   * Extract the axis name from a gate string.
   * Uses the same regex pattern as GateConstraintExtractor.
   *
   * @param {string} gate - Gate condition string (e.g., "threat <= 0.20")
   * @returns {string|null} Axis name or null if unparseable
   */
  #extractAxisFromGate(gate) {
    if (typeof gate !== 'string') {
      return null;
    }
    // Reuse pattern from GateConstraintExtractor.GATE_PATTERN
    const match = gate.match(/^(\w+)\s*(>=|>|<=|<)\s*(-?\d+\.?\d*)$/);
    return match ? match[1] : null;
  }

  /**
   * Resolve the context value for a given axis name.
   * Mirrors ContextBuilder.#resolveGateAxisRawValue() for consistent lookups.
   *
   * @param {object} context - The built context object
   * @param {string} axis - The axis name to look up
   * @returns {number|null} The axis value or null if not found
   */
  #resolveContextValue(context, axis) {
    if (!context || typeof axis !== 'string') {
      return null;
    }

    // Mood axes (valence, arousal, etc.)
    if (MOOD_AXES_SET.has(axis)) {
      return context?.moodAxes?.[axis] ?? context?.mood?.[axis] ?? null;
    }

    // Affect traits (affective_empathy, etc.)
    if (AFFECT_TRAITS_SET.has(axis)) {
      return context?.affectTraits?.[axis] ?? null;
    }

    // Sexual arousal scalar
    if (axis === 'sexual_arousal') {
      return context?.sexualArousal ?? null;
    }

    // Sexual axes (sex_excitation, sex_inhibition, baseline_libido)
    if (SEXUAL_AXIS_NAMES.has(axis)) {
      const sexualAxes = context?.sexualAxes ?? context?.sexual ?? {};
      return sexualAxes[axis] ?? null;
    }

    return null;
  }

  /**
   * Normalize raw axis values to [0, 1] for display consistency.
   *
   * @param {string} axis - Axis name
   * @param {number} rawValue - Raw axis value
   * @returns {number} Normalized value in [0, 1]
   */
  #normalizeAxisValue(axis, rawValue) {
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      return rawValue;
    }

    // Mood axes use [-100, 100] while traits/sexual axes use [0, 100] or [-50, 50].
    if (MOOD_AXES_SET.has(axis)) {
      return this.#clamp01((rawValue + 100) / 200);
    }

    if (AFFECT_TRAITS_SET.has(axis)) {
      return this.#clamp01(rawValue / 100);
    }

    if (axis === 'sexual_arousal') {
      return this.#clamp01(rawValue);
    }

    if (axis === 'baseline_libido') {
      return this.#clamp01((rawValue + 50) / 100);
    }

    if (SEXUAL_AXIS_NAMES.has(axis)) {
      return this.#clamp01(rawValue / 100);
    }

    return rawValue;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Format a context object into a human-readable summary string.
   * Extracts top attribute names and values for concise display.
   * Only includes axes that are relevant to the prototypes being compared.
   *
   * @param {object} context - The sampled context object
   * @param {object} weightsA - Weights from prototype A
   * @param {object} weightsB - Weights from prototype B
   * @param {string[]} gatesA - Gates from prototype A
   * @param {string[]} gatesB - Gates from prototype B
   * @returns {string} Formatted summary (e.g., "arousal: 0.70, valence: 0.35")
   */
  #formatContextSummary(context, weightsA, weightsB, gatesA, gatesB) {
    if (!context || typeof context !== 'object') {
      return '';
    }

    const relevantAxes = this.#getRelevantAxes(weightsA, weightsB, gatesA, gatesB);

    // If no relevant axes, return empty (edge case: both prototypes have no weights/gates)
    if (relevantAxes.size === 0) {
      return '';
    }

    // Extract values only for relevant axes
    /** @type {Array<[string, number]>} */
    const entries = [];
    for (const axis of relevantAxes) {
      const value = this.#resolveContextValue(context, axis);
      if (typeof value === 'number' && Number.isFinite(value)) {
        entries.push([axis, value]);
      }
    }

    // Sort by absolute value (most impactful first) and take top 3
    entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const top3 = entries.slice(0, 3);

    if (top3.length === 0) {
      return '';
    }

    return top3
      .map(([key, value]) => {
        const normalizedValue = this.#normalizeAxisValue(key, value);
        return `${key}: ${normalizedValue.toFixed(2)}`;
      })
      .join(', ');
  }
}

export default BehavioralOverlapEvaluator;
