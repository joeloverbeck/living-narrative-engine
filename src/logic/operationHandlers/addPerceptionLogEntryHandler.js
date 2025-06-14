/**
 * @file A handler that adds an entry to perception logs
 * @see src/logic/operationHandlers/addPerceptionLogEntryHandler.js
 */

import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';

const DEFAULT_MAX_LOG_ENTRIES = 50;

/**
 * @typedef {object} AddPerceptionLogEntryParams
 * @property {string} location_id           – Required. Location where the event happened.
 * @property {object} entry                 – Required. Log entry (descriptionText, timestamp, perceptionType, actorId…).
 * @property {string=} originating_actor_id – Optional. Actor who raised the event (auditing only).
 */
class AddPerceptionLogEntryHandler {
  /** @type {import('../../interfaces/coreServices.js').ILogger}      */ #logger;
  /** @type {import('../../entities/entityManager.js').default}       */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    if (!logger?.debug)
      throw new Error('AddPerceptionLogEntryHandler needs ILogger');
    if (!entityManager?.getEntitiesInLocation)
      throw new Error('AddPerceptionLogEntryHandler needs IEntityManager');
    if (!safeEventDispatcher?.dispatch)
      throw new Error(
        'AddPerceptionLogEntryHandler needs ISafeEventDispatcher'
      );
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * @param {AddPerceptionLogEntryParams} params
   * @param {import('../defs.js').ExecutionContext} _ctx – Unused for now.
   */
  execute(params, _ctx) {
    const log = this.#logger;

    /* ── validation ─────────────────────────────────────────────── */
    if (!params || typeof params !== 'object') {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: 'ADD_PERCEPTION_LOG_ENTRY: params missing/invalid',
        details: { params },
      });
      return;
    }
    const { location_id, entry } = params;
    if (typeof location_id !== 'string' || !location_id.trim()) {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: 'ADD_PERCEPTION_LOG_ENTRY: location_id is required',
        details: { location_id },
      });
      return;
    }
    if (!entry || typeof entry !== 'object') {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: 'ADD_PERCEPTION_LOG_ENTRY: entry object is required',
        details: { entry },
      });
      return;
    }

    /* ── perceive who? ──────────────────────────────────────────── */
    const entityIds =
      this.#entityManager.getEntitiesInLocation(location_id) ?? new Set();
    if (entityIds.size === 0) {
      log.debug(
        `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${location_id}`
      );
      return;
    }

    let updated = 0;

    /* ── update each perceiver ──────────────────────────────────── */
    for (const id of entityIds) {
      if (!this.#entityManager.hasComponent(id, PERCEPTION_LOG_COMPONENT_ID)) {
        continue; // not a perceiver
      }

      /* pull current data; fall back to sane defaults */
      const raw =
        this.#entityManager.getComponentData(id, PERCEPTION_LOG_COMPONENT_ID) ??
        {};

      /* normalise / repair corrupted shapes -------------------------------- */
      let { maxEntries, logEntries } = raw;

      if (!Array.isArray(logEntries)) {
        logEntries = []; // recover from bad type
      }
      if (typeof maxEntries !== 'number' || maxEntries < 1) {
        maxEntries = DEFAULT_MAX_LOG_ENTRIES; // recover from bad value
      }

      /* build next state ---------------------------------------------------- */
      const next = {
        maxEntries,
        logEntries: [...logEntries, entry], // keep ORIGINAL reference
      };

      /* trim to size -------------------------------------------------------- */
      if (next.logEntries.length > next.maxEntries) {
        next.logEntries = next.logEntries.slice(-next.maxEntries);
      }

      /* write back ---------------------------------------------------------- */
      try {
        this.#entityManager.addComponent(id, PERCEPTION_LOG_COMPONENT_ID, next);
        updated++;
      } catch (e) {
        this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
          message: `ADD_PERCEPTION_LOG_ENTRY: failed to update ${id}: ${e.message}`,
          details: { stack: e.stack, entityId: id },
        });
      }
    }

    log.debug(
      `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updated}/${entityIds.size} perceivers in ${location_id}`
    );
  }
}

export default AddPerceptionLogEntryHandler;
