/**
 * @file Adapter wrapping EmotionCalculatorService for MonteCarloSimulator.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

class EmotionCalculatorAdapter {
  #emotionCalculatorService;
  #logger;

  constructor({ emotionCalculatorService, logger }) {
    validateDependency(emotionCalculatorService, 'IEmotionCalculatorService', logger, {
      requiredMethods: [
        'calculateEmotions',
        'calculateEmotionsFiltered',
        'calculateSexualArousal',
        'calculateSexualStates',
      ],
    });
    this.#emotionCalculatorService = emotionCalculatorService;
    this.#logger = logger;
  }

  /**
   * Calculate emotions from mood, sexual state, and optional affect traits.
   * @param {object} mood - Mood axes with values in [-100, 100]
   * @param {object|null} [sexualState=null] - Optional sexual state axes
   * @param {object|null} [affectTraits=null] - Optional affect trait modifiers
   * @returns {object} Emotion intensities keyed by emotion ID
   */
  calculateEmotions(mood, sexualState = null, affectTraits = null) {
    const results = this.#emotionCalculatorService.calculateEmotions(
      mood,
      null,
      sexualState,
      affectTraits
    );
    return this.#mapToObject(results);
  }

  /**
   * Calculate specified emotions from mood, sexual state, and optional affect traits.
   * Falls back to full calculation when no filter is provided.
   * @param {object} mood - Mood axes with values in [-100, 100]
   * @param {object|null} [sexualState=null] - Optional sexual state axes
   * @param {object|null} [affectTraits=null] - Optional affect trait modifiers
   * @param {Set<string>|null|undefined} emotionFilter - Emotion names to calculate
   * @returns {object} Emotion intensities keyed by emotion ID
   */
  calculateEmotionsFiltered(
    mood,
    sexualState = null,
    affectTraits = null,
    emotionFilter
  ) {
    if (!emotionFilter || emotionFilter.size === 0) {
      return this.calculateEmotions(mood, sexualState, affectTraits);
    }

    const results = this.#emotionCalculatorService.calculateEmotionsFiltered(
      mood,
      null,
      sexualState,
      affectTraits,
      emotionFilter
    );
    return this.#mapToObject(results);
  }

  /**
   * Calculate sexual arousal from sexual state.
   * @param {object|null} sexualState - Sexual state axes
   * @returns {number|null} Arousal value in [0, 1] or null
   */
  calculateSexualArousal(sexualState) {
    return this.#emotionCalculatorService.calculateSexualArousal(sexualState);
  }

  /**
   * Calculate sexual states from mood, sexual state, and arousal.
   * @param {object} mood - Mood axes with values in [-100, 100]
   * @param {object|null} sexualState - Sexual state axes
   * @param {number|null} [sexualArousal=null] - Arousal value in [0, 1]
   * @returns {object} Sexual state intensities keyed by state ID
   */
  calculateSexualStates(mood, sexualState, sexualArousal = null) {
    const results = this.#emotionCalculatorService.calculateSexualStates(
      mood,
      sexualArousal,
      sexualState
    );
    return this.#mapToObject(results);
  }

  #mapToObject(map) {
    if (!map || typeof map[Symbol.iterator] !== 'function') {
      return {};
    }

    const obj = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return obj;
  }
}

export default EmotionCalculatorAdapter;
