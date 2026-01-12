/**
 * @file intensitySignalUtils - Compute raw/gated/final intensity signals.
 */

import GateConstraint from '../models/GateConstraint.js';
import { resolveAxisValue } from './axisNormalizationUtils.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * Compute the raw intensity for a prototype using normalized axes.
 * Mirrors PrototypeFitRankingService weighting behavior.
 * @param {object|null|undefined} weights
 * @param {Record<string, number>} normalizedMood
 * @param {Record<string, number>} normalizedSexual
 * @param {Record<string, number>} normalizedTraits
 * @returns {number}
 */
const computeRawIntensity = (
  weights,
  normalizedMood,
  normalizedSexual,
  normalizedTraits
) => {
  if (!weights || typeof weights !== 'object') {
    return 0;
  }

  let rawSum = 0;
  let sumAbsWeights = 0;

  for (const [axis, weight] of Object.entries(weights)) {
    if (typeof weight !== 'number') {
      continue;
    }
    const value = resolveAxisValue(
      axis,
      normalizedMood,
      normalizedSexual,
      normalizedTraits
    );
    rawSum += weight * value;
    sumAbsWeights += Math.abs(weight);
  }

  if (sumAbsWeights === 0) {
    return 0;
  }

  return clamp01(rawSum / sumAbsWeights);
};

/**
 * Compute raw/gated/final signals for a prototype in a normalized context.
 * @param {object} params
 * @param {object|null|undefined} params.weights
 * @param {string[]|null|undefined} params.gates
 * @param {Record<string, number>} params.normalizedMood
 * @param {Record<string, number>} params.normalizedSexual
 * @param {Record<string, number>} params.normalizedTraits
 * @returns {{ raw: number, gated: number, final: number, gatePass: boolean }}
 */
const computeIntensitySignals = ({
  weights,
  gates,
  normalizedMood,
  normalizedSexual,
  normalizedTraits,
}) => {
  const raw = computeRawIntensity(
    weights,
    normalizedMood,
    normalizedSexual,
    normalizedTraits
  );

  const parsedGates = (gates ?? [])
    .map((gateStr) => {
      try {
        return GateConstraint.parse(gateStr);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let gatePass = true;
  if (parsedGates.length > 0) {
    for (const constraint of parsedGates) {
      const axisValue = resolveAxisValue(
        constraint.axis,
        normalizedMood,
        normalizedSexual,
        normalizedTraits
      );

      if (!constraint.isSatisfiedBy(axisValue)) {
        gatePass = false;
        break;
      }
    }
  }

  const gated = gatePass ? raw : 0;
  const final = gated;

  return { raw, gated, final, gatePass };
};

export { computeIntensitySignals, computeRawIntensity };
