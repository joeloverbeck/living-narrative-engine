// src/ai/thoughtPersistenceListener.js

import { persistThoughts } from './thoughtPersistenceHook.js';

/**
 * @class ThoughtPersistenceListener
 * @description Listens for AI decision events and persists any generated thoughts
 * to the actor's short-term memory component.
 */
export class ThoughtPersistenceListener {
  /**
   * @param {{ logger: import('../interfaces/coreServices.js').ILogger,
   *            entityManager: import('../interfaces/IEntityManager.js').IEntityManager }}
   */
  constructor({ logger, entityManager }) {
    this.logger = logger;
    this.entityManager = entityManager;
  }

  /**
   * @param {{ actorId: string, extractedData: { thoughts?: string } }} payload
   */
  handleEvent({ actorId, extractedData }) {
    this.logger.info('Thoughts listener received: ' + extractedData);
    if (!extractedData?.thoughts) return;

    const actorEntity = this.entityManager.getEntityInstance(actorId);
    if (actorEntity) {
      this.logger.info('Will persist thoughts: ' + extractedData.thoughts);
      persistThoughts(
        { thoughts: extractedData.thoughts },
        actorEntity,
        this.logger
      );
    } else {
      this.logger.warn(
        `ThoughtPersistenceListener: Could not find entity for actor ID ${actorId}.`
      );
    }
  }
}
