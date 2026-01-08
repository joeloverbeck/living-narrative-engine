/**
 * @file AxisInterval - Represents a bounded interval for a mood/sexual axis
 * @description Encapsulates interval arithmetic for constraint analysis in the Expression Diagnostics system.
 * Supports intersection, constraint application, and provides factory methods for common axis ranges.
 */

/**
 * Represents a bounded interval [min, max] for mood or sexual axis values.
 * Immutable - all operations return new instances.
 */
class AxisInterval {
  /**
   * Minimum bound of the interval.
   *
   * @type {number}
   */
  #min;

  /**
   * Maximum bound of the interval.
   *
   * @type {number}
   */
  #max;

  /**
   * Creates a new AxisInterval.
   *
   * @param {number} min - Minimum bound (inclusive)
   * @param {number} max - Maximum bound (inclusive)
   */
  constructor(min, max) {
    if (typeof min !== 'number' || typeof max !== 'number') {
      throw new Error('AxisInterval requires numeric min and max values');
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error('AxisInterval requires finite min and max values');
    }
    this.#min = min;
    this.#max = max;
    Object.freeze(this);
  }

  /**
   * Gets the minimum bound (inclusive).
   *
   * @returns {number} The minimum bound value.
   */
  get min() {
    return this.#min;
  }

  /**
   * Gets the maximum bound (inclusive).
   *
   * @returns {number} The maximum bound value.
   */
  get max() {
    return this.#max;
  }

  /**
   * Check if interval is empty (min > max).
   *
   * @returns {boolean} True if the interval is empty (unsatisfiable).
   */
  isEmpty() {
    return this.#min > this.#max;
  }

  /**
   * Intersect with another interval.
   *
   * @param {AxisInterval} other - The other interval to intersect with.
   * @returns {AxisInterval|null} The intersection interval, or null if intersection is empty.
   */
  intersect(other) {
    if (!(other instanceof AxisInterval)) {
      throw new Error('intersect requires an AxisInterval instance');
    }

    const newMin = Math.max(this.#min, other.min);
    const newMax = Math.min(this.#max, other.max);

    if (newMin > newMax) {
      return null;
    }

    return new AxisInterval(newMin, newMax);
  }

  /**
   * Apply a gate constraint to tighten this interval.
   * Returns a new interval with bounds adjusted according to the operator and value.
   *
   * @param {string} operator - One of '>=', '<=', '>', '<', '=='.
   * @param {number} value - Threshold value.
   * @returns {AxisInterval} New interval with constraint applied.
   * @throws {Error} If operator is unknown.
   */
  applyConstraint(operator, value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('applyConstraint requires a finite numeric value');
    }

    let newMin = this.#min;
    let newMax = this.#max;

    switch (operator) {
      case '>=':
        newMin = Math.max(newMin, value);
        break;
      case '>':
        newMin = Math.max(newMin, value + Number.EPSILON);
        break;
      case '<=':
        newMax = Math.min(newMax, value);
        break;
      case '<':
        newMax = Math.min(newMax, value - Number.EPSILON);
        break;
      case '==':
        newMin = Math.max(newMin, value);
        newMax = Math.min(newMax, value);
        break;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }

    return new AxisInterval(newMin, newMax);
  }

  /**
   * Check if a value is contained within this interval (inclusive bounds).
   *
   * @param {number} value - The value to check.
   * @returns {boolean} True if value is within [min, max].
   */
  contains(value) {
    return value >= this.#min && value <= this.#max;
  }

  /**
   * Get the width/size of this interval.
   *
   * @returns {number} The difference between max and min (0 or negative if empty).
   */
  width() {
    return this.#max - this.#min;
  }

  /**
   * Create default interval for normalized mood axes [-1, 1].
   *
   * @returns {AxisInterval} An interval from -1 to 1.
   */
  static forMoodAxis() {
    return new AxisInterval(-1, 1);
  }

  /**
   * Create default interval for normalized sexual axes [0, 1].
   *
   * @returns {AxisInterval} An interval from 0 to 1.
   */
  static forSexualAxis() {
    return new AxisInterval(0, 1);
  }

  /**
   * Create interval for raw (unnormalized) mood values [-100, 100].
   *
   * @returns {AxisInterval} An interval from -100 to 100.
   */
  static forRawMoodAxis() {
    return new AxisInterval(-100, 100);
  }

  /**
   * Create interval for raw (unnormalized) sexual values [0, 100].
   *
   * @returns {AxisInterval} An interval from 0 to 100.
   */
  static forRawSexualAxis() {
    return new AxisInterval(0, 100);
  }

  /**
   * Create an empty interval (where min > max).
   * Useful for representing impossible constraints.
   *
   * @returns {AxisInterval} An empty interval with min=1, max=0.
   */
  static empty() {
    return new AxisInterval(1, 0);
  }

  /**
   * Serialize to JSON-compatible object.
   *
   * @returns {{min: number, max: number}} JSON representation.
   */
  toJSON() {
    return { min: this.#min, max: this.#max };
  }

  /**
   * Create a human-readable string representation.
   *
   * @returns {string} String representation of the interval.
   */
  toString() {
    if (this.isEmpty()) {
      return '[empty]';
    }
    return `[${this.#min}, ${this.#max}]`;
  }
}

export default AxisInterval;
