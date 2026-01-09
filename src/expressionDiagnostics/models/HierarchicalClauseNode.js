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
    for (const child of this.#children) {
      child.resetStats();
    }
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
      isCompound: this.isCompound,
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
