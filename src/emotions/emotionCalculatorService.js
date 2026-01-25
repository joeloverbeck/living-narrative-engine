/**
 * @file Service that calculates emotion intensities from mood axes using weighted prototype matching.
 * Includes sexual arousal calculation and prompt text formatting.
 * @see data/mods/core/lookups/emotion_prototypes.lookup.json - Emotion prototypes with weights and gates
 * @see data/mods/core/lookups/sexual_prototypes.lookup.json - Sexual state prototypes with weights and gates
 * @see tickets/MOOANDSEXAROSYS-003-emotion-calculator-service.md - Implementation ticket
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { DEFAULT_AFFECT_TRAITS } from '../constants/moodAffectConstants.js';

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
 * @property {number} baseline_libido - Baseline libido [-50..50]
 */

/**
 * @typedef {object} AffectTraits
 * @property {number} affective_empathy - Capacity to feel what others feel [0..100]
 * @property {number} cognitive_empathy - Ability to understand others' perspectives [0..100]
 * @property {number} harm_aversion - Aversion to causing harm [0..100]
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
/** Component ID for affect traits */
const AFFECT_TRAITS_COMPONENT_ID = 'core:affect_traits';

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
  /** @type {number} */
  #defaultMaxEmotionalStates = 7;
  /** @type {number} */
  #defaultMaxSexualStates = 5;
  /** @type {string} */
  #sexualComponentId = 'core:sexual_state';

  /**
   * Creates a new EmotionCalculatorService instance.
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {IDataRegistry} deps.dataRegistry - Data registry for lookup access
   * @param {{maxEmotionalStates?: number, maxSexualStates?: number}} [deps.displayConfig] - Display defaults
   */
  constructor({ logger, dataRegistry, displayConfig }) {
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }
    if (!dataRegistry) {
      throw new InvalidArgumentError('dataRegistry is required');
    }

    this.#logger = logger;
    this.#dataRegistry = dataRegistry;

    if (displayConfig && typeof displayConfig === 'object') {
      const { maxEmotionalStates, maxSexualStates } = displayConfig;
      if (Number.isInteger(maxEmotionalStates) && maxEmotionalStates > 0) {
        this.#defaultMaxEmotionalStates = maxEmotionalStates;
      }
      if (Number.isInteger(maxSexualStates) && maxSexualStates > 0) {
        this.#defaultMaxSexualStates = maxSexualStates;
      }
    }
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
   * Resolves axis values across mood, sexual, and trait axes.
   *
   * Resolution order: trait axes → sexual axes → mood axes
   * This allows trait gates to work correctly.
   *
   * @param {string} axis - Axis name
   * @param {{[key: string]: number}} normalizedAxes - Normalized mood axes
   * @param {{[key: string]: number}} sexualAxes - Normalized sexual axes
   * @param {{[key: string]: number}} [traitAxes={}] - Normalized affect trait axes
   * @returns {number} Resolved axis value
   */
  #resolveAxisValue(axis, normalizedAxes, sexualAxes, traitAxes = {}) {
    const resolvedAxis = axis === 'SA' ? 'sexual_arousal' : axis;

    // Check trait axes first (affective_empathy, cognitive_empathy, harm_aversion)
    if (Object.prototype.hasOwnProperty.call(traitAxes, resolvedAxis)) {
      return traitAxes[resolvedAxis];
    }

    // Then sexual axes
    if (Object.prototype.hasOwnProperty.call(sexualAxes, resolvedAxis)) {
      // Value guaranteed to be a number from #normalizeSexualAxes (uses clamp01)
      return sexualAxes[resolvedAxis];
    }

    // Finally mood axes (including affiliation axis)
    return normalizedAxes[resolvedAxis] ?? 0;
  }

  /**
   * Checks if all gates pass for a prototype.
   *
   * @param {string[]|undefined} gates - Array of gate conditions
   * @param {{[key: string]: number}} normalizedAxes - Normalized mood axes
   * @param {{[key: string]: number}} sexualAxes - Normalized sexual axes
   * @param {{[key: string]: number}} [traitAxes={}] - Normalized affect trait axes
   * @returns {boolean} True if all gates pass
   */
  #checkGates(gates, normalizedAxes, sexualAxes, traitAxes = {}) {
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

      const axisValue = this.#resolveAxisValue(
        axis,
        normalizedAxes,
        sexualAxes,
        traitAxes
      );

      // Evaluate the gate condition
      // Note: operator is guaranteed to be one of >=, <=, >, <, == by the #parseGate regex
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
   * @param {{[key: string]: number}} sexualAxes - Normalized sexual axes
   * @param {{[key: string]: number}} [traitAxes={}] - Normalized affect trait axes
   * @returns {number} Intensity value in [0..1]
   */
  #calculatePrototypeIntensity(prototype, normalizedAxes, sexualAxes, traitAxes = {}) {
    // Check gates first (including trait gates)
    if (!this.#checkGates(prototype.gates, normalizedAxes, sexualAxes, traitAxes)) {
      return 0;
    }

    const weights = prototype.weights;
    if (!weights || typeof weights !== 'object') {
      return 0;
    }

    let rawSum = 0;
    let maxPossible = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const axisValue = this.#resolveAxisValue(
        axis,
        normalizedAxes,
        sexualAxes,
        traitAxes
      );

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
   * Compute raw/gated/final signals for a prototype.
   *
   * @param {EmotionPrototype} prototype - Emotion/sexual prototype
   * @param {{[key: string]: number}} normalizedAxes - Normalized mood axes
   * @param {{[key: string]: number}} sexualAxes - Normalized sexual axes
   * @param {{[key: string]: number}} [traitAxes={}] - Normalized affect trait axes
   * @returns {{ raw: number, gated: number, final: number, gatePass: boolean }}
   */
  #computePrototypeSignals(prototype, normalizedAxes, sexualAxes, traitAxes = {}) {
    let rawSum = 0;
    let maxPossible = 0;

    const weights = prototype?.weights;
    if (weights && typeof weights === 'object') {
      for (const [axis, weight] of Object.entries(weights)) {
        const axisValue = this.#resolveAxisValue(
          axis,
          normalizedAxes,
          sexualAxes,
          traitAxes
        );
        rawSum += axisValue * weight;
        maxPossible += Math.abs(weight);
      }
    }

    const raw =
      maxPossible === 0 ? 0 : clamp01(rawSum / maxPossible);
    const gatePass = this.#checkGates(
      prototype?.gates,
      normalizedAxes,
      sexualAxes,
      traitAxes
    );
    const gated = gatePass ? raw : 0;
    const final = gated;

    return { raw, gated, final, gatePass };
  }

  /**
   * Normalizes sexual axes from [0..100] to [0..1].
   *
   * @param {SexualState|null|undefined} sexualState - Raw sexual state data
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @returns {{[key: string]: number}} Normalized sexual axes
   */
  #normalizeSexualAxes(sexualState, sexualArousal) {
    const normalized = {};
    const resolvedArousal =
      typeof sexualArousal === 'number'
        ? sexualArousal
        : this.calculateSexualArousal(sexualState);

    normalized.sexual_arousal = clamp01(resolvedArousal ?? 0);

    if (sexualState && typeof sexualState === 'object') {
      const hasSexInhibition = Object.prototype.hasOwnProperty.call(
        sexualState,
        'sex_inhibition'
      );
      const hasSexualInhibition = Object.prototype.hasOwnProperty.call(
        sexualState,
        'sexual_inhibition'
      );
      const hasSexExcitation = Object.prototype.hasOwnProperty.call(
        sexualState,
        'sex_excitation'
      );

      if (hasSexInhibition) {
        this.#assertSexualAxisValue(
          'sex_inhibition',
          sexualState.sex_inhibition,
          sexualState,
          'normalizeSexualAxes'
        );
      } else if (hasSexualInhibition) {
        this.#assertSexualAxisValue(
          'sexual_inhibition',
          sexualState.sexual_inhibition,
          sexualState,
          'normalizeSexualAxes'
        );
      }

      if (hasSexExcitation) {
        this.#assertSexualAxisValue(
          'sex_excitation',
          sexualState.sex_excitation,
          sexualState,
          'normalizeSexualAxes'
        );
      }

      const inhibitionValue =
        typeof sexualState.sex_inhibition === 'number'
          ? sexualState.sex_inhibition
          : typeof sexualState.sexual_inhibition === 'number'
            ? sexualState.sexual_inhibition
            : null;

      if (typeof inhibitionValue === 'number') {
        const normalizedInhibition = clamp01(inhibitionValue / 100);
        normalized.sex_inhibition = normalizedInhibition;
        normalized.sexual_inhibition = normalizedInhibition;
      }

      if (typeof sexualState.sex_excitation === 'number') {
        normalized.sex_excitation = clamp01(sexualState.sex_excitation / 100);
      }
    }

    return normalized;
  }

  /**
   * Normalizes affect traits from [0..100] to [0..1].
   * Uses default values (50 = average human) for missing properties.
   *
   * @param {AffectTraits|null|undefined} affectTraits - Raw affect traits data
   * @returns {{[key: string]: number}} Normalized trait values in [0..1]
   */
  #normalizeAffectTraits(affectTraits) {
    const normalized = {};
    const traits = affectTraits ?? DEFAULT_AFFECT_TRAITS;

    for (const [trait, value] of Object.entries(traits)) {
      if (typeof value === 'number') {
        // Normalize [0..100] to [0..1], clamp to valid range
        normalized[trait] = Math.max(0, Math.min(1, value / 100));
      }
    }

    // Ensure all default traits are present with defaults if missing
    for (const [trait, defaultValue] of Object.entries(DEFAULT_AFFECT_TRAITS)) {
      if (normalized[trait] === undefined) {
        normalized[trait] = defaultValue / 100;
      }
    }

    return normalized;
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

    if (typeof sexualState === 'object') {
      if (Object.prototype.hasOwnProperty.call(sexualState, 'sex_excitation')) {
        this.#assertSexualAxisValue(
          'sex_excitation',
          sexualState.sex_excitation,
          sexualState,
          'calculateSexualArousal'
        );
      }
      if (Object.prototype.hasOwnProperty.call(sexualState, 'sex_inhibition')) {
        this.#assertSexualAxisValue(
          'sex_inhibition',
          sexualState.sex_inhibition,
          sexualState,
          'calculateSexualArousal'
        );
      }
    }

    const excitation =
      typeof sexualState.sex_excitation === 'number'
        ? sexualState.sex_excitation
        : 0;
    const inhibition =
      typeof sexualState.sex_inhibition === 'number'
        ? sexualState.sex_inhibition
        : 0;
    const baseline =
      typeof sexualState.baseline_libido === 'number'
        ? sexualState.baseline_libido
        : 0;

    // Formula: (excitation - inhibition + baseline) / 100
    const rawValue = (excitation - inhibition + baseline) / 100;

    return clamp01(rawValue);
  }

  /**
   * Validates sexual axis inputs before normalization.
   *
   * @param {string} axisName - Axis name in sexual state
   * @param {unknown} value - Incoming raw axis value
   * @param {SexualState|null|undefined} sexualState - Sexual state payload
   * @param {string} context - Calling method for error context
   * @returns {void}
   */
  #assertSexualAxisValue(axisName, value, sexualState, context) {
    const serialized = this.#stringifySexualState(sexualState);
    const normalizationNote =
      'EmotionCalculatorService normalizes sexual axes by dividing by 100; pass raw core:sexual_state values in [0..100].';

    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new InvalidArgumentError(
        `EmotionCalculatorService.${context}: Invalid "${axisName}" value. Expected a finite number (integer) in [0..100] from ${this.#sexualComponentId}. Received ${String(
          value
        )} (${typeof value}). ${normalizationNote} sexualState=${serialized}`,
        axisName,
        value
      );
    }

    if (!Number.isInteger(value)) {
      const normalizedHint =
        value > 0 && value < 1
          ? ' Value looks pre-normalized in [0..1].'
          : '';
      throw new InvalidArgumentError(
        `EmotionCalculatorService.${context}: Invalid "${axisName}" value. Expected an integer in [0..100] from ${this.#sexualComponentId}. Received ${value} (non-integer).${normalizedHint} ${normalizationNote} sexualState=${serialized}`,
        axisName,
        value
      );
    }

    if (value < 0 || value > 100) {
      throw new InvalidArgumentError(
        `EmotionCalculatorService.${context}: Invalid "${axisName}" value. Expected integer range [0..100] from ${this.#sexualComponentId}. Received ${value}. ${normalizationNote} sexualState=${serialized}`,
        axisName,
        value
      );
    }
  }

  /**
   * Stringifies sexual state for error messages.
   *
   * @param {SexualState|null|undefined} sexualState
   * @returns {string}
   */
  #stringifySexualState(sexualState) {
    try {
      return JSON.stringify(sexualState);
    } catch {
      return '[unserializable sexualState]';
    }
  }

  /**
   * Calculates emotion intensities from mood data.
   *
   * @param {MoodData} moodData - Mood axis values (including affiliation)
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @param {SexualState|null|undefined} sexualState - Sexual state data
   * @param {AffectTraits|null|undefined} [affectTraits] - Affect trait values (optional)
   * @returns {Map<string, number>} Map of emotion name to intensity
   */
  calculateEmotions(moodData, sexualArousal, sexualState, affectTraits = null) {
    const result = new Map();

    const prototypes = this.#ensureEmotionPrototypes();
    if (!prototypes) {
      this.#logger.warn(
        'EmotionCalculatorService: No emotion prototypes available.'
      );
      return result;
    }

    const normalizedAxes = this.#normalizeMoodAxes(moodData);
    const sexualAxes = this.#normalizeSexualAxes(sexualState, sexualArousal);
    const traitAxes = this.#normalizeAffectTraits(affectTraits);

    for (const [emotionName, prototype] of Object.entries(prototypes)) {
      const intensity = this.#calculatePrototypeIntensity(
        prototype,
        normalizedAxes,
        sexualAxes,
        traitAxes
      );
      result.set(emotionName, intensity);
    }

    return result;
  }

  /**
   * Calculates emotion intensities for specified prototypes only.
   *
   * @param {MoodData} moodData - Mood axis values (including affiliation)
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @param {SexualState|null|undefined} sexualState - Sexual state data
   * @param {AffectTraits|null|undefined} [affectTraits] - Affect trait values (optional)
   * @param {Set<string>|null|undefined} emotionFilter - Emotion names to calculate
   * @returns {Map<string, number>} Map of emotion name to intensity
   */
  calculateEmotionsFiltered(
    moodData,
    sexualArousal,
    sexualState,
    affectTraits = null,
    emotionFilter
  ) {
    if (!emotionFilter || emotionFilter.size === 0) {
      return this.calculateEmotions(
        moodData,
        sexualArousal,
        sexualState,
        affectTraits
      );
    }

    const result = new Map();

    const prototypes = this.#ensureEmotionPrototypes();
    if (!prototypes) {
      this.#logger.warn(
        'EmotionCalculatorService: No emotion prototypes available.'
      );
      return result;
    }

    const normalizedAxes = this.#normalizeMoodAxes(moodData);
    const sexualAxes = this.#normalizeSexualAxes(sexualState, sexualArousal);
    const traitAxes = this.#normalizeAffectTraits(affectTraits);

    for (const emotionName of emotionFilter) {
      const prototype = prototypes[emotionName];
      if (!prototype) continue;

      const intensity = this.#calculatePrototypeIntensity(
        prototype,
        normalizedAxes,
        sexualAxes,
        traitAxes
      );
      result.set(emotionName, intensity);
    }

    return result;
  }

  /**
   * Calculates raw/gated/final signals for specified emotion prototypes.
   *
   * @param {MoodData} moodData - Mood axis values (including affiliation)
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @param {SexualState|null|undefined} sexualState - Sexual state data
   * @param {AffectTraits|null|undefined} [affectTraits] - Affect trait values (optional)
   * @param {Set<string>|null|undefined} emotionFilter - Emotion names to calculate
   * @returns {Map<string, { raw: number, gated: number, final: number, gatePass: boolean }>}
   */
  calculateEmotionTracesFiltered(
    moodData,
    sexualArousal,
    sexualState,
    affectTraits = null,
    emotionFilter
  ) {
    if (!emotionFilter || emotionFilter.size === 0) {
      return this.calculateEmotionTraces(
        moodData,
        sexualArousal,
        sexualState,
        affectTraits
      );
    }

    const result = new Map();

    const prototypes = this.#ensureEmotionPrototypes();
    if (!prototypes) {
      this.#logger.warn(
        'EmotionCalculatorService: No emotion prototypes available.'
      );
      return result;
    }

    const normalizedAxes = this.#normalizeMoodAxes(moodData);
    const sexualAxes = this.#normalizeSexualAxes(sexualState, sexualArousal);
    const traitAxes = this.#normalizeAffectTraits(affectTraits);

    for (const emotionName of emotionFilter) {
      const prototype = prototypes[emotionName];
      if (!prototype) continue;

      result.set(
        emotionName,
        this.#computePrototypeSignals(
          prototype,
          normalizedAxes,
          sexualAxes,
          traitAxes
        )
      );
    }

    return result;
  }

  /**
   * Calculates raw/gated/final signals for all emotion prototypes.
   *
   * @param {MoodData} moodData - Mood axis values (including affiliation)
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @param {SexualState|null|undefined} sexualState - Sexual state data
   * @param {AffectTraits|null|undefined} [affectTraits] - Affect trait values (optional)
   * @returns {Map<string, { raw: number, gated: number, final: number, gatePass: boolean }>}
   */
  calculateEmotionTraces(moodData, sexualArousal, sexualState, affectTraits = null) {
    const result = new Map();

    const prototypes = this.#ensureEmotionPrototypes();
    if (!prototypes) {
      this.#logger.warn(
        'EmotionCalculatorService: No emotion prototypes available.'
      );
      return result;
    }

    const normalizedAxes = this.#normalizeMoodAxes(moodData);
    const sexualAxes = this.#normalizeSexualAxes(sexualState, sexualArousal);
    const traitAxes = this.#normalizeAffectTraits(affectTraits);

    for (const [emotionName, prototype] of Object.entries(prototypes)) {
      result.set(
        emotionName,
        this.#computePrototypeSignals(
          prototype,
          normalizedAxes,
          sexualAxes,
          traitAxes
        )
      );
    }

    return result;
  }

  /**
   * Calculates sexual state intensities from mood data.
   *
   * @param {MoodData} moodData - Mood axis values
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @param {SexualState|null|undefined} sexualState - Sexual state data
   * @returns {Map<string, number>} Map of sexual state name to intensity
   */
  calculateSexualStates(moodData, sexualArousal, sexualState) {
    const result = new Map();

    const prototypes = this.#ensureSexualPrototypes();
    if (!prototypes) {
      this.#logger.warn(
        'EmotionCalculatorService: No sexual prototypes available.'
      );
      return result;
    }

    const normalizedAxes = this.#normalizeMoodAxes(moodData);
    const sexualAxes = this.#normalizeSexualAxes(sexualState, sexualArousal);

    for (const [stateName, prototype] of Object.entries(prototypes)) {
      const intensity = this.#calculatePrototypeIntensity(
        prototype,
        normalizedAxes,
        sexualAxes
      );
      result.set(stateName, intensity);
    }

    return result;
  }

  /**
   * Calculates raw/gated/final signals for sexual state prototypes.
   *
   * @param {MoodData} moodData - Mood axis values
   * @param {number|null} sexualArousal - Calculated sexual arousal value
   * @param {SexualState|null|undefined} sexualState - Sexual state data
   * @returns {Map<string, { raw: number, gated: number, final: number, gatePass: boolean }>}
   */
  calculateSexualStateTraces(moodData, sexualArousal, sexualState) {
    const result = new Map();

    const prototypes = this.#ensureSexualPrototypes();
    if (!prototypes) {
      this.#logger.warn(
        'EmotionCalculatorService: No sexual prototypes available.'
      );
      return result;
    }

    const normalizedAxes = this.#normalizeMoodAxes(moodData);
    const sexualAxes = this.#normalizeSexualAxes(sexualState, sexualArousal);

    for (const [stateName, prototype] of Object.entries(prototypes)) {
      result.set(
        stateName,
        this.#computePrototypeSignals(prototype, normalizedAxes, sexualAxes)
      );
    }

    return result;
  }

  /**
   * Get all emotion prototype keys from lookups.
   *
   * @returns {string[]} Emotion prototype keys
   */
  getEmotionPrototypeKeys() {
    const prototypes = this.#ensureEmotionPrototypes();
    if (!prototypes) {
      throw new InvalidArgumentError(
        `EmotionCalculatorService: Required lookup "${EMOTION_PROTOTYPES_LOOKUP_ID}" not found in data registry. ` +
          `Ensure mods are loaded before using expression services.`
      );
    }
    const keys = Object.keys(prototypes);
    if (keys.length === 0) {
      throw new InvalidArgumentError(
        `EmotionCalculatorService: Emotion prototype lookup "${EMOTION_PROTOTYPES_LOOKUP_ID}" is empty. ` +
          `No prototype definitions found. Check the lookup file for valid entries.`
      );
    }
    return keys;
  }

  /**
   * Get all sexual prototype keys from lookups.
   *
   * @returns {string[]} Sexual prototype keys
   */
  getSexualPrototypeKeys() {
    const prototypes = this.#ensureSexualPrototypes();
    if (!prototypes) {
      throw new InvalidArgumentError(
        `EmotionCalculatorService: Required lookup "${SEXUAL_PROTOTYPES_LOOKUP_ID}" not found in data registry. ` +
          `Ensure mods are loaded before using expression services.`
      );
    }
    const keys = Object.keys(prototypes);
    if (keys.length === 0) {
      throw new InvalidArgumentError(
        `EmotionCalculatorService: Sexual prototype lookup "${SEXUAL_PROTOTYPES_LOOKUP_ID}" is empty. ` +
          `No prototype definitions found. Check the lookup file for valid entries.`
      );
    }
    return keys;
  }

  /**
   * Gets the intensity label for a given intensity value.
   * Loop is guaranteed to return since clamp01() ensures [0,1] and INTENSITY_LEVELS[10].max === 1.0
   *
   * @param {number} intensity - Intensity value in [0..1]
   * @returns {string} Human-readable intensity label
   */
  getIntensityLabel(intensity) {
    const clamped = clamp01(intensity);

    // Loop guaranteed to return: clamp01() ensures value is in [0,1]
    // and INTENSITY_LEVELS ends with {max: 1.0}, so we always match
    for (const level of INTENSITY_LEVELS) {
      if (clamped <= level.max) {
        return level.label;
      }
    }
  }

  /**
   * Formats emotions for inclusion in LLM prompts.
   *
   * @param {Map<string, number>} emotions - Map of emotion name to intensity
   * @param {number} [maxCount] - Maximum number of emotions to include
   * @returns {string} Formatted string like "joy: strong, curiosity: moderate, ..."
   */
  formatEmotionsForPrompt(emotions, maxCount) {
    return this.getTopEmotions(emotions, maxCount)
      .map(({ displayName, label }) => `${displayName}: ${label}`)
      .join(', ');
  }

  /**
   * Formats sexual states for inclusion in LLM prompts.
   *
   * @param {Map<string, number>} sexualStates - Map of sexual state name to intensity
   * @param {number} [maxCount] - Maximum number of states to include
   * @returns {string} Formatted string like "sexual_lust: strong, ..."
   */
  formatSexualStatesForPrompt(sexualStates, maxCount) {
    return this.getTopSexualStates(sexualStates, maxCount)
      .map(({ displayName, label }) => `${displayName}: ${label}`)
      .join(', ');
  }

  /**
   * Gets the top emotions for display purposes.
   *
   * @param {Map<string, number>} emotions - Map of emotion name to intensity
   * @param {number} [maxCount] - Maximum number of emotions to include
   * @returns {Array<{name: string, displayName: string, label: string, intensity: number}>}
   */
  getTopEmotions(emotions, maxCount) {
    return this.#getTopStates(emotions, maxCount, this.#defaultMaxEmotionalStates);
  }

  /**
   * Gets the top sexual states for display purposes.
   *
   * @param {Map<string, number>} sexualStates - Map of sexual state name to intensity
   * @param {number} [maxCount] - Maximum number of states to include
   * @returns {Array<{name: string, displayName: string, label: string, intensity: number}>}
   */
  getTopSexualStates(sexualStates, maxCount) {
    return this.#getTopStates(sexualStates, maxCount, this.#defaultMaxSexualStates);
  }

  /**
   * Shared filtering/sorting for emotion/sexual state lists.
   *
   * @param {Map<string, number>|null|undefined} states - Map of state name to intensity
   * @param {number|undefined} maxCount - Maximum number of items to include
   * @param {number} defaultMaxCount - Default max if maxCount is not provided
   * @returns {Array<{name: string, displayName: string, label: string, intensity: number}>}
   */
  #getTopStates(states, maxCount, defaultMaxCount) {
    if (!states || states.size === 0) {
      return [];
    }

    const filtered = Array.from(states.entries()).filter(
      ([, intensity]) => intensity >= 0.05
    );

    if (filtered.length === 0) {
      return [];
    }

    filtered.sort((a, b) => b[1] - a[1]);

    const resolvedMaxCount = maxCount ?? defaultMaxCount;
    const topStates = filtered.slice(0, resolvedMaxCount);

    return topStates.map(([name, intensity]) => {
      const displayName = name.replace(/_/g, ' ');
      const label = this.getIntensityLabel(intensity);
      return {
        name,
        displayName,
        label,
        intensity,
      };
    });
  }
}

export default EmotionCalculatorService;
