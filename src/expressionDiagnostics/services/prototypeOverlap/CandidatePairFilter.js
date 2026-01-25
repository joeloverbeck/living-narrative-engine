/**
 * @file CandidatePairFilter - Stage A candidate filtering for prototype overlap analysis
 * @description Identifies potentially overlapping prototype pairs based on structural
 * similarity metrics (active axis overlap, sign agreement, cosine similarity) before
 * expensive behavioral sampling. Supports multi-route filtering (v2.1) via optional
 * Route B (gate similarity) and Route C (behavioral prescan) filters.
 * @see specs/prototype-overlap-analyzer.md
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} CandidateMetrics
 * @property {number} activeAxisOverlap - Jaccard similarity of active axis sets [0, 1]
 * @property {number} signAgreement - Ratio of shared axes with matching weight signs [0, 1]
 * @property {number} weightCosineSimilarity - Cosine similarity of weight vectors [-1, 1]
 */

/**
 * @typedef {object} CandidatePair
 * @property {object} prototypeA - First prototype
 * @property {object} prototypeB - Second prototype
 * @property {CandidateMetrics} candidateMetrics - Computed similarity metrics
 * @property {'routeA' | 'routeB' | 'routeC'} [selectedBy] - Route that selected this pair (v2.1)
 * @property {object} [routeMetrics] - Route-specific selection metrics (v2.1)
 */

/**
 * @typedef {object} RouteStats
 * @property {number} passed - Number of pairs that passed this route
 * @property {number} rejected - Number of pairs rejected by this route
 * @property {number} [skipped] - Number of pairs skipped (Route C safety limit)
 * @property {number} [byImplication] - Pairs selected by gate implication (Route B)
 * @property {number} [byOverlap] - Pairs selected by gate overlap (Route B)
 */

/**
 * Filters prototype pairs to candidates based on structural similarity.
 *
 * Stage A of the Prototype Overlap Analyzer pipeline.
 * Uses fast structural metrics to prune the O(n^2) pair space before
 * expensive behavioral sampling in Stage B.
 *
 * v2.1: Supports multi-route filtering to improve candidate coverage:
 * - Route A: Weight-vector similarity (original filtering)
 * - Route B: Gate-based similarity (optional, via gateSimilarityFilter)
 * - Route C: Behavioral prescan (optional, via behavioralPrescanFilter)
 */
class CandidatePairFilter {
  #config;
  #logger;
  #gateSimilarityFilter;
  #behavioralPrescanFilter;


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
   * Constructs a new CandidatePairFilter instance.
   *
   * @param {object} deps - Dependencies for the filter
   * @param {object} deps.config - Configuration with Stage A thresholds
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance
   * @param {object} [deps.gateSimilarityFilter] - Optional Route B filter (v2.1)
   * @param {object} [deps.behavioralPrescanFilter] - Optional Route C filter (v2.1)
   */
  constructor({
    config,
    logger,
    gateSimilarityFilter = null,
    behavioralPrescanFilter = null,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    if (!config || typeof config !== 'object') {
      logger.error('CandidatePairFilter: Missing or invalid config');
      throw new Error('CandidatePairFilter requires a valid config object');
    }

    // Validate optional Route B filter if provided
    if (gateSimilarityFilter !== null) {
      validateDependency(gateSimilarityFilter, 'IGateSimilarityFilter', logger, {
        requiredMethods: ['filterPairs'],
      });
    }

    // Validate optional Route C filter if provided
    if (behavioralPrescanFilter !== null) {
      validateDependency(
        behavioralPrescanFilter,
        'IBehavioralPrescanFilter',
        logger,
        {
          requiredMethods: ['filterPairs'],
        }
      );
    }

    this.#validateConfigThresholds(config, logger);

    this.#config = config;
    this.#logger = logger;
    this.#gateSimilarityFilter = gateSimilarityFilter;
    this.#behavioralPrescanFilter = behavioralPrescanFilter;
  }

  /**
   * Filter prototypes to candidate pairs based on structural similarity.
   *
   * When enableMultiRouteFiltering is true (v2.1), uses three routes:
   * - Route A: Weight-vector similarity (original)
   * - Route B: Gate-based similarity (requires gateSimilarityFilter)
   * - Route C: Behavioral prescan (requires behavioralPrescanFilter)
   *
   * @param {Array<object>} prototypes - Array of prototype objects with weights property
   * @returns {{candidates: Array<CandidatePair>, stats: object}} Candidate pairs with filtering statistics
   */
  /**
   * Filter prototypes to candidate pairs based on structural similarity.
   *
   * When enableMultiRouteFiltering is true (v2.1), uses three routes:
   * - Route A: Weight-vector similarity (original)
   * - Route B: Gate-based similarity (requires gateSimilarityFilter)
   * - Route C: Behavioral prescan (requires behavioralPrescanFilter)
   *
   * @param {Array<object>} prototypes - Array of prototype objects with weights property
   * @param {Function|null} [onProgress=null] - Optional progress callback (called with {pairsProcessed, totalPairs})
   * @returns {Promise<{candidates: Array<CandidatePair>, stats: object}>} Candidate pairs with filtering statistics
   */
  async filterCandidates(prototypes, onProgress = null) {
    // Defensive: handle invalid input
    if (!Array.isArray(prototypes)) {
      this.#logger.warn(
        'CandidatePairFilter.filterCandidates: Invalid input, expected array'
      );
      return {
        candidates: [],
        stats: this.#buildEmptyStats(),
      };
    }

    // Filter to prototypes with valid weights
    const validPrototypes = prototypes.filter((p) => this.#hasValidWeights(p));

    if (validPrototypes.length < 2) {
      this.#logger.debug(
        `CandidatePairFilter: Fewer than 2 valid prototypes (${validPrototypes.length}), no pairs possible`
      );
      return {
        candidates: [],
        stats: {
          ...this.#buildEmptyStats(),
          prototypesWithValidWeights: validPrototypes.length,
        },
      };
    }

    // Compute total possible pairs
    const totalPossiblePairs =
      (validPrototypes.length * (validPrototypes.length - 1)) / 2;

    // Route A: Weight-vector similarity (original filtering)
    const routeAResult = await this.#filterByWeightSimilarity(validPrototypes, totalPossiblePairs, onProgress);

    // If multi-route filtering is disabled, return Route A results only
    if (!this.#config.enableMultiRouteFiltering) {
      return {
        candidates: routeAResult.candidates,
        stats: {
          totalPossiblePairs,
          passedFiltering: routeAResult.candidates.length,
          rejectedByActiveAxisOverlap: routeAResult.rejectedByActiveAxisOverlap,
          rejectedBySignAgreement: routeAResult.rejectedBySignAgreement,
          rejectedByCosineSimilarity: routeAResult.rejectedByCosineSimilarity,
          prototypesWithValidWeights: validPrototypes.length,
        },
      };
    }

    // Multi-route filtering (v2.1)
    // Get pairs rejected by Route A for Route B and C processing
    const routeARejectedPairs = this.#getRejectedPairs(
      validPrototypes,
      routeAResult.passedPairKeys
    );

    // Route B: Gate-based similarity (if filter provided)
    let routeBResult = { candidates: [], stats: { passed: 0, rejected: 0 } };
    if (this.#gateSimilarityFilter !== null) {
      routeBResult = this.#gateSimilarityFilter.filterPairs(routeARejectedPairs);
    }

    // Route C: Behavioral prescan (if filter provided)
    // Only process pairs that failed both Route A and Route B
    let routeCResult = { candidates: [], stats: { passed: 0, rejected: 0, skipped: 0 } };
    if (this.#behavioralPrescanFilter !== null) {
      const routeBPassedKeys = new Set(
        routeBResult.candidates.map((c) => this.#makePairKey(c.prototypeA, c.prototypeB))
      );
      const routeCInputPairs = routeARejectedPairs.filter(
        (p) => !routeBPassedKeys.has(this.#makePairKey(p.prototypeA, p.prototypeB))
      );
      routeCResult = this.#behavioralPrescanFilter.filterPairs(routeCInputPairs);
    }

    // Merge and deduplicate candidates from all routes
    const mergedCandidates = this.#mergeCandidates(
      routeAResult.candidates,
      routeBResult.candidates,
      routeCResult.candidates
    );

    this.#logger.debug(
      `CandidatePairFilter: Multi-route results - Route A: ${routeAResult.candidates.length}, ` +
        `Route B: ${routeBResult.candidates.length}, Route C: ${routeCResult.candidates.length}, ` +
        `Total: ${mergedCandidates.length}`
    );

    return {
      candidates: mergedCandidates,
      stats: {
        totalPossiblePairs,
        passedFiltering: mergedCandidates.length,
        rejectedByActiveAxisOverlap: routeAResult.rejectedByActiveAxisOverlap,
        rejectedBySignAgreement: routeAResult.rejectedBySignAgreement,
        rejectedByCosineSimilarity: routeAResult.rejectedByCosineSimilarity,
        prototypesWithValidWeights: validPrototypes.length,
        routeStats: {
          routeA: {
            passed: routeAResult.candidates.length,
            rejected:
              routeAResult.rejectedByActiveAxisOverlap +
              routeAResult.rejectedBySignAgreement +
              routeAResult.rejectedByCosineSimilarity,
          },
          routeB: {
            passed: routeBResult.stats.passed,
            rejected: routeBResult.stats.rejected,
            byImplication: routeBResult.stats.byImplication || 0,
            byOverlap: routeBResult.stats.byOverlap || 0,
          },
          routeC: {
            passed: routeCResult.stats.passed,
            rejected: routeCResult.stats.rejected,
            skipped: routeCResult.stats.skipped || 0,
          },
        },
      },
    };
  }

  /**
   * Filter prototypes using Route A (weight-vector similarity).
   *
   * @param {Array<object>} validPrototypes - Prototypes with valid weights
   * @returns {object} Route A results with candidates and rejection counts
   */
  /**
   * Filter prototypes using Route A (weight-vector similarity).
   *
   * @param {Array<object>} validPrototypes - Prototypes with valid weights
   * @param {number} totalPossiblePairs - Total number of pairs for progress reporting
   * @param {Function|null} onProgress - Optional progress callback
   * @returns {Promise<object>} Route A results with candidates and rejection counts
   */
  async #filterByWeightSimilarity(validPrototypes, totalPossiblePairs, onProgress) {
    const CHUNK_SIZE = 10;
    const candidates = [];
    const passedPairKeys = new Set();
    const {
      candidateMinActiveAxisOverlap,
      candidateMinSignAgreement,
      candidateMinCosineSimilarity,
    } = this.#config;

    let rejectedByActiveAxisOverlap = 0;
    let rejectedBySignAgreement = 0;
    let rejectedByCosineSimilarity = 0;
    let pairsProcessed = 0;

    for (let i = 0; i < validPrototypes.length; i++) {
      for (let j = i + 1; j < validPrototypes.length; j++) {
        const prototypeA = validPrototypes[i];
        const prototypeB = validPrototypes[j];

        const metrics = this.#computePairMetrics(prototypeA, prototypeB);

        if (metrics.activeAxisOverlap < candidateMinActiveAxisOverlap) {
          rejectedByActiveAxisOverlap++;
        } else if (metrics.signAgreement < candidateMinSignAgreement) {
          rejectedBySignAgreement++;
        } else if (metrics.weightCosineSimilarity < candidateMinCosineSimilarity) {
          rejectedByCosineSimilarity++;
        } else {
          const pairKey = this.#makePairKey(prototypeA, prototypeB);
          passedPairKeys.add(pairKey);

          candidates.push({
            prototypeA,
            prototypeB,
            candidateMetrics: metrics,
            selectedBy: 'routeA',
            routeMetrics: {
              activeAxisOverlap: metrics.activeAxisOverlap,
              signAgreement: metrics.signAgreement,
              weightCosineSimilarity: metrics.weightCosineSimilarity,
            },
          });
        }

        pairsProcessed++;

        // Yield to event loop after each chunk
        if (pairsProcessed % CHUNK_SIZE === 0) {
          await this.#yieldToEventLoop();
          onProgress?.({ pairsProcessed, totalPairs: totalPossiblePairs });
        }
      }
    }

    // Final progress update with yield to allow UI repaint
    if (onProgress && pairsProcessed > 0) {
      await this.#yieldToEventLoop();
      onProgress({ pairsProcessed, totalPairs: totalPossiblePairs });
    }

    this.#logger.debug(
      `CandidatePairFilter Route A: ${candidates.length} passed ` +
        `(rejected: ${rejectedByActiveAxisOverlap} axis, ${rejectedBySignAgreement} sign, ${rejectedByCosineSimilarity} cosine)`
    );

    return {
      candidates,
      passedPairKeys,
      rejectedByActiveAxisOverlap,
      rejectedBySignAgreement,
      rejectedByCosineSimilarity,
    };
  }

  /**
   * Get pairs rejected by Route A for processing by Routes B and C.
   *
   * @param {Array<object>} validPrototypes - All valid prototypes
   * @param {Set<string>} passedPairKeys - Keys of pairs that passed Route A
   * @returns {Array<{prototypeA: object, prototypeB: object, candidateMetrics: object}>} Rejected pairs
   */
  #getRejectedPairs(validPrototypes, passedPairKeys) {
    const rejectedPairs = [];

    for (let i = 0; i < validPrototypes.length; i++) {
      for (let j = i + 1; j < validPrototypes.length; j++) {
        const prototypeA = validPrototypes[i];
        const prototypeB = validPrototypes[j];
        const pairKey = this.#makePairKey(prototypeA, prototypeB);

        if (!passedPairKeys.has(pairKey)) {
          const metrics = this.#computePairMetrics(prototypeA, prototypeB);
          rejectedPairs.push({
            prototypeA,
            prototypeB,
            candidateMetrics: metrics,
          });
        }
      }
    }

    return rejectedPairs;
  }

  /**
   * Merge candidates from all routes, ensuring no duplicates.
   *
   * @param {Array<object>} routeACandidates - Candidates from Route A
   * @param {Array<object>} routeBCandidates - Candidates from Route B
   * @param {Array<object>} routeCCandidates - Candidates from Route C
   * @returns {Array<object>} Deduplicated merged candidates
   */
  #mergeCandidates(routeACandidates, routeBCandidates, routeCCandidates) {
    // Route A candidates have priority (they passed the original, stricter filter)
    const seen = new Set();
    const merged = [];

    // Add Route A candidates first
    for (const candidate of routeACandidates) {
      const key = this.#makePairKey(candidate.prototypeA, candidate.prototypeB);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(candidate);
      }
    }

    // Add Route B candidates
    for (const candidate of routeBCandidates) {
      const key = this.#makePairKey(candidate.prototypeA, candidate.prototypeB);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(candidate);
      }
    }

    // Add Route C candidates
    for (const candidate of routeCCandidates) {
      const key = this.#makePairKey(candidate.prototypeA, candidate.prototypeB);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(candidate);
      }
    }

    return merged;
  }

  /**
   * Create a unique key for a prototype pair (order-independent).
   *
   * @param {object} prototypeA - First prototype
   * @param {object} prototypeB - Second prototype
   * @returns {string} Unique pair key
   */
  #makePairKey(prototypeA, prototypeB) {
    const idA = prototypeA?.id || '';
    const idB = prototypeB?.id || '';
    // Ensure consistent ordering for the key
    return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
  }

  /**
   * Build empty stats object for edge cases.
   *
   * @returns {object} Empty statistics object
   */
  #buildEmptyStats() {
    const baseStats = {
      totalPossiblePairs: 0,
      passedFiltering: 0,
      rejectedByActiveAxisOverlap: 0,
      rejectedBySignAgreement: 0,
      rejectedByCosineSimilarity: 0,
      prototypesWithValidWeights: 0,
    };

    if (this.#config.enableMultiRouteFiltering) {
      baseStats.routeStats = {
        routeA: { passed: 0, rejected: 0 },
        routeB: { passed: 0, rejected: 0, byImplication: 0, byOverlap: 0 },
        routeC: { passed: 0, rejected: 0, skipped: 0 },
      };
    }

    return baseStats;
  }

  /**
   * Compute all similarity metrics for a prototype pair.
   *
   * @param {object} prototypeA - First prototype
   * @param {object} prototypeB - Second prototype
   * @returns {CandidateMetrics} Computed metrics
   */
  #computePairMetrics(prototypeA, prototypeB) {
    const weightsA = prototypeA.weights || {};
    const weightsB = prototypeB.weights || {};

    const activeA = this.#getActiveAxes(weightsA);
    const activeB = this.#getActiveAxes(weightsB);

    const activeAxisOverlap = this.#computeJaccard(activeA, activeB);

    // Shared axes for sign agreement
    const sharedAxes = new Set([...activeA].filter((axis) => activeB.has(axis)));
    const signAgreement = this.#computeSignAgreement(
      weightsA,
      weightsB,
      sharedAxes
    );

    const weightCosineSimilarity = this.#computeCosineSimilarity(
      weightsA,
      weightsB
    );

    return {
      activeAxisOverlap,
      signAgreement,
      weightCosineSimilarity,
    };
  }

  /**
   * Extract active axes from a prototype's weights.
   * An axis is "active" if its absolute weight >= epsilon.
   *
   * @param {object} weights - Prototype weights object (axis -> weight)
   * @returns {Set<string>} Set of axis names with |weight| >= epsilon
   */
  #getActiveAxes(weights) {
    const epsilon = this.#config.activeAxisEpsilon;
    const activeAxes = new Set();

    for (const [axis, weight] of Object.entries(weights)) {
      if (typeof weight === 'number' && Math.abs(weight) >= epsilon) {
        activeAxes.add(axis);
      }
    }

    return activeAxes;
  }

  /**
   * Compute Jaccard similarity of two sets.
   * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
   *
   * @param {Set<string>} setA - First set of axis names
   * @param {Set<string>} setB - Second set of axis names
   * @returns {number} Jaccard index [0, 1], configurable for empty sets
   */
  #computeJaccard(setA, setB) {
    if (setA.size === 0 && setB.size === 0) {
      const emptyValue = this.#config.jaccardEmptySetValue ?? 1.0;
      return emptyValue;
    }

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  /**
   * Compute sign with soft threshold for near-zero weights.
   *
   * @param {number} weight - The weight value
   * @returns {-1|0|1} Soft sign: -1 (negative), 0 (neutral), 1 (positive)
   */
  #softSign(weight) {
    const threshold = this.#config.softSignThreshold ?? 0;
    if (threshold === 0) {
      return Math.sign(weight);
    }
    if (Math.abs(weight) < threshold) {
      return 0;
    }
    return Math.sign(weight);
  }

  /**
   * Compute sign agreement for shared axes.
   * Returns the ratio of shared axes where both weights have the same sign.
   *
   * @param {object} weightsA - First prototype's weights
   * @param {object} weightsB - Second prototype's weights
   * @param {Set<string>} sharedAxes - Axes present in both active sets
   * @returns {number} Ratio of matching signs [0, 1], returns 0 if no shared axes
   */
  #computeSignAgreement(weightsA, weightsB, sharedAxes) {
    if (sharedAxes.size === 0) {
      return 0;
    }

    let matchingCount = 0;
    for (const axis of sharedAxes) {
      const weightA = weightsA[axis];
      const weightB = weightsB[axis];

      // Signs match if both positive, both negative, or both zero
      const signA = this.#softSign(weightA);
      const signB = this.#softSign(weightB);

      if (signA === signB) {
        matchingCount++;
      }
    }

    return matchingCount / sharedAxes.size;
  }

  /**
   * Compute cosine similarity of weight vectors.
   * cosine(A, B) = (A · B) / (|A| * |B|)
   *
   * Uses the union of all axes from both prototypes.
   * Missing axes in either are treated as 0.
   *
   * @param {object} weightsA - First prototype's weights
   * @param {object} weightsB - Second prototype's weights
   * @returns {number} Cosine similarity [-1, 1], returns 0 for zero-norm vectors
   */
  #computeCosineSimilarity(weightsA, weightsB) {
    // Get all unique axes
    const allAxes = new Set([
      ...Object.keys(weightsA),
      ...Object.keys(weightsB),
    ]);

    if (allAxes.size === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normASq = 0;
    let normBSq = 0;

    for (const axis of allAxes) {
      const a = typeof weightsA[axis] === 'number' ? weightsA[axis] : 0;
      const b = typeof weightsB[axis] === 'number' ? weightsB[axis] : 0;

      dotProduct += a * b;
      normASq += a * a;
      normBSq += b * b;
    }

    const normA = Math.sqrt(normASq);
    const normB = Math.sqrt(normBSq);

    // Avoid division by zero
    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Check if a prototype has valid weights.
   *
   * @param {object} prototype - Prototype to check
   * @returns {boolean} True if prototype has a non-empty weights object
   */
  #hasValidWeights(prototype) {
    if (!prototype || typeof prototype !== 'object') {
      return false;
    }

    const weights = prototype.weights;
    if (!weights || typeof weights !== 'object') {
      return false;
    }

    // Must have at least one numeric weight
    return Object.values(weights).some((v) => typeof v === 'number');
  }

  /**
   * Validate that config has required numeric thresholds.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   */
  #validateConfigThresholds(config, logger) {
    const requiredKeys = [
      'activeAxisEpsilon',
      'candidateMinActiveAxisOverlap',
      'candidateMinSignAgreement',
      'candidateMinCosineSimilarity',
    ];

    for (const key of requiredKeys) {
      if (typeof config[key] !== 'number') {
        logger.error(
          `CandidatePairFilter: Missing or invalid config.${key} (expected number)`
        );
        throw new Error(
          `CandidatePairFilter config requires numeric ${key}`
        );
      }
    }
  }
}

export default CandidatePairFilter;
