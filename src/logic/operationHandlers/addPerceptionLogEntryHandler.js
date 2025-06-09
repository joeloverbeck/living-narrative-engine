/**
 * @file A handler that adds an entry to the corresponding perception logs.
 * @see src/logic/operationHandlers/addPerceptionLogEntryHandler.js
 */

// -----------------------------------------------------------------------------
//  ADD_PERCEPTION_LOG_ENTRY Handler
//  Replaces PerceptionUpdateService.addEntryToLogsInLocation
// -----------------------------------------------------------------------------

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';

const DEFAULT_MAX_LOG_ENTRIES = 50;

/**
 * @typedef {object} AddPerceptionLogEntryParams
 * @property {string} location_id              – Required. Location where the event happened.
 * @property {object} entry                    – Required. Log entry (descriptionText, timestamp, perceptionType, actorId, etc.).
 * @property {string=} originating_actor_id    – Optional. Actor who raised the event (used for auditing only).
 */

class AddPerceptionLogEntryHandler {
  /** @type {ILogger} */ #logger;
  /** @type {EntityManager} */ #entityManager;

  constructor({ logger, entityManager }) {
    if (!logger?.debug)
      throw new Error('AddPerceptionLogEntryHandler needs ILogger');
    if (!entityManager?.getEntitiesInLocation)
      throw new Error('AddPerceptionLogEntryHandler needs IEntityManager');
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * @param {AddPerceptionLogEntryParams} params
   * @param {ExecutionContext} _ctx           – Unused; no variables are written.
   */
  execute(params, _ctx) {
    const log = this.#logger;

    // ---------- Validate -----------------------------------------------------
    if (!params || typeof params !== 'object') {
      log.error('ADD_PERCEPTION_LOG_ENTRY: params missing/invalid', { params });
      return;
    }

    const { location_id, entry } = params;
    if (typeof location_id !== 'string' || !location_id.trim()) {
      log.error('ADD_PERCEPTION_LOG_ENTRY: location_id is required');
      return;
    }
    if (!entry || typeof entry !== 'object') {
      log.error('ADD_PERCEPTION_LOG_ENTRY: entry object is required');
      return;
    }

    // ---------- Find perceivers ---------------------------------------------
    const entityIds =
      this.#entityManager.getEntitiesInLocation(location_id) ?? new Set();
    if (entityIds.size === 0) {
      log.debug(
        `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${location_id}`
      );
      return;
    }

    let updated = 0;

    for (const id of entityIds) {
      if (!this.#entityManager.hasComponent(id, PERCEPTION_LOG_COMPONENT_ID)) {
        continue; // not a perceiver
      }

      const current = this.#entityManager.getComponentData(
        id,
        PERCEPTION_LOG_COMPONENT_ID
      ) || { maxEntries: DEFAULT_MAX_LOG_ENTRIES, logEntries: [] };

      // Defensive deep-clone (avoid in-place mutation)
      const next = {
        ...current,
        logEntries: [...(current.logEntries ?? []), { ...entry }],
      };

      if (next.logEntries.length > next.maxEntries) {
        next.logEntries = next.logEntries.slice(-next.maxEntries);
      }

      try {
        this.#entityManager.addComponent(id, PERCEPTION_LOG_COMPONENT_ID, next);
        updated++;
      } catch (e) {
        log.error(
          `ADD_PERCEPTION_LOG_ENTRY: failed to update ${id}: ${e.message}`,
          { stack: e.stack }
        );
      }
    }

    log.debug(
      `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updated}/${entityIds.size} perceivers in ${location_id}`
    );
  }
}

export default AddPerceptionLogEntryHandler;
