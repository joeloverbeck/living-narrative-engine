// src/ai/thoughtPersistenceListener.js

import { persistThoughts } from './thoughtPersistenceHook.js';
import ShortTermMemoryService from './shortTermMemoryService.js';
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class
 * @description Listens for ACTION_DECIDED_ID events and persists any thoughts in the
 * actor's short-term memory component.
 */
export class ThoughtPersistenceListener {
  /**
   * Creates an instance of the listener.
   *
   * @param {{
   *   logger: import('../interfaces/coreServices.js').ILogger,
   *   entityManager: import('../interfaces/IEntityManager.js').IEntityManager,
   *   stmService?: ShortTermMemoryService,
   *   now?: () => Date
   * }} deps
   *   Dependencies for the listener.
   */
  constructor({
    logger,
    entityManager,
    dispatcher,
    stmService = new ShortTermMemoryService(),
    now = () => new Date(),
  }) {
    this.logger = logger;
    this.entityManager = entityManager;
    /** @type {ISafeEventDispatcher | undefined} */
    this.dispatcher = dispatcher;
    this.stmService = stmService;
    this.now = now;
  }

  /**
   * Handles events emitted after an action decision.
   *
   * @param {{ type: string, payload: { actorId: string, extractedData?: { thoughts?: string } } }} event -
   * The event containing any thoughts produced during the decision process.
   */
  handleEvent(event) {
    if (!event || !event.payload) return;

    const { actorId, extractedData } = event.payload;
    this.logger.debug(
      `ThoughtPersistenceListener → event received: ${JSON.stringify(event)}`
    );

    if (!extractedData?.thoughts) return;

    const actorEntity = this.entityManager.getEntityInstance(actorId);
    if (actorEntity) {
      this.logger.debug(
        `Persisting thoughts for ${actorId}: ${extractedData.thoughts}`
      );
      persistThoughts(
        { thoughts: extractedData.thoughts },
        actorEntity,
        this.logger,
        this.dispatcher,
        this.stmService,
        this.now()
      );
    } else {
      this.logger.warn(
        `ThoughtPersistenceListener: entity not found for actor ${actorId}`
      );
    }
  }
}
