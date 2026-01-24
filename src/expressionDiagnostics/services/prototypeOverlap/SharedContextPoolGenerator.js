/**
 * @file SharedContextPoolGenerator - Build a shared context pool for prototype overlap analysis.
 * @see specs/prototype-analysis-overhaul-v3.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { MOOD_AXIS_RANGE } from '../../../constants/moodAffectConstants.js';

const DEFAULT_POOL_SIZE = 50000;
const DEFAULT_STRATUM_COUNT = 5;
const DEFAULT_STRATEGY = 'uniform';
const STRATEGIES = new Set(['uniform', 'mood-regime', 'extremes-enhanced']);
const STRATUM_ID_PREFIX = 'valence';
const EXTREME_WEIGHT_BONUS = 0.5;
const CHUNK_SIZE = 500;

class SharedContextPoolGenerator {
  #randomStateGenerator;
  #contextBuilder;
  #logger;
  #poolSize;
  #stratified;
  #stratumCount;
  #stratificationStrategy;
  #randomSeed;
  #pool;
  #strata;
  #metadata;

  /**
   * Create a shared pool generator with injected dependencies and options.
   *
   * @param {object} deps - Constructor dependencies and options.
   * @param {object} deps.randomStateGenerator - IRandomStateGenerator with generate().
   * @param {object} deps.contextBuilder - IContextBuilder with buildContext().
   * @param {object} deps.logger - Logger instance.
   * @param {number} [deps.poolSize] - Total contexts in pool.
   * @param {boolean} [deps.stratified] - Whether to stratify by valence bands.
   * @param {number} [deps.stratumCount] - Number of strata when stratified.
   * @param {'uniform'|'mood-regime'|'extremes-enhanced'} [deps.stratificationStrategy] - Sampling strategy.
   * @param {number|null} [deps.randomSeed] - Seed for reproducibility.
   */
  constructor({
    randomStateGenerator,
    contextBuilder,
    logger,
    poolSize = DEFAULT_POOL_SIZE,
    stratified = false,
    stratumCount = DEFAULT_STRATUM_COUNT,
    stratificationStrategy = DEFAULT_STRATEGY,
    randomSeed = null,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(randomStateGenerator, 'IRandomStateGenerator', logger, {
      requiredMethods: ['generate'],
    });
    validateDependency(contextBuilder, 'IContextBuilder', logger, {
      requiredMethods: ['buildContext'],
    });

    this.#logger = logger;

    this.#validateOptions({
      poolSize,
      stratified,
      stratumCount,
      stratificationStrategy,
      randomSeed,
    });

    this.#randomStateGenerator = randomStateGenerator;
    this.#contextBuilder = contextBuilder;
    this.#poolSize = Math.floor(poolSize);
    this.#stratified = Boolean(stratified);
    this.#stratumCount = Math.floor(stratumCount);
    this.#stratificationStrategy = stratificationStrategy;
    this.#randomSeed = randomSeed;
    this.#pool = [];
    this.#strata = new Map();
    this.#metadata = null;
  }

  /**
   * Generate the shared context pool asynchronously with progress reporting.
   * Yields to the event loop periodically to prevent UI blocking.
   *
   * @param {Function|null} [onProgress] - Progress callback: (current, total) => void
   * @returns {Promise<Array<object>>} Array of context objects.
   */
  async generate(onProgress = null) {
    this.#pool = [];
    this.#strata = new Map();

    const poolSize = this.#poolSize;
    this.#metadata = {
      poolSize,
      seed: this.#randomSeed ?? null,
      timestamp: Date.now(),
      stratified: this.#stratified,
      stratificationStrategy: this.#stratificationStrategy,
      stratumCount: this.#stratified ? this.#stratumCount : 1,
    };

    if (poolSize === 0) {
      onProgress?.(0, 0);
      return this.#pool;
    }

    // Pre-generate all random states synchronously (preserves seeded determinism)
    const { states, stratumAssignments } = this.#withSeed(this.#randomSeed, () => {
      return this.#preGenerateStates(poolSize);
    });

    // Build contexts asynchronously in chunks with yielding
    const contexts = [];
    for (let processed = 0; processed < poolSize; ) {
      const chunkEnd = Math.min(processed + CHUNK_SIZE, poolSize);

      for (let i = processed; i < chunkEnd; i += 1) {
        const { state, stratumIndex } = states[i];
        const context = this.#contextBuilder.buildContext(
          state.current,
          state.previous,
          state.affectTraits,
          null,
          false
        );
        contexts.push(context);
      }

      processed = chunkEnd;
      onProgress?.(processed, poolSize);

      if (processed < poolSize) {
        await this.#yieldToEventLoop();
      }
    }

    // Organize into strata
    if (!this.#stratified) {
      this.#strata.set('default', contexts);
    } else {
      for (const [stratumId, indices] of stratumAssignments.entries()) {
        const stratumContexts = indices.map((idx) => contexts[idx]);
        this.#strata.set(stratumId, stratumContexts);
      }
    }

    this.#pool = contexts;
    return this.#pool;
  }

  /**
   * Pre-generate all random states synchronously.
   * Must be called inside #withSeed to preserve determinism.
   *
   * @param {number} poolSize - Number of states to generate.
   * @returns {{states: Array<{state: object, stratumIndex: number|null}>, stratumAssignments: Map<string, number[]>}}
   */
  #preGenerateStates(poolSize) {
    const states = [];
    const stratumAssignments = new Map();

    if (!this.#stratified) {
      for (let i = 0; i < poolSize; i += 1) {
        const state = this.#generateRandomState(null);
        states.push({ state, stratumIndex: null });
      }
      return { states, stratumAssignments };
    }

    // Stratified generation
    const stratumCounts = this.#buildStratumCounts(poolSize);
    let globalIndex = 0;

    for (let stratumIdx = 0; stratumIdx < this.#stratumCount; stratumIdx += 1) {
      const stratumId = this.#buildStratumId(stratumIdx);
      const count = stratumCounts[stratumIdx] ?? 0;
      const indices = [];

      for (let j = 0; j < count; j += 1) {
        const state = this.#generateRandomState(stratumIdx);
        states.push({ state, stratumIndex: stratumIdx });
        indices.push(globalIndex);
        globalIndex += 1;
      }

      stratumAssignments.set(stratumId, indices);
    }

    return { states, stratumAssignments };
  }

  /**
   * Generate a single random state with optional valence stratum applied.
   *
   * @param {number|null} stratumIndex - Stratum index for valence banding.
   * @returns {object} The generated random state.
   */
  #generateRandomState(stratumIndex) {
    const distribution = this.#resolveDistribution();
    const state = this.#randomStateGenerator.generate(distribution, 'static');

    if (Number.isInteger(stratumIndex)) {
      this.#applyValenceStratum(state, stratumIndex);
    }

    return state;
  }

  /**
   * Yield to the event loop to prevent UI blocking.
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
   * Get contexts for a specific stratum (if stratified).
   *
   * @param {string} stratumId - Stratum identifier.
   * @returns {Array<object>} Contexts for the requested stratum.
   */
  getStratum(stratumId) {
    if (!stratumId) {
      return [];
    }
    return this.#strata.get(stratumId) ?? [];
  }

  /**
   * Get pool metadata for reproducibility.
   *
   * @returns {{
   *   poolSize: number,
   *   seed: number|null,
   *   timestamp: number,
   *   stratified: boolean,
   *   stratificationStrategy: string,
   *   stratumCount: number,
   * }} Metadata snapshot.
   */
  getMetadata() {
    if (this.#metadata) {
      return this.#metadata;
    }

    return {
      poolSize: this.#poolSize,
      seed: this.#randomSeed ?? null,
      timestamp: 0,
      stratified: this.#stratified,
      stratificationStrategy: this.#stratificationStrategy,
      stratumCount: this.#stratified ? this.#stratumCount : 1,
    };
  }

  #resolveDistribution() {
    if (this.#stratificationStrategy === 'mood-regime') {
      return 'gaussian';
    }
    return 'uniform';
  }

  #applyValenceStratum(state, stratumIndex) {
    if (!state?.current?.mood || !state?.previous?.mood) {
      return;
    }

    const { min, max } = this.#getStratumRange(stratumIndex);
    const currentValue = this.#sampleInteger(min, max);
    const previousValue = this.#sampleInteger(min, max);

    state.current.mood.valence = currentValue;
    state.previous.mood.valence = previousValue;
  }

  #getStratumRange(stratumIndex) {
    const { min, max } = MOOD_AXIS_RANGE;
    const step = (max - min) / this.#stratumCount;
    const rangeMin = min + step * stratumIndex;
    const rangeMax =
      stratumIndex === this.#stratumCount - 1 ? max : min + step * (stratumIndex + 1);
    return { min: rangeMin, max: rangeMax };
  }

  #buildStratumId(stratumIndex) {
    return `${STRATUM_ID_PREFIX}-${stratumIndex}`;
  }

  #buildStratumCounts(poolSize) {
    const weights = new Array(this.#stratumCount).fill(1);

    if (
      this.#stratificationStrategy === 'extremes-enhanced' &&
      this.#stratumCount > 1
    ) {
      weights[0] += EXTREME_WEIGHT_BONUS;
      weights[this.#stratumCount - 1] += EXTREME_WEIGHT_BONUS;
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const counts = weights.map((weight) =>
      Math.floor(poolSize * (weight / totalWeight))
    );

    let remaining = poolSize - counts.reduce((sum, count) => sum + count, 0);
    if (remaining > 0) {
      const indices = weights
        .map((weight, index) => ({ weight, index }))
        .sort((a, b) => b.weight - a.weight);
      let cursor = 0;
      while (remaining > 0) {
        const targetIndex = indices[cursor % indices.length].index;
        counts[targetIndex] += 1;
        remaining -= 1;
        cursor += 1;
      }
    }

    return counts;
  }

  #sampleInteger(min, max) {
    const clampedMin = Math.min(min, max);
    const clampedMax = Math.max(min, max);
    return Math.round(clampedMin + Math.random() * (clampedMax - clampedMin));
  }

  #withSeed(seed, fn) {
    if (seed === null || seed === undefined) {
      return fn();
    }
    if (!Number.isFinite(seed)) {
      return fn();
    }

    const originalRandom = Math.random;
    const seededRandom = this.#createSeededRandom(seed);
    Math.random = seededRandom;

    try {
      return fn();
    } finally {
      Math.random = originalRandom;
    }
  }

  #createSeededRandom(seed) {
    let state = (Math.floor(seed) >>> 0) || 1;
    return () => {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  #validateOptions({
    poolSize,
    stratified,
    stratumCount,
    stratificationStrategy,
    randomSeed,
  }) {
    if (!Number.isFinite(poolSize) || poolSize < 0) {
      const message = 'SharedContextPoolGenerator: poolSize must be >= 0.';
      this.#logger.error(message, { poolSize });
      throw new Error(message);
    }

    if (!Number.isInteger(stratumCount) || stratumCount <= 0) {
      const message =
        'SharedContextPoolGenerator: stratumCount must be a positive integer.';
      this.#logger.error(message, { stratumCount });
      throw new Error(message);
    }

    if (!STRATEGIES.has(stratificationStrategy)) {
      const message =
        'SharedContextPoolGenerator: stratificationStrategy must be one of uniform, mood-regime, extremes-enhanced.';
      this.#logger.error(message, { stratificationStrategy });
      throw new Error(message);
    }

    if (randomSeed !== null && !Number.isFinite(randomSeed)) {
      const message = 'SharedContextPoolGenerator: randomSeed must be a number or null.';
      this.#logger.error(message, { randomSeed });
      throw new Error(message);
    }

    if (stratified && stratumCount > Math.max(1, Math.floor(poolSize))) {
      this.#logger.warn(
        'SharedContextPoolGenerator: stratumCount exceeds poolSize; some strata will be empty.',
        { stratumCount, poolSize }
      );
    }
  }
}

export default SharedContextPoolGenerator;
