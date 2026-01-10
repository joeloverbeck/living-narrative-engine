/**
 * @file BranchReachability - Threshold reachability result for a specific branch
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

/**
 * @typedef {import('./KnifeEdge.js').default} KnifeEdge
 */

class BranchReachability {
  /** @type {string} Branch identifier */
  #branchId;

  /** @type {string} Branch description */
  #branchDescription;

  /** @type {string} Prototype ID being tested */
  #prototypeId;

  /** @type {'emotion'|'sexual'} Prototype type */
  #type;

  /** @type {'high'|'low'} Threshold direction - 'high' means >= threshold, 'low' means < threshold */
  #direction;

  /** @type {number} Required threshold */
  #threshold;

  /** @type {number} Maximum achievable in this branch */
  #maxPossible;

  /** @type {number} Minimum achievable in this branch (for LOW direction calculations) */
  #minPossible;

  /** @type {boolean} True if threshold is reachable in this branch */
  #isReachable;

  /** @type {number} Gap if unreachable, 0 if reachable */
  #gap;

  /** @type {object[]} Knife-edge constraints affecting this threshold */
  #knifeEdges;

  /**
   * @param {object} params
   * @param {string} params.branchId - Branch identifier
   * @param {string} params.branchDescription - Human-readable branch description
   * @param {string} params.prototypeId - Prototype being tested (e.g., "flow")
   * @param {'emotion'|'sexual'} params.type - Prototype type
   * @param {'high'|'low'} [params.direction='high'] - Threshold direction:
   *   - 'high': Value must be >= threshold (e.g., flow >= 0.75)
   *   - 'low': Value must be < threshold (e.g., despair < 0.65)
   * @param {number} params.threshold - Required threshold value
   * @param {number} params.maxPossible - Maximum achievable value in this branch
   * @param {number} [params.minPossible=0] - Minimum achievable value in this branch (for LOW direction)
   * @param {object[]} [params.knifeEdges] - Knife-edge constraints
   */
  constructor({
    branchId,
    branchDescription,
    prototypeId,
    type,
    direction = 'high',
    threshold,
    maxPossible,
    minPossible = 0,
    knifeEdges = [],
  }) {
    if (typeof branchId !== 'string' || branchId.trim() === '') {
      throw new Error('BranchReachability requires non-empty branchId string');
    }
    if (typeof branchDescription !== 'string') {
      throw new Error('BranchReachability requires branchDescription string');
    }
    if (typeof prototypeId !== 'string' || prototypeId.trim() === '') {
      throw new Error(
        'BranchReachability requires non-empty prototypeId string'
      );
    }
    if (type !== 'emotion' && type !== 'sexual') {
      throw new Error('BranchReachability type must be "emotion" or "sexual"');
    }
    if (direction !== 'high' && direction !== 'low') {
      throw new Error('BranchReachability direction must be "high" or "low"');
    }
    if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
      throw new Error('BranchReachability requires numeric threshold');
    }
    if (typeof maxPossible !== 'number' || Number.isNaN(maxPossible)) {
      throw new Error('BranchReachability requires numeric maxPossible');
    }
    if (typeof minPossible !== 'number' || Number.isNaN(minPossible)) {
      throw new Error('BranchReachability requires numeric minPossible');
    }
    if (!Array.isArray(knifeEdges)) {
      throw new Error('BranchReachability knifeEdges must be an array');
    }

    this.#branchId = branchId;
    this.#branchDescription = branchDescription;
    this.#prototypeId = prototypeId;
    this.#type = type;
    this.#direction = direction;
    this.#threshold = threshold;
    this.#maxPossible = maxPossible;
    this.#minPossible = minPossible;

    // Direction-aware reachability calculation
    // HIGH direction (>= threshold): reachable if maxPossible >= threshold
    // LOW direction (< threshold): reachable if minPossible < threshold
    if (direction === 'high') {
      this.#isReachable = maxPossible >= threshold;
      this.#gap = this.#isReachable ? 0 : threshold - maxPossible;
    } else {
      // LOW direction: The question is "can the emotion go below threshold?"
      // Reachable if minPossible < threshold (can achieve a value below the threshold)
      // Unreachable if minPossible >= threshold (stuck above/at threshold)
      this.#isReachable = minPossible < threshold;
      // Gap for LOW: how far above threshold the minimum is stuck
      this.#gap = this.#isReachable ? 0 : minPossible - threshold;
    }
    this.#knifeEdges = [...knifeEdges];
  }

  // Getters
  get branchId() {
    return this.#branchId;
  }
  get branchDescription() {
    return this.#branchDescription;
  }
  get prototypeId() {
    return this.#prototypeId;
  }
  get type() {
    return this.#type;
  }
  get direction() {
    return this.#direction;
  }
  get threshold() {
    return this.#threshold;
  }
  get maxPossible() {
    return this.#maxPossible;
  }
  get minPossible() {
    return this.#minPossible;
  }
  get isReachable() {
    return this.#isReachable;
  }
  get gap() {
    return this.#gap;
  }
  get knifeEdges() {
    return [...this.#knifeEdges];
  }

  /**
   * Check if this has any knife-edge constraints
   *
   * @returns {boolean}
   */
  get hasKnifeEdges() {
    return this.#knifeEdges.length > 0;
  }

  /**
   * Get status indicator for UI display
   *
   * @returns {'reachable'|'unreachable'|'knife-edge'}
   */
  get status() {
    if (!this.#isReachable) return 'unreachable';
    if (this.#knifeEdges.length > 0) return 'knife-edge';
    return 'reachable';
  }

  /**
   * Get status emoji for display
   *
   * @returns {string}
   */
  get statusEmoji() {
    const emojiMap = {
      reachable: '\u2705',
      unreachable: '\u274C',
      'knife-edge': '\u26A0\uFE0F',
    };
    return emojiMap[this.status];
  }

  /**
   * Get gap as percentage of threshold
   *
   * @returns {number}
   */
  get gapPercentage() {
    if (this.#threshold === 0) return 0;
    return (this.#gap / this.#threshold) * 100;
  }

  /**
   * Create human-readable summary
   *
   * @returns {string}
   */
  toSummary() {
    const status = this.#isReachable
      ? 'Reachable'
      : `Unreachable (gap: ${this.#gap.toFixed(2)})`;
    const keWarning =
      this.#knifeEdges.length > 0
        ? ` [${this.#knifeEdges.length} knife-edge(s)]`
        : '';
    const operator = this.#direction === 'high' ? '>=' : '<';

    return (
      `${this.#prototypeId} ${operator} ${this.#threshold}: ${status}${keWarning}` +
      `\n  Max possible: ${this.#maxPossible.toFixed(2)}` +
      `\n  Direction: ${this.#direction}` +
      `\n  Branch: ${this.#branchDescription}`
    );
  }

  /**
   * Convert to JSON for serialization
   *
   * @returns {object}
   */
  toJSON() {
    return {
      branchId: this.#branchId,
      branchDescription: this.#branchDescription,
      prototypeId: this.#prototypeId,
      type: this.#type,
      direction: this.#direction,
      threshold: this.#threshold,
      maxPossible: this.#maxPossible,
      minPossible: this.#minPossible,
      isReachable: this.#isReachable,
      gap: this.#gap,
      knifeEdges: this.#knifeEdges.map((ke) =>
        typeof ke.toJSON === 'function' ? ke.toJSON() : ke
      ),
      status: this.status,
    };
  }

  /**
   * Create from JSON
   *
   * @param {object} json
   * @returns {BranchReachability}
   */
  static fromJSON(json) {
    return new BranchReachability({
      branchId: json.branchId,
      branchDescription: json.branchDescription,
      prototypeId: json.prototypeId,
      type: json.type,
      direction: json.direction || 'high',
      threshold: json.threshold,
      maxPossible: json.maxPossible,
      minPossible: json.minPossible ?? 0,
      knifeEdges: json.knifeEdges || [],
    });
  }

  /**
   * Create display object for UI table row
   *
   * @returns {object}
   */
  toTableRow() {
    const operator = this.#direction === 'high' ? '>=' : '<';
    return {
      prototype: this.#prototypeId,
      type: this.#type,
      direction: this.#direction,
      required: `${operator} ${this.#threshold.toFixed(2)}`,
      maxPossible: this.#maxPossible.toFixed(2),
      minPossible: this.#minPossible.toFixed(2),
      gap: this.#gap.toFixed(2),
      status: this.statusEmoji,
      branch: this.#branchDescription,
    };
  }
}

export default BranchReachability;
