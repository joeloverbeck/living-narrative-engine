/**
 * @file Normalizes context objects and filters by axis constraints.
 */

import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
  resolveAxisValue,
} from '../utils/axisNormalizationUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

class ContextAxisNormalizer {
  #logger;
  #prototypeConstraintAnalyzer;

  /**
   * @param {object} deps
   * @param {object} deps.logger - ILogger instance
   * @param {object|null} [deps.prototypeConstraintAnalyzer] - Optional IPrototypeConstraintAnalyzer
   */
  constructor({ logger, prototypeConstraintAnalyzer = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    if (this.#prototypeConstraintAnalyzer) {
      validateDependency(
        this.#prototypeConstraintAnalyzer,
        'IPrototypeConstraintAnalyzer',
        logger,
        {
          requiredMethods: ['extractAxisConstraints'],
        }
      );
    }
  }

  /**
   * Extract or normalize axis constraints from prerequisites or pre-extracted constraints.
   * @param {Array|Map|null} constraintsOrPrerequisites
   * @returns {Map<string, {min: number, max: number}>}
   */
  normalizeConstraints(constraintsOrPrerequisites) {
    if (constraintsOrPrerequisites instanceof Map) {
      return constraintsOrPrerequisites;
    }

    if (Array.isArray(constraintsOrPrerequisites) && this.#prototypeConstraintAnalyzer) {
      try {
        return this.#prototypeConstraintAnalyzer.extractAxisConstraints(constraintsOrPrerequisites);
      } catch (err) {
        this.#logger.warn('Failed to extract axis constraints from prerequisites:', err.message);
        return new Map();
      }
    }

    return new Map();
  }

  /**
   * Filter contexts to those within the mood regime.
   * @param {Array<object>} contexts
   * @param {Map<string, {min: number, max: number}>} constraints
   * @returns {Array<object>}
   */
  filterToMoodRegime(contexts, constraints) {
    if (!constraints || constraints.size === 0) {
      return contexts;
    }

    return contexts.filter((ctx) => {
      const normalized = this.getNormalizedAxes(ctx);
      for (const [axis, constraint] of constraints) {
        const value = resolveAxisValue(
          axis,
          normalized.moodAxes,
          normalized.sexualAxes,
          normalized.traitAxes
        );
        if (value < constraint.min || value > constraint.max) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get axis values from context, normalized to expected ranges.
   * @param {object} ctx
   * @returns {{moodAxes: Record<string, number>, sexualAxes: Record<string, number>, traitAxes: Record<string, number>}}
   */
  getNormalizedAxes(ctx) {
    const moodSource = ctx?.moodAxes ?? ctx?.mood ?? null;
    const sexualSource = ctx?.sexualAxes ?? ctx?.sexual ?? null;

    return {
      moodAxes: normalizeMoodAxes(moodSource),
      sexualAxes: normalizeSexualAxes(sexualSource, ctx?.sexualArousal ?? null),
      traitAxes: normalizeAffectTraits(ctx?.affectTraits ?? null),
    };
  }
}

export default ContextAxisNormalizer;
