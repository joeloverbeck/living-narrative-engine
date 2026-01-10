/**
 * @file AnalysisBranch - Represents a single path through OR branches with its constraint state
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

/**
 * @typedef {import('./AxisInterval.js').default} AxisInterval
 */

/**
 * @typedef {Object} GateConflict
 * @property {string} axis - The axis with conflicting constraints
 * @property {string} message - Human-readable conflict description
 */

class AnalysisBranch {
  /** @type {string} Unique branch identifier (e.g., "0.1.0" for nested paths) */
  #branchId;

  /** @type {string} Human-readable description (e.g., "entrancement branch") */
  #description;

  /** @type {Map<string, AxisInterval>} Axis intervals for this branch */
  #axisIntervals;

  /** @type {string[]} Prototype IDs included in this branch */
  #requiredPrototypes;

  /** @type {string[]} Prototypes with HIGH threshold (>= or >), gates enforced */
  #activePrototypes;

  /** @type {string[]} Prototypes with LOW threshold (<= or <), gates ignored */
  #inactivePrototypes;

  /** @type {boolean} True if any axis interval is empty */
  #isInfeasible;

  /** @type {GateConflict[]} Conflicts detected in this branch */
  #conflicts;

  /** @type {Object[]} Knife-edge constraints in this branch (populated externally) */
  #knifeEdges;

  /**
   * @param {Object} params
   * @param {string} params.branchId - Unique branch identifier
   * @param {string} params.description - Human-readable description
   * @param {string[]} [params.requiredPrototypes=[]] - Prototype IDs in this branch
   * @param {string[]} [params.activePrototypes=[]] - Prototypes with HIGH threshold (gates enforced)
   * @param {string[]} [params.inactivePrototypes=[]] - Prototypes with LOW threshold (gates ignored)
   * @param {Map<string, AxisInterval>} [params.axisIntervals] - Computed intervals
   * @param {GateConflict[]} [params.conflicts=[]] - Detected conflicts
   * @param {Object[]} [params.knifeEdges=[]] - Knife-edge constraints
   */
  constructor({
    branchId,
    description,
    requiredPrototypes = [],
    activePrototypes = [],
    inactivePrototypes = [],
    axisIntervals = new Map(),
    conflicts = [],
    knifeEdges = [],
  }) {
    if (typeof branchId !== 'string' || branchId.trim() === '') {
      throw new Error('AnalysisBranch requires non-empty branchId string');
    }
    if (typeof description !== 'string') {
      throw new Error('AnalysisBranch requires description string');
    }
    if (!Array.isArray(requiredPrototypes)) {
      throw new Error('AnalysisBranch requiredPrototypes must be an array');
    }

    this.#branchId = branchId;
    this.#description = description;
    this.#requiredPrototypes = [...requiredPrototypes];
    this.#activePrototypes = [...activePrototypes];
    this.#inactivePrototypes = [...inactivePrototypes];
    this.#axisIntervals = new Map(axisIntervals);
    this.#conflicts = [...conflicts];
    this.#knifeEdges = [...knifeEdges];
    this.#isInfeasible = conflicts.length > 0;
  }

  // Getters
  get branchId() {
    return this.#branchId;
  }
  get description() {
    return this.#description;
  }
  get requiredPrototypes() {
    return [...this.#requiredPrototypes];
  }
  /** @returns {string[]} Prototypes with HIGH threshold (gates enforced) */
  get activePrototypes() {
    return [...this.#activePrototypes];
  }
  /** @returns {string[]} Prototypes with LOW threshold (gates ignored) */
  get inactivePrototypes() {
    return [...this.#inactivePrototypes];
  }
  get axisIntervals() {
    return new Map(this.#axisIntervals);
  }
  get conflicts() {
    return [...this.#conflicts];
  }
  get knifeEdges() {
    return [...this.#knifeEdges];
  }
  get isInfeasible() {
    return this.#isInfeasible;
  }

  /**
   * Check if branch includes a specific prototype
   * @param {string} prototypeId
   * @returns {boolean}
   */
  hasPrototype(prototypeId) {
    return this.#requiredPrototypes.includes(prototypeId);
  }

  /**
   * Get axis interval for a specific axis
   * @param {string} axis
   * @returns {AxisInterval|undefined}
   */
  getAxisInterval(axis) {
    return this.#axisIntervals.get(axis);
  }

  /**
   * Create a copy with updated axis intervals
   * @param {Map<string, AxisInterval>} axisIntervals
   * @returns {AnalysisBranch}
   */
  withAxisIntervals(axisIntervals) {
    return new AnalysisBranch({
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: this.#requiredPrototypes,
      activePrototypes: this.#activePrototypes,
      inactivePrototypes: this.#inactivePrototypes,
      axisIntervals,
      conflicts: this.#conflicts,
      knifeEdges: this.#knifeEdges,
    });
  }

  /**
   * Create a copy with updated conflicts
   * @param {GateConflict[]} conflicts
   * @returns {AnalysisBranch}
   */
  withConflicts(conflicts) {
    return new AnalysisBranch({
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: this.#requiredPrototypes,
      activePrototypes: this.#activePrototypes,
      inactivePrototypes: this.#inactivePrototypes,
      axisIntervals: this.#axisIntervals,
      conflicts,
      knifeEdges: this.#knifeEdges,
    });
  }

  /**
   * Create a copy with updated knife-edges
   * @param {Object[]} knifeEdges
   * @returns {AnalysisBranch}
   */
  withKnifeEdges(knifeEdges) {
    return new AnalysisBranch({
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: this.#requiredPrototypes,
      activePrototypes: this.#activePrototypes,
      inactivePrototypes: this.#inactivePrototypes,
      axisIntervals: this.#axisIntervals,
      conflicts: this.#conflicts,
      knifeEdges,
    });
  }

  /**
   * Create a copy with active/inactive prototype partitioning
   * @param {string[]} activePrototypes - Prototypes with HIGH threshold (gates enforced)
   * @param {string[]} inactivePrototypes - Prototypes with LOW threshold (gates ignored)
   * @returns {AnalysisBranch}
   */
  withPrototypePartitioning(activePrototypes, inactivePrototypes) {
    return new AnalysisBranch({
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: this.#requiredPrototypes,
      activePrototypes,
      inactivePrototypes,
      axisIntervals: this.#axisIntervals,
      conflicts: this.#conflicts,
      knifeEdges: this.#knifeEdges,
    });
  }

  /**
   * Convert to JSON for serialization
   * @returns {Object}
   */
  toJSON() {
    const axisIntervalsObj = {};
    for (const [key, interval] of this.#axisIntervals) {
      axisIntervalsObj[key] = {
        min: interval.min,
        max: interval.max,
      };
    }

    return {
      branchId: this.#branchId,
      description: this.#description,
      requiredPrototypes: [...this.#requiredPrototypes],
      activePrototypes: [...this.#activePrototypes],
      inactivePrototypes: [...this.#inactivePrototypes],
      axisIntervals: axisIntervalsObj,
      conflicts: [...this.#conflicts],
      knifeEdges: [...this.#knifeEdges],
      isInfeasible: this.#isInfeasible,
    };
  }

  /**
   * Create human-readable summary
   * @returns {string}
   */
  toSummary() {
    const status = this.#isInfeasible ? '❌ Infeasible' : '✅ Feasible';
    const activeList = this.#activePrototypes.join(', ') || 'none';
    const inactiveList = this.#inactivePrototypes.join(', ') || 'none';
    return (
      `Branch ${this.#branchId}: ${this.#description}\n` +
      `  Status: ${status}\n` +
      `  Active (gates enforced): ${activeList}\n` +
      `  Inactive (gates ignored): ${inactiveList}\n` +
      `  Conflicts: ${this.#conflicts.length}\n` +
      `  Knife-edges: ${this.#knifeEdges.length}`
    );
  }
}

export default AnalysisBranch;
