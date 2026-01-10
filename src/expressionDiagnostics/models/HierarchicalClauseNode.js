/**
 * @file HierarchicalClauseNode - Tree node model for tracking per-condition statistics
 * in expression prerequisite evaluation. Used by MonteCarloSimulator to provide
 * granular breakdown of clause failures within AND/OR blocks.
 * @see MonteCarloSimulator.js - Builds and evaluates these trees
 * @see FailureExplainer.js - Analyzes trees for reporting
 */

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

  /** @type {number} Maximum observed value for this clause's variable */
  #maxObservedValue = -Infinity;

  /** @type {number[]} All observed values for p99 calculation */
  #observedValues = [];

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
   * Get the maximum observed value for this clause's variable.
   *
   * @returns {number|null} Max value, or null if no observations
   */
  get maxObservedValue() {
    return this.#maxObservedValue === -Infinity ? null : this.#maxObservedValue;
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
   * Calculate the gap between threshold and max observed.
   * Negative value means threshold is achievable.
   * Positive value means there's a ceiling effect.
   *
   * @returns {number|null} Gap, or null if threshold not set or no observations
   */
  get ceilingGap() {
    if (this.#thresholdValue === null || this.#maxObservedValue === -Infinity) {
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
   * Record an observed value for this clause's variable.
   * Called for EVERY evaluation, not just failures.
   *
   * @param {number} value - The actual value observed
   */
  recordObservedValue(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return; // Skip non-numeric values (boolean conditions)
    }

    if (value > this.#maxObservedValue) {
      this.#maxObservedValue = value;
    }

    this.#observedValues.push(value);
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
        this.#violationValues.push(violation);
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
    this.#maxObservedValue = -Infinity;
    this.#observedValues = [];
    this.#nearMissCount = 0;
    this.#epsilonUsed = null;
    this.#lastMileFailCount = 0;
    this.#othersPassedCount = 0;
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
      isCompound: this.isCompound,
      thresholdValue: this.#thresholdValue,
      comparisonOperator: this.#comparisonOperator,
      variablePath: this.#variablePath,
      violationSampleCount: this.#violationValues.length,
      maxObservedValue: this.maxObservedValue,
      observedP99: this.observedP99,
      ceilingGap: this.ceilingGap,
      nearMissCount: this.nearMissCount,
      nearMissRate: this.nearMissRate,
      nearMissEpsilon: this.nearMissEpsilon,
      lastMileFailCount: this.#lastMileFailCount,
      othersPassedCount: this.#othersPassedCount,
      lastMileFailRate: this.lastMileFailRate,
      isSingleClause: this.isSingleClause,
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
    return node;
  }
}

export default HierarchicalClauseNode;
