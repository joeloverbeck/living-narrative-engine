/**
 * @file ContextBuilder.js
 * @description Builds and manages simulation contexts for Monte Carlo evaluation
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
} from '../../utils/axisNormalizationUtils.js';
import { MOOD_AXES, AFFECT_TRAITS } from '../../../constants/moodAffectConstants.js';

const SEXUAL_AXIS_NAMES = new Set([
  'sex_excitation',
  'sex_inhibition',
  'sexual_inhibition',
  'baseline_libido',
]);

const MOOD_AXIS_NAMES = new Set(MOOD_AXES);
const AFFECT_TRAIT_NAMES = new Set(AFFECT_TRAITS);

class ContextBuilder {
  #dataRegistry;
  #emotionCalculatorAdapter;

  /**
   * @param {Object} deps
   * @param {import('../../../interfaces/ILogger.js').ILogger} [deps.logger]
   * @param {import('../../../interfaces/IDataRegistry.js').IDataRegistry} deps.dataRegistry
   * @param {import('../../../interfaces/IEmotionCalculatorAdapter.js').IEmotionCalculatorAdapter} deps.emotionCalculatorAdapter
   */
  constructor({ logger, dataRegistry, emotionCalculatorAdapter }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(emotionCalculatorAdapter, 'IEmotionCalculatorAdapter', logger, {
      requiredMethods: [
        'calculateEmotionsFiltered',
        'calculateEmotionTracesFiltered',
        'calculateSexualStateTraces',
        'calculateSexualArousal',
        'calculateSexualStates',
      ],
    });

    this.#dataRegistry = dataRegistry;
    this.#emotionCalculatorAdapter = emotionCalculatorAdapter;
  }

  /**
   * Build evaluation context from current and previous states
   *
   * @param {{mood: object, sexual: object}} currentState - Current mood and sexual state
   * @param {{mood: object, sexual: object}} previousState - Previous mood and sexual state
   * @param {{affective_empathy: number, cognitive_empathy: number, harm_aversion: number}|null} [affectTraits] - Affect traits for gate checking
   * @param {Set<string>|null|undefined} [emotionFilter] - Emotion names to calculate
   * @param {boolean} [includeGateTrace=false] - Whether to compute gate traces
   * @returns {object} Context object with moodAxes, emotions, sexualStates, gateTrace, affectTraits, and their previous counterparts
   */
  buildContext(
    currentState,
    previousState,
    affectTraits = null,
    emotionFilter,
    includeGateTrace = false
  ) {
    const emotions = this.#emotionCalculatorAdapter.calculateEmotionsFiltered(
      currentState.mood,
      currentState.sexual,
      affectTraits,
      emotionFilter
    );

    const sexualArousal =
      this.#emotionCalculatorAdapter.calculateSexualArousal(
        currentState.sexual
      );

    const sexualStates =
      this.#emotionCalculatorAdapter.calculateSexualStates(
        currentState.mood,
        currentState.sexual,
        sexualArousal
      );

    const previousEmotions = this.#emotionCalculatorAdapter.calculateEmotionsFiltered(
      previousState.mood,
      previousState.sexual,
      affectTraits,
      emotionFilter
    );

    const previousSexualArousal =
      this.#emotionCalculatorAdapter.calculateSexualArousal(
        previousState.sexual
      );
    const previousSexualStates =
      this.#emotionCalculatorAdapter.calculateSexualStates(
        previousState.mood,
        previousState.sexual,
        previousSexualArousal
      );

    const gateTrace = includeGateTrace
      ? {
          emotions:
            this.#emotionCalculatorAdapter.calculateEmotionTracesFiltered(
              currentState.mood,
              currentState.sexual,
              affectTraits,
              emotionFilter
            ),
          sexualStates:
            this.#emotionCalculatorAdapter.calculateSexualStateTraces(
              currentState.mood,
              currentState.sexual,
              sexualArousal
            ),
        }
      : null;

    const previousMoodAxes = previousState.mood;

    const defaultTraits = {
      affective_empathy: 50,
      cognitive_empathy: 50,
      harm_aversion: 50,
      self_control: 50,
    };

    return {
      mood: currentState.mood,
      moodAxes: currentState.mood,
      sexualAxes: currentState.sexual,
      emotions,
      sexualStates,
      sexualArousal,
      previousEmotions,
      previousSexualStates,
      previousMoodAxes,
      previousSexualAxes: previousState.sexual,
      previousSexualArousal,
      affectTraits: affectTraits ?? defaultTraits,
      gateTrace,
    };
  }

  /**
   * Build the set of known context keys from static definitions and prototype registries.
   *
   * @returns {{ topLevel: Set<string>, nestedKeys: Record<string, Set<string>>, scalarKeys: Set<string> }}
   */
  buildKnownContextKeys() {
    const topLevel = new Set([
      'mood',
      'moodAxes',
      'emotions',
      'sexualStates',
      'sexualArousal',
      'previousEmotions',
      'previousSexualStates',
      'previousMoodAxes',
      'previousSexualArousal',
      'affectTraits',
    ]);

    const scalarKeys = new Set(['sexualArousal', 'previousSexualArousal']);

    const moodAxisSet = new Set(MOOD_AXES);

    const nestedKeys = {
      mood: moodAxisSet,
      moodAxes: new Set(moodAxisSet),
      previousMoodAxes: new Set(moodAxisSet),
    };

    nestedKeys.affectTraits = new Set(AFFECT_TRAITS);

    const emotionLookup = this.#dataRegistry.get(
      'lookups',
      'core:emotion_prototypes'
    );
    if (emotionLookup?.entries) {
      const emotionKeys = new Set(Object.keys(emotionLookup.entries));
      nestedKeys.emotions = emotionKeys;
      nestedKeys.previousEmotions = emotionKeys;
    } else {
      nestedKeys.emotions = new Set();
      nestedKeys.previousEmotions = new Set();
    }

    const sexualLookup = this.#dataRegistry.get(
      'lookups',
      'core:sexual_prototypes'
    );
    if (sexualLookup?.entries) {
      const sexualKeys = new Set(Object.keys(sexualLookup.entries));
      nestedKeys.sexualStates = sexualKeys;
      nestedKeys.previousSexualStates = sexualKeys;
    } else {
      nestedKeys.sexualStates = new Set();
      nestedKeys.previousSexualStates = new Set();
    }

    return { topLevel, nestedKeys, scalarKeys };
  }

  /**
   * Normalize axes from context for gate evaluation.
   *
   * @param {object} context
   * @param {boolean} usePrevious
   * @returns {{moodAxes: object, sexualAxes: object, traitAxes: object}}
   */
  normalizeGateContext(context, usePrevious) {
    const moodSource = usePrevious
      ? context?.previousMoodAxes
      : context?.moodAxes ?? context?.mood ?? {};
    const sexualSource = usePrevious
      ? context?.previousSexualAxes
      : context?.sexualAxes ?? context?.sexual ?? null;
    const sexualArousalSource = usePrevious
      ? context?.previousSexualArousal ?? null
      : context?.sexualArousal ?? null;

    const moodAxes = normalizeMoodAxes(moodSource);
    const sexualAxes = normalizeSexualAxes(
      sexualSource,
      sexualArousalSource
    );
    const traitAxes = normalizeAffectTraits(context?.affectTraits);

    return { moodAxes, sexualAxes, traitAxes };
  }

  initializeMoodRegimeAxisHistograms(trackedGateAxes) {
    if (!Array.isArray(trackedGateAxes) || trackedGateAxes.length === 0) {
      return {};
    }

    const histograms = {};
    for (const axis of trackedGateAxes) {
      const spec = this.#getAxisHistogramSpec(axis);
      if (!spec) {
        continue;
      }
      histograms[axis] = {
        axis,
        min: spec.min,
        max: spec.max,
        binCount: spec.binCount,
        bins: Array.from({ length: spec.binCount }, () => 0),
        sampleCount: 0,
      };
    }

    return histograms;
  }

  initializeMoodRegimeSampleReservoir(limit) {
    const resolvedLimit =
      typeof limit === 'number' && Number.isFinite(limit)
        ? Math.max(0, Math.floor(limit))
        : 0;

    return {
      sampleCount: 0,
      storedCount: 0,
      limit: resolvedLimit,
      samples: [],
    };
  }

  recordMoodRegimeAxisHistograms(histograms, context) {
    for (const [axis, histogram] of Object.entries(histograms)) {
      const value = this.#resolveGateAxisRawValue(axis, context);
      if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        continue;
      }

      const binIndex = this.#getHistogramBinIndex(histogram, value);
      if (binIndex === null) {
        continue;
      }

      histogram.bins[binIndex] += 1;
      histogram.sampleCount += 1;
    }
  }

  recordMoodRegimeSampleReservoir(reservoir, histogramAxes, context) {
    if (!reservoir) {
      return;
    }

    reservoir.sampleCount += 1;
    if (reservoir.limit <= 0 || reservoir.samples.length >= reservoir.limit) {
      reservoir.storedCount = reservoir.samples.length;
      return;
    }

    const sample = {};
    for (const axis of histogramAxes) {
      const value = this.#resolveGateAxisRawValue(axis, context);
      if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        continue;
      }
      sample[axis] = value;
    }

    reservoir.samples.push(sample);
    reservoir.storedCount = reservoir.samples.length;
  }

  #getAxisHistogramSpec(axis) {
    if (MOOD_AXIS_NAMES.has(axis)) {
      return { min: -100, max: 100, binCount: 201 };
    }
    if (AFFECT_TRAIT_NAMES.has(axis)) {
      return { min: 0, max: 100, binCount: 101 };
    }
    if (axis === 'sexual_arousal') {
      return { min: 0, max: 1, binCount: 101 };
    }
    if (axis === 'baseline_libido') {
      return { min: -50, max: 50, binCount: 101 };
    }
    if (axis === 'sex_excitation' || axis === 'sex_inhibition' || axis === 'sexual_inhibition') {
      return { min: 0, max: 100, binCount: 101 };
    }
    return null;
  }

  #getHistogramBinIndex(histogram, value) {
    const { min, max, binCount } = histogram;
    if (typeof min !== 'number' || typeof max !== 'number' || typeof binCount !== 'number') {
      return null;
    }
    if (binCount <= 0 || max === min) {
      return null;
    }

    if (binCount === max - min + 1) {
      const rounded = Math.round(value);
      const clamped = Math.max(min, Math.min(max, rounded));
      return clamped - min;
    }

    const clampedValue = Math.max(min, Math.min(max, value));
    const ratio = (clampedValue - min) / (max - min);
    const index = Math.round(ratio * (binCount - 1));
    return Math.max(0, Math.min(binCount - 1, index));
  }

  #resolveGateAxisRawValue(axis, context) {
    if (!context || typeof axis !== 'string') {
      return null;
    }

    if (MOOD_AXIS_NAMES.has(axis)) {
      return context?.moodAxes?.[axis] ?? context?.mood?.[axis] ?? null;
    }

    if (AFFECT_TRAIT_NAMES.has(axis)) {
      return context?.affectTraits?.[axis] ?? null;
    }

    if (axis === 'sexual_arousal') {
      return context?.sexualArousal ?? null;
    }

    if (SEXUAL_AXIS_NAMES.has(axis)) {
      const sexualAxes = context?.sexualAxes ?? context?.sexual ?? {};
      if (axis === 'sexual_inhibition') {
        return sexualAxes.sex_inhibition ?? sexualAxes.sexual_inhibition ?? null;
      }
      if (axis === 'sex_inhibition') {
        return sexualAxes.sex_inhibition ?? sexualAxes.sexual_inhibition ?? null;
      }
      return sexualAxes[axis] ?? null;
    }

    return null;
  }
}

export default ContextBuilder;
