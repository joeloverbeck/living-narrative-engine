/**
 * @file GateSimilarityFilter - Route B candidate selection based on gate structure similarity
 * @description Identifies prototype pairs with similar gate constraints that may overlap
 * despite having different weight vectors. Uses gate interval analysis and implication
 * checking to find candidates missed by weight-only filtering.
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} GateSimilarityResult
 * @property {boolean} passes - Whether the pair passes Route B filtering
 * @property {'gate_implication' | 'gate_overlap' | null} reason - Reason for selection
 * @property {object} [implication] - Implication analysis result (if reason is gate_implication)
 * @property {number} [overlapRatio] - Gate interval overlap ratio (if reason is gate_overlap)
 */

/**
 * Filters prototype pairs based on gate structure similarity (Route B).
 *
 * Route B complements Route A (weight-vector similarity) by identifying pairs with:
 * 1. Gate implication: A's gates imply B's gates or vice versa (non-vacuous)
 * 2. Gate interval overlap: Significant overlap in gate-constrained axis ranges
 *
 * This catches pairs that have different weight vectors but fire under similar conditions.
 */
class GateSimilarityFilter {
  #config;
  #logger;
  #gateConstraintExtractor;
  #gateImplicationEvaluator;

  /**
   * Constructs a new GateSimilarityFilter instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.config - Configuration with Route B thresholds
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance
   * @param {object} deps.gateConstraintExtractor - GateConstraintExtractor service
   * @param {object} deps.gateImplicationEvaluator - GateImplicationEvaluator service
   */
  constructor({
    config,
    logger,
    gateConstraintExtractor,
    gateImplicationEvaluator,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    if (!config || typeof config !== 'object') {
      logger.error('GateSimilarityFilter: Missing or invalid config');
      throw new Error('GateSimilarityFilter requires a valid config object');
    }

    validateDependency(
      gateConstraintExtractor,
      'IGateConstraintExtractor',
      logger,
      {
        requiredMethods: ['extract'],
      }
    );

    validateDependency(
      gateImplicationEvaluator,
      'IGateImplicationEvaluator',
      logger,
      {
        requiredMethods: ['evaluate'],
      }
    );

    this.#validateConfigRequirements(config, logger);

    this.#config = config;
    this.#logger = logger;
    this.#gateConstraintExtractor = gateConstraintExtractor;
    this.#gateImplicationEvaluator = gateImplicationEvaluator;
  }

  /**
   * Check if a prototype pair qualifies via gate similarity.
   *
   * @param {object} prototypeA - First prototype with gates property
   * @param {object} prototypeB - Second prototype with gates property
   * @returns {GateSimilarityResult} Result indicating if pair passes and why
   */
  checkGateSimilarity(prototypeA, prototypeB) {
    const gatesA = prototypeA?.gates || [];
    const gatesB = prototypeB?.gates || [];

    // Extract gate intervals
    const intervalsA = this.#gateConstraintExtractor.extract(gatesA);
    const intervalsB = this.#gateConstraintExtractor.extract(gatesB);

    // Check 1: Gate implication (most reliable indicator)
    const implicationResult = this.#checkGateImplication(
      intervalsA,
      intervalsB
    );
    if (implicationResult.passes) {
      return implicationResult;
    }

    // Check 2: Gate interval overlap ratio
    const overlapResult = this.#checkGateIntervalOverlap(
      intervalsA,
      intervalsB
    );
    // Always return the overlap result (includes overlapRatio even when not passing)
    return overlapResult;
  }

  /**
   * Filter a list of rejected pairs through Route B.
   *
   * @param {Array<{prototypeA: object, prototypeB: object}>} pairs - Pairs rejected by Route A
   * @returns {{candidates: Array<object>, stats: object}} Candidates that pass Route B with stats
   */
  filterPairs(pairs) {
    if (!Array.isArray(pairs)) {
      this.#logger.warn(
        'GateSimilarityFilter.filterPairs: Invalid input, expected array'
      );
      return {
        candidates: [],
        stats: { passed: 0, rejected: 0, byImplication: 0, byOverlap: 0 },
      };
    }

    const candidates = [];
    let byImplication = 0;
    let byOverlap = 0;

    for (const pair of pairs) {
      const result = this.checkGateSimilarity(pair.prototypeA, pair.prototypeB);

      if (result.passes) {
        candidates.push({
          prototypeA: pair.prototypeA,
          prototypeB: pair.prototypeB,
          candidateMetrics: pair.candidateMetrics || {},
          selectedBy: 'routeB',
          routeMetrics: {
            reason: result.reason,
            implication: result.implication,
            overlapRatio: result.overlapRatio,
          },
        });

        if (result.reason === 'gate_implication') {
          byImplication++;
        } else if (result.reason === 'gate_overlap') {
          byOverlap++;
        }
      }
    }

    this.#logger.debug(
      `GateSimilarityFilter: ${candidates.length}/${pairs.length} pairs passed ` +
        `(${byImplication} by implication, ${byOverlap} by overlap)`
    );

    return {
      candidates,
      stats: {
        passed: candidates.length,
        rejected: pairs.length - candidates.length,
        byImplication,
        byOverlap,
      },
    };
  }

  /**
   * Check if gate implication selects this pair.
   *
   * @param {object} intervalsA - Extracted intervals for prototype A
   * @param {object} intervalsB - Extracted intervals for prototype B
   * @returns {GateSimilarityResult} Result with implication details
   */
  #checkGateImplication(intervalsA, intervalsB) {
    // Only use implication for fully parsed gates
    if (
      intervalsA.parseStatus !== 'complete' ||
      intervalsB.parseStatus !== 'complete'
    ) {
      return { passes: false, reason: null };
    }

    const implication = this.#gateImplicationEvaluator.evaluate(
      intervalsA.intervals,
      intervalsB.intervals
    );

    // Select if there's a non-vacuous implication in either direction
    if (
      !implication.isVacuous &&
      (implication.A_implies_B || implication.B_implies_A)
    ) {
      return {
        passes: true,
        reason: 'gate_implication',
        implication: {
          A_implies_B: implication.A_implies_B,
          B_implies_A: implication.B_implies_A,
          relation: implication.relation,
        },
      };
    }

    return { passes: false, reason: null };
  }

  /**
   * Check if gate interval overlap ratio selects this pair.
   *
   * @param {object} intervalsA - Extracted intervals for prototype A
   * @param {object} intervalsB - Extracted intervals for prototype B
   * @returns {GateSimilarityResult} Result with overlap ratio
   */
  #checkGateIntervalOverlap(intervalsA, intervalsB) {
    const overlapRatio = this.#computeGateIntervalOverlap(
      intervalsA,
      intervalsB
    );

    if (overlapRatio >= this.#config.gateBasedMinIntervalOverlap) {
      return {
        passes: true,
        reason: 'gate_overlap',
        overlapRatio,
      };
    }

    return { passes: false, reason: null, overlapRatio };
  }

  /**
   * Compute the overlap ratio between gate interval sets.
   *
   * Uses Jaccard-like metric: |intersection| / |union| of axis intervals,
   * where intersection considers the overlap of bounds on each axis.
   *
   * @param {object} intervalsA - Extracted intervals for prototype A
   * @param {object} intervalsB - Extracted intervals for prototype B
   * @returns {number} Overlap ratio [0, 1]
   */
  #computeGateIntervalOverlap(intervalsA, intervalsB) {
    const mapA = intervalsA.intervals;
    const mapB = intervalsB.intervals;

    // Handle empty maps
    if ((!mapA || mapA.size === 0) && (!mapB || mapB.size === 0)) {
      // Both have no constraints - they overlap completely (unconstrained)
      return 1.0;
    }

    if (!mapA || mapA.size === 0 || !mapB || mapB.size === 0) {
      // One is unconstrained, one is constrained - partial overlap
      return 0.5;
    }

    // Collect all constrained axes
    const allAxes = new Set([...mapA.keys(), ...mapB.keys()]);

    if (allAxes.size === 0) {
      return 1.0;
    }

    let overlapSum = 0;
    let axisCount = 0;

    for (const axis of allAxes) {
      const intervalA = mapA.get(axis);
      const intervalB = mapB.get(axis);

      // If one side doesn't constrain this axis, treat as full range [-1, 1]
      const boundA = intervalA || { lower: -1, upper: 1 };
      const boundB = intervalB || { lower: -1, upper: 1 };

      const axisOverlap = this.#computeIntervalOverlap(boundA, boundB);
      overlapSum += axisOverlap;
      axisCount++;
    }

    return axisCount > 0 ? overlapSum / axisCount : 0;
  }

  /**
   * Compute overlap ratio for a single axis interval pair.
   *
   * @param {{lower: number, upper: number}} boundA - Interval A
   * @param {{lower: number, upper: number}} boundB - Interval B
   * @returns {number} Overlap ratio [0, 1]
   */
  #computeIntervalOverlap(boundA, boundB) {
    const intersectLower = Math.max(boundA.lower, boundB.lower);
    const intersectUpper = Math.min(boundA.upper, boundB.upper);

    // No intersection
    if (intersectLower > intersectUpper) {
      return 0;
    }

    const intersectLength = intersectUpper - intersectLower;

    // Union length (avoiding double-count of intersection)
    const unionLower = Math.min(boundA.lower, boundB.lower);
    const unionUpper = Math.max(boundA.upper, boundB.upper);
    const unionLength = unionUpper - unionLower;

    if (unionLength <= 0) {
      return 0;
    }

    return intersectLength / unionLength;
  }

  /**
   * Validate required config properties.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   */
  #validateConfigRequirements(config, logger) {
    if (typeof config.gateBasedMinIntervalOverlap !== 'number') {
      logger.error(
        'GateSimilarityFilter: Missing or invalid config.gateBasedMinIntervalOverlap'
      );
      throw new Error(
        'GateSimilarityFilter config requires numeric gateBasedMinIntervalOverlap'
      );
    }
  }
}

export default GateSimilarityFilter;
