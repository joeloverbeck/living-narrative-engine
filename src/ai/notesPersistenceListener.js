// src/ai/notesPersistenceListener.js

import { persistNotes } from './notesPersistenceHook.js';

/**
 * @class NotesPersistenceListener
 * @description Consumes AI decision events and merges generated notes into the actor's notes component.
 */
export class NotesPersistenceListener {
  /**
   * @param {{ logger: import('../interfaces/coreServices.js').ILogger,
   *            entityManager: import('../interfaces/IEntityManager.js').IEntityManager }}
   */
  constructor({ logger, entityManager }) {
    this.logger = logger;
    this.entityManager = entityManager;
  }

  /**
   * @param {{ actorId: string, extractedData: { notes?: string[] } }} payload
   */
  handleEvent({ actorId, extractedData }) {
    this.logger.info('Notes listener has received: ' + extractedData);
    if (
      !Array.isArray(extractedData?.notes) ||
      extractedData.notes.length === 0
    ) {
      return;
    }

    const actorEntity = this.entityManager.getEntityInstance(actorId);
    if (actorEntity) {
      this.logger.info('Will persist notes: ' + extractedData.notes);
      persistNotes({ notes: extractedData.notes }, actorEntity, this.logger);
    } else {
      this.logger.warn(
        `NotesPersistenceListener: Could not find entity for actor ID ${actorId}.`
      );
    }
  }
}
