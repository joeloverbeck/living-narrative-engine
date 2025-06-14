// src/ai/notesPersistenceListener.js

import { persistNotes } from './notesPersistenceHook.js';

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * Consumes ACTION_DECIDED_ID and merges generated notes into the
 * actor’s notes component.
 */
export class NotesPersistenceListener {
  /**
   * @param {{
   *   logger: import('../interfaces/coreServices.js').ILogger,
   *   entityManager: import('../interfaces/IEntityManager.js').IEntityManager,
   *   dispatcher: ISafeEventDispatcher
   * }} deps
   */
  constructor({ logger, entityManager, dispatcher }) {
    this.logger = logger;
    this.entityManager = entityManager;
    /** @type {ISafeEventDispatcher} */
    this.dispatcher = dispatcher;
  }

  /**
   * @param {{ type: string, payload: { actorId: string, extractedData?: { notes?: string[] } } }} event
   */
  handleEvent(event) {
    if (!event || !event.payload) return;

    const { actorId, extractedData } = event.payload;
    this.logger.debug(
      `NotesPersistenceListener → event received: ${JSON.stringify(event)}`
    );

    if (
      !Array.isArray(extractedData?.notes) ||
      extractedData.notes.length === 0
    )
      return;

    const actorEntity = this.entityManager.getEntityInstance(actorId);
    if (actorEntity) {
      this.logger.debug(
        `Persisting notes for ${actorId}: ${JSON.stringify(
          extractedData.notes
        )}`
      );
      persistNotes(
        { notes: extractedData.notes },
        actorEntity,
        this.logger,
        this.dispatcher
      );
    } else {
      this.logger.warn(
        `NotesPersistenceListener: entity not found for actor ${actorId}`
      );
    }
  }
}
