/**
 * @file PrototypeVectorEvaluator - Evaluate prototypes against a shared context pool.
 * @see specs/prototype-analysis-overhaul-v3.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

const CHUNK_SIZE = 500;

/**
 * Evaluates prototypes against shared context pools and builds output vectors.
 */
class PrototypeVectorEvaluator {
  #prototypeGateChecker;
  #prototypeIntensityCalculator;
  #contextAxisNormalizer;
  #logger;
  #cacheByPool;

  /**
   * Create a PrototypeVectorEvaluator instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {object} deps.prototypeGateChecker - IPrototypeGateChecker with checkAllGatesPass(), preParseGates(), checkParsedGatesPass().
   * @param {object} deps.prototypeIntensityCalculator - IPrototypeIntensityCalculator with computeIntensity(), computeIntensityFromNormalized().
   * @param {object} deps.contextAxisNormalizer - IContextAxisNormalizer with getNormalizedAxes().
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   */
  constructor({ prototypeGateChecker, prototypeIntensityCalculator, contextAxisNormalizer, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(
      prototypeGateChecker,
      'IPrototypeGateChecker',
      logger,
      { requiredMethods: ['checkAllGatesPass', 'preParseGates', 'checkParsedGatesPass'] }
    );
    validateDependency(
      prototypeIntensityCalculator,
      'IPrototypeIntensityCalculator',
      logger,
      { requiredMethods: ['computeIntensity', 'computeIntensityFromNormalized'] }
    );
    validateDependency(
      contextAxisNormalizer,
      'IContextAxisNormalizer',
      logger,
      { requiredMethods: ['getNormalizedAxes'] }
    );

    this.#prototypeGateChecker = prototypeGateChecker;
    this.#prototypeIntensityCalculator = prototypeIntensityCalculator;
    this.#contextAxisNormalizer = contextAxisNormalizer;
    this.#logger = logger;
    this.#cacheByPool = new WeakMap();
  }

  /**
   * Evaluate all prototypes on the shared context pool.
   *
   * @param {Array<object>} prototypes - All prototypes to evaluate.
   * @param {Array<object>} contextPool - Shared context pool.
   * @param {function(number, number): void} [onProgress] - Optional progress callback (current, total).
   * @returns {Promise<Map<string, PrototypeOutputVector>>} Output vectors by prototype id.
   */
  async evaluateAll(prototypes, contextPool, onProgress = null) {
    if (!Array.isArray(prototypes)) {
      throw new Error(
        'PrototypeVectorEvaluator.evaluateAll expects prototypes array'
      );
    }
    if (!Array.isArray(contextPool)) {
      throw new Error(
        'PrototypeVectorEvaluator.evaluateAll expects contextPool array'
      );
    }

    const results = new Map();
    if (prototypes.length === 0) {
      return results;
    }

    const poolCache = this.#getPoolCache(contextPool);
    const totalPrototypes = prototypes.length;

    if (contextPool.length === 0) {
      this.#logger.warn(
        'PrototypeVectorEvaluator: contextPool is empty; returning empty vectors',
        { prototypeCount: prototypes.length }
      );
      for (let i = 0; i < prototypes.length; i++) {
        const prototype = prototypes[i];
        const prototypeId = this.#getPrototypeId(prototype);
        const vector = this.#buildEmptyVector(prototypeId);
        poolCache.set(prototypeId, vector);
        results.set(prototypeId, vector);
        // Report progress for empty pool case
        onProgress?.(i + 1, totalPrototypes);
      }
      return results;
    }

    // OPTIMIZATION: Pre-normalize entire context pool ONCE (instead of per-prototype)
    // This eliminates ~4.5 million redundant normalization calls
    const normalizedPool = contextPool.map((ctx) =>
      this.#contextAxisNormalizer.getNormalizedAxes(ctx)
    );

    // OPTIMIZATION: Pre-parse gates for all prototypes ONCE
    // This eliminates ~13.6 million redundant regex parses
    const prototypeGatesMap = new Map();
    for (const proto of prototypes) {
      const prototypeId = this.#getPrototypeId(proto);
      const gates = Array.isArray(proto.gates) ? proto.gates : [];
      prototypeGatesMap.set(prototypeId, this.#prototypeGateChecker.preParseGates(gates));
    }

    for (let i = 0; i < prototypes.length; i++) {
      const prototype = prototypes[i];
      const prototypeId = this.#getPrototypeId(prototype);
      const cached = poolCache.get(prototypeId);
      if (cached) {
        results.set(prototypeId, cached);
        // Report progress even for cached results
        onProgress?.(i + 1, totalPrototypes);
        continue;
      }

      const parsedGates = prototypeGatesMap.get(prototypeId);
      const vector = await this.#evaluatePrototypeOptimized(prototype, normalizedPool, parsedGates);
      poolCache.set(prototypeId, vector);
      results.set(prototypeId, vector);
      // Report progress after each prototype evaluation
      onProgress?.(i + 1, totalPrototypes);
    }

    return results;
  }

  /**
   * Evaluate a single prototype on the shared context pool.
   *
   * @param {object} prototype - Prototype to evaluate.
   * @param {Array<object>} contextPool - Shared context pool.
   * @returns {Promise<PrototypeOutputVector>} Output vector for the prototype.
   */
  async evaluateSingle(prototype, contextPool) {
    if (!Array.isArray(contextPool) || contextPool.length === 0) {
      return this.#buildEmptyVector(this.#getPrototypeId(prototype));
    }

    // Pre-normalize for single prototype evaluation
    const normalizedPool = contextPool.map((ctx) =>
      this.#contextAxisNormalizer.getNormalizedAxes(ctx)
    );
    const gates = Array.isArray(prototype.gates) ? prototype.gates : [];
    const parsedGates = this.#prototypeGateChecker.preParseGates(gates);

    return this.#evaluatePrototypeOptimized(prototype, normalizedPool, parsedGates);
  }

  #getPoolCache(contextPool) {
    if (!this.#cacheByPool.has(contextPool)) {
      this.#cacheByPool.set(contextPool, new Map());
    }
    return this.#cacheByPool.get(contextPool);
  }

  #getPrototypeId(prototype) {
    if (!prototype || typeof prototype !== 'object') {
      this.#logger.error(
        'PrototypeVectorEvaluator: prototype must be an object',
        { prototype }
      );
      throw new Error('PrototypeVectorEvaluator: invalid prototype');
    }
    const prototypeId = prototype.id;
    if (typeof prototypeId !== 'string' || prototypeId.length === 0) {
      this.#logger.error(
        'PrototypeVectorEvaluator: prototype.id must be a non-empty string',
        { prototypeId }
      );
      throw new Error('PrototypeVectorEvaluator: invalid prototype');
    }
    return prototypeId;
  }

  #buildEmptyVector(prototypeId) {
    return {
      prototypeId,
      gateResults: new Float32Array(0),
      intensities: new Float32Array(0),
      activationRate: 0,
      meanIntensity: 0,
      stdIntensity: 0,
    };
  }

  /**
   * Optimized prototype evaluation using pre-normalized contexts and pre-parsed gates.
   * This is the hot path optimized for batch evaluation.
   *
   * @param {object} prototype - Prototype to evaluate.
   * @param {Array<{moodAxes: object, sexualAxes: object, traitAxes: object}>} normalizedPool - Pre-normalized context pool.
   * @param {Array<GateConstraint>} parsedGates - Pre-parsed gate constraints.
   * @returns {Promise<PrototypeOutputVector>} Output vector for the prototype.
   */
  async #evaluatePrototypeOptimized(prototype, normalizedPool, parsedGates) {
    const prototypeId = this.#getPrototypeId(prototype);
    const weights = prototype.weights ?? {};

    const gateResults = new Float32Array(normalizedPool.length);
    const intensities = new Float32Array(normalizedPool.length);

    let passCount = 0;
    let sumIntensity = 0;
    let sumSqIntensity = 0;

    for (let processed = 0; processed < normalizedPool.length; ) {
      const chunkEnd = Math.min(processed + CHUNK_SIZE, normalizedPool.length);
      for (let i = processed; i < chunkEnd; i += 1) {
        const normalizedCtx = normalizedPool[i];
        // Use optimized gate check with pre-parsed constraints
        const pass = this.#prototypeGateChecker.checkParsedGatesPass(
          parsedGates,
          normalizedCtx
        );
        gateResults[i] = pass ? 1 : 0;
        if (pass) {
          // Use optimized intensity calculation with pre-normalized axes
          const intensity =
            this.#prototypeIntensityCalculator.computeIntensityFromNormalized(
              weights,
              normalizedCtx
            );
          intensities[i] = intensity;
          passCount += 1;
          sumIntensity += intensity;
          sumSqIntensity += intensity * intensity;
        } else {
          intensities[i] = 0;
        }
      }

      processed = chunkEnd;
      if (processed < normalizedPool.length) {
        await this.#yieldToEventLoop();
      }
    }

    const activationRate =
      normalizedPool.length > 0 ? passCount / normalizedPool.length : 0;
    let meanIntensity = 0;
    let stdIntensity = 0;

    if (passCount > 0) {
      meanIntensity = sumIntensity / passCount;
      const variance =
        sumSqIntensity / passCount - meanIntensity * meanIntensity;
      stdIntensity = Math.sqrt(Math.max(0, variance));
    }

    return {
      prototypeId,
      gateResults,
      intensities,
      activationRate,
      meanIntensity,
      stdIntensity,
    };
  }

  /**
   * Yield to the event loop to prevent long blocking.
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
}

export default PrototypeVectorEvaluator;

/**
 * @typedef {object} PrototypeOutputVector
 * @property {string} prototypeId - Prototype identifier.
 * @property {Float32Array} gateResults - Binary pass/fail per context (0 or 1).
 * @property {Float32Array} intensities - Output intensity per context (0 if gate fails).
 * @property {number} activationRate - Fraction of contexts where gate passes.
 * @property {number} meanIntensity - Mean intensity when activated.
 * @property {number} stdIntensity - Std dev of intensity when activated.
 */
