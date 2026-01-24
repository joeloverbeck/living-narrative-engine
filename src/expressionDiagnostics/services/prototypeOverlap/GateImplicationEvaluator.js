/**
 * @file GateImplicationEvaluator service for evaluating gate implication relationships.
 * Part of PROREDANAV2-008: Determines whether one prototype's gate constraints
 * logically imply another's using interval subset analysis.
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} AxisInterval
 * @property {number|null} lower - Lower bound (null = unbounded below / -∞)
 * @property {number|null} upper - Upper bound (null = unbounded above / +∞)
 * @property {boolean} unsatisfiable - True if interval is empty (lower > upper)
 */

/**
 * @typedef {object} AxisEvidence
 * @property {string} axis - The axis name
 * @property {AxisInterval} intervalA - Interval from prototype A
 * @property {AxisInterval} intervalB - Interval from prototype B
 * @property {boolean} A_subset_B - Whether A's interval is a subset of B's
 * @property {boolean} B_subset_A - Whether B's interval is a subset of A's
 */

/**
 * @typedef {object} ImplicationResult
 * @property {boolean} A_implies_B - True if A's gates imply B's gates
 * @property {boolean} B_implies_A - True if B's gates imply A's gates
 * @property {string[]} counterExampleAxes - Axes where implication fails
 * @property {AxisEvidence[]} evidence - Per-axis comparison details
 * @property {'equal'|'narrower'|'wider'|'disjoint'|'overlapping'} relation - Overall relationship
 * @property {boolean} isVacuous - True if implication is vacuously true due to unsatisfiable intervals
 * @property {string} [vacuousReason] - Reason for vacuous truth (only present when isVacuous is true)
 */

/**
 * @typedef {object} ASTImplicationResult
 * @property {boolean} implies - Whether A → B
 * @property {boolean} isVacuous - Whether implication is vacuously true
 * @property {boolean} parseComplete - Whether both gates fully parsed
 * @property {'deterministic' | 'probabilistic' | 'unknown'} confidence - Confidence level
 * @property {string[]} parseErrors - Any parsing errors encountered
 */

/**
 * Evaluates implication relationships between gate constraint sets.
 *
 * Given two sets of per-axis intervals (from GateConstraintExtractor),
 * determines whether satisfying one prototype's gates necessarily
 * satisfies the other's gates.
 *
 * Core Logic:
 * - A implies B iff A's constraint set is a SUBSET of B's
 * - For intervals: A ⊆ B when A.lower >= B.lower AND A.upper <= B.upper
 * - null bounds represent unbounded constraints (-∞ or +∞)
 * - Unsatisfiable (empty) intervals vacuously imply anything
 */
class GateImplicationEvaluator {
  #gateASTNormalizer;
  #logger;

  /**
   * Constructs a new GateImplicationEvaluator instance.
   *
   * @param {object} deps - Dependencies object
   * @param {import('./GateASTNormalizer.js').default} deps.gateASTNormalizer - AST normalizer for gate parsing
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance
   */
  constructor({ gateASTNormalizer, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(gateASTNormalizer, 'IGateASTNormalizer', logger, {
      requiredMethods: ['parse', 'checkImplication', 'toString'],
    });

    this.#gateASTNormalizer = gateASTNormalizer;
    this.#logger = logger;
  }

  /**
   * Evaluate implication relationship between two gate constraint sets.
   *
   * @param {Map<string, AxisInterval>} intervalsA - Intervals from prototype A
   * @param {Map<string, AxisInterval>} intervalsB - Intervals from prototype B
   * @returns {ImplicationResult} Implication analysis result
   */
  evaluate(intervalsA, intervalsB) {
    // Validate inputs defensively
    const mapA = this.#ensureMap(intervalsA, 'intervalsA');
    const mapB = this.#ensureMap(intervalsB, 'intervalsB');

    // Check for unsatisfiable intervals (empty sets)
    const aIsUnsatisfiable = this.#hasUnsatisfiableInterval(mapA);
    const bIsUnsatisfiable = this.#hasUnsatisfiableInterval(mapB);

    // Vacuous truth: empty set implies anything
    if (aIsUnsatisfiable && bIsUnsatisfiable) {
      this.#logger.debug(
        'GateImplicationEvaluator: Both intervals unsatisfiable - mutual implication'
      );
      return this.#buildVacuousResult(true, true, 'equal');
    }

    if (aIsUnsatisfiable) {
      this.#logger.debug(
        'GateImplicationEvaluator: A is unsatisfiable - vacuously implies B'
      );
      return this.#buildVacuousResult(true, false, 'narrower');
    }

    if (bIsUnsatisfiable) {
      this.#logger.debug(
        'GateImplicationEvaluator: B is unsatisfiable - vacuously implied by A'
      );
      return this.#buildVacuousResult(false, true, 'wider');
    }

    // Collect all axes from both maps
    const allAxes = new Set([...mapA.keys(), ...mapB.keys()]);

    // Evaluate each axis
    const evidence = [];
    const counterExampleAxes = [];
    let A_implies_B = true;
    let B_implies_A = true;

    for (const axis of allAxes) {
      const intervalA = mapA.get(axis) ?? this.#getUnconstrainedInterval();
      const intervalB = mapB.get(axis) ?? this.#getUnconstrainedInterval();

      const A_subset_B = this.#isSubset(intervalA, intervalB);
      const B_subset_A = this.#isSubset(intervalB, intervalA);

      evidence.push({
        axis,
        intervalA: { ...intervalA },
        intervalB: { ...intervalB },
        A_subset_B,
        B_subset_A,
      });

      if (!A_subset_B) {
        A_implies_B = false;
        counterExampleAxes.push(axis);
      }

      if (!B_subset_A && !counterExampleAxes.includes(axis)) {
        // Track counterexamples for B_implies_A only if not already tracked
        // (to avoid duplicates)
        if (A_subset_B) {
          counterExampleAxes.push(axis);
        }
      }

      if (!B_subset_A) {
        B_implies_A = false;
      }
    }

    // Determine relation type
    const relation = this.#determineRelation(
      A_implies_B,
      B_implies_A,
      evidence
    );

    this.#logger.debug(
      `GateImplicationEvaluator: A→B=${A_implies_B}, B→A=${B_implies_A}, ` +
        `relation=${relation}, counterExamples=${counterExampleAxes.join(',') || 'none'}`
    );

    return {
      A_implies_B,
      B_implies_A,
      counterExampleAxes,
      evidence,
      relation,
      isVacuous: false,
    };
  }

  /**
   * Check if gateA implies gateB using AST-based analysis.
   *
   * @param {object|string|object[]} gateA - Gate definition (any supported format)
   * @param {object|string|object[]} gateB - Gate definition (any supported format)
   * @returns {ASTImplicationResult} Implication result with parse status
   */
  checkImplication(gateA, gateB) {
    const parsedA = this.#gateASTNormalizer.parse(gateA);
    const parsedB = this.#gateASTNormalizer.parse(gateB);
    const parseErrors = [...parsedA.errors, ...parsedB.errors];

    if (!parsedA.parseComplete || !parsedB.parseComplete) {
      this.#logger.debug(
        `GateImplicationEvaluator.checkImplication: Parse incomplete - ` +
          `A=${parsedA.parseComplete}, B=${parsedB.parseComplete}, ` +
          `errors=${parseErrors.join('; ')}`
      );
      return {
        implies: false,
        isVacuous: false,
        parseComplete: false,
        confidence: 'unknown',
        parseErrors,
      };
    }

    const result = this.#gateASTNormalizer.checkImplication(
      parsedA.ast,
      parsedB.ast
    );

    this.#logger.debug(
      `GateImplicationEvaluator.checkImplication: implies=${result.implies}, ` +
        `isVacuous=${result.isVacuous}`
    );

    return {
      implies: result.implies,
      isVacuous: result.isVacuous,
      parseComplete: true,
      confidence: 'deterministic',
      parseErrors: [],
    };
  }

  /**
   * Get human-readable description of a gate.
   *
   * @param {object|string|object[]} gate - Gate definition
   * @returns {string} Human-readable gate string
   */
  describeGate(gate) {
    const parsed = this.#gateASTNormalizer.parse(gate);

    if (!parsed.parseComplete) {
      return `[Unparseable gate: ${parsed.errors.join(', ')}]`;
    }

    return this.#gateASTNormalizer.toString(parsed.ast);
  }

  /**
   * Check if interval A is a subset of interval B.
   *
   * A ⊆ B iff:
   * - A.lower >= B.lower (A's lower bound is at least as high as B's)
   * - A.upper <= B.upper (A's upper bound is at most as high as B's)
   *
   * Null handling:
   * - null lower = -∞ (no lower constraint)
   * - null upper = +∞ (no upper constraint)
   *
   * @param {AxisInterval} intervalA - Interval A
   * @param {AxisInterval} intervalB - Interval B
   * @returns {boolean} True if A is a subset of B
   * @private
   */
  #isSubset(intervalA, intervalB) {
    // Empty set is subset of everything (including empty sets)
    if (intervalA.unsatisfiable) {
      return true;
    }

    // Non-empty set is not subset of empty set
    if (intervalB.unsatisfiable) {
      return false;
    }

    const lowerOk = this.#lowerBoundOk(intervalA.lower, intervalB.lower);
    const upperOk = this.#upperBoundOk(intervalA.upper, intervalB.upper);

    return lowerOk && upperOk;
  }

  /**
   * Check if A's lower bound satisfies A.lower >= B.lower for subset.
   *
   * @param {number|null} aLower - A's lower bound
   * @param {number|null} bLower - B's lower bound
   * @returns {boolean} True if condition satisfied
   * @private
   */
  #lowerBoundOk(aLower, bLower) {
    // B unbounded below (null = -∞) → any A satisfies
    if (bLower === null) {
      return true;
    }

    // A unbounded below but B has bound → A extends lower than B → fails
    if (aLower === null) {
      return false;
    }

    // Both have bounds: A.lower must be >= B.lower
    return aLower >= bLower;
  }

  /**
   * Check if A's upper bound satisfies A.upper <= B.upper for subset.
   *
   * @param {number|null} aUpper - A's upper bound
   * @param {number|null} bUpper - B's upper bound
   * @returns {boolean} True if condition satisfied
   * @private
   */
  #upperBoundOk(aUpper, bUpper) {
    // B unbounded above (null = +∞) → any A satisfies
    if (bUpper === null) {
      return true;
    }

    // A unbounded above but B has bound → A extends higher than B → fails
    if (aUpper === null) {
      return false;
    }

    // Both have bounds: A.upper must be <= B.upper
    return aUpper <= bUpper;
  }

  /**
   * Determine the overall relation type between the two constraint sets.
   *
   * @param {boolean} A_implies_B - Whether A implies B
   * @param {boolean} B_implies_A - Whether B implies A
   * @param {AxisEvidence[]} evidence - Per-axis evidence
   * @returns {'equal'|'narrower'|'wider'|'disjoint'|'overlapping'} Relation type
   * @private
   */
  #determineRelation(A_implies_B, B_implies_A, evidence) {
    // Mutual implication = equivalent constraints
    if (A_implies_B && B_implies_A) {
      return 'equal';
    }

    // A implies B but not vice versa = A is narrower/stricter
    if (A_implies_B && !B_implies_A) {
      return 'narrower';
    }

    // B implies A but not vice versa = A is wider/looser
    if (!A_implies_B && B_implies_A) {
      return 'wider';
    }

    // Neither implies the other - check for disjoint
    const isDisjoint = this.#checkDisjoint(evidence);
    if (isDisjoint) {
      return 'disjoint';
    }

    // Partial overlap with neither being a subset
    return 'overlapping';
  }

  /**
   * Check if two constraint sets are disjoint (no overlapping region).
   *
   * @param {AxisEvidence[]} evidence - Per-axis evidence
   * @returns {boolean} True if disjoint on at least one axis
   * @private
   */
  #checkDisjoint(evidence) {
    for (const e of evidence) {
      // Skip unsatisfiable intervals
      if (e.intervalA.unsatisfiable || e.intervalB.unsatisfiable) {
        continue;
      }

      // Check if intervals are disjoint on this axis
      // Disjoint if: A.upper < B.lower OR B.upper < A.lower
      const aUpper = e.intervalA.upper;
      const aLower = e.intervalA.lower;
      const bUpper = e.intervalB.upper;
      const bLower = e.intervalB.lower;

      // A entirely below B
      if (aUpper !== null && bLower !== null && aUpper < bLower) {
        return true;
      }

      // B entirely below A
      if (bUpper !== null && aLower !== null && bUpper < aLower) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if any interval in the map is unsatisfiable.
   *
   * @param {Map<string, AxisInterval>} intervals - Interval map
   * @returns {boolean} True if any interval is unsatisfiable
   * @private
   */
  #hasUnsatisfiableInterval(intervals) {
    for (const interval of intervals.values()) {
      if (interval.unsatisfiable) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get an unconstrained interval (for missing axes).
   *
   * @returns {AxisInterval} Fully unconstrained interval
   * @private
   */
  #getUnconstrainedInterval() {
    return {
      lower: null,
      upper: null,
      unsatisfiable: false,
    };
  }

  /**
   * Build result for vacuous truth cases (unsatisfiable intervals).
   *
   * @param {boolean} A_implies_B - Whether A implies B
   * @param {boolean} B_implies_A - Whether B implies A
   * @param {'equal'|'narrower'|'wider'} relation - Relation type
   * @returns {ImplicationResult} Vacuous result
   * @private
   */
  #buildVacuousResult(A_implies_B, B_implies_A, relation) {
    return {
      A_implies_B,
      B_implies_A,
      counterExampleAxes: [],
      evidence: [],
      relation,
      isVacuous: true,
      vacuousReason: this.#getVacuousReason(A_implies_B, B_implies_A),
    };
  }

  /**
   * Get the reason for vacuous truth based on implication directions.
   *
   * @param {boolean} A_implies_B - Whether A implies B vacuously
   * @param {boolean} B_implies_A - Whether B implies A vacuously
   * @returns {string} Reason for vacuous truth
   * @private
   */
  #getVacuousReason(A_implies_B, B_implies_A) {
    if (A_implies_B && B_implies_A) {
      return 'both_unsatisfiable';
    }
    if (A_implies_B) {
      return 'a_unsatisfiable';
    }
    return 'b_unsatisfiable';
  }

  /**
   * Ensure input is a Map, converting if necessary.
   *
   * @param {Map|object} input - Input to validate
   * @param {string} name - Parameter name for logging
   * @returns {Map<string, AxisInterval>} Valid Map
   * @private
   */
  #ensureMap(input, name) {
    if (input instanceof Map) {
      return input;
    }

    if (!input || typeof input !== 'object') {
      this.#logger.warn(
        `GateImplicationEvaluator: ${name} is not a Map, using empty Map`
      );
      return new Map();
    }

    // Try to convert plain object to Map
    try {
      return new Map(Object.entries(input));
    } catch (err) {
      this.#logger.warn(
        `GateImplicationEvaluator: Failed to convert ${name} to Map`,
        err
      );
      return new Map();
    }
  }
}

export default GateImplicationEvaluator;
