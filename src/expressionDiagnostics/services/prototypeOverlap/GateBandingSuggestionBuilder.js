/**
 * @file GateBandingSuggestionBuilder - Builds gate adjustment suggestions for nested siblings
 * Part of PROREDANAV2-015: Suggests new gate bounds to separate overlapping prototypes.
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} AxisInterval
 * @property {number|null} lower - Lower bound (null = unbounded below / -∞)
 * @property {number|null} upper - Upper bound (null = unbounded above / +∞)
 * @property {boolean} unsatisfiable - True if interval is empty (lower > upper)
 */

/**
 * @typedef {object} AxisEvidence
 * @property {string} axis - The axis name
 * @property {AxisInterval} intervalA - Interval from prototype A
 * @property {AxisInterval} intervalB - Interval from prototype B
 * @property {boolean} A_subset_B - Whether A's interval is a subset of B's
 * @property {boolean} B_subset_A - Whether B's interval is a subset of A's
 */

/**
 * @typedef {object} ImplicationResult
 * @property {boolean} A_implies_B - True if A's gates imply B's gates
 * @property {boolean} B_implies_A - True if B's gates imply A's gates
 * @property {string[]} counterExampleAxes - Axes where implication fails
 * @property {AxisEvidence[]} evidence - Per-axis comparison details
 * @property {'equal'|'narrower'|'wider'|'disjoint'|'overlapping'} relation - Overall relationship
 */

/**
 * @typedef {object} GateBandingSuggestion
 * @property {'gate_band'|'expression_suppression'} type - Suggestion type
 * @property {string} [axis] - Axis for gate_band type
 * @property {string} [affectedPrototype] - 'A' or 'B' that should add the gate
 * @property {string} [suggestedGate] - Suggested gate expression (e.g., "valence >= 0.35")
 * @property {string} [reason] - Explanation of why this gate is suggested
 * @property {string} message - Human-readable suggestion message
 * @property {string} [suggestedAction] - Recommended action for expression_suppression
 */

/**
 * Builds gate adjustment suggestions from gate implication analysis.
 *
 * When two prototypes are classified as "nested_siblings" or "needs_separation",
 * this service analyzes the per-axis gate intervals to suggest new bounds
 * that would create clean separation between them.
 *
 * Strategy:
 * 1. For each axis where one interval is narrower, suggest adding a gate
 *    to the broader prototype that excludes the narrower prototype's range.
 * 2. For nested siblings, suggest expression-level suppression rules.
 */
class GateBandingSuggestionBuilder {
  #config;
  #logger;

  /**
   * Constructs a new GateBandingSuggestionBuilder instance.
   *
   * @param {object} deps - Dependencies object
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG with bandMargin
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - ILogger
   */
  constructor({ config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#validateConfig(config, logger);

    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Build gate banding suggestions from implication analysis.
   *
   * @param {ImplicationResult|null} gateImplicationResult - Result from GateImplicationEvaluator
   * @param {string} classification - Classification type from OverlapClassifier
   * @returns {GateBandingSuggestion[]} Array of suggestions
   */
  buildSuggestions(gateImplicationResult, classification) {
    const suggestions = [];
    const bandMargin = this.#config.bandMargin ?? 0.05;

    // Only generate suggestions for nested_siblings or needs_separation
    if (!['nested_siblings', 'needs_separation'].includes(classification)) {
      this.#logger.debug(
        `GateBandingSuggestionBuilder: No suggestions for classification "${classification}"`
      );
      return suggestions;
    }

    // Handle missing or empty evidence gracefully
    const evidence = gateImplicationResult?.evidence;
    if (!evidence || !Array.isArray(evidence) || evidence.length === 0) {
      this.#logger.debug(
        'GateBandingSuggestionBuilder: No evidence available in implication result'
      );
    } else {
      // Process each axis evidence
      for (const axisEvidence of evidence) {
        const relation = this.#deriveAxisRelation(axisEvidence);
        const suggestion = this.#analyzeAxisForBanding(
          axisEvidence,
          relation,
          bandMargin
        );
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    // Add expression suppression suggestion for nested siblings
    if (classification === 'nested_siblings') {
      suggestions.push({
        type: 'expression_suppression',
        message:
          'When higher-tier prototype is active, cap lower-tier intensity to 0',
        suggestedAction: 'Add expression-level mutual exclusion rule',
      });
    }

    this.#logger.debug(
      `GateBandingSuggestionBuilder: Generated ${suggestions.length} suggestions ` +
        `for classification "${classification}"`
    );

    return suggestions;
  }

  /**
   * Derive per-axis relation from subset flags.
   *
   * @param {AxisEvidence} axisEvidence - Per-axis evidence
   * @returns {'equal'|'narrower'|'wider'|'overlapping'} Per-axis relation
   * @private
   */
  #deriveAxisRelation(axisEvidence) {
    const { A_subset_B, B_subset_A } = axisEvidence;

    if (A_subset_B && B_subset_A) {
      return 'equal';
    }
    if (A_subset_B && !B_subset_A) {
      // A is a subset of B means A is narrower
      return 'narrower';
    }
    if (!A_subset_B && B_subset_A) {
      // B is a subset of A means A is wider
      return 'wider';
    }
    return 'overlapping';
  }

  /**
   * Analyze an axis for potential gate banding suggestion.
   *
   * @param {AxisEvidence} axisEvidence - Per-axis evidence
   * @param {'equal'|'narrower'|'wider'|'overlapping'} relation - Derived relation
   * @param {number} bandMargin - Margin to add for separation
   * @returns {GateBandingSuggestion|null} Suggestion or null if not applicable
   * @private
   */
  #analyzeAxisForBanding(axisEvidence, relation, bandMargin) {
    const { axis, intervalA, intervalB } = axisEvidence;

    // Only suggest banding for narrower/wider relationships
    if (relation !== 'narrower' && relation !== 'wider') {
      return null;
    }

    // Determine which is the narrower and which is the broader interval
    const narrower = relation === 'narrower' ? intervalA : intervalB;
    const broader = relation === 'narrower' ? intervalB : intervalA;
    const narrowerLabel = relation === 'narrower' ? 'A' : 'B';
    const broaderLabel = relation === 'narrower' ? 'B' : 'A';

    // Handle null as unbounded
    const narrowerUpper = narrower.upper ?? Infinity;
    const narrowerLower = narrower.lower ?? -Infinity;
    const broaderUpper = broader.upper ?? Infinity;
    const broaderLower = broader.lower ?? -Infinity;

    // Try to find a meaningful separation boundary
    let suggestion = null;

    // Case 1: Narrower has an upper bound that's below broader's upper bound
    // Suggest adding a gate to broader that requires values above narrower's upper bound
    if (narrowerUpper < Infinity && narrowerUpper < broaderUpper) {
      const newLowerBound = narrowerUpper + bandMargin;
      suggestion = {
        type: 'gate_band',
        axis,
        affectedPrototype: broaderLabel,
        suggestedGate: `${axis} >= ${newLowerBound.toFixed(2)}`,
        reason: `${narrowerLabel} has tighter ${axis} constraints (upper: ${narrowerUpper.toFixed(2)})`,
        message:
          `Add gate "${axis} >= ${newLowerBound.toFixed(2)}" to ${broaderLabel} ` +
          `to exclude overlap with ${narrowerLabel}`,
      };
    }
    // Case 2: Narrower has a lower bound that's above broader's lower bound
    // Suggest adding a gate to broader that requires values below narrower's lower bound
    else if (narrowerLower > -Infinity && narrowerLower > broaderLower) {
      const newUpperBound = narrowerLower - bandMargin;
      suggestion = {
        type: 'gate_band',
        axis,
        affectedPrototype: broaderLabel,
        suggestedGate: `${axis} <= ${newUpperBound.toFixed(2)}`,
        reason: `${narrowerLabel} has tighter ${axis} constraints (lower: ${narrowerLower.toFixed(2)})`,
        message:
          `Add gate "${axis} <= ${newUpperBound.toFixed(2)}" to ${broaderLabel} ` +
          `to exclude overlap with ${narrowerLabel}`,
      };
    }

    return suggestion;
  }

  /**
   * Validate that config has required fields.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   * @private
   */
  #validateConfig(config, logger) {
    if (!config || typeof config !== 'object') {
      logger.error('GateBandingSuggestionBuilder: Missing or invalid config');
      throw new Error(
        'GateBandingSuggestionBuilder requires a valid config object'
      );
    }

    if (typeof config.bandMargin !== 'number') {
      logger.error(
        'GateBandingSuggestionBuilder: Missing or invalid config.bandMargin'
      );
      throw new Error(
        'GateBandingSuggestionBuilder config requires numeric bandMargin'
      );
    }
  }
}

export default GateBandingSuggestionBuilder;
