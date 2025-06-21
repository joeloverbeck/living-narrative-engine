// src/ai/thoughtPersistenceListener.js

import { persistThoughts } from './thoughtPersistenceHook.js';

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
   *   entityManager: import('../interfaces/IEntityManager.js').IEntityManager
   * }} deps
   *   Dependencies for the listener.
   */
  constructor({ logger, entityManager }) {
    this.logger = logger;
    this.entityManager = entityManager;
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
        this.logger
      );
    } else {
      this.logger.warn(
        `ThoughtPersistenceListener: entity not found for actor ${actorId}`
      );
    }
  }
}
