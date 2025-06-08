/**
 * @module FollowValidationService
 * @description A system service accessible by the Rule Engine to perform complex validations
 * related to the follow action, such as cycle detection.
 * @since 0.5.1
 */

import { wouldCreateCycle } from '../../utils/followUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

class FollowValidationService {
  /** @type {ILogger} @private */
  #logger;
  /** @type {IEntityManager} @private */
  #entityManager;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {IEntityManager} deps.entityManager
   */
  constructor({ logger, entityManager }) {
    if (!logger || typeof logger.info !== 'function') {
      throw new Error('FollowValidationService requires a valid ILogger.');
    }
    if (
      !entityManager ||
      typeof entityManager.getEntityInstance !== 'function'
    ) {
      logger.error(
        'FollowValidationService initialization failed – invalid IEntityManager.'
      );
      throw new Error(
        'FollowValidationService requires a valid IEntityManager.'
      );
    }

    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#logger.debug('[FollowValidationService] Created.');
  }

  /**
   * Public entry-point required by the SystemDataRegistry.
   * Handles queries from the rule engine.
   *
   * @param {object} queryDetails - The details of the query from the rule action.
   * @property {string} queryDetails.action - The specific action to perform.
   * @returns {object} A result object.
   */
  handleQuery(queryDetails) {
    if (!queryDetails || typeof queryDetails !== 'object') {
      this.#logger.error(
        '[FollowValidationService] handleQuery called with invalid details',
        { queryDetails }
      );
      return { success: false, error: 'Invalid queryDetails supplied.' };
    }

    const { action, followerId, leaderId } = queryDetails;

    switch (action) {
      case 'wouldCreateCycle':
        if (!followerId || !leaderId) {
          this.#logger.warn(
            `[FollowValidationService] 'wouldCreateCycle' called without followerId or leaderId.`
          );
          return {
            success: false,
            cycleDetected: false,
            error: 'Missing followerId or leaderId.',
          };
        }
        const cycleDetected = wouldCreateCycle(
          followerId,
          leaderId,
          this.#entityManager
        );
        return { success: true, cycleDetected };
      default:
        this.#logger.warn(
          `[FollowValidationService] Unknown action '${action}'.`
        );
        return { success: false, error: `Unknown action '${action}'.` };
    }
  }
}

export default FollowValidationService;
