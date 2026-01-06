/**
 * @file Service that calculates emotion intensities from mood axes using weighted prototype matching.
 * Includes sexual arousal calculation and prompt text formatting.
 * @see data/mods/core/lookups/emotion_prototypes.lookup.json - Emotion prototypes with weights and gates
 * @see data/mods/core/lookups/sexual_prototypes.lookup.json - Sexual state prototypes with weights and gates
 * @see tickets/MOOANDSEXAROSYS-003-emotion-calculator-service.md - Implementation ticket
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */

/**
 * @typedef {object} MoodData
 * @property {number} valence - Pleasure-displeasure axis [-100..100]
 * @property {number} arousal - Activation-deactivation axis [-100..100]
 * @property {number} agency_control - Control-powerlessness axis [-100..100]
 * @property {number} threat - Safety-threat axis [-100..100]
 * @property {number} engagement - Interest-boredom axis [-100..100]
 * @property {number} future_expectancy - Hope-dread axis [-100..100]
 * @property {number} self_evaluation - Pride-shame axis [-100..100]
 */

/**
 * @typedef {object} SexualState
 * @property {number} sex_excitation - Sexual excitation level [0..100]
 * @property {number} sex_inhibition - Sexual inhibition level [0..100]
 * @property {number} baseline_libido - Baseline libido [0..100]
 */

/**
 * @typedef {object} EmotionPrototype
 * @property {{[key: string]: number}} weights - Weight coefficients for each axis [-1..1]
 * @property {string[]} [gates] - Prerequisite conditions (e.g., "valence >= 0.20")
 */

/**
 * Intensity level thresholds (10-level system)
 *
 * @type {Array<{max: number, label: string}>}
 */
const INTENSITY_LEVELS = [
  { max: 0.05, label: 'absent' },
  { max: 0.15, label: 'faint' },
  { max: 0.25, label: 'slight' },
  { max: 0.35, label: 'mild' },
  { max: 0.45, label: 'noticeable' },
  { max: 0.55, label: 'moderate' },
  { max: 0.65, label: 'strong' },
  { max: 0.75, label: 'intense' },
  { max: 0.85, label: 'powerful' },
  { max: 0.95, label: 'overwhelming' },
  { max: 1.0, label: 'extreme' },
];

/** Lookup ID for emotion prototypes */
const EMOTION_PROTOTYPES_LOOKUP_ID = 'core:emotion_prototypes';
/** Lookup ID for sexual prototypes */
const SEXUAL_PROTOTYPES_LOOKUP_ID = 'core:sexual_prototypes';

/**
 * Clamps a value to the range [0, 1]
 *
 * @param {number} x - Value to clamp
 * @returns {number} Clamped value
 */
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/**
 * Service that calculates emotion intensities from mood axes using weighted prototype matching.
 */
class EmotionCalculatorService {
  /** @type {ILogger} */
  #logger;
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {{[key: string]: EmotionPrototype}|null} */
  #emotionPrototypes = null;
  /** @type {{[key: string]: EmotionPrototype}|null} */
  #sexualPrototypes = null;

  /**
   * Creates a new EmotionCalculatorService instance.
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {IDataRegistry} deps.dataRegistry - Data registry for lookup access
   */
  constructor({ logger, dataRegistry }) {
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }
    if (!dataRegistry) {
      throw new InvalidArgumentError('dataRegistry is required');
    }

    this.#logger = logger;
    this.#dataRegistry = dataRegistry;
  }

  /**
   * Loads prototypes from the data registry (lazy loading).
   *
   * @param {'emotion'|'sexual'} type - Type of prototypes to load
   * @returns {{[key: string]: EmotionPrototype}|null} Loaded prototypes or null if not found
   */
  #loadPrototypes(type) {
    const lookupId =
      type === 'emotion'
        ? EMOTION_PROTOTYPES_LOOKUP_ID
        : SEXUAL_PROTOTYPES_LOOKUP_ID;

    const lookup = this.#dataRegistry.get('lookups', lookupId);

    if (!lookup) {
      this.#logger.warn(
        `EmotionCalculatorService: Lookup "${lookupId}" not found in data registry.`
      );
      return null;
    }

    if (!lookup.entries || typeof lookup.entries !== 'object') {
      this.#logger.warn(
        `EmotionCalculatorService: Lookup "${lookupId}" has no valid entries object.`
      );
      return null;
    }

    return lookup.entries;
  }

  /**
   * Ensures emotion prototypes are loaded.
   *
   * @returns {{[key: string]: EmotionPrototype}|null} Emotion prototypes
   */
  #ensureEmotionPrototypes() {
    if (this.#emotionPrototypes === null) {
      this.#emotionPrototypes = this.#loadPrototypes('emotion');
    }
    return this.#emotionPrototypes;
  }

  /**
   * Ensures sexual prototypes are loaded.
   *
   * @returns {{[key: string]: EmotionPrototype}|null} Sexual prototypes
   */
  #ensureSexualPrototypes() {
    if (this.#sexualPrototypes === null) {
      this.#sexualPrototypes = this.#loadPrototypes('sexual');
    }
    return this.#sexualPrototypes;
  }

  /**
   * Normalizes mood axes from [-100..100] to [-1..1].
   *
   * @param {MoodData} moodData - Raw mood data
   * @returns {{[key: string]: number}} Normalized axes
   */
  #normalizeMoodAxes(moodData) {
    if (!moodData) {
      return {};
    }
    const normalized = {};
    for (const [axis, value] of Object.entries(moodData)) {
      if (typeof value === 'number') {
        normalized[axis] = value / 100;
      }
    }
    return normalized;
  }

  /**
   * Parses a gate string into its components.
   *
   * @param {string} gate - Gate string (e.g., "valence >= 0.20")
   * @returns {{axis: string, operator: string, value: number}|null} Parsed gate or null if invalid
   */
  #parseGate(gate) {
    // Match patterns like "axis_name >= 0.35" or "valence <= -0.20"
    const match = gate.match(/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/);
    if (!match) {
      return null;
    }

    return {
      axis: match[1],
      operator: match[2],
      value: parseFloat(match[3]),
    };
  }

  /**
   * Checks if all gates pass for a prototype.
   *
   * @param {string[]|undefined} gates - Array of gate conditions
   * @param {{[key: string]: number}} normalizedAxes - Normalized mood axes
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @returns {boolean} True if all gates pass
   */
  #checkGates(gates, normalizedAxes, sexualArousal) {
    if (!gates || !Array.isArray(gates) || gates.length === 0) {
      return true;
    }

    for (const gate of gates) {
      const parsed = this.#parseGate(gate);
      if (!parsed) {
        this.#logger.warn(
          `EmotionCalculatorService: Invalid gate format: "${gate}"`
        );
        continue;
      }

      const { axis, operator, value } = parsed;

      // Get the axis value - special handling for sexual_arousal
      let axisValue;
      if (axis === 'sexual_arousal') {
        axisValue = sexualArousal ?? 0;
      } else {
        axisValue = normalizedAxes[axis] ?? 0;
      }

      // Evaluate the gate condition
      let passes;
      switch (operator) {
        case '>=':
          passes = axisValue >= value;
          break;
        case '<=':
          passes = axisValue <= value;
          break;
        case '>':
          passes = axisValue > value;
          break;
        case '<':
          passes = axisValue < value;
          break;
        case '==':
          passes = Math.abs(axisValue - value) < 0.0001; // Float comparison
          break;
        default:
          this.#logger.warn(
            `EmotionCalculatorService: Unknown gate operator: "${operator}"`
          );
          passes = false;
      }

      if (!passes) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculates the intensity for a single prototype.
   *
   * @param {EmotionPrototype} prototype - Emotion/sexual prototype
   * @param {{[key: string]: number}} normalizedAxes - Normalized mood axes
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @returns {number} Intensity value in [0..1]
   */
  #calculatePrototypeIntensity(prototype, normalizedAxes, sexualArousal) {
    // Check gates first
    if (!this.#checkGates(prototype.gates, normalizedAxes, sexualArousal)) {
      return 0;
    }

    const weights = prototype.weights;
    if (!weights || typeof weights !== 'object') {
      return 0;
    }

    let rawSum = 0;
    let maxPossible = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      // Get axis value - special handling for sexual_arousal and SA alias
      let axisValue;
      if (axis === 'sexual_arousal' || axis === 'SA') {
        axisValue = sexualArousal ?? 0;
      } else {
        axisValue = normalizedAxes[axis] ?? 0;
      }

      rawSum += axisValue * weight;
      maxPossible += Math.abs(weight);
    }

    if (maxPossible === 0) {
      return 0;
    }

    const normalizedIntensity = rawSum / maxPossible;

    // Clamp negatives to 0, but also clamp max to 1
    return clamp01(normalizedIntensity);
  }

  /**
   * Calculates sexual arousal from sexual state.
   *
   * @param {SexualState|null|undefined} sexualState - Sexual state data
   * @returns {number|null} Sexual arousal in [0..1] or null if no data
   */
  calculateSexualArousal(sexualState) {
    if (!sexualState) {
      return null;
    }

    const excitation = sexualState.sex_excitation ?? 0;
    const inhibition = sexualState.sex_inhibition ?? 0;
    const baseline = sexualState.baseline_libido ?? 0;

    // Formula: (excitation - inhibition + baseline) / 100
    const rawValue = (excitation - inhibition + baseline) / 100;

    return clamp01(rawValue);
  }

  /**
   * Calculates emotion intensities from mood data.
   *
   * @param {MoodData} moodData - Mood axis values
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @returns {Map<string, number>} Map of emotion name to intensity
   */
  calculateEmotions(moodData, sexualArousal) {
    const result = new Map();

    const prototypes = this.#ensureEmotionPrototypes();
    if (!prototypes) {
      this.#logger.warn(
        'EmotionCalculatorService: No emotion prototypes available.'
      );
      return result;
    }

    const normalizedAxes = this.#normalizeMoodAxes(moodData);

    for (const [emotionName, prototype] of Object.entries(prototypes)) {
      const intensity = this.#calculatePrototypeIntensity(
        prototype,
        normalizedAxes,
        sexualArousal
      );

      // Only include emotions with intensity > 0 (gates passed and has positive intensity)
      if (intensity > 0) {
        result.set(emotionName, intensity);
      }
    }

    return result;
  }

  /**
   * Calculates sexual state intensities from mood data.
   *
   * @param {MoodData} moodData - Mood axis values
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @returns {Map<string, number>} Map of sexual state name to intensity
   */
  calculateSexualStates(moodData, sexualArousal) {
    const result = new Map();

    const prototypes = this.#ensureSexualPrototypes();
    if (!prototypes) {
      this.#logger.warn(
        'EmotionCalculatorService: No sexual prototypes available.'
      );
      return result;
    }

    const normalizedAxes = this.#normalizeMoodAxes(moodData);

    for (const [stateName, prototype] of Object.entries(prototypes)) {
      const intensity = this.#calculatePrototypeIntensity(
        prototype,
        normalizedAxes,
        sexualArousal
      );

      // Only include states with intensity > 0
      if (intensity > 0) {
        result.set(stateName, intensity);
      }
    }

    return result;
  }

  /**
   * Gets the intensity label for a given intensity value.
   *
   * @param {number} intensity - Intensity value in [0..1]
   * @returns {string} Human-readable intensity label
   */
  getIntensityLabel(intensity) {
    const clamped = clamp01(intensity);

    for (const level of INTENSITY_LEVELS) {
      if (clamped <= level.max) {
        return level.label;
      }
    }

    // Fallback for edge cases
    return 'extreme';
  }

  /**
   * Formats emotions for inclusion in LLM prompts.
   *
   * @param {Map<string, number>} emotions - Map of emotion name to intensity
   * @param {number} [maxCount] - Maximum number of emotions to include
   * @returns {string} Formatted string like "joy: strong, curiosity: moderate, ..."
   */
  formatEmotionsForPrompt(emotions, maxCount = 5) {
    if (!emotions || emotions.size === 0) {
      return '';
    }

    // Filter out absent emotions (intensity < 0.05)
    const filtered = Array.from(emotions.entries()).filter(
      ([, intensity]) => intensity >= 0.05
    );

    if (filtered.length === 0) {
      return '';
    }

    // Sort by intensity descending
    filtered.sort((a, b) => b[1] - a[1]);

    // Take top N
    const topEmotions = filtered.slice(0, maxCount);

    // Format: "emotion_name: label" with underscores replaced by spaces
    return topEmotions
      .map(([name, intensity]) => {
        const displayName = name.replace(/_/g, ' ');
        const label = this.getIntensityLabel(intensity);
        return `${displayName}: ${label}`;
      })
      .join(', ');
  }

  /**
   * Formats sexual states for inclusion in LLM prompts.
   *
   * @param {Map<string, number>} sexualStates - Map of sexual state name to intensity
   * @param {number} [maxCount] - Maximum number of states to include
   * @returns {string} Formatted string like "sexual_lust: strong, ..."
   */
  formatSexualStatesForPrompt(sexualStates, maxCount = 3) {
    if (!sexualStates || sexualStates.size === 0) {
      return '';
    }

    // Filter out absent states (intensity < 0.05)
    const filtered = Array.from(sexualStates.entries()).filter(
      ([, intensity]) => intensity >= 0.05
    );

    if (filtered.length === 0) {
      return '';
    }

    // Sort by intensity descending
    filtered.sort((a, b) => b[1] - a[1]);

    // Take top N
    const topStates = filtered.slice(0, maxCount);

    // Format: "state_name: label" with underscores replaced by spaces
    return topStates
      .map(([name, intensity]) => {
        const displayName = name.replace(/_/g, ' ');
        const label = this.getIntensityLabel(intensity);
        return `${displayName}: ${label}`;
      })
      .join(', ');
  }
}

export default EmotionCalculatorService;
