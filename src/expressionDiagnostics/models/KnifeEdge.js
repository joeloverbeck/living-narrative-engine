/**
 * @file KnifeEdge - Represents a brittle constraint where the feasible interval is very narrow
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

/**
 * Default threshold below which an interval is considered a "knife-edge"
 * @type {number}
 */
const DEFAULT_KNIFE_EDGE_THRESHOLD = 0.02;

/**
 * Scale factor for converting normalized [-1, 1] to raw [-100, 100] game values
 * @type {number}
 */
const RAW_SCALE_FACTOR = 100;

class KnifeEdge {
  /** @type {string} Axis name */
  #axis;

  /** @type {number} Interval minimum */
  #min;

  /** @type {number} Interval maximum */
  #max;

  /** @type {number} Width of the interval (max - min) */
  #width;

  /** @type {string[]} Prototypes contributing to this knife-edge */
  #contributingPrototypes;

  /** @type {string[]} Gate strings that created this knife-edge */
  #contributingGates;

  /**
   * @param {Object} params
   * @param {string} params.axis - Axis name (e.g., "agency_control")
   * @param {number} params.min - Interval minimum
   * @param {number} params.max - Interval maximum
   * @param {string[]} [params.contributingPrototypes=[]] - Prototypes causing this constraint
   * @param {string[]} [params.contributingGates=[]] - Gate strings causing this constraint
   */
  constructor({
    axis,
    min,
    max,
    contributingPrototypes = [],
    contributingGates = [],
  }) {
    if (typeof axis !== 'string' || axis.trim() === '') {
      throw new Error('KnifeEdge requires non-empty axis string');
    }
    if (typeof min !== 'number' || Number.isNaN(min)) {
      throw new Error('KnifeEdge requires numeric min value');
    }
    if (typeof max !== 'number' || Number.isNaN(max)) {
      throw new Error('KnifeEdge requires numeric max value');
    }
    if (max < min) {
      throw new Error(`KnifeEdge max (${max}) cannot be less than min (${min})`);
    }
    if (!Array.isArray(contributingPrototypes)) {
      throw new Error('KnifeEdge contributingPrototypes must be an array');
    }
    if (!Array.isArray(contributingGates)) {
      throw new Error('KnifeEdge contributingGates must be an array');
    }

    this.#axis = axis;
    this.#min = min;
    this.#max = max;
    this.#width = max - min;
    this.#contributingPrototypes = [...contributingPrototypes];
    this.#contributingGates = [...contributingGates];
  }

  // Getters
  get axis() {
    return this.#axis;
  }
  get min() {
    return this.#min;
  }
  get max() {
    return this.#max;
  }
  get width() {
    return this.#width;
  }
  get contributingPrototypes() {
    return [...this.#contributingPrototypes];
  }
  get contributingGates() {
    return [...this.#contributingGates];
  }

  /**
   * Get minimum value in raw scale [-100, 100]
   * @returns {number}
   */
  get rawMin() {
    return this.#min * RAW_SCALE_FACTOR;
  }

  /**
   * Get maximum value in raw scale [-100, 100]
   * @returns {number}
   */
  get rawMax() {
    return this.#max * RAW_SCALE_FACTOR;
  }

  /**
   * Get width in raw scale
   * @returns {number}
   */
  get rawWidth() {
    return this.#width * RAW_SCALE_FACTOR;
  }

  /**
   * Convert normalized value to raw scale (multiply by 100)
   * @param {number} normalized - Value in normalized scale [-1, 1]
   * @returns {number} Value in raw scale [-100, 100]
   */
  static toRawScale(normalized) {
    return normalized * RAW_SCALE_FACTOR;
  }

  /**
   * Check if this is a zero-width (point) constraint
   * @returns {boolean}
   */
  get isPoint() {
    return this.#width === 0;
  }

  /**
   * Check if this is below a given threshold
   * @param {number} [threshold=0.02] - Width threshold
   * @returns {boolean}
   */
  isBelowThreshold(threshold = DEFAULT_KNIFE_EDGE_THRESHOLD) {
    return this.#width <= threshold;
  }

  /**
   * Get severity level based on width
   * @returns {'critical'|'warning'|'info'}
   */
  get severity() {
    if (this.#width === 0) return 'critical';
    if (this.#width <= 0.01) return 'warning';
    return 'info';
  }

  /**
   * Format interval as string
   * @returns {string}
   */
  formatInterval() {
    if (this.#width === 0) {
      return `exactly ${this.#min.toFixed(2)}`;
    }
    return `[${this.#min.toFixed(2)}, ${this.#max.toFixed(2)}]`;
  }

  /**
   * Format interval showing both normalized and raw scales
   * @returns {string}
   */
  formatDualScaleInterval() {
    const rawMin = Math.round(this.#min * RAW_SCALE_FACTOR);
    const rawMax = Math.round(this.#max * RAW_SCALE_FACTOR);

    if (this.#width === 0) {
      return `exactly ${this.#min.toFixed(2)} (raw: ${rawMin})`;
    }
    return `[${this.#min.toFixed(2)}, ${this.#max.toFixed(2)}] (raw: [${rawMin}, ${rawMax}])`;
  }

  /**
   * Format contributing prototypes as readable string
   * @returns {string}
   */
  formatContributors() {
    if (this.#contributingPrototypes.length === 0) {
      return 'unknown';
    }
    return this.#contributingPrototypes.join(' \u2227 ');
  }

  /**
   * Convert to JSON for serialization (includes both normalized and raw scale values)
   * @returns {Object}
   */
  toJSON() {
    return {
      axis: this.#axis,
      min: this.#min,
      max: this.#max,
      rawMin: Math.round(this.#min * RAW_SCALE_FACTOR),
      rawMax: Math.round(this.#max * RAW_SCALE_FACTOR),
      width: this.#width,
      rawWidth: Math.round(this.#width * RAW_SCALE_FACTOR),
      contributingPrototypes: [...this.#contributingPrototypes],
      contributingGates: [...this.#contributingGates],
      severity: this.severity,
    };
  }

  /**
   * Create from JSON
   * @param {{axis: string, min: number, max: number, contributingPrototypes?: string[], contributingGates?: string[]}} json
   * @returns {KnifeEdge}
   */
  static fromJSON(json) {
    return new KnifeEdge({
      axis: json.axis,
      min: json.min,
      max: json.max,
      contributingPrototypes: json.contributingPrototypes || [],
      contributingGates: json.contributingGates || [],
    });
  }

  /**
   * Create human-readable warning message with both normalized and raw scales
   * @returns {string}
   */
  toWarningMessage() {
    const severityEmoji = {
      critical: '\uD83D\uDD34',
      warning: '\uD83D\uDFE1',
      info: '\uD83D\uDD35',
    };

    const rawMin = Math.round(this.#min * RAW_SCALE_FACTOR);
    const rawMax = Math.round(this.#max * RAW_SCALE_FACTOR);

    let constraintExplanation;
    if (this.#width === 0) {
      constraintExplanation = `must be exactly ${this.#min.toFixed(2)} (${rawMin} in game values)`;
    } else {
      constraintExplanation = `must be in [${this.#min.toFixed(2)}, ${this.#max.toFixed(2)}] (${rawMin} to ${rawMax} in game values)`;
    }

    return (
      `${severityEmoji[this.severity]} ${this.#axis}: ${constraintExplanation} ` +
      `| width: ${this.#width.toFixed(3)} | caused by: ${this.formatContributors()}`
    );
  }

  /**
   * Create display object for UI rendering (includes both normalized and raw scale values)
   * @returns {Object}
   */
  toDisplayObject() {
    const rawMin = Math.round(this.#min * RAW_SCALE_FACTOR);
    const rawMax = Math.round(this.#max * RAW_SCALE_FACTOR);

    return {
      axis: this.#axis,
      interval: this.formatInterval(),
      intervalDualScale: this.formatDualScaleInterval(),
      width: this.#width.toFixed(3),
      rawWidth: Math.round(this.#width * RAW_SCALE_FACTOR),
      min: this.#min,
      max: this.#max,
      rawMin,
      rawMax,
      cause: this.formatContributors(),
      gates: this.#contributingGates,
      severity: this.severity,
    };
  }
}

// Export constants
KnifeEdge.DEFAULT_THRESHOLD = DEFAULT_KNIFE_EDGE_THRESHOLD;

export default KnifeEdge;
