import { persistThoughts } from './thoughtPersistenceHook.js';

/**
 * @file Handles persistence of AI-generated thoughts when an action is decided.
 */

/**
 * @class ThoughtPersistenceListener
 * @description Listens for AI decision events and persists any generated thoughts
 * to the actor's short-term memory component.
 */
export class ThoughtPersistenceListener {
  /**
   * Constructs a ThoughtPersistenceListener.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {import('../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   * @param {import('../interfaces/IEntityManager.js').IEntityManager} deps.entityManager - Entity manager used to retrieve actors.
   */
  constructor({ logger, entityManager }) {
    this.logger = logger;
    this.entityManager = entityManager;
  }

  /**
   * Handles the core:ai_action_decided event.
   *
   * @param {{actor: {id: string}, extractedData: any}} payload - Event payload containing the actor and extracted data.
   * @returns {void}
   */
  handleEvent({ actor, extractedData }) {
    if (extractedData?.thoughts) {
      const actorEntity = this.entityManager.getEntityInstance(actor.id);
      if (actorEntity) {
        persistThoughts(
          { thoughts: extractedData.thoughts },
          actorEntity,
          this.logger
        );
      } else {
        this.logger.warn(
          `ThoughtPersistenceListener: Could not find entity for actor ID ${actor.id}.`
        );
      }
    }
  }
}
