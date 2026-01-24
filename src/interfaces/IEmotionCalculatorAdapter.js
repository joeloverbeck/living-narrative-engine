/**
 * @file Interface for EmotionCalculatorAdapter
 * @description Adapter interface for emotion calculation in Monte Carlo simulations
 */

/**
 * @typedef {object} IEmotionCalculatorAdapter
 * @property {function(object, object|null, Set<string>=): object} calculateEmotionsFiltered
 *   Calculate specified emotions from mood and optional sexual state
 * @property {function(object, object|null, Set<string>=): object} calculateEmotionTracesFiltered
 *   Calculate emotion traces for debugging/analysis
 * @property {function(object, object): object} calculateSexualStateTraces
 *   Calculate sexual state traces for analysis
 * @property {function(object, object): number} calculateSexualArousal
 *   Calculate sexual arousal level from state
 * @property {function(object, object): object} calculateSexualStates
 *   Calculate sexual states from mood and base state
 */

export {};
