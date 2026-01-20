/**
 * @file CandidatePairFilter - Stage A candidate filtering for prototype overlap analysis
 * @description Identifies potentially overlapping prototype pairs based on structural
 * similarity metrics (active axis overlap, sign agreement, cosine similarity) before
 * expensive behavioral sampling.
 * @see specs/prototype-overlap-analyzer.md
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
 */

/**
 * Filters prototype pairs to candidates based on structural similarity.
 *
 * Stage A of the Prototype Overlap Analyzer pipeline.
 * Uses fast structural metrics to prune the O(n^2) pair space before
 * expensive behavioral sampling in Stage B.
 */
class CandidatePairFilter {
  #config;
  #logger;

  /**
   * Constructs a new CandidatePairFilter instance.
   *
   * @param {object} deps - Dependencies for the filter
   * @param {object} deps.config - Configuration with Stage A thresholds
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance
   */
  constructor({ config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    if (!config || typeof config !== 'object') {
      logger.error('CandidatePairFilter: Missing or invalid config');
      throw new Error('CandidatePairFilter requires a valid config object');
    }

    this.#validateConfigThresholds(config, logger);

    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Filter prototypes to candidate pairs based on structural similarity.
   *
   * @param {Array<object>} prototypes - Array of prototype objects with weights property
   * @returns {Array<CandidatePair>} Candidate pairs meeting all thresholds
   */
  filterCandidates(prototypes) {
    // Defensive: handle invalid input
    if (!Array.isArray(prototypes)) {
      this.#logger.warn(
        'CandidatePairFilter.filterCandidates: Invalid input, expected array'
      );
      return {
        candidates: [],
        stats: {
          totalPossiblePairs: 0,
          passedFiltering: 0,
          rejectedByActiveAxisOverlap: 0,
          rejectedBySignAgreement: 0,
          rejectedByCosineSimilarity: 0,
          prototypesWithValidWeights: 0,
        },
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
          totalPossiblePairs: 0,
          passedFiltering: 0,
          rejectedByActiveAxisOverlap: 0,
          rejectedBySignAgreement: 0,
          rejectedByCosineSimilarity: 0,
          prototypesWithValidWeights: validPrototypes.length,
        },
      };
    }

    const candidates = [];
    const {
      candidateMinActiveAxisOverlap,
      candidateMinSignAgreement,
      candidateMinCosineSimilarity,
    } = this.#config;

    // Track rejection statistics
    let rejectedByActiveAxisOverlap = 0;
    let rejectedBySignAgreement = 0;
    let rejectedByCosineSimilarity = 0;

    // Generate all unique pairs (i, j) where i < j
    // This ensures no duplicates and no self-pairs
    const totalPossiblePairs =
      (validPrototypes.length * (validPrototypes.length - 1)) / 2;

    for (let i = 0; i < validPrototypes.length; i++) {
      for (let j = i + 1; j < validPrototypes.length; j++) {
        const prototypeA = validPrototypes[i];
        const prototypeB = validPrototypes[j];

        const metrics = this.#computePairMetrics(prototypeA, prototypeB);

        // Track rejections by threshold - check in order, track first failure
        // Note: A pair failing multiple thresholds is only counted once (first failure)
        if (metrics.activeAxisOverlap < candidateMinActiveAxisOverlap) {
          rejectedByActiveAxisOverlap++;
          continue;
        }

        if (metrics.signAgreement < candidateMinSignAgreement) {
          rejectedBySignAgreement++;
          continue;
        }

        if (metrics.weightCosineSimilarity < candidateMinCosineSimilarity) {
          rejectedByCosineSimilarity++;
          continue;
        }

        // Passed all thresholds
        candidates.push({
          prototypeA,
          prototypeB,
          candidateMetrics: metrics,
        });
      }
    }

    this.#logger.debug(
      `CandidatePairFilter: Found ${candidates.length} candidate pairs from ${validPrototypes.length} prototypes ` +
        `(rejected: ${rejectedByActiveAxisOverlap} axis overlap, ${rejectedBySignAgreement} sign agreement, ${rejectedByCosineSimilarity} cosine sim)`
    );

    return {
      candidates,
      stats: {
        totalPossiblePairs,
        passedFiltering: candidates.length,
        rejectedByActiveAxisOverlap,
        rejectedBySignAgreement,
        rejectedByCosineSimilarity,
        prototypesWithValidWeights: validPrototypes.length,
      },
    };
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
   * @returns {number} Jaccard index [0, 1], returns 0 for empty sets
   */
  #computeJaccard(setA, setB) {
    if (setA.size === 0 && setB.size === 0) {
      return 0; // No meaningful overlap for empty sets
    }

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
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
      const signA = Math.sign(weightA);
      const signB = Math.sign(weightB);

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
