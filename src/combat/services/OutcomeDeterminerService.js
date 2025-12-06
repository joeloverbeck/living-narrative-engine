/**
 * @file OutcomeDeterminerService - Resolves outcomes with degrees of success/failure
 * @see specs/non-deterministic-actions-system.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'FUMBLE'} OutcomeType
 */

/**
 * @typedef {object} DetermineParams
 * @property {number} finalChance - Calculated probability (0-100)
 * @property {object} [thresholds] - Outcome thresholds
 * @property {number} [thresholds.criticalSuccess=5] - Roll <= this on success = critical
 * @property {number} [thresholds.criticalFailure=95] - Roll >= this on failure = fumble
 * @property {number} [forcedRoll] - For testing determinism (1-100)
 */

/**
 * @typedef {object} DetermineResult
 * @property {OutcomeType} outcome - The determined outcome
 * @property {number} roll - The actual d100 roll (1-100)
 * @property {number} margin - roll - finalChance (negative = success margin)
 * @property {boolean} isCritical - Whether the outcome was critical (success or failure)
 */

/** @type {object} */
const DEFAULT_THRESHOLDS = {
  criticalSuccess: 5,
  criticalFailure: 95,
};

/**
 * Service for resolving final outcomes with degrees of success/failure.
 * Determines CRITICAL_SUCCESS, SUCCESS, FAILURE, or FUMBLE based on
 * calculated probability and dice roll.
 *
 * @example
 * const determiner = new OutcomeDeterminerService({ logger });
 * const result = determiner.determine({ finalChance: 50, forcedRoll: 30 });
 * // Returns { outcome: 'SUCCESS', roll: 30, margin: -20, isCritical: false }
 * @example
 * // With critical success
 * const result = determiner.determine({ finalChance: 50, forcedRoll: 3 });
 * // Returns { outcome: 'CRITICAL_SUCCESS', roll: 3, margin: -47, isCritical: true }
 */
class OutcomeDeterminerService {
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of OutcomeDeterminerService
   *
   * @param {object} params - Constructor dependencies
   * @param {ILogger} params.logger - ILogger implementation
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });

    this.#logger = logger;

    this.#logger.debug('OutcomeDeterminerService: Initialized');
  }

  /**
   * Determines outcome based on calculated probability
   *
   * @param {DetermineParams} params - Determination parameters
   * @returns {DetermineResult} Outcome determination result
   */
  determine(params) {
    const {
      finalChance,
      thresholds = DEFAULT_THRESHOLDS,
      forcedRoll,
    } = params || {};

    // Validate finalChance
    const validatedChance = this.#validateFinalChance(finalChance);

    // Normalize thresholds
    const normalizedThresholds = this.#normalizeThresholds(thresholds);

    // Get the roll (either forced or random)
    const roll =
      typeof forcedRoll === 'number' && forcedRoll >= 1 && forcedRoll <= 100
        ? forcedRoll
        : this.#rollD100();

    // Calculate margin: positive means over (failure), negative means under (success)
    const margin = roll - validatedChance;

    // Determine outcome
    const isSuccess = roll <= validatedChance;
    const outcome = this.#determineOutcome(
      roll,
      isSuccess,
      normalizedThresholds
    );
    const isCritical = outcome === 'CRITICAL_SUCCESS' || outcome === 'FUMBLE';

    this.#logger.debug(
      `OutcomeDeterminerService.determine: roll=${roll}, chance=${validatedChance}, margin=${margin}, outcome=${outcome}, isCritical=${isCritical}`
    );

    return {
      outcome,
      roll,
      margin,
      isCritical,
    };
  }

  /**
   * Validates and normalizes the finalChance parameter
   *
   * @private
   * @param {number} finalChance - The final chance value
   * @returns {number} Validated chance (0-100)
   */
  #validateFinalChance(finalChance) {
    if (typeof finalChance !== 'number' || Number.isNaN(finalChance)) {
      this.#logger.warn(
        `OutcomeDeterminerService.determine: Invalid finalChance: ${finalChance}, defaulting to 50`
      );
      return 50;
    }

    // Clamp to valid range
    return Math.max(0, Math.min(100, finalChance));
  }

  /**
   * Normalizes threshold values with defaults
   *
   * @private
   * @param {object} thresholds - Threshold configuration
   * @returns {object} Normalized thresholds
   */
  #normalizeThresholds(thresholds) {
    const criticalSuccess =
      typeof thresholds?.criticalSuccess === 'number'
        ? thresholds.criticalSuccess
        : DEFAULT_THRESHOLDS.criticalSuccess;

    const criticalFailure =
      typeof thresholds?.criticalFailure === 'number'
        ? thresholds.criticalFailure
        : DEFAULT_THRESHOLDS.criticalFailure;

    return { criticalSuccess, criticalFailure };
  }

  /**
   * Determines the outcome type based on roll and thresholds
   *
   * Outcome logic:
   * - CRITICAL_SUCCESS: roll <= criticalSuccessThreshold AND roll <= finalChance (success)
   * - SUCCESS: roll <= finalChance AND not critical success
   * - FUMBLE: roll >= criticalFailureThreshold AND roll > finalChance (failure)
   * - FAILURE: roll > finalChance AND not fumble
   *
   * @private
   * @param {number} roll - The dice roll result
   * @param {boolean} isSuccess - Whether the base roll was a success
   * @param {object} thresholds - Normalized thresholds
   * @returns {OutcomeType} The determined outcome
   */
  #determineOutcome(roll, isSuccess, thresholds) {
    if (isSuccess) {
      // Check for critical success: must succeed AND roll low
      if (roll <= thresholds.criticalSuccess) {
        return 'CRITICAL_SUCCESS';
      }
      return 'SUCCESS';
    } else {
      // Check for fumble: must fail AND roll high
      if (roll >= thresholds.criticalFailure) {
        return 'FUMBLE';
      }
      return 'FAILURE';
    }
  }

  /**
   * Rolls a d100 (1-100 inclusive)
   *
   * @private
   * @returns {number} Random number 1-100
   */
  #rollD100() {
    return Math.floor(Math.random() * 100) + 1;
  }
}

export default OutcomeDeterminerService;
