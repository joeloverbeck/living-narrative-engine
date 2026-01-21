/**
 * @file GateConstraintExtractor - Parses gate strings into per-axis intervals
 * Part B1 of Prototype Redundancy Analyzer v2
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} AxisInterval
 * @property {number|null} lower - Lower bound (null if unbounded below)
 * @property {number|null} upper - Upper bound (null if unbounded above)
 * @property {boolean} unsatisfiable - True if lower > upper
 */

/**
 * @typedef {object} ExtractionResult
 * @property {Map<string, AxisInterval>} intervals - Per-axis interval constraints
 * @property {string[]} unparsedGates - Gates that could not be parsed
 * @property {'complete'|'partial'|'failed'} parseStatus - Overall parsing status
 */

/**
 * Extracts per-axis interval constraints from gate strings.
 *
 * Supports gate patterns:
 * - Simple bounds: "threat <= 0.20" → upper=0.20
 * - Combined bounds: ["arousal >= -0.30", "arousal <= 0.35"] → interval [-0.30, 0.35]
 * - Strict inequalities: "valence > 0.10" → lower=0.10+strictEpsilon
 *
 * @class GateConstraintExtractor
 */
class GateConstraintExtractor {
  #config;
  #logger;

  /**
   * Regex pattern to match gate strings.
   * Format: <axis> <op> <number>
   * Examples: "threat <= 0.20", "arousal >= -0.5", "valence > 0.10"
   *
   * @type {RegExp}
   */
  static GATE_PATTERN = /^(\w+)\s*(>=|>|<=|<)\s*(-?\d+\.?\d*)$/;

  /**
   * Constructs a new GateConstraintExtractor instance.
   *
   * @param {object} deps - Dependencies for the extractor
   * @param {object} deps.config - Configuration with strictEpsilon
   * @param {import('../../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance
   */
  constructor({ config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    if (!config || typeof config !== 'object') {
      logger.error('GateConstraintExtractor: Missing or invalid config');
      throw new Error('GateConstraintExtractor requires a valid config object');
    }

    this.#validateConfigRequirements(config, logger);

    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Extract per-axis interval constraints from an array of gate strings.
   *
   * @param {string[]} gates - Array of gate condition strings
   * @returns {ExtractionResult} Extraction result with intervals and status
   */
  extract(gates) {
    // Defensive: handle invalid input
    if (!Array.isArray(gates)) {
      this.#logger.warn(
        'GateConstraintExtractor.extract: Invalid input, expected array'
      );
      return {
        intervals: new Map(),
        unparsedGates: [],
        parseStatus: 'complete',
      };
    }

    // Handle empty array
    if (gates.length === 0) {
      this.#logger.debug('GateConstraintExtractor: Empty gates array');
      return {
        intervals: new Map(),
        unparsedGates: [],
        parseStatus: 'complete',
      };
    }

    const intervalAccumulators = new Map();
    const unparsedGates = [];
    let parsedCount = 0;

    for (const gate of gates) {
      const parsed = this.#parseGate(gate);

      if (parsed === null) {
        unparsedGates.push(gate);
        continue;
      }

      parsedCount++;
      this.#accumulateBound(intervalAccumulators, parsed);
    }

    // Finalize intervals and detect unsatisfiable
    const intervals = this.#finalizeIntervals(intervalAccumulators);

    // Determine parse status
    const parseStatus = this.#determineParseStatus(
      parsedCount,
      unparsedGates.length,
      gates.length
    );

    this.#logger.debug(
      `GateConstraintExtractor: Parsed ${parsedCount}/${gates.length} gates, ` +
        `status=${parseStatus}, intervals=${intervals.size}`
    );

    return {
      intervals,
      unparsedGates,
      parseStatus,
    };
  }

  /**
   * Parse a single gate string into axis, operator, and value.
   *
   * @param {string} gate - Gate condition string
   * @returns {object|null} Parsed gate or null if unparseable
   * @private
   */
  #parseGate(gate) {
    if (typeof gate !== 'string' || gate.trim() === '') {
      return null;
    }

    const trimmed = gate.trim();
    const match = trimmed.match(GateConstraintExtractor.GATE_PATTERN);

    if (!match) {
      this.#logger.debug(
        `GateConstraintExtractor: Failed to parse gate: "${gate}"`
      );
      return null;
    }

    const [, axis, operator, valueStr] = match;
    const value = parseFloat(valueStr);

    if (isNaN(value)) {
      this.#logger.debug(
        `GateConstraintExtractor: Invalid numeric value in gate: "${gate}"`
      );
      return null;
    }

    // Normalize strict inequalities
    const normalizedBound = this.#normalizeBound(operator, value);

    return {
      axis,
      ...normalizedBound,
    };
  }

  /**
   * Normalize a bound based on operator type.
   * Strict inequalities (> or <) are adjusted by strictEpsilon.
   *
   * @param {string} operator - Comparison operator
   * @param {number} value - Numeric value
   * @returns {object} Normalized bound with type and value
   * @private
   */
  #normalizeBound(operator, value) {
    const epsilon = this.#config.strictEpsilon;

    switch (operator) {
      case '>=':
        return { boundType: 'lower', boundValue: value };
      case '>':
        // Strict lower bound: value + epsilon
        return { boundType: 'lower', boundValue: value + epsilon };
      case '<=':
        return { boundType: 'upper', boundValue: value };
      case '<':
        // Strict upper bound: value - epsilon
        return { boundType: 'upper', boundValue: value - epsilon };
      default:
        // Should never reach here due to regex
        return null;
    }
  }

  /**
   * Accumulate a parsed bound into the interval accumulators.
   *
   * @param {Map} accumulators - Map of axis -> { lower: number|null, upper: number|null }
   * @param {object} parsed - Parsed gate with axis, boundType, boundValue
   * @private
   */
  #accumulateBound(accumulators, parsed) {
    const { axis, boundType, boundValue } = parsed;

    if (!accumulators.has(axis)) {
      accumulators.set(axis, { lower: null, upper: null });
    }

    const acc = accumulators.get(axis);

    if (boundType === 'lower') {
      // Take the maximum of all lower bounds (most restrictive)
      if (acc.lower === null || boundValue > acc.lower) {
        acc.lower = boundValue;
      }
    } else if (boundType === 'upper') {
      // Take the minimum of all upper bounds (most restrictive)
      if (acc.upper === null || boundValue < acc.upper) {
        acc.upper = boundValue;
      }
    }
  }

  /**
   * Finalize intervals from accumulators and detect unsatisfiable cases.
   *
   * @param {Map} accumulators - Map of axis -> { lower: number|null, upper: number|null }
   * @returns {Map<string, AxisInterval>} Finalized intervals
   * @private
   */
  #finalizeIntervals(accumulators) {
    const intervals = new Map();

    for (const [axis, acc] of accumulators.entries()) {
      const unsatisfiable =
        acc.lower !== null && acc.upper !== null && acc.lower > acc.upper;

      if (unsatisfiable) {
        this.#logger.warn(
          `GateConstraintExtractor: Unsatisfiable interval for axis "${axis}": ` +
            `lower=${acc.lower} > upper=${acc.upper}`
        );
      }

      intervals.set(axis, {
        lower: acc.lower,
        upper: acc.upper,
        unsatisfiable,
      });
    }

    return intervals;
  }

  /**
   * Determine overall parse status based on counts.
   *
   * @param {number} parsedCount - Number of successfully parsed gates
   * @param {number} unparsedCount - Number of unparsed gates
   * @param {number} totalCount - Total number of gates
   * @returns {'complete'|'partial'|'failed'} Parse status
   * @private
   */
  #determineParseStatus(parsedCount, unparsedCount, totalCount) {
    if (totalCount === 0) {
      return 'complete';
    }

    if (parsedCount === 0) {
      return 'failed';
    }

    if (unparsedCount > 0) {
      return 'partial';
    }

    return 'complete';
  }

  /**
   * Validate that config has required properties.
   *
   * @param {object} config - Configuration object
   * @param {object} logger - Logger for error messages
   * @private
   */
  #validateConfigRequirements(config, logger) {
    if (typeof config.strictEpsilon !== 'number') {
      logger.error(
        'GateConstraintExtractor: Missing or invalid config.strictEpsilon (expected number)'
      );
      throw new Error(
        'GateConstraintExtractor config requires numeric strictEpsilon'
      );
    }

    if (config.strictEpsilon <= 0) {
      logger.error(
        `GateConstraintExtractor: config.strictEpsilon must be positive, got ${config.strictEpsilon}`
      );
      throw new Error(
        'GateConstraintExtractor config.strictEpsilon must be positive'
      );
    }
  }
}

export default GateConstraintExtractor;
