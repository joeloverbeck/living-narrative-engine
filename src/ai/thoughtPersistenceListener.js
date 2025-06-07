// src/ai/thoughtPersistenceListener.js

import { persistThoughts } from './thoughtPersistenceHook.js';

/**
 * Listens for 'core:ai_action_decided' and persists any thoughts in the
 * actor’s short-term memory component.
 */
export class ThoughtPersistenceListener {
  /**
   * @param {{
   *   logger: import('../interfaces/coreServices.js').ILogger,
   *   entityManager: import('../interfaces/IEntityManager.js').IEntityManager
   * }} deps
   */
  constructor({ logger, entityManager }) {
    this.logger = logger;
    this.entityManager = entityManager;
  }

  /**
   * @param {{ type: string, payload: { actorId: string, extractedData?: { thoughts?: string } } }} event
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
      this.logger.info(
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
