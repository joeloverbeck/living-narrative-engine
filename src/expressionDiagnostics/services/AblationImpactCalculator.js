/**
 * @file AblationImpactCalculator - Computes clause ablation impact and choke rank.
 */

class AblationImpactCalculator {
  /** @type {Array<object|null>} */
  #rootNodes;

  /** @type {Map<string, Set<number>>} */
  #clauseIdToRoots;

  /** @type {Map<string, number>} */
  #passWithoutByClauseId;

  /** @type {Map<number, number>} */
  #passWithoutByTopLevel;

  /**
   * @param {Array<{hierarchicalTree: object|null}>} clauseTracking
   */
  constructor(clauseTracking = []) {
    this.#rootNodes = clauseTracking.map((clause) => clause.hierarchicalTree ?? null);
    this.#clauseIdToRoots = new Map();
    this.#passWithoutByClauseId = new Map();
    this.#passWithoutByTopLevel = new Map();

    clauseTracking.forEach((clause, index) => {
      this.#passWithoutByTopLevel.set(index, 0);
      if (clause.hierarchicalTree) {
        this.#collectClauseIds(clause.hierarchicalTree, index);
      }
    });
  }

  /**
   * Record a single sample's evaluation outcomes.
   *
   * @param {object} params
   * @param {Array<{passed: boolean}>} params.clauseResults
   * @param {Map<string, boolean>} params.atomTruthMap
   */
  recordSample({ clauseResults, atomTruthMap }) {
    if (!Array.isArray(clauseResults) || !atomTruthMap) {
      return;
    }

    const rootCount = this.#rootNodes.length;
    const rootPasses = clauseResults.map((result) =>
      typeof result === 'boolean' ? result : Boolean(result?.passed)
    );

    if (rootCount === 1) {
      this.#incrementTopLevel(0);
    } else {
      for (let i = 0; i < rootCount; i++) {
        const othersPassed = rootPasses.every(
          (passed, index) => index === i || passed
        );
        if (othersPassed) {
          this.#incrementTopLevel(i);
        }
      }
    }

    for (const [clauseId, rootIndices] of this.#clauseIdToRoots.entries()) {
      let expressionPasses = true;

      for (let i = 0; i < rootCount; i++) {
        let rootResult = rootPasses[i];
        if (rootIndices.has(i)) {
          const rootNode = this.#rootNodes[i];
          rootResult = rootNode
            ? this.#evaluateWithForcedClause(rootNode, atomTruthMap, clauseId)
            : rootResult;
        }

        if (!rootResult) {
          expressionPasses = false;
          break;
        }
      }

      if (expressionPasses) {
        this.#incrementClause(clauseId);
      }
    }
  }

  /**
   * Build ablation impact payload from accumulated counts.
   *
   * @param {object} params
   * @param {number} params.triggerCount
   * @param {number} params.sampleCount
   * @returns {object}
   */
  buildResult({ triggerCount, sampleCount }) {
    const originalPassRate =
      sampleCount > 0 ? triggerCount / sampleCount : 0;

    const clauseImpacts = [];
    for (const clauseId of this.#passWithoutByClauseId.keys()) {
      const passWithoutCount = this.#passWithoutByClauseId.get(clauseId) ?? 0;
      const normalizedCount = this.#normalizePassWithoutCount(
        passWithoutCount,
        triggerCount,
        sampleCount
      );
      const passWithoutRate =
        sampleCount > 0 ? normalizedCount / sampleCount : 0;
      clauseImpacts.push({
        clauseId,
        passWithoutRate,
        passWithoutCount: normalizedCount,
        sampleCount,
        impact: passWithoutRate - originalPassRate,
      });
    }

    clauseImpacts.sort(
      (a, b) =>
        b.impact - a.impact || a.clauseId.localeCompare(b.clauseId)
    );
    clauseImpacts.forEach((entry, index) => {
      entry.chokeRank = index + 1;
    });

    const topLevelImpacts = [];
    for (let i = 0; i < this.#rootNodes.length; i++) {
      const passWithoutCount = this.#passWithoutByTopLevel.get(i) ?? 0;
      const normalizedCount = this.#normalizePassWithoutCount(
        passWithoutCount,
        triggerCount,
        sampleCount
      );
      const passWithoutRate =
        sampleCount > 0 ? normalizedCount / sampleCount : 0;
      topLevelImpacts.push({
        clauseIndex: i,
        passWithoutRate,
        passWithoutCount: normalizedCount,
        sampleCount,
        impact: passWithoutRate - originalPassRate,
      });
    }

    return {
      originalPassRate,
      clauseImpacts,
      topLevelImpacts,
    };
  }

  #incrementTopLevel(index) {
    this.#passWithoutByTopLevel.set(
      index,
      (this.#passWithoutByTopLevel.get(index) ?? 0) + 1
    );
  }

  #incrementClause(clauseId) {
    this.#passWithoutByClauseId.set(
      clauseId,
      (this.#passWithoutByClauseId.get(clauseId) ?? 0) + 1
    );
  }

  #normalizePassWithoutCount(passWithoutCount, triggerCount, sampleCount) {
    const clamped = Math.max(passWithoutCount, triggerCount);
    return Math.min(sampleCount, clamped);
  }

  #collectClauseIds(node, rootIndex) {
    if (!node) {
      return;
    }

    if (node.nodeType === 'leaf') {
      if (node.clauseId) {
        this.#registerClauseId(node.clauseId, rootIndex);
      }
      return;
    }

    for (const child of node.children ?? []) {
      this.#collectClauseIds(child, rootIndex);
    }
  }

  #registerClauseId(clauseId, rootIndex) {
    const roots = this.#clauseIdToRoots.get(clauseId) ?? new Set();
    roots.add(rootIndex);
    this.#clauseIdToRoots.set(clauseId, roots);
    if (!this.#passWithoutByClauseId.has(clauseId)) {
      this.#passWithoutByClauseId.set(clauseId, 0);
    }
  }

  #evaluateWithForcedClause(node, atomTruthMap, forcedClauseId) {
    if (!node) {
      return true;
    }

    if (node.nodeType === 'leaf') {
      if (node.clauseId && node.clauseId === forcedClauseId) {
        return true;
      }
      const cacheKey = node.clauseId ?? `node:${node.id}`;
      if (atomTruthMap.has(cacheKey)) {
        return atomTruthMap.get(cacheKey);
      }
      return false;
    }

    if (node.nodeType === 'and') {
      for (const child of node.children ?? []) {
        if (!this.#evaluateWithForcedClause(child, atomTruthMap, forcedClauseId)) {
          return false;
        }
      }
      return true;
    }

    if (node.nodeType === 'or') {
      for (const child of node.children ?? []) {
        if (this.#evaluateWithForcedClause(child, atomTruthMap, forcedClauseId)) {
          return true;
        }
      }
      return false;
    }

    return false;
  }
}

export default AblationImpactCalculator;
