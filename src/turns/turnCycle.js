/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { PARTICIPATION_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * @class TurnCycle
 * @classdesc Wraps the turn order service to provide a simplified interface for turn cycle management.
 */
export default class TurnCycle {
  /** @type {ITurnOrderService} */
  #service;
  /** @type {import('../entities/entityManager.js').default} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of TurnCycle.
   *
   * @param {ITurnOrderService} service - The turn order service to wrap.
   * @param {import('../entities/entityManager.js').default} entityManager - The entity manager for component access.
   * @param {ILogger} logger - The logger service.
   */
  constructor(service, entityManager, logger) {
    // Validate entityManager
    if (!entityManager || typeof entityManager.getComponentData !== 'function') {
      throw new Error('TurnCycle requires a valid EntityManager instance.');
    }

    this.#service = service;
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Gets the next participating actor from the turn order service.
   * Skips actors with participating: false in their participation component.
   *
   * @async
   * @returns {Promise<import('../entities/entity.js').default | null>} The next participating entity or null if the queue is empty.
   */
  async nextActor() {
    try {
      if (await this.#service.isEmpty()) {
        this.#logger.debug('TurnCycle.nextActor(): queue empty');
        return null;
      }

      // Safety limit: maximum attempts = current queue size or 50 (whichever is smaller)
      const queueSize = this.#service.getCurrentOrder().length;
      const maxAttempts = Math.min(queueSize || 50, 50);
      let attempts = 0;

      while (attempts < maxAttempts) {
        const entity = await this.#service.getNextEntity();

        if (!entity) {
          // Queue exhausted
          this.#logger.debug('TurnCycle.nextActor(): queue returned null');
          return null;
        }

        // Check participation component
        // IMPORTANT: getComponentData returns the data directly - NO nested dataSchema
        const participationData = this.#entityManager.getComponentData(
          entity.id,
          PARTICIPATION_COMPONENT_ID
        );

        // Default to true for backward compatibility
        const isParticipating = participationData?.participating ?? true;

        if (isParticipating) {
          // Actor is participating, return normally
          this.#logger.debug(
            `TurnCycle.nextActor(): Selected participating actor ${entity.id}`
          );
          return entity;
        }

        // Actor not participating, skip and try next
        this.#logger.debug(
          `TurnCycle.nextActor(): Skipping actor ${entity.id} - participation disabled`
        );
        attempts++;
      }

      // All actors exhausted or all non-participating
      this.#logger.warn(
        'TurnCycle.nextActor(): No participating actors found in turn queue after ' +
        `${attempts} attempts (max: ${maxAttempts})`
      );
      return null;
    } catch (error) {
      this.#logger.error('TurnCycle.nextActor(): failed', error);
      throw error;
    }
  }

  /**
   * Clears the current round in the turn order service.
   *
   * @async
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      await this.#service.clearCurrentRound();
      this.#logger.debug('TurnCycle.clear(): current round cleared');
    } catch (error) {
      this.#logger.error('TurnCycle.clear(): failed', error);
      throw error;
    }
  }
}
