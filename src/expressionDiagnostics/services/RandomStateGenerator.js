/**
 * @file Service for generating random emotional/sexual states for Monte Carlo simulation
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  MOOD_AXES,
  AFFECT_TRAITS,
} from '../../constants/moodAffectConstants.js';

// Sigma values for Gaussian deltas
const MOOD_DELTA_SIGMA = 15;
const SEXUAL_DELTA_SIGMA = 12;
const LIBIDO_DELTA_SIGMA = 8;

class RandomStateGenerator {
  /**
   * @param {object} deps
   * @param {object} deps.logger - ILogger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
  }

  /**
   * Generate a random state for simulation.
   * @param {'uniform'|'gaussian'} distribution - Distribution type
   * @param {'static'|'dynamic'} samplingMode - Sampling mode
   * @returns {{current: {mood: object, sexual: object}, previous: {mood: object, sexual: object}, affectTraits: object}}
   */
  generate(distribution = 'uniform', samplingMode = 'static') {
    // Generate previous state first (always random)
    const previousMood = {};
    const previousSexual = {};

    for (const axis of MOOD_AXES) {
      previousMood[axis] = Math.round(
        this.#sampleValue(distribution, -100, 100)
      );
    }

    previousSexual.sex_excitation = Math.round(
      this.#sampleValue(distribution, 0, 100)
    );
    previousSexual.sex_inhibition = Math.round(
      this.#sampleValue(distribution, 0, 100)
    );
    previousSexual.baseline_libido = Math.round(
      this.#sampleValue(distribution, -50, 50)
    );

    // Traits are stable across current/previous state
    const affectTraits = {};
    for (const axis of AFFECT_TRAITS) {
      affectTraits[axis] = Math.round(this.#sampleValue(distribution, 0, 100));
    }

    const currentMood = {};
    const currentSexual = {};

    if (samplingMode === 'static') {
      for (const axis of MOOD_AXES) {
        currentMood[axis] = Math.round(
          this.#sampleValue(distribution, -100, 100)
        );
      }
      currentSexual.sex_excitation = Math.round(
        this.#sampleValue(distribution, 0, 100)
      );
      currentSexual.sex_inhibition = Math.round(
        this.#sampleValue(distribution, 0, 100)
      );
      currentSexual.baseline_libido = Math.round(
        this.#sampleValue(distribution, -50, 50)
      );
    } else {
      for (const axis of MOOD_AXES) {
        const delta = this.#sampleGaussianDelta(MOOD_DELTA_SIGMA);
        const raw = previousMood[axis] + delta;
        currentMood[axis] = Math.round(Math.max(-100, Math.min(100, raw)));
      }

      const excitationDelta = this.#sampleGaussianDelta(SEXUAL_DELTA_SIGMA);
      currentSexual.sex_excitation = Math.round(
        Math.max(0, Math.min(100, previousSexual.sex_excitation + excitationDelta))
      );

      const inhibitionDelta = this.#sampleGaussianDelta(SEXUAL_DELTA_SIGMA);
      currentSexual.sex_inhibition = Math.round(
        Math.max(0, Math.min(100, previousSexual.sex_inhibition + inhibitionDelta))
      );

      const libidoDelta = this.#sampleGaussianDelta(LIBIDO_DELTA_SIGMA);
      currentSexual.baseline_libido = Math.round(
        Math.max(-50, Math.min(50, previousSexual.baseline_libido + libidoDelta))
      );
    }

    return {
      current: { mood: currentMood, sexual: currentSexual },
      previous: { mood: previousMood, sexual: previousSexual },
      affectTraits,
    };
  }

  /**
   * Sample a value from the specified distribution
   *
   * @private
   * @param {'uniform'|'gaussian'} distribution
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  #sampleValue(distribution, min, max) {
    if (distribution === 'gaussian') {
      // Box-Muller transform, clamped to range
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const mid = (min + max) / 2;
      const spread = (max - min) / 6; // 99.7% within range
      const value = mid + z * spread;
      return Math.max(min, Math.min(max, value));
    }

    // Uniform distribution
    return min + Math.random() * (max - min);
  }

  /**
   * Samples a Gaussian (normal) random delta centered at zero.
   * Used for generating correlated temporal state pairs where
   * current = previous + delta.
   *
   * @param {number} sigma - Standard deviation (default 10 for mood axes on [-100,100] scale)
   * @returns {number} A random delta from N(0, sigma^2)
   */
  #sampleGaussianDelta(sigma = 10) {
    // Box-Muller transform for standard normal
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * sigma;
  }
}

export default RandomStateGenerator;
export {
  MOOD_DELTA_SIGMA,
  SEXUAL_DELTA_SIGMA,
  LIBIDO_DELTA_SIGMA,
  MOOD_AXES,
  AFFECT_TRAITS,
};
