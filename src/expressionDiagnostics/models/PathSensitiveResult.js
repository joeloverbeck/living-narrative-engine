/**
 * @file PathSensitiveResult - Complete result of path-sensitive analysis
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

/**
 * @typedef {import('./AnalysisBranch.js').default} AnalysisBranch
 * @typedef {import('./BranchReachability.js').default} BranchReachability
 * @typedef {import('./KnifeEdge.js').default} KnifeEdge
 */

class PathSensitiveResult {
  /** @type {string} Expression ID */
  #expressionId;

  /** @type {AnalysisBranch[]} All analyzed branches */
  #branches;

  /** @type {BranchReachability[]} Per-branch reachability for all thresholds */
  #reachabilityByBranch;

  /** @type {number|null} Overall feasibility volume (optional) */
  #feasibilityVolume;

  /** @type {Date} When the analysis was performed */
  #analyzedAt;

  /**
   * @param {Object} params
   * @param {string} params.expressionId - Expression ID that was analyzed
   * @param {AnalysisBranch[]} params.branches - All analyzed branches
   * @param {BranchReachability[]} [params.reachabilityByBranch=[]] - Per-branch reachability
   * @param {number|null} [params.feasibilityVolume=null] - Feasibility volume (0-1)
   */
  constructor({
    expressionId,
    branches,
    reachabilityByBranch = [],
    feasibilityVolume = null,
  }) {
    if (typeof expressionId !== 'string' || expressionId.trim() === '') {
      throw new Error(
        'PathSensitiveResult requires non-empty expressionId string'
      );
    }
    if (!Array.isArray(branches)) {
      throw new Error('PathSensitiveResult requires branches array');
    }
    if (!Array.isArray(reachabilityByBranch)) {
      throw new Error(
        'PathSensitiveResult reachabilityByBranch must be an array'
      );
    }
    if (
      feasibilityVolume !== null &&
      (typeof feasibilityVolume !== 'number' || Number.isNaN(feasibilityVolume))
    ) {
      throw new Error(
        'PathSensitiveResult feasibilityVolume must be null or a number'
      );
    }

    this.#expressionId = expressionId;
    this.#branches = [...branches];
    this.#reachabilityByBranch = [...reachabilityByBranch];
    this.#feasibilityVolume = feasibilityVolume;
    this.#analyzedAt = new Date();
  }

  // Basic getters
  get expressionId() {
    return this.#expressionId;
  }
  get branches() {
    return [...this.#branches];
  }
  get reachabilityByBranch() {
    return [...this.#reachabilityByBranch];
  }
  get feasibilityVolume() {
    return this.#feasibilityVolume;
  }
  get analyzedAt() {
    return this.#analyzedAt;
  }

  // Computed properties

  /** @returns {number} Total number of branches analyzed */
  get branchCount() {
    return this.#branches.length;
  }

  /** @returns {number} Number of feasible branches (no conflicts) */
  get feasibleBranchCount() {
    return this.#branches.filter((b) => !b.isInfeasible).length;
  }

  /** @returns {number} Number of infeasible branches */
  get infeasibleBranchCount() {
    return this.#branches.filter((b) => b.isInfeasible).length;
  }

  /** @returns {boolean} True if ANY branch satisfies ALL thresholds */
  get hasFullyReachableBranch() {
    if (this.#branches.length === 0) return false;

    // Group reachability by branch
    const branchReachabilityMap = new Map();
    for (const r of this.#reachabilityByBranch) {
      if (!branchReachabilityMap.has(r.branchId)) {
        branchReachabilityMap.set(r.branchId, []);
      }
      branchReachabilityMap.get(r.branchId).push(r);
    }

    // Check if any branch has all thresholds reachable
    for (const [branchId, reachabilities] of branchReachabilityMap) {
      const branch = this.#branches.find((b) => b.branchId === branchId);
      if (branch && !branch.isInfeasible) {
        const allReachable = reachabilities.every((r) => r.isReachable);
        if (allReachable) return true;
      }
    }

    return false;
  }

  /** @returns {string[]} Branch IDs where all thresholds are reachable */
  get fullyReachableBranchIds() {
    const result = [];

    // Group reachability by branch
    const branchReachabilityMap = new Map();
    for (const r of this.#reachabilityByBranch) {
      if (!branchReachabilityMap.has(r.branchId)) {
        branchReachabilityMap.set(r.branchId, []);
      }
      branchReachabilityMap.get(r.branchId).push(r);
    }

    for (const [branchId, reachabilities] of branchReachabilityMap) {
      const branch = this.#branches.find((b) => b.branchId === branchId);
      if (branch && !branch.isInfeasible) {
        const allReachable = reachabilities.every((r) => r.isReachable);
        if (allReachable) result.push(branchId);
      }
    }

    return result;
  }

  /** @returns {KnifeEdge[]} All knife-edge constraints across all branches */
  get allKnifeEdges() {
    return this.#branches.flatMap((b) => b.knifeEdges || []);
  }

  /** @returns {number} Total knife-edge count across all branches */
  get totalKnifeEdgeCount() {
    return this.allKnifeEdges.length;
  }

  /**
   * Get branch by ID
   * @param {string} branchId
   * @returns {AnalysisBranch|undefined}
   */
  getBranch(branchId) {
    return this.#branches.find((b) => b.branchId === branchId);
  }

  /**
   * Get reachability results for a specific branch
   * @param {string} branchId
   * @returns {BranchReachability[]}
   */
  getReachabilityForBranch(branchId) {
    return this.#reachabilityByBranch.filter((r) => r.branchId === branchId);
  }

  /**
   * Get reachability results for a specific prototype across all branches
   * @param {string} prototypeId
   * @returns {BranchReachability[]}
   */
  getReachabilityForPrototype(prototypeId) {
    return this.#reachabilityByBranch.filter(
      (r) => r.prototypeId === prototypeId
    );
  }

  /**
   * Get all unreachable thresholds across all branches
   * @returns {BranchReachability[]}
   */
  getUnreachableThresholds() {
    return this.#reachabilityByBranch.filter((r) => !r.isReachable);
  }

  /**
   * Get overall status of the expression
   * @returns {'fully_reachable'|'partially_reachable'|'unreachable'}
   */
  get overallStatus() {
    if (this.hasFullyReachableBranch) return 'fully_reachable';
    if (this.feasibleBranchCount > 0) return 'partially_reachable';
    return 'unreachable';
  }

  /**
   * Get status emoji for overall status
   * @returns {string}
   */
  get statusEmoji() {
    const emojiMap = {
      fully_reachable: '🟢',
      partially_reachable: '🟡',
      unreachable: '🔴',
    };
    return emojiMap[this.overallStatus];
  }

  /**
   * Get human-readable summary message
   * @returns {string}
   */
  getSummaryMessage() {
    const status = this.overallStatus;
    const reachableCount = this.fullyReachableBranchIds.length;
    const total = this.branchCount;

    if (status === 'fully_reachable') {
      return `Expression CAN trigger via ${reachableCount} of ${total} branches`;
    }
    if (status === 'partially_reachable') {
      return `Expression has ${this.feasibleBranchCount} feasible branches, but thresholds may be unreachable`;
    }
    return `Expression CANNOT trigger - all ${total} branches are infeasible`;
  }

  /**
   * Convert to JSON for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      expressionId: this.#expressionId,
      branches: this.#branches.map((b) =>
        typeof b.toJSON === 'function' ? b.toJSON() : b
      ),
      branchCount: this.branchCount,
      feasibleBranchCount: this.feasibleBranchCount,
      reachabilityByBranch: this.#reachabilityByBranch.map((r) =>
        typeof r.toJSON === 'function' ? r.toJSON() : r
      ),
      hasFullyReachableBranch: this.hasFullyReachableBranch,
      fullyReachableBranchIds: this.fullyReachableBranchIds,
      allKnifeEdges: this.allKnifeEdges.map((ke) =>
        typeof ke.toJSON === 'function' ? ke.toJSON() : ke
      ),
      feasibilityVolume: this.#feasibilityVolume,
      overallStatus: this.overallStatus,
      analyzedAt: this.#analyzedAt.toISOString(),
    };
  }

  /**
   * Create compact summary for logging
   * @returns {string}
   */
  toSummary() {
    return (
      `${this.statusEmoji} ${this.#expressionId}: ` +
      `${this.fullyReachableBranchIds.length}/${this.branchCount} branches fully reachable, ` +
      `${this.totalKnifeEdgeCount} knife-edge(s)`
    );
  }
}

export default PathSensitiveResult;
