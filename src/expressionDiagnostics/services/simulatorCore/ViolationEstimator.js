/**
 * @file ViolationEstimator.js
 * @description Estimates violations and collects failure information for Monte Carlo diagnostics.
 * Handles counting failed clauses, collecting failed leaves, and extracting violation details.
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import jsonLogic from 'json-logic-js';

/**
 * @typedef {object} ViolationInfo
 * @property {number|null} actual - Actual value from context
 * @property {number|null} threshold - Threshold value from expression
 * @property {number|null} violation - Absolute difference between actual and threshold
 */

/**
 * @typedef {object} FailedLeafSummary
 * @property {string} description - Human-readable description of the condition
 * @property {number|null} actual - Actual value from context
 * @property {number|null} threshold - Threshold value from expression
 * @property {number|null} violation - Absolute difference between actual and threshold
 */

/**
 * Estimator for violation analysis in Monte Carlo simulation.
 * Counts failed clauses and collects violation information for nearest-miss tracking.
 * Stateless - all methods are pure functions that only depend on jsonLogic.
 */
class ViolationEstimator {
  /**
   * Count failed leaf clauses for nearest-miss tracking.
   *
   * @param {Array} clauseTracking - Clause tracking data with hierarchicalTree
   * @param {object} expression - Expression with prerequisites array
   * @param {object} context - Evaluation context for JSON Logic
   * @param {function(object, object): boolean} prerequisiteEvaluator - Function to evaluate prerequisites
   * @returns {number} Count of failed leaves
   */
  countFailedClauses(clauseTracking, expression, context, prerequisiteEvaluator) {
    let failedCount = 0;

    if (!expression?.prerequisites || !Array.isArray(clauseTracking)) {
      return 0;
    }

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      const clause = clauseTracking[i];

      if (clause?.hierarchicalTree) {
        // Count failed leaves in hierarchical tree
        failedCount += this.#countFailedLeavesInTree(clause.hierarchicalTree, context);
      } else {
        // Simple atomic clause - check if it fails
        const result = prerequisiteEvaluator(prereq, context);
        if (!result) {
          failedCount++;
        }
      }
    }

    return failedCount;
  }

  /**
   * Get summary of failed leaf conditions (capped at 5 for brevity).
   *
   * @param {Array} clauseTracking - Clause tracking data with hierarchicalTree
   * @param {object} expression - Expression with prerequisites array
   * @param {object} context - Evaluation context for JSON Logic
   * @param {function(object, object): boolean} prerequisiteEvaluator - Function to evaluate prerequisites
   * @returns {FailedLeafSummary[]} Failed leaf summaries with actual/threshold/violation
   */
  getFailedLeavesSummary(clauseTracking, expression, context, prerequisiteEvaluator) {
    const failedLeaves = [];

    if (!expression?.prerequisites || !Array.isArray(clauseTracking)) {
      return [];
    }

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      const clause = clauseTracking[i];

      if (clause?.hierarchicalTree) {
        // Collect failed leaves from tree
        this.#collectFailedLeaves(clause.hierarchicalTree, context, failedLeaves);
      } else {
        // Simple atomic clause
        const result = prerequisiteEvaluator(prereq, context);
        if (!result) {
          failedLeaves.push({
            description: clause?.description || `Clause ${i + 1}`,
            actual: null,
            threshold: null,
            violation: null,
          });
        }
      }
    }

    // Limit to first 5 failed leaves for brevity
    return failedLeaves.slice(0, 5);
  }

  /**
   * Recursively count failed nodes in hierarchical tree.
   *
   * @param {object} node - Hierarchical tree node
   * @param {object} context - Evaluation context
   * @returns {number} Count of failed leaves
   * @private
   */
  #countFailedLeavesInTree(node, context) {
    if (!node?.isCompound) {
      // Leaf node - evaluate and count if failed
      try {
        const result = jsonLogic.apply(node.logic, context);
        return result ? 0 : 1;
      } catch {
        return 1; // Treat errors as failures
      }
    }

    // Compound node - sum failed children
    let failedCount = 0;
    for (const child of node.children || []) {
      failedCount += this.#countFailedLeavesInTree(child, context);
    }
    return failedCount;
  }

  /**
   * Recursively collect failed leaves from tree with violation info.
   *
   * @param {object} node - Hierarchical tree node
   * @param {object} context - Evaluation context
   * @param {FailedLeafSummary[]} failedLeaves - Array to collect failed leaves into
   * @private
   */
  #collectFailedLeaves(node, context, failedLeaves) {
    if (!node?.isCompound) {
      // Leaf node - evaluate and collect if failed
      let passed = false;
      try {
        passed = jsonLogic.apply(node.logic, context);
      } catch {
        passed = false;
      }
      if (!passed) {
        // Try to extract threshold info from node
        const violationInfo = this.#extractViolationInfo(node.logic, context);
        failedLeaves.push({
          description: node.description || 'Unknown condition',
          actual: violationInfo.actual,
          threshold: violationInfo.threshold,
          violation: violationInfo.violation,
        });
      }
      return;
    }

    // Compound node - recurse into children
    for (const child of node.children || []) {
      this.#collectFailedLeaves(child, context, failedLeaves);
    }
  }

  /**
   * Safely evaluate operands (literals, vars, expressions).
   *
   * @param {number|string|boolean|object|null|undefined} operand - The operand to evaluate (literal, var, or expression)
   * @param {object} context - Evaluation context
   * @returns {number|string|boolean|object|null} Evaluated value or null on error
   * @private
   */
  #safeEvalOperand(operand, context) {
    // Handle literal values
    if (typeof operand === 'number' || typeof operand === 'string' || typeof operand === 'boolean') {
      return operand;
    }

    // Handle null/undefined
    if (operand === null || operand === undefined) {
      return null;
    }

    // Handle var reference
    if (typeof operand === 'object' && operand.var) {
      try {
        return jsonLogic.apply(operand, context);
      } catch {
        return null;
      }
    }

    // Handle other expressions (arithmetic, etc.)
    if (typeof operand === 'object') {
      try {
        return jsonLogic.apply(operand, context);
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Extract actual/threshold/violation from comparison expressions.
   * Supports >=, <=, >, <, == operators.
   *
   * @param {object} logic - JSON Logic expression
   * @param {object} context - Evaluation context
   * @returns {ViolationInfo} Extracted violation information
   * @private
   */
  #extractViolationInfo(logic, context) {
    // Guard against null/undefined logic
    if (!logic || typeof logic !== 'object') {
      return { actual: null, threshold: null, violation: null };
    }

    // Check for comparison operators
    const operators = ['>=', '<=', '>', '<', '=='];
    for (const op of operators) {
      if (logic[op]) {
        const [leftExpr, rightExpr] = logic[op];

        // Try to evaluate both sides
        const left = this.#safeEvalOperand(leftExpr, context);
        const right = this.#safeEvalOperand(rightExpr, context);

        if (typeof left === 'number' && typeof right === 'number') {
          // Determine which is actual and which is threshold
          // Typically var references are on the left, thresholds on the right
          const isLeftVar = typeof leftExpr === 'object' && leftExpr?.var;
          const actual = isLeftVar ? left : right;
          const threshold = isLeftVar ? right : left;
          const violation = Math.abs(actual - threshold);

          return { actual, threshold, violation };
        }
      }
    }

    return { actual: null, threshold: null, violation: null };
  }
}

export default ViolationEstimator;
