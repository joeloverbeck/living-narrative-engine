/**
 * @file DiagnosticResult - Unified result model for expression diagnostics
 * @description Aggregates output from all diagnostic layers (static analysis, Monte Carlo
 * simulation, witness finding, SMT solving). Provides consistent structure for UI display
 * and data export.
 * @see specs/expression-diagnostics.md
 */

/**
 * @typedef {'impossible' | 'extremely_rare' | 'rare' | 'normal' | 'frequent'} RarityCategory
 */

/**
 * @typedef {object} GateConflictInfo
 * @property {string} axis - The axis name where conflict occurs.
 * @property {{ min: number, max: number }} required - The required interval bounds.
 * @property {string[]} prototypes - The prototype IDs involved in the conflict.
 * @property {string[]} gates - The gate constraint strings causing the conflict.
 */

/**
 * @typedef {object} UnreachableThresholdInfo
 * @property {string} prototypeId - The prototype ID with unreachable threshold.
 * @property {string} type - The prototype type (emotion or sexual).
 * @property {number} threshold - The required threshold value.
 * @property {number} maxPossible - The maximum achievable intensity.
 * @property {number} gap - The difference between required and maximum possible.
 */

/**
 * @typedef {object} ClauseFailureInfo
 * @property {string} clauseDescription - Human-readable description of the clause.
 * @property {number} failureRate - Failure rate from 0 to 1.
 * @property {number} averageViolation - Average magnitude of constraint violation.
 * @property {number} clauseIndex - Index of the clause in the prerequisites array.
 */

/**
 * @typedef {object} ThresholdSuggestion
 * @property {string} clause - The clause description to modify.
 * @property {number} original - The original threshold value.
 * @property {number} suggested - The suggested threshold value.
 * @property {number} expectedTriggerRate - Expected trigger rate after adjustment.
 */

/**
 * Threshold values for rarity categorization.
 * Values represent rates as decimals (0.00001 = 0.001%).
 *
 * @type {Readonly<{IMPOSSIBLE: number, EXTREMELY_RARE: number, RARE: number, NORMAL: number}>}
 */
const RARITY_THRESHOLDS = Object.freeze({
  IMPOSSIBLE: 0,
  EXTREMELY_RARE: 0.00001, // 0.001%
  RARE: 0.0005, // 0.05%
  NORMAL: 0.02, // 2%
});

/**
 * Rarity category string constants.
 *
 * @type {Readonly<{UNKNOWN: string, IMPOSSIBLE: string, EXTREMELY_RARE: string, RARE: string, NORMAL: string, FREQUENT: string}>}
 */
const RARITY_CATEGORIES = Object.freeze({
  UNKNOWN: 'unknown',
  IMPOSSIBLE: 'impossible',
  EXTREMELY_RARE: 'extremely_rare',
  RARE: 'rare',
  NORMAL: 'normal',
  FREQUENT: 'frequent',
});

/**
 * UI status indicators for each rarity category.
 *
 * @type {Readonly<{[key: string]: {color: string, emoji: string, label: string}}>}
 */
const STATUS_INDICATORS = Object.freeze({
  unknown: { color: 'gray', emoji: '⚪', label: 'Unknown' },
  impossible: { color: 'red', emoji: '🔴', label: 'Impossible' },
  extremely_rare: { color: 'orange', emoji: '🟠', label: 'Extremely Rare' },
  rare: { color: 'yellow', emoji: '🟡', label: 'Rare' },
  normal: { color: 'green', emoji: '🟢', label: 'Normal' },
  frequent: { color: 'blue', emoji: '🔵', label: 'Frequent' },
});

/**
 * Unified result model aggregating output from all diagnostic layers.
 * Provides consistent structure for UI display and data export.
 */
class DiagnosticResult {
  /** @type {string} */
  #expressionId;

  /** @type {boolean} */
  #isImpossible = false;

  /** @type {string|null} */
  #impossibilityReason = null;

  /** @type {GateConflictInfo[]} */
  #gateConflicts = [];

  /** @type {UnreachableThresholdInfo[]} */
  #unreachableThresholds = [];

  /** @type {number|null} */
  #triggerRate = null;

  /** @type {number|null} */
  #confidenceIntervalLow = null;

  /** @type {number|null} */
  #confidenceIntervalHigh = null;

  /** @type {number} */
  #sampleCount = 0;

  /** @type {string|null} */
  #distribution = null;

  /** @type {ClauseFailureInfo[]} */
  #clauseFailures = [];

  /** @type {object|null} */
  #witnessState = null;

  /** @type {object|null} */
  #nearestMiss = null;

  /** @type {boolean|null} */
  #smtResult = null;

  /** @type {string[]|null} */
  #unsatCore = null;

  /** @type {ThresholdSuggestion[]} */
  #suggestions = [];

  /** @type {Date} */
  #timestamp;

  /**
   * Creates a new DiagnosticResult.
   *
   * @param {string} expressionId - The ID of the expression being diagnosed.
   * @throws {Error} If expressionId is missing or not a string.
   */
  constructor(expressionId) {
    if (!expressionId || typeof expressionId !== 'string') {
      throw new Error('DiagnosticResult requires expressionId');
    }
    this.#expressionId = expressionId;
    this.#timestamp = new Date();
  }

  // --- Getters ---

  /**
   * Gets the expression ID.
   *
   * @returns {string} The expression ID.
   */
  get expressionId() {
    return this.#expressionId;
  }

  /**
   * Whether the expression is impossible to trigger.
   *
   * @returns {boolean} True if impossible.
   */
  get isImpossible() {
    return this.#isImpossible;
  }

  /**
   * The reason why the expression is impossible (if applicable).
   *
   * @returns {string|null} The impossibility reason.
   */
  get impossibilityReason() {
    return this.#impossibilityReason;
  }

  /**
   * Gate conflicts detected in static analysis.
   *
   * @returns {GateConflictInfo[]} Copy of gate conflicts array.
   */
  get gateConflicts() {
    return [...this.#gateConflicts];
  }

  /**
   * Unreachable thresholds detected in static analysis.
   *
   * @returns {UnreachableThresholdInfo[]} Copy of unreachable thresholds array.
   */
  get unreachableThresholds() {
    return [...this.#unreachableThresholds];
  }

  /**
   * Estimated trigger rate from Monte Carlo simulation.
   *
   * @returns {number|null} Trigger rate (0 to 1) or null if not computed.
   */
  get triggerRate() {
    return this.#triggerRate;
  }

  /**
   * Confidence interval for the trigger rate estimate.
   *
   * @returns {{ low: number, high: number }|null} Confidence interval or null.
   */
  get confidenceInterval() {
    if (this.#confidenceIntervalLow === null) return null;
    return { low: this.#confidenceIntervalLow, high: this.#confidenceIntervalHigh };
  }

  /**
   * Number of samples used in Monte Carlo simulation.
   *
   * @returns {number} Sample count.
   */
  get sampleCount() {
    return this.#sampleCount;
  }

  /**
   * Distribution type used in Monte Carlo simulation.
   *
   * @returns {string|null} Distribution name or null.
   */
  get distribution() {
    return this.#distribution;
  }

  /**
   * Per-clause failure analysis from Monte Carlo simulation.
   *
   * @returns {ClauseFailureInfo[]} Copy of clause failures array.
   */
  get clauseFailures() {
    return [...this.#clauseFailures];
  }

  /**
   * Witness state that triggers the expression (if found).
   *
   * @returns {object|null} Witness state or null.
   */
  get witnessState() {
    return this.#witnessState;
  }

  /**
   * Nearest miss state (closest to triggering without passing).
   *
   * @returns {object|null} Nearest miss state or null.
   */
  get nearestMiss() {
    return this.#nearestMiss;
  }

  /**
   * SMT solver satisfiability result.
   *
   * @returns {boolean|null} True if satisfiable, false if unsatisfiable, null if not computed.
   */
  get smtResult() {
    return this.#smtResult;
  }

  /**
   * Minimal unsatisfiable core from SMT solver.
   *
   * @returns {string[]|null} Copy of unsat core array or null.
   */
  get unsatCore() {
    return this.#unsatCore ? [...this.#unsatCore] : null;
  }

  /**
   * Threshold adjustment suggestions.
   *
   * @returns {ThresholdSuggestion[]} Copy of suggestions array.
   */
  get suggestions() {
    return [...this.#suggestions];
  }

  /**
   * Timestamp when the diagnostic was created.
   *
   * @returns {Date} The timestamp.
   */
  get timestamp() {
    return this.#timestamp;
  }

  /**
   * Derive rarity category from trigger rate and impossibility status.
   *
   * @returns {RarityCategory} The rarity category.
   */
  get rarityCategory() {
    if (this.#isImpossible) {
      return RARITY_CATEGORIES.IMPOSSIBLE;
    }

    if (this.#triggerRate === null) {
      // No simulation data yet - return unknown (not impossible)
      // This allows static analysis to pass without falsely reporting impossible
      return RARITY_CATEGORIES.UNKNOWN;
    }

    if (this.#triggerRate === 0) {
      return RARITY_CATEGORIES.IMPOSSIBLE;
    }

    if (this.#triggerRate < RARITY_THRESHOLDS.EXTREMELY_RARE) {
      return RARITY_CATEGORIES.EXTREMELY_RARE;
    }

    if (this.#triggerRate < RARITY_THRESHOLDS.RARE) {
      return RARITY_CATEGORIES.RARE;
    }

    if (this.#triggerRate < RARITY_THRESHOLDS.NORMAL) {
      return RARITY_CATEGORIES.NORMAL;
    }

    return RARITY_CATEGORIES.FREQUENT;
  }

  /**
   * Get status indicator for UI display.
   *
   * @returns {{ color: string, emoji: string, label: string }} Status indicator object.
   */
  get statusIndicator() {
    return STATUS_INDICATORS[this.rarityCategory];
  }

  // --- Setters (Builder Pattern) ---

  /**
   * Set static analysis results.
   *
   * @param {object} staticResults - Static analysis results.
   * @param {GateConflictInfo[]} [staticResults.gateConflicts] - Detected gate conflicts.
   * @param {UnreachableThresholdInfo[]} [staticResults.unreachableThresholds] - Unreachable thresholds.
   * @returns {DiagnosticResult} This instance for chaining.
   */
  setStaticAnalysis(staticResults) {
    if (staticResults.gateConflicts) {
      this.#gateConflicts = [...staticResults.gateConflicts];
      if (this.#gateConflicts.length > 0) {
        this.#isImpossible = true;
        this.#impossibilityReason = `Gate conflict on axis: ${this.#gateConflicts[0].axis}`;
      }
    }

    if (staticResults.unreachableThresholds) {
      this.#unreachableThresholds = [...staticResults.unreachableThresholds];
      if (this.#unreachableThresholds.length > 0 && !this.#isImpossible) {
        this.#isImpossible = true;
        const first = this.#unreachableThresholds[0];
        this.#impossibilityReason = `Unreachable threshold: ${first.prototypeId} requires ${first.threshold}, max possible is ${first.maxPossible}`;
      }
    }

    return this;
  }

  /**
   * Set Monte Carlo simulation results.
   *
   * @param {object} mcResults - Monte Carlo simulation results.
   * @param {number} [mcResults.triggerRate] - Estimated trigger rate.
   * @param {number} [mcResults.sampleCount] - Number of samples used.
   * @param {string} [mcResults.distribution] - Distribution type used.
   * @param {{ low: number, high: number }} [mcResults.confidenceInterval] - Confidence interval.
   * @param {ClauseFailureInfo[]} [mcResults.clauseFailures] - Per-clause failure analysis.
   * @returns {DiagnosticResult} This instance for chaining.
   */
  setMonteCarloResults(mcResults) {
    this.#triggerRate = mcResults.triggerRate ?? null;
    this.#sampleCount = mcResults.sampleCount ?? 0;
    this.#distribution = mcResults.distribution ?? null;

    if (mcResults.confidenceInterval) {
      this.#confidenceIntervalLow = mcResults.confidenceInterval.low;
      this.#confidenceIntervalHigh = mcResults.confidenceInterval.high;
    }

    if (mcResults.clauseFailures) {
      this.#clauseFailures = [...mcResults.clauseFailures];
    }

    return this;
  }

  /**
   * Set witness finding results.
   *
   * @param {object} witnessResults - Witness finding results.
   * @param {object} [witnessResults.witnessState] - State that triggers the expression.
   * @param {object} [witnessResults.nearestMiss] - Closest non-triggering state.
   * @returns {DiagnosticResult} This instance for chaining.
   */
  setWitnessResults(witnessResults) {
    this.#witnessState = witnessResults.witnessState ?? null;
    this.#nearestMiss = witnessResults.nearestMiss ?? null;
    return this;
  }

  /**
   * Set SMT solver results.
   *
   * @param {object} smtResults - SMT solver results.
   * @param {boolean} [smtResults.satisfiable] - Whether constraints are satisfiable.
   * @param {string[]} [smtResults.unsatCore] - Minimal unsatisfiable core.
   * @returns {DiagnosticResult} This instance for chaining.
   */
  setSmtResults(smtResults) {
    this.#smtResult = smtResults.satisfiable ?? null;

    if (smtResults.unsatCore) {
      this.#unsatCore = [...smtResults.unsatCore];
      if (!smtResults.satisfiable) {
        this.#isImpossible = true;
        this.#impossibilityReason = 'SMT solver proved impossibility';
      }
    }

    return this;
  }

  /**
   * Set threshold suggestions.
   *
   * @param {ThresholdSuggestion[]} suggestions - Suggested threshold adjustments.
   * @returns {DiagnosticResult} This instance for chaining.
   */
  setSuggestions(suggestions) {
    this.#suggestions = [...suggestions];
    return this;
  }

  /**
   * Serialize to JSON for export.
   *
   * @returns {object} JSON-compatible representation.
   */
  toJSON() {
    return {
      expressionId: this.#expressionId,
      timestamp: this.#timestamp.toISOString(),
      rarityCategory: this.rarityCategory,
      statusIndicator: this.statusIndicator,
      isImpossible: this.#isImpossible,
      impossibilityReason: this.#impossibilityReason,
      staticAnalysis: {
        gateConflicts: this.#gateConflicts,
        unreachableThresholds: this.#unreachableThresholds,
      },
      monteCarlo: {
        triggerRate: this.#triggerRate,
        confidenceInterval: this.confidenceInterval,
        sampleCount: this.#sampleCount,
        distribution: this.#distribution,
        clauseFailures: this.#clauseFailures,
      },
      witness: {
        found: this.#witnessState !== null,
        state: this.#witnessState,
        nearestMiss: this.#nearestMiss,
      },
      smt: {
        satisfiable: this.#smtResult,
        unsatCore: this.#unsatCore,
      },
      suggestions: this.#suggestions,
    };
  }
}

// Export constants for use in tests and UI
DiagnosticResult.RARITY_THRESHOLDS = RARITY_THRESHOLDS;
DiagnosticResult.RARITY_CATEGORIES = RARITY_CATEGORIES;
DiagnosticResult.STATUS_INDICATORS = STATUS_INDICATORS;

/**
 * Get rarity category for a given trigger rate.
 * This static helper can be used without creating a DiagnosticResult instance.
 *
 * @param {number} rate - Trigger rate as decimal (0.02 = 2%)
 * @returns {string} Rarity category string from RARITY_CATEGORIES
 */
DiagnosticResult.getRarityCategoryForRate = function (rate) {
  if (rate === 0) return RARITY_CATEGORIES.IMPOSSIBLE;
  if (rate < RARITY_THRESHOLDS.EXTREMELY_RARE)
    return RARITY_CATEGORIES.EXTREMELY_RARE;
  if (rate < RARITY_THRESHOLDS.RARE) return RARITY_CATEGORIES.RARE;
  if (rate < RARITY_THRESHOLDS.NORMAL) return RARITY_CATEGORIES.NORMAL;
  return RARITY_CATEGORIES.FREQUENT;
};

export default DiagnosticResult;
