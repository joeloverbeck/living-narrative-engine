/**
 * @file HierarchicalClauseNode - Tree node model for tracking per-condition statistics
 * in expression prerequisite evaluation. Used by MonteCarloSimulator to provide
 * granular breakdown of clause failures within AND/OR blocks.
 * @see MonteCarloSimulator.js - Builds and evaluates these trees
 * @see FailureExplainer.js - Analyzes trees for reporting
 */

import { advancedMetricsConfig } from '../config/advancedMetricsConfig.js';

/**
 * @typedef {'and' | 'or' | 'leaf'} NodeType
 */

/**
 * Represents a node in a hierarchical clause tracking tree.
 * Tracks evaluation statistics at each level of a JSON Logic expression.
 */
class HierarchicalClauseNode {
  /** @type {string} Path-based ID (e.g., "0.2.1") */
  #id;

  /** @type {string|null} Deterministic clause ID for leaf nodes */
  #clauseId = null;

  /** @type {'threshold' | 'delta' | 'compound' | 'other' | null} Clause type */
  #clauseType = null;

  /** @type {NodeType} Node type */
  #nodeType;

  /** @type {string} Human-readable description */
  #description;

  /** @type {object | null} JSON Logic for leaf nodes */
  #logic;

  /** @type {HierarchicalClauseNode[]} Child nodes for compound types */
  #children;

  /** @type {number} Times this node evaluated to false */
  #failureCount;

  /** @type {number} Total evaluations */
  #evaluationCount;

  /** @type {number} Sum of violation magnitudes when failed */
  #violationSum;

  /** @type {number|null} Threshold value from condition */
  #thresholdValue = null;

  /** @type {string|null} Comparison operator ('>=', '<=', etc.) */
  #comparisonOperator = null;

  /** @type {string|null} Variable path being compared (e.g., 'emotions.joy') */
  #variablePath = null;

  /** @type {number[]} Individual violation values for percentile calculation */
  #violationValues = [];

  /** @type {number} Total violation values observed (including unsampled) */
  #violationValueCount = 0;

  /** @type {number} Maximum observed value for this clause's variable */
  #maxObservedValue = -Infinity;

  /** @type {number} Minimum observed value for this clause's variable */
  #minObservedValue = Infinity;

  /** @type {number[]} All observed values for p99 calculation */
  #observedValues = [];

  /** @type {number} Total observed values recorded (including unsampled) */
  #observedValueCount = 0;

  /** @type {number} Count of samples within epsilon of threshold */
  #nearMissCount = 0;

  /** @type {number|null} The epsilon value used for near-miss detection */
  #epsilonUsed = null;

  /** @type {number} Failures when all other clauses passed */
  #lastMileFailCount = 0;

  /** @type {number} Samples where all other clauses passed */
  #othersPassedCount = 0;

  /** @type {boolean|null} Whether this is the only clause in the prerequisite */
  #isSingleClause = null;

  /** @type {number} Samples where all sibling clauses (in same compound) passed */
  #siblingsPassedCount = 0;

  /** @type {number} Failures when all sibling clauses (in same compound) passed */
  #siblingConditionedFailCount = 0;

  /** @type {number} Count of times this OR alternative was the first to pass when parent OR succeeded */
  #orContributionCount = 0;

  /** @type {number} Count of times parent OR block succeeded (for OR contribution rate) */
  #orSuccessCount = 0;

  /** @type {number} Count of times this OR alternative passed when the parent OR succeeded */
  #orPassCount = 0;

  /** @type {number} Count of times this OR alternative passed exclusively when the parent OR succeeded */
  #orExclusivePassCount = 0;

  /** @type {number} Count of OR block successes with exactly one passing child (global) */
  #orBlockExclusivePassCount = 0;

  /** @type {number} Count of OR block successes with exactly one passing child (in-regime) */
  #orBlockExclusivePassInRegimeCount = 0;

  /** @type {Map<string, number>} Count of pairwise passes for OR children (global) */
  #orPairPassCounts = new Map();

  /** @type {Map<string, number>} Count of pairwise passes for OR children (in-regime) */
  #orPairPassInRegimeCounts = new Map();

  /** @type {'and' | 'or' | 'root' | null} Parent node type for context-aware analysis */
  #parentNodeType = null;

  /** @type {number} In-regime evaluations (mood constraints satisfied) */
  #inRegimeEvaluationCount = 0;

  /** @type {number} In-regime failures (mood constraints satisfied) */
  #inRegimeFailureCount = 0;

  /** @type {number} Maximum observed value for this clause's variable in-regime */
  #inRegimeMaxObservedValue = -Infinity;

  /** @type {number} Minimum observed value for this clause's variable in-regime */
  #inRegimeMinObservedValue = Infinity;

  /** @type {number} Gate evaluations recorded for this node */
  #gateEvaluationCount = 0;

  /** @type {number} Gate pass count for this node */
  #gatePassCount = 0;

  /** @type {number} Gate pass count within mood regime */
  #gatePassInRegimeCount = 0;

  /** @type {number} Gate pass + clause pass count within mood regime */
  #gatePassAndClausePassInRegimeCount = 0;

  /** @type {number|null} Raw pass count (>= threshold before gating) within mood regime */
  #rawPassInRegimeCount = null;

  /** @type {number|null} Lost pass count (raw >= threshold, gated < threshold) within mood regime */
  #lostPassInRegimeCount = null;

  /** @type {number[]} Sole-blocker values for percentile calculation (values at fail when others passed) */
  #soleBlockerValues = [];

  /** @type {number} Total sole-blocker values observed (including unsampled) */
  #soleBlockerValueCount = 0;
  /**
   * @param {object} params
   * @param {string} params.id - Path-based ID (e.g., "0.2.1")
   * @param {NodeType} params.nodeType - 'and', 'or', or 'leaf'
   * @param {string} params.description - Human-readable description
   * @param {object | null} [params.logic] - JSON Logic for leaf nodes
   * @param {HierarchicalClauseNode[]} [params.children] - Child nodes
   * @param {string|null} [params.clauseId] - Deterministic clause id
   * @param {'threshold' | 'delta' | 'compound' | 'other' | null} [params.clauseType]
   */
  constructor({
    id,
    nodeType,
    description,
    logic = null,
    children = [],
    clauseId = null,
    clauseType = null,
  }) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('HierarchicalClauseNode: id must be a non-empty string');
    }
    if (!['and', 'or', 'leaf'].includes(nodeType)) {
      throw new Error(
        `HierarchicalClauseNode: nodeType must be 'and', 'or', or 'leaf', got '${nodeType}'`
      );
    }
    if (typeof description !== 'string') {
      throw new Error(
        'HierarchicalClauseNode: description must be a string'
      );
    }

    this.#id = id;
    this.#nodeType = nodeType;
    this.#description = description;
    this.#logic = logic;
    this.#children = Array.isArray(children) ? children : [];
    this.#clauseId = typeof clauseId === 'string' ? clauseId : null;
    this.#clauseType = clauseType ?? null;
    this.#failureCount = 0;
    this.#evaluationCount = 0;
    this.#violationSum = 0;
  }

  /** @returns {string} */
  get id() {
    return this.#id;
  }

  /** @returns {string|null} */
  get clauseId() {
    return this.#clauseId;
  }

  /** @returns {'threshold' | 'delta' | 'compound' | 'other' | null} */
  get clauseType() {
    return this.#clauseType;
  }

  /** @returns {NodeType} */
  get nodeType() {
    return this.#nodeType;
  }

  /** @returns {string} */
  get description() {
    return this.#description;
  }

  /** @returns {object | null} */
  get logic() {
    return this.#logic;
  }

  /** @returns {HierarchicalClauseNode[]} */
  get children() {
    return this.#children;
  }

  /** @returns {number} */
  get failureCount() {
    return this.#failureCount;
  }

  /** @returns {number} */
  get evaluationCount() {
    return this.#evaluationCount;
  }

  /** @returns {number} */
  get violationSum() {
    return this.#violationSum;
  }

  /**
   * Computed failure rate (0-1).
   *
   * @returns {number}
   */
  get failureRate() {
    return this.#evaluationCount > 0
      ? this.#failureCount / this.#evaluationCount
      : 0;
  }

  /**
   * Computed average violation magnitude.
   *
   * @returns {number}
   */
  get averageViolation() {
    return this.#failureCount > 0 ? this.#violationSum / this.#failureCount : 0;
  }

  /**
   * Whether this is a compound node (AND/OR).
   *
   * @returns {boolean}
   */
  get isCompound() {
    return this.#nodeType === 'and' || this.#nodeType === 'or';
  }

  /** @returns {number|null} */
  get thresholdValue() {
    return this.#thresholdValue;
  }

  /** @returns {string|null} */
  get comparisonOperator() {
    return this.#comparisonOperator;
  }

  /** @returns {string|null} */
  get variablePath() {
    return this.#variablePath;
  }

  /**
   * Get the array of violation values for percentile calculation.
   *
   * @returns {number[]}
   */
  get violationValues() {
    return this.#violationValues;
  }

  /**
   * Get the count of stored violation samples.
   *
   * @returns {number}
   */
  get violationSampleCount() {
    return this.#violationValues.length;
  }

  /**
   * Get the total number of violation values observed (including unsampled).
   *
   * @returns {number}
   */
  get violationTotalCount() {
    return this.#violationValueCount;
  }

  /**
   * Get the maximum observed value for this clause's variable.
   *
   * @returns {number|null} Max value, or null if no observations
   */
  get maxObservedValue() {
    return this.#maxObservedValue === -Infinity ? null : this.#maxObservedValue;
  }

  /**
   * Get the minimum observed value for this clause's variable.
   *
   * @returns {number|null} Min value, or null if no observations
   */
  get observedMin() {
    return this.#minObservedValue === Infinity ? null : this.#minObservedValue;
  }

  /**
   * Get the minimum observed value (alias for minObservedValue).
   * This is tracked efficiently during recording.
   *
   * @returns {number|null} Min value, or null if no observations
   */
  get minObservedValue() {
    return this.#minObservedValue === Infinity ? null : this.#minObservedValue;
  }

  /**
   * Get the maximum observed value for this clause's variable in-regime.
   *
   * @returns {number|null} Max value, or null if no in-regime observations
   */
  get inRegimeMaxObservedValue() {
    return this.#inRegimeMaxObservedValue === -Infinity
      ? null
      : this.#inRegimeMaxObservedValue;
  }

  /**
   * Get the minimum observed value for this clause's variable in-regime.
   *
   * @returns {number|null} Min value, or null if no in-regime observations
   */
  get inRegimeMinObservedValue() {
    return this.#inRegimeMinObservedValue === Infinity
      ? null
      : this.#inRegimeMinObservedValue;
  }

  /**
   * Computed in-regime failure rate (0-1), or null when no in-regime samples exist.
   *
   * @returns {number|null}
   */
  get inRegimeFailureRate() {
    if (this.#inRegimeEvaluationCount === 0) return null;
    return this.#inRegimeFailureCount / this.#inRegimeEvaluationCount;
  }

  /**
   * Computed in-regime pass rate (0-1), or null when no in-regime samples exist.
   *
   * @returns {number|null}
   */
  get inRegimePassRate() {
    if (this.#inRegimeEvaluationCount === 0) return null;
    return 1 - this.#inRegimeFailureCount / this.#inRegimeEvaluationCount;
  }

  /**
   * Get total gate evaluation count.
   *
   * @returns {number}
   */
  get gateEvaluationCount() {
    return this.#gateEvaluationCount;
  }

  /**
   * Get gate pass count.
   *
   * @returns {number}
   */
  get gatePassCount() {
    return this.#gatePassCount;
  }

  /**
   * Get gate pass rate (all samples).
   *
   * @returns {number|null}
   */
  get gatePassRate() {
    if (this.#gateEvaluationCount === 0) return null;
    return this.#gatePassCount / this.#gateEvaluationCount;
  }

  /**
   * Gate pass count within mood regime.
   *
   * @returns {number}
   */
  get gatePassInRegimeCount() {
    if (this.#gateEvaluationCount === 0) return null;
    return this.#gatePassInRegimeCount;
  }

  /**
   * Gate fail count within mood regime.
   *
   * @returns {number|null}
   */
  get gateFailInRegimeCount() {
    if (this.#gateEvaluationCount === 0) return null;
    if (this.#inRegimeEvaluationCount === 0) return null;
    return this.#inRegimeEvaluationCount - this.#gatePassInRegimeCount;
  }

  /**
   * Gate pass rate within mood regime.
   *
   * @returns {number|null}
   */
  get gatePassRateInRegime() {
    if (this.#gateEvaluationCount === 0) return null;
    if (this.#inRegimeEvaluationCount === 0) return null;
    return this.#gatePassInRegimeCount / this.#inRegimeEvaluationCount;
  }

  /**
   * Gate clamp rate within mood regime.
   *
   * @returns {number|null}
   */
  get gateClampRateInRegime() {
    const passRate = this.gatePassRateInRegime;
    if (passRate === null) return null;
    return 1 - passRate;
  }

  /**
   * Gate pass + clause pass count within mood regime.
   *
   * @returns {number}
   */
  get gatePassAndClausePassInRegimeCount() {
    if (this.#gateEvaluationCount === 0) return null;
    return this.#gatePassAndClausePassInRegimeCount;
  }

  /**
   * Gate pass + clause fail count within mood regime.
   *
   * @returns {number|null}
   */
  get gatePassAndClauseFailInRegimeCount() {
    if (this.#gateEvaluationCount === 0) return null;
    if (this.#gatePassInRegimeCount === 0) return null;
    return (
      this.#gatePassInRegimeCount - this.#gatePassAndClausePassInRegimeCount
    );
  }

  /**
   * Raw pass count within mood regime (only tracked for >= thresholds).
   *
   * @returns {number|null}
   */
  get rawPassInRegimeCount() {
    return this.#rawPassInRegimeCount;
  }

  /**
   * Lost pass count within mood regime (raw >= threshold, gated < threshold).
   *
   * @returns {number|null}
   */
  get lostPassInRegimeCount() {
    return this.#lostPassInRegimeCount;
  }

  /**
   * Lost pass rate within mood regime.
   *
   * @returns {number|null}
   */
  get lostPassRateInRegime() {
    if (
      this.#rawPassInRegimeCount === null ||
      this.#rawPassInRegimeCount === 0
    ) {
      return null;
    }
    if (this.#lostPassInRegimeCount === null) {
      return null;
    }
    return this.#lostPassInRegimeCount / this.#rawPassInRegimeCount;
  }

  /**
   * P(clause pass | gate pass, mood regime).
   *
   * @returns {number|null}
   */
  get passRateGivenGateInRegime() {
    if (this.#gateEvaluationCount === 0) return null;
    if (this.#gatePassInRegimeCount === 0) return null;
    return (
      this.#gatePassAndClausePassInRegimeCount / this.#gatePassInRegimeCount
    );
  }

  /**
   * Get the mean (average) observed value for this clause's variable.
   *
   * @returns {number|null} Mean value, or null if no observations
   */
  get observedMean() {
    if (this.#observedValues.length === 0) {
      return null;
    }
    const sum = this.#observedValues.reduce((acc, val) => acc + val, 0);
    return sum / this.#observedValues.length;
  }

  /**
   * Get the count of stored observed samples.
   *
   * @returns {number}
   */
  get observedSampleCount() {
    return this.#observedValues.length;
  }

  /**
   * Get the total number of observed values recorded (including unsampled).
   *
   * @returns {number}
   */
  get observedTotalCount() {
    return this.#observedValueCount;
  }

  /**
   * Get the 95th percentile of observed values.
   *
   * @returns {number|null}
   */
  get observedP95() {
    return this.#getObservedPercentile(0.95);
  }

  /**
   * Get the 99th percentile of observed values.
   *
   * @returns {number|null}
   */
  get observedP99() {
    return this.#getObservedPercentile(0.99);
  }

  /**
   * Calculate the gap between threshold and observed values.
   * Direction-aware: uses maxObserved for >= operators, minObserved for <= operators.
   * Positive value means there's a ceiling effect (threshold unreachable).
   * Negative value means threshold is achievable.
   *
   * For >= and > operators: gap = threshold - maxObserved
   *   Positive means: we never observe values high enough
   * For <= and < operators: gap = minObserved - threshold
   *   Positive means: we never observe values low enough
   *
   * @returns {number|null} Gap, or null if threshold not set or no observations
   */
  get ceilingGap() {
    if (this.#thresholdValue === null) {
      return null;
    }

    // Direction-aware gap calculation
    const op = this.#comparisonOperator;

    if (op === '>=' || op === '>') {
      // For "value >= threshold": we need values HIGH enough
      // Gap = threshold - maxObserved; positive = ceiling effect
      if (this.#maxObservedValue === -Infinity) {
        return null;
      }
      return this.#thresholdValue - this.#maxObservedValue;
    } else if (op === '<=' || op === '<') {
      // For "value <= threshold": we need values LOW enough
      // Gap = minObserved - threshold; positive = floor effect (values never low enough)
      if (this.#minObservedValue === Infinity) {
        return null;
      }
      return this.#minObservedValue - this.#thresholdValue;
    }

    // For == or unknown operators, fall back to maxObserved-based calculation
    if (this.#maxObservedValue === -Infinity) {
      return null;
    }
    return this.#thresholdValue - this.#maxObservedValue;
  }

  /**
   * Get the near-miss count (samples within epsilon of threshold).
   *
   * @returns {number}
   */
  get nearMissCount() {
    return this.#nearMissCount;
  }

  /**
   * Get the near-miss rate (proportion of all evaluations).
   *
   * @returns {number|null} Rate as decimal [0, 1], or null if no evaluations
   */
  get nearMissRate() {
    if (this.#evaluationCount === 0) {
      return null;
    }
    return this.#nearMissCount / this.#evaluationCount;
  }

  /**
   * Get the epsilon value used for near-miss detection.
   *
   * @returns {number|null}
   */
  get nearMissEpsilon() {
    return this.#epsilonUsed;
  }

  /**
   * Get the last-mile failure count.
   * This counts failures when all other clauses passed.
   *
   * @returns {number}
   */
  get lastMileFailCount() {
    return this.#lastMileFailCount;
  }

  /**
   * Get the count of samples where all other clauses passed.
   *
   * @returns {number}
   */
  get othersPassedCount() {
    return this.#othersPassedCount;
  }

  /**
   * Get the last-mile failure rate.
   * Failure rate among samples where all other clauses passed.
   *
   * @returns {number|null} Rate [0, 1], or null if no samples with others passed
   */
  get lastMileFailRate() {
    if (this.#othersPassedCount === 0) {
      return null;
    }
    return this.#lastMileFailCount / this.#othersPassedCount;
  }

  /**
   * Whether this clause is redundant within the mood regime.
   *
   * @returns {boolean|null} Null when in-regime stats are unavailable or not a leaf.
   */
  get redundantInRegime() {
    if (this.#nodeType !== 'leaf') return null;
    if (this.#thresholdValue === null || !this.#comparisonOperator) return null;

    const inRegimeMin = this.inRegimeMinObservedValue;
    const inRegimeMax = this.inRegimeMaxObservedValue;
    if (inRegimeMin === null || inRegimeMax === null) return null;

    switch (this.#comparisonOperator) {
      case '>=':
        return inRegimeMin >= this.#thresholdValue;
      case '>':
        return inRegimeMin > this.#thresholdValue;
      case '<=':
        return inRegimeMax <= this.#thresholdValue;
      case '<':
        return inRegimeMax < this.#thresholdValue;
      default:
        return null;
    }
  }

  /**
   * Whether this clause is trivially satisfied due to gate clamping in regime.
   *
   * @returns {boolean|null} Null when in-regime stats are unavailable or not applicable.
   */
  get clampTrivialInRegime() {
    if (this.#nodeType !== 'leaf' || !this.#comparisonOperator) return null;
    if (this.#comparisonOperator !== '<=' && this.#comparisonOperator !== '<') {
      return null;
    }

    const gatePassRate = this.gatePassRateInRegime;
    const inRegimeMax = this.inRegimeMaxObservedValue;
    if (typeof gatePassRate !== 'number' || typeof inRegimeMax !== 'number') {
      return null;
    }

    return gatePassRate === 0 && inRegimeMax === 0;
  }

  /**
   * Tuning direction labels derived from the comparison operator.
   *
   * @returns {{loosen: string, tighten: string}|null}
   */
  get tuningDirection() {
    if (this.#nodeType !== 'leaf' || !this.#comparisonOperator) return null;

    switch (this.#comparisonOperator) {
      case '>=':
      case '>':
        return { loosen: 'threshold_down', tighten: 'threshold_up' };
      case '<=':
      case '<':
        return { loosen: 'threshold_up', tighten: 'threshold_down' };
      default:
        return null;
    }
  }

  /**
   * Whether this is a single-clause prerequisite.
   * For single clauses, last-mile rate equals failure rate by definition.
   *
   * @returns {boolean}
   */
  get isSingleClause() {
    return this.#isSingleClause ?? false;
  }

  /**
   * Set whether this is a single-clause prerequisite.
   *
   * @param {boolean} value
   */
  set isSingleClause(value) {
    this.#isSingleClause = value;
  }

  /**
   * Get the count of samples where all sibling clauses passed.
   * Only meaningful for leaves within compound nodes (AND/OR).
   *
   * @returns {number}
   */
  get siblingsPassedCount() {
    return this.#siblingsPassedCount;
  }

  /**
   * Get the count of failures when all sibling clauses passed.
   *
   * @returns {number}
   */
  get siblingConditionedFailCount() {
    return this.#siblingConditionedFailCount;
  }

  /**
   * Get the sibling-conditioned failure rate.
   * Failure rate among samples where all sibling clauses (within same compound) passed.
   * This isolates the contribution of this specific leaf to the compound's failure.
   *
   * @returns {number|null} Rate [0, 1], or null if no samples with siblings passed
   */
  get siblingConditionedFailRate() {
    if (this.#siblingsPassedCount === 0) {
      return null;
    }
    return this.#siblingConditionedFailCount / this.#siblingsPassedCount;
  }

  /**
   * Get the count of times this OR alternative was the first to pass.
   * Only meaningful for direct children of OR nodes.
   *
   * @returns {number}
   */
  get orContributionCount() {
    return this.#orContributionCount;
  }

  /**
   * Get the count of times the parent OR block succeeded.
   * Used as denominator for OR contribution rate.
   *
   * @returns {number}
   */
  get orSuccessCount() {
    return this.#orSuccessCount;
  }

  /**
   * Get the count of times this OR alternative passed when parent OR succeeded.
   * Only meaningful for direct children of OR nodes.
   *
   * @returns {number}
   */
  get orPassCount() {
    return this.#orPassCount;
  }

  /**
   * Get the count of times this OR alternative passed exclusively.
   * Only meaningful for direct children of OR nodes.
   *
   * @returns {number}
   */
  get orExclusivePassCount() {
    return this.#orExclusivePassCount;
  }

  /**
   * Get the OR block union pass count (global).
   *
   * @returns {number}
   */
  get orUnionPassCount() {
    return this.#evaluationCount - this.#failureCount;
  }

  /**
   * Get the OR block union pass count (in-regime).
   *
   * @returns {number}
   */
  get orUnionPassInRegimeCount() {
    return this.#inRegimeEvaluationCount - this.#inRegimeFailureCount;
  }

  /**
   * Get the OR block exclusive pass count (global).
   *
   * @returns {number}
   */
  get orBlockExclusivePassCount() {
    return this.#orBlockExclusivePassCount;
  }

  /**
   * Get the OR block exclusive pass count (in-regime).
   *
   * @returns {number}
   */
  get orBlockExclusivePassInRegimeCount() {
    return this.#orBlockExclusivePassInRegimeCount;
  }

  /**
   * Get pairwise OR pass counts (global).
   *
   * @returns {{leftId: string, rightId: string, passCount: number}[]}
   */
  get orPairPassCounts() {
    return this.#serializeOrPairCounts(this.#orPairPassCounts);
  }

  /**
   * Get pairwise OR pass counts (in-regime).
   *
   * @returns {{leftId: string, rightId: string, passCount: number}[]}
   */
  get orPairPassInRegimeCounts() {
    return this.#serializeOrPairCounts(this.#orPairPassInRegimeCounts);
  }

  /**
   * Get the OR contribution rate.
   * The proportion of parent OR successes where this alternative was the first to pass.
   * Helps identify which OR alternatives are "carrying" the block.
   *
   * @returns {number|null} Rate [0, 1], or null if parent OR never succeeded
   */
  get orContributionRate() {
    if (this.#orSuccessCount === 0) {
      return null;
    }
    return this.#orContributionCount / this.#orSuccessCount;
  }

  /**
   * Get the OR pass rate.
   * The proportion of parent OR successes where this alternative passed.
   *
   * @returns {number|null} Rate [0, 1], or null if parent OR never succeeded
   */
  get orPassRate() {
    if (this.#orSuccessCount === 0) {
      return null;
    }
    return this.#orPassCount / this.#orSuccessCount;
  }

  /**
   * Get the OR exclusive pass rate.
   * The proportion of parent OR successes where only this alternative passed.
   *
   * @returns {number|null} Rate [0, 1], or null if parent OR never succeeded
   */
  get orExclusivePassRate() {
    if (this.#orSuccessCount === 0) {
      return null;
    }
    return this.#orExclusivePassCount / this.#orSuccessCount;
  }

  /**
   * Get the parent node type for context-aware analysis.
   * Indicates whether this node is inside an AND block, OR block, or at root.
   *
   * @returns {'and' | 'or' | 'root' | null}
   */
  get parentNodeType() {
    return this.#parentNodeType;
  }

  /**
   * Set the parent node type.
   *
   * @param {'and' | 'or' | 'root' | null} value
   */
  set parentNodeType(value) {
    this.#parentNodeType = value;
  }

  /**
   * Calculate the percentile of violation values.
   * Uses linear interpolation for non-integer indices.
   *
   * @param {number} p - Percentile as decimal (0.5 for p50, 0.9 for p90)
   * @returns {number|null} The percentile value, or null if no violations
   */
  getViolationPercentile(p) {
    const values = this.#violationValues;

    if (values.length === 0) {
      return null;
    }

    if (values.length === 1) {
      return values[0];
    }

    // Sort a copy (don't mutate the original)
    const sorted = [...values].sort((a, b) => a - b);

    // Calculate index using linear interpolation
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    // Linear interpolation between adjacent values
    const fraction = index - lower;
    return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
  }

  /**
   * Median (50th percentile) of violation values.
   *
   * @returns {number|null}
   */
  get violationP50() {
    return this.getViolationPercentile(0.5);
  }

  /**
   * 90th percentile of violation values.
   *
   * @returns {number|null}
   */
  get violationP90() {
    return this.getViolationPercentile(0.9);
  }

  /**
   * 95th percentile of violation values.
   *
   * @returns {number|null}
   */
  get violationP95() {
    return this.getViolationPercentile(0.95);
  }

  /**
   * 99th percentile of violation values.
   *
   * @returns {number|null}
   */
  get violationP99() {
    return this.getViolationPercentile(0.99);
  }

  /**
   * P50 (median) of sole-blocker values.
   * Returns the threshold that would pass 50% of sole-blocker samples.
   *
   * @returns {number|null}
   */
  get soleBlockerP50() {
    return this.#getSoleBlockerPercentile(0.5);
  }

  /**
   * P90 of sole-blocker values.
   * Returns the threshold that would pass 90% of sole-blocker samples.
   *
   * @returns {number|null}
   */
  get soleBlockerP90() {
    return this.#getSoleBlockerPercentile(0.9);
  }

  /**
   * Number of sole-blocker values currently stored in the sample reservoir.
   *
   * @returns {number}
   */
  get soleBlockerSampleCount() {
    return this.#soleBlockerValues.length;
  }

  /**
   * Total sole-blocker value observations (including those evicted from reservoir).
   *
   * @returns {number}
   */
  get soleBlockerTotalCount() {
    return this.#soleBlockerValueCount;
  }

  /**
   * Calculate the percentile of observed values.
   * Uses linear interpolation for non-integer indices.
   *
   * @private
   * @param {number} p - Percentile as decimal (0.99 for p99)
   * @returns {number|null} The percentile value, or null if no observations
   */
  #getObservedPercentile(p) {
    const values = this.#observedValues;

    if (values.length === 0) {
      return null;
    }

    if (values.length === 1) {
      return values[0];
    }

    // Sort a copy (don't mutate the original)
    const sorted = [...values].sort((a, b) => a - b);

    // Calculate index using linear interpolation
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    // Linear interpolation between adjacent values
    const fraction = index - lower;
    return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
  }

  /**
   * Compute percentile of sole-blocker values.
   *
   * @private
   * @param {number} p - Percentile (0.0 to 1.0)
   * @returns {number|null} The percentile value or null if no data
   */
  #getSoleBlockerPercentile(p) {
    const values = this.#soleBlockerValues;

    if (values.length === 0) {
      return null;
    }

    if (values.length === 1) {
      return values[0];
    }

    // Sort a copy (don't mutate the original)
    const sorted = [...values].sort((a, b) => a - b);

    // Calculate index using linear interpolation
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    // Linear interpolation between adjacent values
    const fraction = index - lower;
    return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
  }

  /**
   * Reservoir-sample a value into an array with a fixed maximum size.
   *
   * @private
   * @param {number[]} values - Stored sample array
   * @param {number} value - New value to consider
   * @param {number} maxSamples - Maximum sample size
   * @param {number} totalCount - Total values observed so far (after increment)
   */
  #sampleValue(values, value, maxSamples, totalCount) {
    if (!Number.isFinite(maxSamples) || maxSamples === Infinity) {
      values.push(value);
      return;
    }

    if (maxSamples <= 0) {
      return;
    }

    if (values.length < maxSamples) {
      values.push(value);
      return;
    }

    const index = Math.floor(Math.random() * totalCount);
    if (index < maxSamples) {
      values[index] = value;
    }
  }

  /**
   * Record an observed value for this clause's variable.
   * Called for EVERY evaluation, not just failures.
   * Tracks both min and max for direction-aware ceiling gap calculation.
   *
   * @param {number} value - The actual value observed
   */
  recordObservedValue(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return; // Skip non-numeric values (boolean conditions)
    }

    this.#observedValueCount++;

    if (value > this.#maxObservedValue) {
      this.#maxObservedValue = value;
    }

    if (value < this.#minObservedValue) {
      this.#minObservedValue = value;
    }

    this.#sampleValue(
      this.#observedValues,
      value,
      advancedMetricsConfig.maxObservedSampled,
      this.#observedValueCount
    );
  }

  /**
   * Record an observed value in-regime (also updates global).
   *
   * @param {number} value - The actual value observed
   */
  recordObservedValueInRegime(value) {
    this.recordObservedValue(value);
    if (typeof value !== 'number' || isNaN(value)) {
      return;
    }

    if (value > this.#inRegimeMaxObservedValue) {
      this.#inRegimeMaxObservedValue = value;
    }

    if (value < this.#inRegimeMinObservedValue) {
      this.#inRegimeMinObservedValue = value;
    }
  }

  /**
   * Record a sole-blocker value when this clause was the decisive blocker.
   * This captures the actual emotion/variable value when this clause failed
   * while all other clauses passed (sole-blocker scenario).
   *
   * Used for generating threshold edit recommendations (P50/P90 analysis).
   *
   * @param {number} value - The actual value observed when sole-blocking
   */
  recordSoleBlockerValue(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return;
    }

    this.#soleBlockerValueCount++;

    this.#sampleValue(
      this.#soleBlockerValues,
      value,
      advancedMetricsConfig.maxSoleBlockerSampled ?? 2000,
      this.#soleBlockerValueCount
    );
  }

  /**
   * Record an in-regime evaluation result for this node.
   *
   * @param {boolean} passed - Whether the node evaluated to true
   */
  recordInRegimeEvaluation(passed) {
    this.#inRegimeEvaluationCount++;
    if (!passed) {
      this.#inRegimeFailureCount++;
    }
  }

  /**
   * Record gate pass/fail outcomes for a leaf clause.
   *
   * @param {boolean} gatePass
   * @param {boolean} clausePassed
   * @param {boolean} inRegime
   */
  recordGateEvaluation(gatePass, clausePassed, inRegime) {
    if (typeof gatePass !== 'boolean') {
      return;
    }

    this.#gateEvaluationCount++;
    if (gatePass) {
      this.#gatePassCount++;
    }

    if (inRegime) {
      if (gatePass) {
        this.#gatePassInRegimeCount++;
        if (clausePassed) {
          this.#gatePassAndClausePassInRegimeCount++;
        }
      }
    }
  }

  /**
   * Record lost pass outcomes for >= thresholds in-regime.
   *
   * @param {boolean} rawPass
   * @param {boolean} clausePassed
   * @param {boolean} inRegime
   */
  recordLostPassInRegime(rawPass, clausePassed, inRegime) {
    if (!inRegime) {
      return;
    }
    if (typeof rawPass !== 'boolean' || typeof clausePassed !== 'boolean') {
      return;
    }
    if (this.#rawPassInRegimeCount === null) {
      this.#rawPassInRegimeCount = 0;
      this.#lostPassInRegimeCount = 0;
    }
    if (rawPass) {
      this.#rawPassInRegimeCount++;
      if (!clausePassed) {
        this.#lostPassInRegimeCount++;
      }
    }
  }

  /**
   * Record whether this evaluation was a near-miss.
   * A near-miss is when |actual - threshold| < epsilon.
   *
   * @param {number} actualValue - The observed value
   * @param {number} threshold - The threshold value
   * @param {number} epsilon - The epsilon for this variable
   */
  recordNearMiss(actualValue, threshold, epsilon) {
    if (typeof actualValue !== 'number' || typeof threshold !== 'number') {
      return;
    }

    this.#epsilonUsed = epsilon;

    const distance = Math.abs(actualValue - threshold);
    if (distance < epsilon) {
      this.#nearMissCount++;
    }
  }

  /**
   * Record a last-mile failure.
   * Called when this clause fails AND all other clauses passed.
   */
  recordLastMileFail() {
    this.#lastMileFailCount++;
  }

  /**
   * Record that all other clauses passed for this sample.
   * Called regardless of whether this clause passed.
   */
  recordOthersPassed() {
    this.#othersPassedCount++;
  }

  /**
   * Record that all sibling clauses (within the same compound) passed for this sample.
   * Called regardless of whether this clause passed.
   */
  recordSiblingsPassed() {
    this.#siblingsPassedCount++;
  }

  /**
   * Record a sibling-conditioned failure.
   * Called when this clause fails AND all sibling clauses (within same compound) passed.
   */
  recordSiblingConditionedFail() {
    this.#siblingConditionedFailCount++;
  }

  /**
   * Record that this OR alternative was the first to pass when the parent OR succeeded.
   * Called for the first passing alternative when an OR block evaluates to true.
   */
  recordOrContribution() {
    this.#orContributionCount++;
  }

  /**
   * Record that the parent OR block succeeded.
   * Called for ALL children of an OR block when it evaluates to true.
   * This provides the denominator for OR contribution rate calculation.
   */
  recordOrSuccess() {
    this.#orSuccessCount++;
  }

  /**
   * Record that this OR alternative passed when the parent OR succeeded.
   */
  recordOrPass() {
    this.#orPassCount++;
  }

  /**
   * Record that this OR alternative passed exclusively when the parent OR succeeded.
   */
  recordOrExclusivePass() {
    this.#orExclusivePassCount++;
  }

  /**
   * Record that an OR block succeeded with exactly one passing child.
   *
   * @param {boolean} [inRegime=false]
   */
  recordOrBlockExclusivePass(inRegime = false) {
    this.#orBlockExclusivePassCount++;
    if (inRegime) {
      this.#orBlockExclusivePassInRegimeCount++;
    }
  }

  /**
   * Record that a pair of OR children passed together.
   *
   * @param {string} leftId
   * @param {string} rightId
   * @param {boolean} [inRegime=false]
   */
  recordOrPairPass(leftId, rightId, inRegime = false) {
    if (typeof leftId !== 'string' || typeof rightId !== 'string') {
      return;
    }
    if (leftId === rightId) {
      return;
    }
    const key = this.#buildOrPairKey(leftId, rightId);
    this.#orPairPassCounts.set(key, (this.#orPairPassCounts.get(key) ?? 0) + 1);
    if (inRegime) {
      this.#orPairPassInRegimeCounts.set(
        key,
        (this.#orPairPassInRegimeCounts.get(key) ?? 0) + 1
      );
    }
  }

  /**
   * Record an evaluation result for this node.
   *
   * @param {boolean} passed - Whether the node evaluated to true
   * @param {number} [violation] - Violation magnitude if failed
   */
  recordEvaluation(passed, violation = 0) {
    this.#evaluationCount++;
    if (!passed) {
      this.#failureCount++;
      if (typeof violation === 'number' && violation > 0) {
        this.#violationSum += violation;
        this.#violationValueCount++;
        this.#sampleValue(
          this.#violationValues,
          violation,
          advancedMetricsConfig.maxViolationsSampled,
          this.#violationValueCount
        );
      }
    }
  }

  /**
   * Reset all statistics. Useful for re-running simulations.
   */
  resetStats() {
    this.#failureCount = 0;
    this.#evaluationCount = 0;
    this.#violationSum = 0;
    this.#violationValues = [];
    this.#violationValueCount = 0;
    this.#maxObservedValue = -Infinity;
    this.#minObservedValue = Infinity;
    this.#observedValues = [];
    this.#observedValueCount = 0;
    this.#nearMissCount = 0;
    this.#epsilonUsed = null;
    this.#lastMileFailCount = 0;
    this.#othersPassedCount = 0;
    this.#siblingsPassedCount = 0;
    this.#siblingConditionedFailCount = 0;
    this.#orContributionCount = 0;
    this.#orSuccessCount = 0;
    this.#orPassCount = 0;
    this.#orExclusivePassCount = 0;
    this.#orBlockExclusivePassCount = 0;
    this.#orBlockExclusivePassInRegimeCount = 0;
    this.#orPairPassCounts = new Map();
    this.#orPairPassInRegimeCounts = new Map();
    this.#inRegimeEvaluationCount = 0;
    this.#inRegimeFailureCount = 0;
    this.#inRegimeMaxObservedValue = -Infinity;
    this.#inRegimeMinObservedValue = Infinity;
    this.#gateEvaluationCount = 0;
    this.#gatePassCount = 0;
    this.#gatePassInRegimeCount = 0;
    this.#gatePassAndClausePassInRegimeCount = 0;
    this.#rawPassInRegimeCount = null;
    this.#lostPassInRegimeCount = null;
    this.#soleBlockerValues = [];
    this.#soleBlockerValueCount = 0;
    // Note: Do NOT reset #isSingleClause - it's metadata, not a stat
    for (const child of this.#children) {
      child.resetStats();
    }
  }

  /**
   * Set threshold metadata for leaf nodes.
   *
   * @param {number|null} threshold - The threshold value
   * @param {string|null} operator - The comparison operator
   * @param {string|null} variablePath - The variable being compared
   */
  setThresholdMetadata(threshold, operator, variablePath) {
    this.#thresholdValue = threshold;
    this.#comparisonOperator = operator;
    this.#variablePath = variablePath;
  }

  /**
   * Serialize to plain object for JSON transport.
   *
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.#id,
      clauseId: this.#clauseId,
      clauseType: this.#clauseType,
      nodeType: this.#nodeType,
      description: this.#description,
      failureCount: this.#failureCount,
      evaluationCount: this.#evaluationCount,
      failureRate: this.failureRate,
      averageViolation: this.averageViolation,
      violationP50: this.violationP50,
      violationP90: this.violationP90,
      violationP95: this.violationP95,
      violationP99: this.violationP99,
      isCompound: this.isCompound,
      thresholdValue: this.#thresholdValue,
      comparisonOperator: this.#comparisonOperator,
      variablePath: this.#variablePath,
      violationSampleCount: this.#violationValues.length,
      violationTotalCount: this.#violationValueCount,
      observedMin: this.observedMin,
      minObservedValue: this.minObservedValue,
      observedMean: this.observedMean,
      maxObservedValue: this.maxObservedValue,
      observedP95: this.observedP95,
      observedP99: this.observedP99,
      observedSampleCount: this.observedSampleCount,
      observedTotalCount: this.observedTotalCount,
      ceilingGap: this.ceilingGap,
      nearMissCount: this.nearMissCount,
      nearMissRate: this.nearMissRate,
      nearMissEpsilon: this.nearMissEpsilon,
      lastMileFailCount: this.#lastMileFailCount,
      othersPassedCount: this.#othersPassedCount,
      lastMileFailRate: this.lastMileFailRate,
      soleBlockerP50: this.soleBlockerP50,
      soleBlockerP90: this.soleBlockerP90,
      soleBlockerSampleCount: this.soleBlockerSampleCount,
      soleBlockerTotalCount: this.soleBlockerTotalCount,
      siblingsPassedCount: this.#siblingsPassedCount,
      siblingConditionedFailCount: this.#siblingConditionedFailCount,
      siblingConditionedFailRate: this.siblingConditionedFailRate,
      orContributionCount: this.#orContributionCount,
      orSuccessCount: this.#orSuccessCount,
      orContributionRate: this.orContributionRate,
      orPassCount: this.#orPassCount,
      orExclusivePassCount: this.#orExclusivePassCount,
      orPassRate: this.orPassRate,
      orExclusivePassRate: this.orExclusivePassRate,
      orUnionPassCount: this.orUnionPassCount,
      orUnionPassInRegimeCount: this.orUnionPassInRegimeCount,
      orBlockExclusivePassCount: this.#orBlockExclusivePassCount,
      orBlockExclusivePassInRegimeCount:
        this.#orBlockExclusivePassInRegimeCount,
      orPairPassCounts: this.orPairPassCounts,
      orPairPassInRegimeCounts: this.orPairPassInRegimeCounts,
      isSingleClause: this.isSingleClause,
      parentNodeType: this.#parentNodeType,
      inRegimeEvaluationCount: this.#inRegimeEvaluationCount,
      inRegimeFailureCount: this.#inRegimeFailureCount,
      inRegimeFailureRate: this.inRegimeFailureRate,
      inRegimePassRate: this.inRegimePassRate,
      inRegimeMinObservedValue: this.inRegimeMinObservedValue,
      inRegimeMaxObservedValue: this.inRegimeMaxObservedValue,
      gateEvaluationCount: this.#gateEvaluationCount,
      gatePassCount: this.#gatePassCount,
      gatePassRate: this.gatePassRate,
      gatePassInRegimeCount: this.gatePassInRegimeCount,
      gateFailInRegimeCount: this.gateFailInRegimeCount,
      gatePassRateInRegime: this.gatePassRateInRegime,
      gateClampRateInRegime: this.gateClampRateInRegime,
      gatePassAndClausePassInRegimeCount:
        this.gatePassAndClausePassInRegimeCount,
      gatePassAndClauseFailInRegimeCount:
        this.gatePassAndClauseFailInRegimeCount,
      passRateGivenGateInRegime: this.passRateGivenGateInRegime,
      rawPassInRegimeCount: this.rawPassInRegimeCount,
      lostPassInRegimeCount: this.lostPassInRegimeCount,
      lostPassRateInRegime: this.lostPassRateInRegime,
      redundantInRegime: this.redundantInRegime,
      clampTrivialInRegime: this.clampTrivialInRegime,
      tuningDirection: this.tuningDirection,
      children: this.#children.map((c) => c.toJSON()),
    };
  }

  /**
   * Create a HierarchicalClauseNode from a plain object (e.g., from toJSON).
   * Note: This creates a read-only snapshot without the ability to record new evaluations.
   *
   * @param {object} obj
   * @returns {HierarchicalClauseNode}
   */
  static fromJSON(obj) {
    const node = new HierarchicalClauseNode({
      id: obj.id,
      nodeType: obj.nodeType,
      description: obj.description,
      logic: null,
      children: (obj.children || []).map((c) => HierarchicalClauseNode.fromJSON(c)),
      clauseId: obj.clauseId ?? null,
      clauseType: obj.clauseType ?? null,
    });
    // Restore stats by recording fake evaluations
    // This is approximate but preserves the data
    const totalEvals = obj.evaluationCount || 0;
    const failures = obj.failureCount || 0;
    const avgViolation = obj.averageViolation || 0;
    for (let i = 0; i < totalEvals; i++) {
      if (i < failures) {
        node.recordEvaluation(false, avgViolation);
      } else {
        node.recordEvaluation(true);
      }
    }
    // Restore parentNodeType if present
    if (obj.parentNodeType) {
      node.parentNodeType = obj.parentNodeType;
    }
    node.#orContributionCount = Number.isFinite(obj.orContributionCount)
      ? obj.orContributionCount
      : 0;
    node.#orSuccessCount = Number.isFinite(obj.orSuccessCount)
      ? obj.orSuccessCount
      : 0;
    node.#orPassCount = Number.isFinite(obj.orPassCount) ? obj.orPassCount : 0;
    node.#orExclusivePassCount = Number.isFinite(obj.orExclusivePassCount)
      ? obj.orExclusivePassCount
      : 0;
    node.#orBlockExclusivePassCount = Number.isFinite(
      obj.orBlockExclusivePassCount
    )
      ? obj.orBlockExclusivePassCount
      : 0;
    node.#orBlockExclusivePassInRegimeCount = Number.isFinite(
      obj.orBlockExclusivePassInRegimeCount
    )
      ? obj.orBlockExclusivePassInRegimeCount
      : 0;
    node.#orPairPassCounts = HierarchicalClauseNode.#parseOrPairCounts(
      obj.orPairPassCounts
    );
    node.#orPairPassInRegimeCounts = HierarchicalClauseNode.#parseOrPairCounts(
      obj.orPairPassInRegimeCounts
    );
    node.#inRegimeEvaluationCount = Number.isFinite(obj.inRegimeEvaluationCount)
      ? obj.inRegimeEvaluationCount
      : 0;
    node.#inRegimeFailureCount = Number.isFinite(obj.inRegimeFailureCount)
      ? obj.inRegimeFailureCount
      : 0;
    node.#inRegimeMinObservedValue =
      typeof obj.inRegimeMinObservedValue === 'number'
        ? obj.inRegimeMinObservedValue
        : Infinity;
    node.#inRegimeMaxObservedValue =
      typeof obj.inRegimeMaxObservedValue === 'number'
        ? obj.inRegimeMaxObservedValue
        : -Infinity;
    if (Number.isFinite(obj.violationTotalCount)) {
      node.#violationValueCount = obj.violationTotalCount;
    }
    if (Number.isFinite(obj.observedTotalCount)) {
      node.#observedValueCount = obj.observedTotalCount;
    }
    node.#gateEvaluationCount = Number.isFinite(obj.gateEvaluationCount)
      ? obj.gateEvaluationCount
      : 0;
    node.#gatePassCount = Number.isFinite(obj.gatePassCount)
      ? obj.gatePassCount
      : 0;
    node.#gatePassInRegimeCount = Number.isFinite(obj.gatePassInRegimeCount)
      ? obj.gatePassInRegimeCount
      : 0;
    node.#gatePassAndClausePassInRegimeCount = Number.isFinite(
      obj.gatePassAndClausePassInRegimeCount
    )
      ? obj.gatePassAndClausePassInRegimeCount
      : 0;
    node.#rawPassInRegimeCount = Number.isFinite(obj.rawPassInRegimeCount)
      ? obj.rawPassInRegimeCount
      : null;
    node.#lostPassInRegimeCount = Number.isFinite(obj.lostPassInRegimeCount)
      ? obj.lostPassInRegimeCount
      : null;
    if (Number.isFinite(obj.soleBlockerTotalCount)) {
      node.#soleBlockerValueCount = obj.soleBlockerTotalCount;
    }
    return node;
  }

  #buildOrPairKey(leftId, rightId) {
    return leftId < rightId
      ? `${leftId}::${rightId}`
      : `${rightId}::${leftId}`;
  }

  #serializeOrPairCounts(map) {
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, passCount]) => {
        const [leftId, rightId] = key.split('::');
        return { leftId, rightId, passCount };
      });
  }

  static #parseOrPairCounts(list) {
    const map = new Map();
    if (!Array.isArray(list)) {
      return map;
    }
    for (const item of list) {
      if (!item || typeof item.passCount !== 'number') {
        continue;
      }
      const leftId = item.leftId;
      const rightId = item.rightId;
      if (typeof leftId !== 'string' || typeof rightId !== 'string') {
        continue;
      }
      const key = leftId < rightId
        ? `${leftId}::${rightId}`
        : `${rightId}::${leftId}`;
      map.set(key, item.passCount);
    }
    return map;
  }
}

export default HierarchicalClauseNode;
