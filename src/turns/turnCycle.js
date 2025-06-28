/** @typedef {import('./interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class TurnCycle
 * @classdesc Wraps the turn order service to provide a simplified interface for turn cycle management.
 */
export default class TurnCycle {
  /** @type {ITurnOrderService} */
  #service;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of TurnCycle.
   *
   * @param {ITurnOrderService} service - The turn order service to wrap.
   * @param {ILogger} logger - The logger service.
   */
  constructor(service, logger) {
    this.#service = service;
    this.#logger = logger;
  }

  /**
   * Gets the next actor from the turn order service.
   *
   * @async
   * @returns {Promise<import('../entities/entity.js').default | null>} The next entity or null if the queue is empty.
   */
  async nextActor() {
    try {
      if (await this.#service.isEmpty()) {
        this.#logger.debug('TurnCycle.nextActor(): queue empty');
        return null;
      }
      const entity = this.#service.getNextEntity();
      this.#logger.debug(
        `TurnCycle.nextActor(): returning entity ${entity?.id ?? 'unknown'}`
      );
      return entity;
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
