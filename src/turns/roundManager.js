import { ACTOR_COMPONENT_ID } from '../constants/componentIds.js';
import { ROUND_STARTED_ID } from '../constants/eventIds.js';

export default class RoundManager {
  #turnOrderService;
  #entityManager;
  #logger;
  #dispatcher;
  #inProgress = false;
  #hadSuccess = false;
  #roundNumber = 0;

  constructor(turnOrderService, entityManager, logger, dispatcher) {
    this.#turnOrderService = turnOrderService;
    this.#entityManager = entityManager;
    this.#logger = logger;

    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      throw new Error(
        'RoundManager requires a valid dispatcher with dispatch method'
      );
    }
    this.#dispatcher = dispatcher;
  }

  /**
   * Starts a new round using round-robin turn order.
   *
   * @returns {Promise<void>}
   */
  async startRound() {
    this.#logger.debug('RoundManager.startRound() initiating...');

    // A new round is not considered active until we successfully hand control to
    // the turn order service. Reset the flag eagerly so callers never observe a
    // stale "in progress" state when this method throws before completion.
    this.#inProgress = false;

    // Increment round number at the start of each round
    this.#roundNumber++;
    this.#logger.debug(`Starting round ${this.#roundNumber}`);

    const strategy = 'round-robin';

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

    this.#logger.debug(
      `Found ${actors.length} actors to start the round: ${actors.map((a) => a.id).join(', ')}`
    );

    // Start the new round in the service (this shuffles the actors array in place)
    await this.#turnOrderService.startNewRound(actors, strategy);

    // Extract actor IDs AFTER shuffle so the event reflects the actual turn order
    const actorIds = actors.map((a) => a.id);

    // Reset success flag only after the round starts successfully
    this.#hadSuccess = false;
    this.#inProgress = true;

    // Dispatch round started event for UI components (e.g., turn order ticker)
    this.#dispatcher.dispatch(ROUND_STARTED_ID, {
      roundNumber: this.#roundNumber,
      actors: actorIds,
      strategy: strategy,
    });

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
    this.#roundNumber = 0;
  }
}
