/**
 * @file WitnessState - Represents a satisfying state for expression triggering
 * @description Encapsulates mood and sexual state values that cause an expression to trigger.
 * Provides validation, serialization, and factory methods for witness state creation.
 * @see specs/expression-diagnostics.md Layer D
 */

/**
 * Mood state object containing all 8 mood axes.
 *
 * @typedef {object} MoodState
 * @property {number} valence - Valence value in [-100, 100]
 * @property {number} arousal - Arousal value in [-100, 100]
 * @property {number} agency_control - Agency/control value in [-100, 100]
 * @property {number} threat - Threat value in [-100, 100]
 * @property {number} engagement - Engagement value in [-100, 100]
 * @property {number} future_expectancy - Future expectancy value in [-100, 100]
 * @property {number} self_evaluation - Self evaluation value in [-100, 100]
 * @property {number} affiliation - Affiliation value in [-100, 100]
 */

/**
 * Sexual state object containing all 3 sexual axes.
 *
 * @typedef {object} SexualState
 * @property {number} sex_excitation - Sexual excitation in [0, 100]
 * @property {number} sex_inhibition - Sexual inhibition in [0, 100]
 * @property {number} baseline_libido - Baseline libido in [-50, 50]
 */

/**
 * Affect traits state object containing all 3 trait axes.
 *
 * @typedef {object} AffectTraitsState
 * @property {number} affective_empathy - Affective empathy in [0, 100]
 * @property {number} cognitive_empathy - Cognitive empathy in [0, 100]
 * @property {number} harm_aversion - Harm aversion in [0, 100]
 */

const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
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

const AFFECT_TRAIT_AXES = Object.freeze([
  'affective_empathy',
  'cognitive_empathy',
  'harm_aversion',
]);

const TRAIT_RANGE = Object.freeze({ min: 0, max: 100 });

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

  /** @type {AffectTraitsState} */
  #affectTraits;

  /**
   * Creates a new WitnessState instance.
   *
   * @param {object} params - Constructor parameters
   * @param {MoodState} params.mood - Mood axis values
   * @param {SexualState} params.sexual - Sexual axis values
   * @param {AffectTraitsState} [params.affectTraits] - Affect trait values (optional, defaults to 50)
   * @param {number} [params.fitness] - How well this state satisfies (1 = perfect)
   * @param {boolean} [params.isExact] - True if exact witness, false if nearest miss
   * @param {string|null} [params.expressionId] - The expression this witnesses
   */
  constructor({
    mood,
    sexual,
    affectTraits = null,
    fitness = 1,
    isExact = true,
    expressionId = null,
  }) {
    this.#validateMood(mood);
    this.#validateSexual(sexual);

    // Use default traits (50 = average human) if not provided
    const traitsToUse = affectTraits ?? {
      affective_empathy: 50,
      cognitive_empathy: 50,
      harm_aversion: 50,
    };
    this.#validateAffectTraits(traitsToUse);

    this.#mood = { ...mood };
    this.#sexual = { ...sexual };
    this.#affectTraits = { ...traitsToUse };
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
  get affectTraits() {
    return { ...this.#affectTraits };
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
   * Get a specific affect trait axis value.
   *
   * @param {string} axis - The trait axis name to retrieve.
   * @returns {number|undefined} The value for the axis, or undefined if not found.
   */
  getTraitAxis(axis) {
    return this.#affectTraits[axis];
  }

  /**
   * Create a copy with modified values.
   *
   * @param {object} changes - Values to change in the new instance.
   * @param {object} [changes.mood] - Mood values to override.
   * @param {object} [changes.sexual] - Sexual values to override.
   * @param {object} [changes.affectTraits] - Trait values to override.
   * @param {number} [changes.fitness] - New fitness value.
   * @param {boolean} [changes.isExact] - New isExact value.
   * @param {string|null} [changes.expressionId] - New expressionId value.
   * @returns {WitnessState} A new WitnessState with the specified changes.
   */
  withChanges(changes) {
    return new WitnessState({
      mood: { ...this.#mood, ...(changes.mood || {}) },
      sexual: { ...this.#sexual, ...(changes.sexual || {}) },
      affectTraits: { ...this.#affectTraits, ...(changes.affectTraits || {}) },
      fitness: changes.fitness ?? this.#fitness,
      isExact: changes.isExact ?? this.#isExact,
      expressionId: changes.expressionId ?? this.#expressionId,
    });
  }

  /**
   * Convert to human-readable format for display.
   *
   * @returns {string} A formatted string showing all mood, sexual, and trait axis values.
   */
  toDisplayString() {
    const moodLines = MOOD_AXES.map(
      (axis) => `  ${axis}: ${this.#mood[axis]?.toFixed(1) ?? 'N/A'}`
    ).join('\n');

    const sexualLines = SEXUAL_AXES.map(
      (axis) => `  ${axis}: ${this.#sexual[axis]?.toFixed(1) ?? 'N/A'}`
    ).join('\n');

    const traitLines = AFFECT_TRAIT_AXES.map(
      (axis) => `  ${axis}: ${this.#affectTraits[axis]?.toFixed(1) ?? 'N/A'}`
    ).join('\n');

    return `Mood:\n${moodLines}\n\nSexual:\n${sexualLines}\n\nAffect Traits:\n${traitLines}`;
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
      affectTraits: { ...this.#affectTraits },
      fitness: this.#fitness,
      isExact: this.#isExact,
      expressionId: this.#expressionId,
    };
  }

  /**
   * Convert to compact JSON for clipboard.
   *
   * @returns {string} JSON string containing mood, sexual, and trait values.
   */
  toClipboardJSON() {
    return JSON.stringify(
      {
        mood: this.#mood,
        sexual: this.#sexual,
        affectTraits: this.#affectTraits,
      },
      null,
      2
    );
  }

  /**
   * Create from JSON.
   *
   * @param {object} json - JSON object with mood, sexual, and optionally affectTraits properties.
   * @returns {WitnessState} A new WitnessState reconstructed from JSON.
   */
  static fromJSON(json) {
    return new WitnessState({
      mood: json.mood,
      sexual: json.sexual,
      affectTraits: json.affectTraits ?? null, // Will use defaults if null
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
    const affectTraits = {};

    for (const axis of MOOD_AXES) {
      // Generate random float, then round to integer within range
      const rawValue =
        MOOD_RANGE.min + Math.random() * (MOOD_RANGE.max - MOOD_RANGE.min);
      mood[axis] = Math.round(rawValue);
    }

    for (const axis of SEXUAL_AXES) {
      const range = SEXUAL_RANGES[axis];
      const rawValue = range.min + Math.random() * (range.max - range.min);
      sexual[axis] = Math.round(rawValue);
    }

    for (const axis of AFFECT_TRAIT_AXES) {
      const rawValue =
        TRAIT_RANGE.min + Math.random() * (TRAIT_RANGE.max - TRAIT_RANGE.min);
      affectTraits[axis] = Math.round(rawValue);
    }

    return new WitnessState({
      mood,
      sexual,
      affectTraits,
      fitness: 0,
      isExact: false,
    });
  }

  /**
   * Create a neutral state (all zeros for mood, middle of range for sexual, 50 for traits).
   *
   * @returns {WitnessState} A new WitnessState with neutral values.
   */
  static createNeutral() {
    const mood = {};
    const sexual = {};
    const affectTraits = {};

    for (const axis of MOOD_AXES) {
      mood[axis] = 0; // Already an integer
    }

    for (const axis of SEXUAL_AXES) {
      const range = SEXUAL_RANGES[axis];
      // Use Math.round to handle any potential floating-point division
      sexual[axis] = Math.round((range.min + range.max) / 2);
    }

    // Neutral traits = 50 (average human baseline)
    for (const axis of AFFECT_TRAIT_AXES) {
      affectTraits[axis] = 50;
    }

    return new WitnessState({
      mood,
      sexual,
      affectTraits,
      fitness: 0,
      isExact: false,
    });
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
      if (!Number.isInteger(value)) {
        throw new Error(
          `Mood axis "${axis}" must be an integer, got ${value}`
        );
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
      if (!Number.isInteger(value)) {
        throw new Error(
          `Sexual axis "${axis}" must be an integer, got ${value}`
        );
      }
      if (value < range.min || value > range.max) {
        throw new Error(
          `Sexual axis "${axis}" must be in range [${range.min}, ${range.max}], got ${value}`
        );
      }
    }
  }

  /**
   * Validate affect traits state.
   *
   * @param {AffectTraitsState} affectTraits - The affect traits state to validate.
   * @private
   */
  #validateAffectTraits(affectTraits) {
    if (!affectTraits || typeof affectTraits !== 'object') {
      throw new Error('WitnessState requires affectTraits object');
    }

    for (const axis of AFFECT_TRAIT_AXES) {
      const value = affectTraits[axis];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Affect trait axis "${axis}" must be a number`);
      }
      if (!Number.isInteger(value)) {
        throw new Error(
          `Affect trait axis "${axis}" must be an integer, got ${value}`
        );
      }
      if (value < TRAIT_RANGE.min || value > TRAIT_RANGE.max) {
        throw new Error(
          `Affect trait axis "${axis}" must be in range [${TRAIT_RANGE.min}, ${TRAIT_RANGE.max}], got ${value}`
        );
      }
    }
  }
}

// Export constants for external use
WitnessState.MOOD_AXES = MOOD_AXES;
WitnessState.SEXUAL_AXES = SEXUAL_AXES;
WitnessState.AFFECT_TRAIT_AXES = AFFECT_TRAIT_AXES;
WitnessState.MOOD_RANGE = MOOD_RANGE;
WitnessState.SEXUAL_RANGES = SEXUAL_RANGES;
WitnessState.TRAIT_RANGE = TRAIT_RANGE;

export default WitnessState;
