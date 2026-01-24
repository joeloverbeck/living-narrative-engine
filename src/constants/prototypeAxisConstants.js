/**
 * @file Centralized constants for all prototype weight axes
 * Single source of truth for valid weight axis names used in emotion and sexual prototypes.
 * Combines mood axes, affect traits, and sexual-specific axes.
 * @see src/constants/moodAffectConstants.js
 * @see data/mods/core/lookups/emotion_prototypes.lookup.json
 * @see data/mods/core/lookups/sexual_prototypes.lookup.json
 */

import { MOOD_AXES, AFFECT_TRAITS } from './moodAffectConstants.js';

/**
 * Sexual-specific axes used in sexual prototypes and some emotion prototypes.
 * These are distinct from mood axes and affect traits.
 *
 * @type {readonly string[]}
 */
export const SEXUAL_AXES = Object.freeze([
  'sexual_arousal',
  'sex_excitation',
  'sex_inhibition',
  'sexual_inhibition',
  'baseline_libido',
]);

/**
 * All valid axes that can appear as weight keys in prototype lookups.
 * Combines mood axes, affect traits, and sexual axes.
 *
 * @type {readonly string[]}
 */
export const ALL_PROTOTYPE_WEIGHT_AXES = Object.freeze([
  ...MOOD_AXES,
  ...AFFECT_TRAITS,
  ...SEXUAL_AXES,
]);

/**
 * Pre-computed Set for fast prototype weight axis lookups.
 *
 * @type {Set<string>}
 */
export const ALL_PROTOTYPE_WEIGHT_AXES_SET = new Set(ALL_PROTOTYPE_WEIGHT_AXES);

/**
 * Check if a name is a valid prototype weight axis.
 *
 * @param {string} name - The axis name to check.
 * @returns {boolean} True if the name is a valid prototype weight axis.
 */
export function isValidPrototypeWeightAxis(name) {
  return ALL_PROTOTYPE_WEIGHT_AXES_SET.has(name);
}

/**
 * Get the category of an axis (mood, affect_trait, or sexual).
 *
 * @param {string} name - The axis name to categorize.
 * @returns {'mood' | 'affect_trait' | 'sexual' | null} The category or null if unknown.
 */
export function getAxisCategory(name) {
  if (new Set(MOOD_AXES).has(name)) {
    return 'mood';
  }
  if (new Set(AFFECT_TRAITS).has(name)) {
    return 'affect_trait';
  }
  if (new Set(SEXUAL_AXES).has(name)) {
    return 'sexual';
  }
  return null;
}
