/**
 * @file WitnessState - Represents a satisfying state for expression triggering
 * @description Encapsulates mood and sexual state values that cause an expression to trigger.
 * Provides validation, serialization, and factory methods for witness state creation.
 * @see specs/expression-diagnostics.md Layer D
 */

/**
 * Mood state object containing all 7 mood axes.
 *
 * @typedef {object} MoodState
 * @property {number} valence - Valence value in [-100, 100]
 * @property {number} arousal - Arousal value in [-100, 100]
 * @property {number} agency_control - Agency/control value in [-100, 100]
 * @property {number} threat - Threat value in [-100, 100]
 * @property {number} engagement - Engagement value in [-100, 100]
 * @property {number} future_expectancy - Future expectancy value in [-100, 100]
 * @property {number} self_evaluation - Self evaluation value in [-100, 100]
 */

/**
 * Sexual state object containing all 3 sexual axes.
 *
 * @typedef {object} SexualState
 * @property {number} sex_excitation - Sexual excitation in [0, 100]
 * @property {number} sex_inhibition - Sexual inhibition in [0, 100]
 * @property {number} baseline_libido - Baseline libido in [-50, 50]
 */

const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
]);
const SEXUAL_AXES = Object.freeze([
  'sex_excitation',
  'sex_inhibition',
  'baseline_libido',
]);

const MOOD_RANGE = Object.freeze({ min: -100, max: 100 });
const SEXUAL_RANGES = Object.freeze({
  sex_excitation: { min: 0, max: 100 },
  sex_inhibition: { min: 0, max: 100 },
  baseline_libido: { min: -50, max: 50 },
});

/**
 * Represents a satisfying state (witness) that causes an expression to trigger.
 * A witness state contains concrete mood axis values and sexual state values that,
 * when applied, would make the expression fire.
 */
class WitnessState {
  /** @type {MoodState} */
  #mood;

  /** @type {SexualState} */
  #sexual;

  /** @type {number} */
  #fitness;

  /** @type {boolean} */
  #isExact;

  /** @type {string|null} */
  #expressionId;

  /**
   * Creates a new WitnessState instance.
   *
   * @param {object} params - Constructor parameters
   * @param {MoodState} params.mood - Mood axis values
   * @param {SexualState} params.sexual - Sexual axis values
   * @param {number} [params.fitness] - How well this state satisfies (1 = perfect)
   * @param {boolean} [params.isExact] - True if exact witness, false if nearest miss
   * @param {string|null} [params.expressionId] - The expression this witnesses
   */
  constructor({
    mood,
    sexual,
    fitness = 1,
    isExact = true,
    expressionId = null,
  }) {
    this.#validateMood(mood);
    this.#validateSexual(sexual);

    this.#mood = { ...mood };
    this.#sexual = { ...sexual };
    this.#fitness = fitness;
    this.#isExact = isExact;
    this.#expressionId = expressionId;
  }

  // Getters
  get mood() {
    return { ...this.#mood };
  }
  get sexual() {
    return { ...this.#sexual };
  }
  get fitness() {
    return this.#fitness;
  }
  get isExact() {
    return this.#isExact;
  }
  get expressionId() {
    return this.#expressionId;
  }

  /**
   * Check if this is a valid triggering witness.
   *
   * @returns {boolean} True if this is an exact match with perfect fitness.
   */
  get isWitness() {
    return this.#isExact && this.#fitness === 1;
  }

  /**
   * Get a specific mood axis value.
   *
   * @param {string} axis - The mood axis name to retrieve.
   * @returns {number|undefined} The value for the axis, or undefined if not found.
   */
  getMoodAxis(axis) {
    return this.#mood[axis];
  }

  /**
   * Get a specific sexual axis value.
   *
   * @param {string} axis - The sexual axis name to retrieve.
   * @returns {number|undefined} The value for the axis, or undefined if not found.
   */
  getSexualAxis(axis) {
    return this.#sexual[axis];
  }

  /**
   * Create a copy with modified values.
   *
   * @param {object} changes - Values to change in the new instance.
   * @param {object} [changes.mood] - Mood values to override.
   * @param {object} [changes.sexual] - Sexual values to override.
   * @param {number} [changes.fitness] - New fitness value.
   * @param {boolean} [changes.isExact] - New isExact value.
   * @param {string|null} [changes.expressionId] - New expressionId value.
   * @returns {WitnessState} A new WitnessState with the specified changes.
   */
  withChanges(changes) {
    return new WitnessState({
      mood: { ...this.#mood, ...(changes.mood || {}) },
      sexual: { ...this.#sexual, ...(changes.sexual || {}) },
      fitness: changes.fitness ?? this.#fitness,
      isExact: changes.isExact ?? this.#isExact,
      expressionId: changes.expressionId ?? this.#expressionId,
    });
  }

  /**
   * Convert to human-readable format for display.
   *
   * @returns {string} A formatted string showing all mood and sexual axis values.
   */
  toDisplayString() {
    const moodLines = MOOD_AXES.map(
      (axis) => `  ${axis}: ${this.#mood[axis]?.toFixed(1) ?? 'N/A'}`
    ).join('\n');

    const sexualLines = SEXUAL_AXES.map(
      (axis) => `  ${axis}: ${this.#sexual[axis]?.toFixed(1) ?? 'N/A'}`
    ).join('\n');

    return `Mood:\n${moodLines}\n\nSexual:\n${sexualLines}`;
  }

  /**
   * Convert to JSON for serialization.
   *
   * @returns {object} JSON representation including all fields.
   */
  toJSON() {
    return {
      mood: { ...this.#mood },
      sexual: { ...this.#sexual },
      fitness: this.#fitness,
      isExact: this.#isExact,
      expressionId: this.#expressionId,
    };
  }

  /**
   * Convert to compact JSON for clipboard.
   *
   * @returns {string} JSON string containing only mood and sexual values.
   */
  toClipboardJSON() {
    return JSON.stringify(
      {
        mood: this.#mood,
        sexual: this.#sexual,
      },
      null,
      2
    );
  }

  /**
   * Create from JSON.
   *
   * @param {object} json - JSON object with mood and sexual properties.
   * @returns {WitnessState} A new WitnessState reconstructed from JSON.
   */
  static fromJSON(json) {
    return new WitnessState({
      mood: json.mood,
      sexual: json.sexual,
      fitness: json.fitness ?? 1,
      isExact: json.isExact ?? true,
      expressionId: json.expressionId ?? null,
    });
  }

  /**
   * Create a random state within valid ranges.
   *
   * @returns {WitnessState} A new WitnessState with random valid values.
   */
  static createRandom() {
    const mood = {};
    const sexual = {};

    for (const axis of MOOD_AXES) {
      mood[axis] =
        MOOD_RANGE.min + Math.random() * (MOOD_RANGE.max - MOOD_RANGE.min);
    }

    for (const axis of SEXUAL_AXES) {
      const range = SEXUAL_RANGES[axis];
      sexual[axis] = range.min + Math.random() * (range.max - range.min);
    }

    return new WitnessState({ mood, sexual, fitness: 0, isExact: false });
  }

  /**
   * Create a neutral state (all zeros for mood, middle of range for sexual).
   *
   * @returns {WitnessState} A new WitnessState with neutral values.
   */
  static createNeutral() {
    const mood = {};
    const sexual = {};

    for (const axis of MOOD_AXES) {
      mood[axis] = 0;
    }

    for (const axis of SEXUAL_AXES) {
      const range = SEXUAL_RANGES[axis];
      sexual[axis] = (range.min + range.max) / 2;
    }

    return new WitnessState({ mood, sexual, fitness: 0, isExact: false });
  }

  /**
   * Validate mood state.
   *
   * @param {MoodState} mood - The mood state to validate.
   * @private
   */
  #validateMood(mood) {
    if (!mood || typeof mood !== 'object') {
      throw new Error('WitnessState requires mood object');
    }

    for (const axis of MOOD_AXES) {
      const value = mood[axis];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Mood axis "${axis}" must be a number`);
      }
      if (value < MOOD_RANGE.min || value > MOOD_RANGE.max) {
        throw new Error(
          `Mood axis "${axis}" must be in range [${MOOD_RANGE.min}, ${MOOD_RANGE.max}], got ${value}`
        );
      }
    }
  }

  /**
   * Validate sexual state (per-axis ranges).
   *
   * @param {SexualState} sexual - The sexual state to validate.
   * @private
   */
  #validateSexual(sexual) {
    if (!sexual || typeof sexual !== 'object') {
      throw new Error('WitnessState requires sexual object');
    }

    for (const axis of SEXUAL_AXES) {
      const value = sexual[axis];
      const range = SEXUAL_RANGES[axis];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Sexual axis "${axis}" must be a number`);
      }
      if (value < range.min || value > range.max) {
        throw new Error(
          `Sexual axis "${axis}" must be in range [${range.min}, ${range.max}], got ${value}`
        );
      }
    }
  }
}

// Export constants for external use
WitnessState.MOOD_AXES = MOOD_AXES;
WitnessState.SEXUAL_AXES = SEXUAL_AXES;
WitnessState.MOOD_RANGE = MOOD_RANGE;
WitnessState.SEXUAL_RANGES = SEXUAL_RANGES;

export default WitnessState;
