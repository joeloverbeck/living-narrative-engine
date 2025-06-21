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

  async startRound(strategy = 'round-robin') {
    this.#logger.debug('RoundManager.startRound() initiating...');

    // Reset success flag at start of new round
    this.#hadSuccess = false;

    // Get all active entities and filter for actors
    const allEntities = Array.from(this.#entityManager.entities);
    console.log(
      'RoundManager.startRound: allEntities =',
      allEntities.map((e) => ({
        id: e.id,
        isActor: e.hasComponent(ACTOR_COMPONENT_ID),
      }))
    );
    const actors = allEntities.filter((e) =>
      e.hasComponent(ACTOR_COMPONENT_ID)
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
    await this.#turnOrderService.startNewRound(actors, strategy);
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
