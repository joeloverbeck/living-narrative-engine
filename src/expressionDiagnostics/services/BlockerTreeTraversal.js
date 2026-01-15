/**
 * @file BlockerTreeTraversal - OR/AND tree traversal for blocker analysis
 * @description Provides tree traversal, flattening, and analysis operations
 * for hierarchical blocker breakdown structures. All methods are pure functions
 * with no external dependencies.
 */

/**
 * Service for traversing and analyzing hierarchical blocker trees.
 * Handles OR/AND tree operations including flattening, pass rate calculations,
 * and finding specific nodes within the tree structure.
 */
class BlockerTreeTraversal {
  // ============================================================================
  // Tree Flattening
  // ============================================================================

  /**
   * Recursively flatten a hierarchical tree to extract all leaf nodes.
   * NOTE: This method loses OR/AND semantics - use buildStructuredTree
   * for operations that need to preserve the logical structure.
   * @param {object} node - Hierarchical breakdown node
   * @param {object[]} [results=[]] - Array to accumulate results
   * @returns {object[]} Array of leaf nodes
   */
  flattenLeaves(node, results = []) {
    if (!node) return results;

    // If this is a leaf node, add it to results
    if (node.nodeType === 'leaf' || !node.isCompound) {
      results.push(node);
    }

    // Recurse into children for compound nodes
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.flattenLeaves(child, results);
      }
    }

    return results;
  }

  /**
   * Collect all OR blocks from an array of blockers with deduplication.
   * @param {object[]} blockers - Array of blocker objects
   * @returns {object[]} Array of unique OR nodes
   */
  collectOrBlocks(blockers) {
    const orBlocks = [];
    const seen = new Set();
    if (!Array.isArray(blockers)) {
      return orBlocks;
    }

    const register = (node) => {
      if (!node || node.nodeType !== 'or') {
        return;
      }
      const key =
        node.id ??
        `${node.description ?? 'or'}:${node.evaluationCount ?? 'na'}:${
          node.failureCount ?? 'na'
        }`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      orBlocks.push(node);
    };

    const walk = (node) => {
      if (!node) return;
      register(node);
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child);
        }
      }
    };

    for (const blocker of blockers) {
      const root = blocker?.hierarchicalBreakdown;
      if (root) {
        walk(root);
      }
    }

    return orBlocks;
  }

  /**
   * Collect funnel leaves from blockers or clause failures.
   * Prefers clauseFailures if available, otherwise falls back to blockers.
   * @param {object} options - Options object
   * @param {object[]} [options.blockers] - Array of blocker objects
   * @param {object[]} [options.clauseFailures] - Array of clause failure objects
   * @returns {object[]} Array of leaf nodes
   */
  collectFunnelLeaves({ blockers, clauseFailures }) {
    const sources =
      Array.isArray(clauseFailures) && clauseFailures.length > 0
        ? clauseFailures
        : blockers;
    const leaves = [];
    if (!Array.isArray(sources)) {
      return leaves;
    }

    for (const source of sources) {
      const root = source?.hierarchicalBreakdown ?? source;
      if (!root) continue;
      this.flattenLeaves(root, leaves);
    }

    return leaves;
  }

  /**
   * Build a structured representation of the condition tree that preserves OR/AND semantics.
   * Returns groups of conditions with their logical context.
   * @param {object} node - Hierarchical breakdown node
   * @returns {{type: 'and'|'or'|'leaf', node: object, children: Array}|null}
   */
  buildStructuredTree(node) {
    if (!node) return null;

    // Leaf node
    if (node.nodeType === 'leaf' || !node.isCompound) {
      return { type: 'leaf', node, children: [] };
    }

    // Compound node (AND/OR)
    const structuredChildren = [];
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const structured = this.buildStructuredTree(child);
        if (structured) {
          structuredChildren.push(structured);
        }
      }
    }

    return {
      type: node.nodeType, // 'and' or 'or'
      node,
      children: structuredChildren,
    };
  }

  // ============================================================================
  // OR Calculations
  // ============================================================================

  /**
   * Calculate the effective pass rate for an OR block.
   * An OR block passes if ANY child passes.
   * @param {object} orNode - OR node from hierarchical breakdown
   * @returns {number} Combined pass rate (0-1)
   */
  calculateOrPassRate(orNode) {
    if (!orNode) return 0;
    const evaluationCount = orNode.evaluationCount;
    const failureCount = orNode.failureCount;

    if (
      typeof evaluationCount === 'number' &&
      evaluationCount > 0 &&
      typeof failureCount === 'number'
    ) {
      return (evaluationCount - failureCount) / evaluationCount;
    }

    const failureRate = orNode.failureRate;
    if (typeof failureRate === 'number') {
      return 1 - failureRate;
    }

    return 0;
  }

  /**
   * Calculate in-regime failure rate for an OR block.
   * @param {object} orNode - OR node from hierarchical breakdown
   * @returns {number|null} In-regime failure rate (0-1) or null when unavailable
   */
  calculateOrInRegimeFailureRate(orNode) {
    if (!orNode) return null;
    const inRegimeEvaluationCount = orNode.inRegimeEvaluationCount;
    const inRegimeFailureCount = orNode.inRegimeFailureCount;

    if (
      typeof inRegimeEvaluationCount === 'number' &&
      inRegimeEvaluationCount > 0 &&
      typeof inRegimeFailureCount === 'number'
    ) {
      return inRegimeFailureCount / inRegimeEvaluationCount;
    }

    return orNode.inRegimeFailureRate ?? null;
  }

  /**
   * Resolve the OR union pass count with fallback calculation.
   * @param {object} orNode - OR node from hierarchical breakdown
   * @returns {number|null} OR union pass count or null if unavailable
   */
  resolveOrUnionCount(orNode) {
    if (!orNode) return null;
    if (Number.isFinite(orNode.orUnionPassCount)) {
      return orNode.orUnionPassCount;
    }
    if (
      Number.isFinite(orNode.evaluationCount) &&
      Number.isFinite(orNode.failureCount)
    ) {
      return orNode.evaluationCount - orNode.failureCount;
    }
    return null;
  }

  /**
   * Resolve the OR union in-regime pass count with fallback calculation.
   * @param {object} orNode - OR node from hierarchical breakdown
   * @returns {number|null} OR union in-regime pass count or null if unavailable
   */
  resolveOrUnionInRegimeCount(orNode) {
    if (!orNode) return null;
    if (Number.isFinite(orNode.orUnionPassInRegimeCount)) {
      return orNode.orUnionPassInRegimeCount;
    }
    if (
      Number.isFinite(orNode.inRegimeEvaluationCount) &&
      Number.isFinite(orNode.inRegimeFailureCount)
    ) {
      return orNode.inRegimeEvaluationCount - orNode.inRegimeFailureCount;
    }
    return null;
  }

  // ============================================================================
  // Tree Analysis
  // ============================================================================

  /**
   * Check if all blockers contain only AND nodes (no OR nodes).
   * @param {object[]} blockers - Array of blocker objects
   * @returns {boolean} True if all blockers are AND-only
   */
  isAndOnlyBlockers(blockers) {
    if (!Array.isArray(blockers) || blockers.length === 0) {
      return false;
    }

    let sawTree = false;
    for (const blocker of blockers) {
      const tree = blocker?.hierarchicalBreakdown;
      if (!tree) {
        return false;
      }
      sawTree = true;
      if (!this.isAndOnlyBreakdown(tree)) {
        return false;
      }
    }

    return sawTree;
  }

  /**
   * Recursively check if a tree contains only AND nodes (no OR nodes).
   * @param {object} node - Hierarchical breakdown node
   * @returns {boolean} True if tree is AND-only
   */
  isAndOnlyBreakdown(node) {
    if (!node || typeof node !== 'object') {
      return false;
    }

    if (node.nodeType === 'or') {
      return false;
    }

    if (node.nodeType === 'and') {
      const children = Array.isArray(node.children) ? node.children : [];
      return children.every((child) => this.isAndOnlyBreakdown(child));
    }

    if (node.nodeType === 'leaf') {
      return true;
    }

    return false;
  }

  /**
   * Check whether a clause leaf represents an emotion-threshold clause.
   * @param {object} leaf - Leaf node to check
   * @returns {boolean} True if this is an emotion threshold leaf
   */
  isEmotionThresholdLeaf(leaf) {
    const variablePath = leaf?.variablePath;
    if (!variablePath || typeof variablePath !== 'string') {
      return false;
    }
    const isEmotionPath =
      variablePath.startsWith('emotions.') ||
      variablePath.startsWith('previousEmotions.');
    return isEmotionPath && typeof leaf.thresholdValue === 'number';
  }

  // ============================================================================
  // Finding Methods
  // ============================================================================

  /**
   * Find the dominant suppressor axis (most negative contribution).
   * @param {object} axisContributions - Per-axis contributions object
   * @returns {{axis: string|null, contribution: number}} Dominant suppressor info
   */
  findDominantSuppressor(axisContributions) {
    let minContribution = 0;
    let dominantAxis = null;

    for (const [axis, data] of Object.entries(axisContributions)) {
      if (data.meanContribution < minContribution) {
        minContribution = data.meanContribution;
        dominantAxis = axis;
      }
    }

    return { axis: dominantAxis, contribution: minContribution };
  }

  /**
   * Find the most tunable leaf condition weighted by impact.
   * Ranks by (nearMissRate * lastMileFailRate) to prioritize conditions
   * that are both tunable AND decisive blockers.
   * @param {object} hb - Hierarchical breakdown node
   * @returns {{description: string, nearMissRate: number, epsilon: number, tunability: string, leafCount: number, impactScore: number}|null}
   */
  findMostTunableLeaf(hb) {
    const leaves = this.flattenLeaves(hb);
    if (leaves.length === 0) return null;

    let mostTunable = null;

    for (const leaf of leaves) {
      const nearMissRate = leaf.nearMissRate;
      const epsilon = leaf.nearMissEpsilon ?? 0;

      if (typeof nearMissRate === 'number' && nearMissRate > 0) {
        // Weight tunability by last-mile impact to prioritize decisive blockers
        const lastMileRate =
          leaf.siblingConditionedFailRate ??
          leaf.lastMileFailRate ??
          leaf.failureRate ??
          0;
        const impactScore = nearMissRate * lastMileRate;

        if (!mostTunable || impactScore > mostTunable.impactScore) {
          let tunability = 'low';
          if (nearMissRate > 0.1) tunability = 'high';
          else if (nearMissRate >= 0.02) tunability = 'moderate';

          mostTunable = {
            description: leaf.description ?? 'Unknown condition',
            nearMissRate,
            epsilon,
            tunability,
            leafCount: leaves.length,
            impactScore,
          };
        }
      }
    }

    return mostTunable;
  }

  /**
   * Find the leaf condition with the highest last-mile failure rate.
   * @param {object} hb - Hierarchical breakdown node
   * @returns {{description: string, lastMileFailRate: number}|null}
   */
  findWorstLastMileLeaf(hb) {
    const leaves = this.flattenLeaves(hb);
    if (leaves.length === 0) return null;

    let worst = null;

    for (const leaf of leaves) {
      const lastMileRate = leaf.lastMileFailRate;

      if (typeof lastMileRate === 'number' && lastMileRate > 0) {
        if (!worst || lastMileRate > worst.lastMileFailRate) {
          worst = {
            description: leaf.description ?? 'Unknown condition',
            lastMileFailRate: lastMileRate,
          };
        }
      }
    }

    return worst;
  }
}

export default BlockerTreeTraversal;
