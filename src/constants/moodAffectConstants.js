/**
 * @file Centralized constants for mood axes and affect traits
 * Single source of truth for axis/trait names, ranges, and defaults.
 * @see data/mods/core/components/mood.component.json
 * @see data/mods/core/components/affect_traits.component.json
 */

/**
 * The 9 mood axes that define a character's current affective/regulatory state.
 * Each axis ranges from -100 to +100.
 * @type {readonly string[]}
 */
export const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
]);

/**
 * The 4 stable personality traits affecting empathy, moral emotion capacity,
 * and regulatory capacity.
 * @type {readonly string[]}
 */
export const AFFECT_TRAITS = Object.freeze([
  'affective_empathy',
  'cognitive_empathy',
  'harm_aversion',
  'self_control',
]);

/**
 * Valid range for mood axes: -100 to +100
 * @type {Readonly<{min: number, max: number}>}
 */
export const MOOD_AXIS_RANGE = Object.freeze({ min: -100, max: 100 });

/**
 * Valid range for affect traits: 0 to 100
 * @type {Readonly<{min: number, max: number}>}
 */
export const AFFECT_TRAIT_RANGE = Object.freeze({ min: 0, max: 100 });

/**
 * Default value for mood axes (from component schema)
 * @type {number}
 */
export const DEFAULT_MOOD_AXIS_VALUE = 0;

/**
 * Default value for affect traits (from component schema)
 * @type {number}
 */
export const DEFAULT_AFFECT_TRAIT_VALUE = 50;

/**
 * Default affect trait values for entities without the affect_traits component.
 * Values of 50 represent "average human" baseline.
 * @type {Readonly<{affective_empathy: number, cognitive_empathy: number, harm_aversion: number, self_control: number}>}
 */
export const DEFAULT_AFFECT_TRAITS = Object.freeze({
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
  self_control: 50,
});

/**
 * Pre-computed Set for fast mood axis lookups
 * @type {Set<string>}
 */
export const MOOD_AXES_SET = new Set(MOOD_AXES);

/**
 * Pre-computed Set for fast affect trait lookups
 * @type {Set<string>}
 */
export const AFFECT_TRAITS_SET = new Set(AFFECT_TRAITS);

/**
 * Check if a name is a valid mood axis
 * @param {string} name - The name to check
 * @returns {boolean} True if the name is a valid mood axis
 */
export function isMoodAxis(name) {
  return MOOD_AXES_SET.has(name);
}

/**
 * Check if a name is a valid affect trait
 * @param {string} name - The name to check
 * @returns {boolean} True if the name is a valid affect trait
 */
export function isAffectTrait(name) {
  return AFFECT_TRAITS_SET.has(name);
}
