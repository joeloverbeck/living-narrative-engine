/**
 * @file axisNormalizationUtils - Shared axis normalization helpers for diagnostics.
 */

import { DEFAULT_AFFECT_TRAITS } from '../../constants/moodAffectConstants.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const normalizeAxisValue = (value, scale) => {
  if (typeof value !== 'number') {
    return null;
  }
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  return value / scale;
};

/**
 * Normalizes mood axes from [-100..100] to [-1..1].
 * @param {object|null|undefined} moodData
 * @returns {Record<string, number>}
 */
const normalizeMoodAxes = (moodData) => {
  if (!moodData || typeof moodData !== 'object') {
    return {};
  }

  const normalized = {};
  for (const [axis, value] of Object.entries(moodData)) {
    if (typeof value !== 'number') {
      continue;
    }
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      continue;
    }
    normalized[axis] = value / 100;
  }

  return normalized;
};

/**
 * Calculates sexual arousal from raw sexual state data.
 * @param {object|null|undefined} sexualState
 * @returns {number|null}
 */
const calculateSexualArousal = (sexualState) => {
  if (!sexualState || typeof sexualState !== 'object') {
    return null;
  }

  const excitation = normalizeAxisValue(sexualState.sex_excitation, 100) ?? 0;
  const inhibition = normalizeAxisValue(sexualState.sex_inhibition, 100) ?? 0;
  const baseline = normalizeAxisValue(sexualState.baseline_libido, 100) ?? 0;
  const rawValue = excitation - inhibition + baseline;
  return clamp01(rawValue);
};

/**
 * Normalizes sexual axes from [0..100] to [0..1].
 * @param {object|null|undefined} sexualState
 * @param {number|null|undefined} sexualArousal
 * @returns {Record<string, number>}
 */
const normalizeSexualAxes = (sexualState, sexualArousal) => {
  const normalized = {};
  const resolvedArousal =
    typeof sexualArousal === 'number'
      ? sexualArousal
      : calculateSexualArousal(sexualState);

  normalized.sexual_arousal = clamp01(resolvedArousal ?? 0);

  if (sexualState && typeof sexualState === 'object') {
    const inhibitionValue =
      typeof sexualState.sex_inhibition === 'number'
        ? sexualState.sex_inhibition
        : typeof sexualState.sexual_inhibition === 'number'
          ? sexualState.sexual_inhibition
          : null;

    const normalizedInhibition = normalizeAxisValue(inhibitionValue, 100);
    if (typeof normalizedInhibition === 'number') {
      const clampedInhibition = clamp01(normalizedInhibition);
      normalized.sex_inhibition = clampedInhibition;
      normalized.sexual_inhibition = clampedInhibition;
    }

    const normalizedExcitation = normalizeAxisValue(
      sexualState.sex_excitation,
      100
    );
    if (typeof normalizedExcitation === 'number') {
      normalized.sex_excitation = clamp01(normalizedExcitation);
    }

    const normalizedBaseline = normalizeAxisValue(
      sexualState.baseline_libido,
      100
    );
    if (typeof normalizedBaseline === 'number') {
      normalized.baseline_libido = clamp01(normalizedBaseline);
    }
  }

  return normalized;
};

/**
 * Normalizes affect traits from [0..100] to [0..1].
 * @param {object|null|undefined} affectTraits
 * @returns {Record<string, number>}
 */
const normalizeAffectTraits = (affectTraits) => {
  const normalized = {};
  const traits = affectTraits ?? DEFAULT_AFFECT_TRAITS;

  if (traits && typeof traits === 'object') {
    for (const [trait, value] of Object.entries(traits)) {
      const normalizedValue = normalizeAxisValue(value, 100);
      if (typeof normalizedValue === 'number') {
        normalized[trait] = clamp01(normalizedValue);
      }
    }
  }

  for (const [trait, defaultValue] of Object.entries(DEFAULT_AFFECT_TRAITS)) {
    if (normalized[trait] === undefined) {
      normalized[trait] = defaultValue / 100;
    }
  }

  return normalized;
};

/**
 * Resolve axis values across traits, sexual axes, then mood axes.
 * Returns 0 for missing axes (permissive mode for backward compatibility).
 * @param {string} axis
 * @param {Record<string, number>} normalizedMood
 * @param {Record<string, number>} normalizedSexual
 * @param {Record<string, number>} [normalizedTraits]
 * @returns {number}
 */
const resolveAxisValue = (
  axis,
  normalizedMood,
  normalizedSexual,
  normalizedTraits = {}
) => {
  const resolvedAxis = axis === 'SA' ? 'sexual_arousal' : axis;

  if (Object.prototype.hasOwnProperty.call(normalizedTraits, resolvedAxis)) {
    return normalizedTraits[resolvedAxis];
  }

  if (Object.prototype.hasOwnProperty.call(normalizedSexual, resolvedAxis)) {
    return normalizedSexual[resolvedAxis];
  }

  return normalizedMood[resolvedAxis] ?? 0;
};

/**
 * Strict axis resolution that throws on missing axis.
 * Use in Monte Carlo diagnostics to detect prototype weight misconfigurations.
 * @param {string} axis - Axis name to resolve
 * @param {Record<string, number>} normalizedMood - Normalized mood axes
 * @param {Record<string, number>} normalizedSexual - Normalized sexual axes
 * @param {Record<string, number>} [normalizedTraits] - Normalized affect traits
 * @param {string} [contextLabel] - Label for error messages
 * @returns {number}
 * @throws {Error} If axis is not found in any source
 */
const resolveAxisValueStrict = (
  axis,
  normalizedMood,
  normalizedSexual,
  normalizedTraits = {},
  contextLabel = 'intensity calculation'
) => {
  const resolvedAxis = axis === 'SA' ? 'sexual_arousal' : axis;

  if (Object.prototype.hasOwnProperty.call(normalizedTraits, resolvedAxis)) {
    return normalizedTraits[resolvedAxis];
  }

  if (Object.prototype.hasOwnProperty.call(normalizedSexual, resolvedAxis)) {
    return normalizedSexual[resolvedAxis];
  }

  if (Object.prototype.hasOwnProperty.call(normalizedMood, resolvedAxis)) {
    return normalizedMood[resolvedAxis];
  }

  throw new Error(
    `[AxisNormalization] Missing axis "${resolvedAxis}" in ${contextLabel}. ` +
      `Available mood: [${Object.keys(normalizedMood).join(', ')}]. ` +
      `Available sexual: [${Object.keys(normalizedSexual).join(', ')}]. ` +
      `Available traits: [${Object.keys(normalizedTraits).join(', ')}].`
  );
};

export {
  calculateSexualArousal,
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
  resolveAxisValue,
  resolveAxisValueStrict,
};
