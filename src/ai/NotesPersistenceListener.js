import { persistNotes } from './notesPersistenceHook.js';

/**
 * @file Handles persistence of AI-generated notes when an action is decided.
 */

/**
 * @class NotesPersistenceListener
 * @description Consumes AI decision events and merges generated notes into the actor's notes component.
 */
export class NotesPersistenceListener {
  /**
   * Constructs a NotesPersistenceListener.
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
    if (extractedData?.notes?.length > 0) {
      const actorEntity = this.entityManager.getEntityInstance(actor.id);
      if (actorEntity) {
        persistNotes({ notes: extractedData.notes }, actorEntity, this.logger);
      } else {
        this.logger.warn(
          `NotesPersistenceListener: Could not find entity for actor ID ${actor.id}.`
        );
      }
    }
  }
}
