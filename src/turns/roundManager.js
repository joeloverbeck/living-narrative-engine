import { ACTOR_COMPONENT_ID } from '../constants/componentIds.js';

export default class RoundManager {
  #turnOrderService;
  #entityManager;
  #logger;
  #inProgress = false;
  #hadSuccess = false;

  constructor(turnOrderService, entityManager, logger) {
    this.#turnOrderService = turnOrderService;
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Starts a new round using the provided strategy and optional initiative data.
   *
   * @param {('round-robin' | 'initiative' | {strategy?: 'round-robin' | 'initiative'; initiativeData?: Map<string, number>})} [strategyOrOptions]
   *  Either the turn order strategy string or an options object.
   * @param {Map<string, number>} [initiativeDataParam] - Initiative data when the first parameter is a strategy string.
   * @returns {Promise<void>}
   */
  async startRound(strategyOrOptions = 'round-robin', initiativeDataParam) {
    this.#logger.debug('RoundManager.startRound() initiating...');

    // A new round is not considered active until we successfully hand control to
    // the turn order service. Reset the flag eagerly so callers never observe a
    // stale "in progress" state when this method throws before completion.
    this.#inProgress = false;

    let strategy;
    let initiativeData;

    const isOptionsObject =
      strategyOrOptions &&
      typeof strategyOrOptions === 'object' &&
      !(strategyOrOptions instanceof String) &&
      !(strategyOrOptions instanceof Map);

    if (isOptionsObject) {
      strategy = strategyOrOptions.strategy ?? 'round-robin';
      initiativeData = strategyOrOptions.initiativeData;
    } else {
      strategy = strategyOrOptions ?? 'round-robin';
      initiativeData = initiativeDataParam;
    }

    if (strategy === 'initiative') {
      if (!(initiativeData instanceof Map) || initiativeData.size === 0) {
        const errorMsg =
          'Cannot start an initiative round: initiativeData Map is required.';
        this.#logger.error(errorMsg);
        throw new Error(errorMsg);
      }
    } else {
      initiativeData = undefined;
    }

    // Get all active entities and filter for actors
    const allEntities = Array.from(this.#entityManager.entities ?? []);
    const actors = allEntities.filter(
      (entity) =>
        entity &&
        typeof entity.hasComponent === 'function' &&
        entity.hasComponent(ACTOR_COMPONENT_ID)
    );

    if (actors.length === 0) {
      const errorMsg =
        'Cannot start a new round: No active entities with an Actor component found.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const actorIds = actors.map((a) => a.id);
    this.#logger.debug(
      `Found ${actors.length} actors to start the round: ${actorIds.join(', ')}`
    );

    // Start the new round in the service
    await this.#turnOrderService.startNewRound(
      actors,
      strategy,
      initiativeData
    );

    // Reset success flag only after the round starts successfully
    this.#hadSuccess = false;
    this.#inProgress = true;

    this.#logger.debug(
      `Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`
    );
  }

  endTurn(success) {
    if (success) {
      this.#hadSuccess = true;
    }
  }

  get inProgress() {
    return this.#inProgress;
  }

  get hadSuccess() {
    return this.#hadSuccess;
  }

  resetFlags() {
    this.#inProgress = false;
    this.#hadSuccess = false;
  }
}
