/**
 * @file GateConstraint - Parses and represents a gate condition string
 * @description Encapsulates gate constraint parsing for the Expression Diagnostics system.
 * Handles gate strings like "valence >= 0.35" or "threat <= -0.20".
 */

import AxisInterval from './AxisInterval.js';

/**
 * Valid comparison operators for gate constraints.
 *
 * @type {readonly string[]}
 */
const VALID_OPERATORS = Object.freeze(['>=', '<=', '>', '<', '==']);

/**
 * Represents a parsed gate constraint from an emotion/sexual prototype.
 * Immutable - captures axis name, operator, threshold value.
 */
class GateConstraint {
  /**
   * The mood/sexual axis name.
   *
   * @type {string}
   */
  #axis;

  /**
   * The comparison operator.
   *
   * @type {string}
   */
  #operator;

  /**
   * The threshold value.
   *
   * @type {number}
   */
  #value;

  /**
   * The original gate string for debugging.
   *
   * @type {string}
   */
  #originalString;

  /**
   * Creates a new GateConstraint.
   *
   * @param {string} axis - The mood/sexual axis name (e.g., 'valence', 'threat').
   * @param {string} operator - Comparison operator (>=, <=, >, <, ==).
   * @param {number} value - Threshold value.
   * @param {string} [originalString] - Original gate string for debugging.
   */
  constructor(axis, operator, value, originalString = '') {
    if (typeof axis !== 'string' || axis.trim() === '') {
      throw new Error('GateConstraint requires a non-empty axis name');
    }
    if (!VALID_OPERATORS.includes(operator)) {
      throw new Error(
        `Invalid operator: ${operator}. Valid operators: ${VALID_OPERATORS.join(', ')}`
      );
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('GateConstraint requires a finite numeric value');
    }

    this.#axis = axis;
    this.#operator = operator;
    this.#value = value;
    this.#originalString = originalString || `${axis} ${operator} ${value}`;
    Object.freeze(this);
  }

  /**
   * Gets the axis name (e.g., 'valence', 'threat').
   *
   * @returns {string} The axis name.
   */
  get axis() {
    return this.#axis;
  }

  /**
   * Gets the comparison operator.
   *
   * @returns {string} The comparison operator.
   */
  get operator() {
    return this.#operator;
  }

  /**
   * Gets the threshold value.
   *
   * @returns {number} The threshold value.
   */
  get value() {
    return this.#value;
  }

  /**
   * Gets the original gate string (for debugging/display).
   *
   * @returns {string} The original gate string.
   */
  get originalString() {
    return this.#originalString;
  }

  /**
   * Parse a gate string like "valence >= 0.35" or "threat <= -0.20".
   * Matches the parsing pattern used in emotionCalculatorService.js.
   *
   * @param {string} gateString - The gate condition string to parse.
   * @returns {GateConstraint} The parsed constraint.
   * @throws {Error} If parsing fails or the string is malformed.
   */
  static parse(gateString) {
    if (typeof gateString !== 'string') {
      throw new Error('parse requires a string argument');
    }

    const trimmed = gateString.trim();

    // Match patterns like "axis >= value" or "axis<=value" or "axis == -0.20"
    // Regex aligned with emotionCalculatorService.js#parseGate pattern
    const match = trimmed.match(/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/);

    if (!match) {
      throw new Error(`Cannot parse gate string: "${gateString}"`);
    }

    const [, axis, operator, valueStr] = match;
    const value = parseFloat(valueStr);

    if (Number.isNaN(value)) {
      throw new Error(`Invalid numeric value in gate: "${gateString}"`);
    }

    return new GateConstraint(axis, operator, value, gateString);
  }

  /**
   * Apply this constraint to an AxisInterval, tightening its bounds.
   *
   * @param {AxisInterval} interval - The interval to constrain.
   * @returns {AxisInterval} New interval with constraint applied.
   */
  applyTo(interval) {
    if (!(interval instanceof AxisInterval)) {
      throw new Error('applyTo requires an AxisInterval instance');
    }
    return interval.applyConstraint(this.#operator, this.#value);
  }

  /**
   * Check if a value satisfies this constraint.
   *
   * @param {number} axisValue - The axis value to check.
   * @returns {boolean} True if the value satisfies the constraint.
   */
  isSatisfiedBy(axisValue) {
    if (typeof axisValue !== 'number') {
      return false;
    }

    switch (this.#operator) {
      case '>=':
        return axisValue >= this.#value;
      case '>':
        return axisValue > this.#value;
      case '<=':
        return axisValue <= this.#value;
      case '<':
        return axisValue < this.#value;
      case '==':
        // Use epsilon comparison for floating point equality
        return Math.abs(axisValue - this.#value) < 0.0001;
      default:
        return false;
    }
  }

  /**
   * Calculate how far a value is from satisfying this constraint.
   * Returns 0 if satisfied, positive number indicating violation magnitude.
   *
   * @param {number} axisValue - The axis value to check.
   * @returns {number} The violation amount (0 if satisfied).
   */
  violationAmount(axisValue) {
    if (this.isSatisfiedBy(axisValue)) {
      return 0;
    }

    switch (this.#operator) {
      case '>=':
      case '>':
        return this.#value - axisValue;
      case '<=':
      case '<':
        return axisValue - this.#value;
      case '==':
        return Math.abs(axisValue - this.#value);
      default:
        return 0;
    }
  }

  /**
   * Create a human-readable string representation.
   *
   * @returns {string} String representation of the constraint.
   */
  toString() {
    return `${this.#axis} ${this.#operator} ${this.#value}`;
  }

  /**
   * Serialize to JSON-compatible object.
   *
   * @returns {{axis: string, operator: string, value: number}} JSON representation.
   */
  toJSON() {
    return {
      axis: this.#axis,
      operator: this.#operator,
      value: this.#value,
    };
  }
}

export default GateConstraint;
export { VALID_OPERATORS };
