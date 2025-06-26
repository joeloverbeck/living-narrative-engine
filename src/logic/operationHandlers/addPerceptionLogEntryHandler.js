/**
 * @file A handler that adds an entry to perception logs
 * @see src/logic/operationHandlers/addPerceptionLogEntryHandler.js
 */

import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';
import {
  assertParamsObject,
  requireNonBlankString,
} from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const DEFAULT_MAX_LOG_ENTRIES = 50;

/**
 * @typedef {object} AddPerceptionLogEntryParams
 * @property {string} location_id           – Required. Location where the event happened.
 * @property {object} entry                 – Required. Log entry (descriptionText, timestamp, perceptionType, actorId…).
 * @property {string=} originating_actor_id – Optional. Actor who raised the event (auditing only).
 */
class AddPerceptionLogEntryHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default}       */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('AddPerceptionLogEntryHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getEntitiesInLocation',
          'hasComponent',
          'getComponentData',
          'addComponent',
        ],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * @description Validate parameters for {@link execute}.
   * @param {AddPerceptionLogEntryParams|null|undefined} params - Raw params object.
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
   * @returns {{locationId:string, entry:object}|null} Normalized values or `null` when invalid.
   * @private
   */
  #validateParams(params, logger) {
    if (
      !assertParamsObject(params, this.#dispatcher, 'ADD_PERCEPTION_LOG_ENTRY')
    ) {
      return null;
    }
    const { location_id, entry } = params;
    const locationId = requireNonBlankString(
      location_id,
      'location_id',
      logger,
      this.#dispatcher
    );
    if (!locationId) {
      return null;
    }
    if (!entry || typeof entry !== 'object') {
      safeDispatchError(
        this.#dispatcher,
        'ADD_PERCEPTION_LOG_ENTRY: entry object is required',
        { entry },
        logger
      );
      return null;
    }
    return { locationId, entry };
  }

  /**
   * @param {AddPerceptionLogEntryParams} params
   * @param {import('../defs.js').ExecutionContext} executionContext – Unused for now.
   */
  execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    /* ── validation ─────────────────────────────────────────────── */
    const validated = this.#validateParams(params, log);
    if (!validated) return;
    const { locationId, entry } = validated;

    /* ── perceive who? ──────────────────────────────────────────── */
    const entityIds =
      this.#entityManager.getEntitiesInLocation(locationId) ?? new Set();
    if (entityIds.size === 0) {
      log.debug(
        `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationId}`
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
      const currentComponent =
        this.#entityManager.getComponentData(id, PERCEPTION_LOG_COMPONENT_ID) ??
        {};

      /* normalise / repair corrupted shapes -------------------------------- */
      let { maxEntries, logEntries } = currentComponent;

      if (!Array.isArray(logEntries)) {
        logEntries = []; // recover from bad type
      }
      if (typeof maxEntries !== 'number' || maxEntries < 1) {
        maxEntries = DEFAULT_MAX_LOG_ENTRIES; // recover from bad value
      }

      /* build next state ---------------------------------------------------- */
      const nextLogEntries = [...logEntries, entry].slice(-maxEntries);
      const updatedComponent = {
        maxEntries,
        logEntries: nextLogEntries,
      };

      /* write back ---------------------------------------------------------- */
      try {
        this.#entityManager.addComponent(
          id,
          PERCEPTION_LOG_COMPONENT_ID,
          updatedComponent
        );
        updated++;
      } catch (e) {
        safeDispatchError(
          this.#dispatcher,
          `ADD_PERCEPTION_LOG_ENTRY: failed to update ${id}: ${e.message}`,
          { stack: e.stack, entityId: id }
        );
      }
    }

    log.debug(
      `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updated}/${entityIds.size} perceivers in ${locationId}`
    );
  }
}

export default AddPerceptionLogEntryHandler;
