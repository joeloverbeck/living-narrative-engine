/**
 * @file ProbabilityCalculatorService - Calculates success probability using configurable formulas
 * @see specs/non-deterministic-actions-system.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} CalculateParams
 * @property {number} actorSkill - Actor's skill value (required)
 * @property {number} [targetSkill=0] - Target's skill value (for opposed checks)
 * @property {number} [difficulty=0] - Static difficulty (for fixed checks)
 * @property {string} [formula='ratio'] - Calculation formula: 'ratio' | 'logistic' | 'linear'
 * @property {object} [modifiers] - Modifier values from ModifierCollectorService
 * @property {number} [modifiers.totalFlat=0] - Flat modifier to add to base chance
 * @property {number} [modifiers.totalPercentage=1] - Percentage multiplier
 * @property {object} [bounds] - Probability bounds
 * @property {number} [bounds.min=5] - Minimum probability (default 5%)
 * @property {number} [bounds.max=95] - Maximum probability (default 95%)
 */

/**
 * @typedef {object} CalculateResult
 * @property {number} baseChance - Probability before modifiers/bounds applied
 * @property {number} finalChance - Probability after modifiers and bounds applied
 * @property {object} breakdown - Detailed calculation breakdown
 * @property {string} breakdown.formula - Formula used
 * @property {number} breakdown.rawCalculation - Raw formula result
 * @property {number} breakdown.afterModifiers - Result after modifiers applied
 * @property {object} breakdown.bounds - Bounds that were applied
 * @property {number} breakdown.bounds.min - Minimum bound
 * @property {number} breakdown.bounds.max - Maximum bound
 */

/** @type {{[key: string]: boolean}} */
const VALID_FORMULAS = {
  ratio: true,
  logistic: true,
  linear: true,
};

/** @type {object} */
const DEFAULT_BOUNDS = {
  min: 5,
  max: 95,
};

/**
 * Service for calculating success probability using configurable formulas.
 * Core building block for the non-deterministic action system.
 *
 * @example
 * const calculator = new ProbabilityCalculatorService({ logger });
 * const result = calculator.calculate({ actorSkill: 50, targetSkill: 50 });
 * // Returns { baseChance: 50, finalChance: 50, breakdown: {...} }
 * @example
 * // With modifiers and custom bounds
 * const result = calculator.calculate({
 *   actorSkill: 60,
 *   targetSkill: 40,
 *   modifiers: { totalFlat: 10, totalPercentage: 1.2 },
 *   bounds: { min: 10, max: 90 }
 * });
 */
class ProbabilityCalculatorService {
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of ProbabilityCalculatorService
   *
   * @param {object} params - Constructor dependencies
   * @param {ILogger} params.logger - ILogger implementation
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });

    this.#logger = logger;

    this.#logger.debug('ProbabilityCalculatorService: Initialized');
  }

  /**
   * Calculates success probability using the specified formula
   *
   * @param {CalculateParams} params - Calculation parameters
   * @returns {CalculateResult} Probability calculation result with breakdown
   * @throws {Error} When invalid formula is specified
   * @throws {Error} When bounds.min > bounds.max
   */
  calculate(params) {
    const {
      actorSkill,
      targetSkill = 0,
      difficulty = 0,
      formula = 'ratio',
      modifiers = {},
      bounds = DEFAULT_BOUNDS,
    } = params || {};

    // Validate actorSkill
    if (typeof actorSkill !== 'number' || Number.isNaN(actorSkill)) {
      this.#logger.warn(
        `ProbabilityCalculatorService.calculate: Invalid actorSkill: ${actorSkill}, defaulting to 0`
      );
      return this.#buildResult(0, 0, formula, bounds);
    }

    // Validate formula
    if (!VALID_FORMULAS[formula]) {
      const error = new Error(
        `ProbabilityCalculatorService.calculate: Invalid formula '${formula}'. Valid options: ratio, logistic, linear`
      );
      this.#logger.error(error.message);
      throw error;
    }

    // Validate and normalize bounds
    const normalizedBounds = this.#validateBounds(bounds);

    // Calculate base chance using the specified formula
    const baseChance = this.#calculateBaseChance(
      formula,
      actorSkill,
      targetSkill,
      difficulty
    );

    // Apply modifiers
    const afterModifiers = this.#applyModifiers(baseChance, modifiers);

    // Clamp to bounds
    const finalChance = this.#clampToBounds(afterModifiers, normalizedBounds);

    this.#logger.debug(
      `ProbabilityCalculatorService.calculate: formula=${formula}, base=${baseChance.toFixed(2)}, afterMods=${afterModifiers.toFixed(2)}, final=${finalChance.toFixed(2)}`
    );

    return {
      baseChance,
      finalChance,
      breakdown: {
        formula,
        rawCalculation: baseChance,
        afterModifiers,
        bounds: normalizedBounds,
      },
    };
  }

  /**
   * Validates and normalizes bounds
   *
   * @private
   * @param {object} bounds - Bounds to validate
   * @returns {object} Normalized bounds
   * @throws {Error} When min > max
   */
  #validateBounds(bounds) {
    const min =
      typeof bounds?.min === 'number' ? bounds.min : DEFAULT_BOUNDS.min;
    const max =
      typeof bounds?.max === 'number' ? bounds.max : DEFAULT_BOUNDS.max;

    if (min > max) {
      const error = new Error(
        `ProbabilityCalculatorService.calculate: Invalid bounds - min (${min}) cannot be greater than max (${max})`
      );
      this.#logger.error(error.message);
      throw error;
    }

    return { min, max };
  }

  /**
   * Calculates base chance using the specified formula
   *
   * @private
   * @param {string} formula - Formula to use
   * @param {number} actorSkill - Actor's skill value
   * @param {number} targetSkill - Target's skill value
   * @param {number} difficulty - Static difficulty
   * @returns {number} Base chance percentage
   */
  #calculateBaseChance(formula, actorSkill, targetSkill, difficulty) {
    switch (formula) {
      case 'ratio':
        return this.#calculateRatio(actorSkill, targetSkill);
      case 'logistic':
        return this.#calculateLogistic(actorSkill, targetSkill, difficulty);
      case 'linear':
        return this.#calculateLinear(actorSkill, difficulty);
      default:
        // Should never reach here due to earlier validation
        return 50;
    }
  }

  /**
   * Calculates probability using ratio formula: actor / (actor + target) * 100
   * Best for opposed skill checks.
   *
   * @private
   * @param {number} actorSkill - Actor's skill value
   * @param {number} targetSkill - Target's skill value
   * @returns {number} Probability percentage
   */
  #calculateRatio(actorSkill, targetSkill) {
    // Handle edge case where both skills are 0 or negative
    const normalizedActor = Math.max(0, actorSkill);
    const normalizedTarget = Math.max(0, targetSkill);
    const total = normalizedActor + normalizedTarget;

    if (total === 0) {
      // When both are 0, return 50% (equal chance)
      return 50;
    }

    return (normalizedActor / total) * 100;
  }

  /**
   * Calculates probability using logistic formula: 100 / (1 + e^(-0.1 * diff))
   * Produces a bell-curve distribution centered at 50%.
   *
   * @private
   * @param {number} actorSkill - Actor's skill value
   * @param {number} targetSkill - Target's skill value
   * @param {number} difficulty - Static difficulty (used if targetSkill is 0)
   * @returns {number} Probability percentage
   */
  #calculateLogistic(actorSkill, targetSkill, difficulty) {
    const opposition = targetSkill || difficulty;
    const diff = actorSkill - opposition;
    return 100 / (1 + Math.exp(-0.1 * diff));
  }

  /**
   * Calculates probability using linear formula: 50 + (actor - difficulty)
   * Best for fixed difficulty checks.
   *
   * @private
   * @param {number} actorSkill - Actor's skill value
   * @param {number} difficulty - Static difficulty
   * @returns {number} Probability percentage
   */
  #calculateLinear(actorSkill, difficulty) {
    return 50 + (actorSkill - difficulty);
  }

  /**
   * Applies modifiers to the base chance
   *
   * @private
   * @param {number} baseChance - Base probability
   * @param {object} modifiers - Modifiers to apply
   * @returns {number} Modified probability
   */
  #applyModifiers(baseChance, modifiers) {
    const totalFlat =
      typeof modifiers?.totalFlat === 'number' ? modifiers.totalFlat : 0;
    const totalPercentage =
      typeof modifiers?.totalPercentage === 'number'
        ? modifiers.totalPercentage
        : 1;

    // Apply flat modifier first, then percentage
    let modified = baseChance + totalFlat;
    modified = modified * totalPercentage;

    return modified;
  }

  /**
   * Clamps a value to the specified bounds
   *
   * @private
   * @param {number} value - Value to clamp
   * @param {object} bounds - Bounds to apply
   * @returns {number} Clamped value
   */
  #clampToBounds(value, bounds) {
    return Math.max(bounds.min, Math.min(bounds.max, value));
  }

  /**
   * Builds a result object with default values
   *
   * @private
   * @param {number} baseChance - Base chance
   * @param {number} finalChance - Final chance
   * @param {string} formula - Formula used
   * @param {object} bounds - Bounds applied
   * @returns {CalculateResult} Result object
   */
  #buildResult(baseChance, finalChance, formula, bounds) {
    const normalizedBounds = {
      min: typeof bounds?.min === 'number' ? bounds.min : DEFAULT_BOUNDS.min,
      max: typeof bounds?.max === 'number' ? bounds.max : DEFAULT_BOUNDS.max,
    };

    return {
      baseChance,
      finalChance: this.#clampToBounds(finalChance, normalizedBounds),
      breakdown: {
        formula,
        rawCalculation: baseChance,
        afterModifiers: finalChance,
        bounds: normalizedBounds,
      },
    };
  }
}

export default ProbabilityCalculatorService;
