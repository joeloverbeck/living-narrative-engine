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
  /**
   * @param {object} params
   * @param {string} params.id - Path-based ID (e.g., "0.2.1")
   * @param {NodeType} params.nodeType - 'and', 'or', or 'leaf'
   * @param {string} params.description - Human-readable description
   * @param {object | null} [params.logic] - JSON Logic for leaf nodes
   * @param {HierarchicalClauseNode[]} [params.children] - Child nodes
   */
  constructor({ id, nodeType, description, logic = null, children = [] }) {
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
    this.#failureCount = 0;
    this.#evaluationCount = 0;
    this.#violationSum = 0;
  }

  /** @returns {string} */
  get id() {
    return this.#id;
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
    this.#inRegimeEvaluationCount = 0;
    this.#inRegimeFailureCount = 0;
    this.#inRegimeMaxObservedValue = -Infinity;
    this.#inRegimeMinObservedValue = Infinity;
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
      isSingleClause: this.isSingleClause,
      parentNodeType: this.#parentNodeType,
      inRegimeEvaluationCount: this.#inRegimeEvaluationCount,
      inRegimeFailureCount: this.#inRegimeFailureCount,
      inRegimeFailureRate: this.inRegimeFailureRate,
      inRegimePassRate: this.inRegimePassRate,
      inRegimeMinObservedValue: this.inRegimeMinObservedValue,
      inRegimeMaxObservedValue: this.inRegimeMaxObservedValue,
      redundantInRegime: this.redundantInRegime,
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
    return node;
  }
}

export default HierarchicalClauseNode;
