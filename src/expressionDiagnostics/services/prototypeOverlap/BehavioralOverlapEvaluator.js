/**
 * @file BehavioralOverlapEvaluator - Stage B behavioral sampling for overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

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
 * @property {number} dominanceP - P(intensityA > intensityB + delta)
 * @property {number} dominanceQ - P(intensityB > intensityA + delta)
 */

/**
 * @typedef {object} DivergenceExample
 * @property {object} context - The sampled context
 * @property {number} intensityA - Intensity for prototype A
 * @property {number} intensityB - Intensity for prototype B
 * @property {number} absDiff - |intensityA - intensityB|
 */

/**
 * @typedef {object} BehavioralMetrics
 * @property {GateOverlapStats} gateOverlap - Gate overlap statistics
 * @property {IntensityStats} intensity - Intensity similarity statistics
 * @property {Array<DivergenceExample>} divergenceExamples - Top-K examples with highest divergence
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
  #config;
  #logger;

  /**
   * Constructs a new BehavioralOverlapEvaluator instance.
   *
   * @param {object} deps - Dependencies object
   * @param {object} deps.prototypeIntensityCalculator - IPrototypeIntensityCalculator with computeIntensity()
   * @param {object} deps.randomStateGenerator - IRandomStateGenerator with generate()
   * @param {object} deps.contextBuilder - IContextBuilder with buildContext()
   * @param {object} deps.prototypeGateChecker - IPrototypeGateChecker with checkAllGatesPass()
   * @param {object} deps.config - Configuration with sampleCountPerPair, divergenceExamplesK, dominanceDelta
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - ILogger
   */
  constructor({
    prototypeIntensityCalculator,
    randomStateGenerator,
    contextBuilder,
    prototypeGateChecker,
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

    this.#validateConfig(config, logger);

    this.#prototypeIntensityCalculator = prototypeIntensityCalculator;
    this.#randomStateGenerator = randomStateGenerator;
    this.#contextBuilder = contextBuilder;
    this.#prototypeGateChecker = prototypeGateChecker;
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Evaluate behavioral overlap between two prototypes via Monte Carlo sampling.
   * Processes samples in chunks and yields to the event loop between chunks
   * to keep the UI responsive during long-running analyses.
   *
   * @param {object} prototypeA - First prototype with gates and weights properties
   * @param {object} prototypeB - Second prototype with gates and weights properties
   * @param {number} sampleCount - Number of contexts to sample
   * @param {function(number, number): void} [onProgress] - Optional progress callback (completed, total)
   * @returns {Promise<BehavioralMetrics>} Computed behavioral metrics
   */
  async evaluate(prototypeA, prototypeB, sampleCount, onProgress) {
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

    // Top-K divergence examples (min-heap by absDiff)
    const divergenceHeap = [];

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

        // Track gate overlap stats
        if (passA || passB) {
          onEitherCount++;
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

        // When both pass, compute intensities and track correlation/divergence
        if (passA && passB) {
          const intensityA =
            this.#prototypeIntensityCalculator.computeIntensity(
              weightsA,
              context
            );
          const intensityB =
            this.#prototypeIntensityCalculator.computeIntensity(
              weightsB,
              context
            );

          intensitiesA.push(intensityA);
          intensitiesB.push(intensityB);

          // Dominance tracking
          if (intensityA > intensityB + dominanceDelta) {
            dominancePCount++;
          }
          if (intensityB > intensityA + dominanceDelta) {
            dominanceQCount++;
          }

          // Track top-K divergence examples
          const absDiff = Math.abs(intensityA - intensityB);
          this.#updateTopKDivergence(
            divergenceHeap,
            { context, intensityA, intensityB, absDiff },
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
    const pearsonCorrelation = this.#computePearsonCorrelation(
      intensitiesA,
      intensitiesB
    );

    let meanAbsDiff = NaN;
    if (jointCount > 0) {
      let sumAbsDiff = 0;
      for (let i = 0; i < jointCount; i++) {
        sumAbsDiff += Math.abs(intensitiesA[i] - intensitiesB[i]);
      }
      meanAbsDiff = sumAbsDiff / jointCount;
    }

    const intensity = {
      pearsonCorrelation,
      meanAbsDiff,
      dominanceP: jointCount > 0 ? dominancePCount / jointCount : 0,
      dominanceQ: jointCount > 0 ? dominanceQCount / jointCount : 0,
    };

    // Extract divergence examples from heap, sorted by absDiff descending
    const divergenceExamples = divergenceHeap
      .sort((a, b) => b.absDiff - a.absDiff)
      .slice(0, divergenceK);

    this.#logger.debug(
      `BehavioralOverlapEvaluator: Completed ${resolvedSampleCount} samples, ` +
        `onBothRate=${gateOverlap.onBothRate.toFixed(4)}, ` +
        `correlation=${Number.isNaN(pearsonCorrelation) ? 'NaN' : pearsonCorrelation.toFixed(4)}`
    );

    return { gateOverlap, intensity, divergenceExamples };
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
}

export default BehavioralOverlapEvaluator;
