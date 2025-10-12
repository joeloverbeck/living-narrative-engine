/**
 * @file A handler that adds an entry to perception logs
 * @see src/logic/operationHandlers/addPerceptionLogEntryHandler.js
 */

import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const DEFAULT_MAX_LOG_ENTRIES = 50;

/**
 * @typedef {object} AddPerceptionLogEntryParams
 * @property {string} location_id           – Required. Location where the event happened.
 * @property {object} entry                 – Required. Log entry (descriptionText, timestamp, perceptionType, actorId…).
 * @property {string=} originating_actor_id – Optional. Actor who raised the event (auditing only).
 * @property {string[]|string=} recipient_ids – Optional. Explicit list of recipients or a placeholder resolving
 *                                              to one or more recipients.
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
    const { location_id, entry, recipient_ids } = params;
    if (typeof location_id !== 'string' || !location_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'ADD_PERCEPTION_LOG_ENTRY: location_id is required',
        { location_id },
        logger
      );
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
    let recipients;
    if (Array.isArray(recipient_ids)) {
      recipients = recipient_ids;
    } else if (typeof recipient_ids === 'string') {
      const trimmed = recipient_ids.trim();
      if (trimmed) {
        recipients = [trimmed];
      }
    }

    return {
      locationId: location_id.trim(),
      entry,
      recipients,
    };
  }

  /**
   * @param {AddPerceptionLogEntryParams} params
   * @param {import('../defs.js').ExecutionContext} executionContext – Unused for now.
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    /* ── validation ─────────────────────────────────────────────── */
    const validated = this.#validateParams(params, log);
    if (!validated) return;
    const { locationId, entry, recipients } = validated;

    /* ── perceive who? ──────────────────────────────────────────── */
    const normalizedRecipients = Array.isArray(recipients)
      ? recipients
          .filter((id) => typeof id === 'string' && id.trim())
          .map((id) => id.trim())
      : [];

    const usingExplicitRecipients = normalizedRecipients.length > 0;

    const entityIds =
      usingExplicitRecipients
        ? new Set(normalizedRecipients)
        : this.#entityManager.getEntitiesInLocation(locationId) ?? new Set();
    if (entityIds.size === 0) {
      log.debug(
        usingExplicitRecipients
          ? `ADD_PERCEPTION_LOG_ENTRY: No matching recipients for ${locationId}`
          : `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationId}`
      );
      return;
    }

    // Prepare batch updates
    const componentSpecs = [];

    /* ── prepare batch updates ──────────────────────────────────── */
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

      // Add to batch
      componentSpecs.push({
        instanceId: id,
        componentTypeId: PERCEPTION_LOG_COMPONENT_ID,
        componentData: updatedComponent,
      });
    }

    /* ── execute batch update ─────────────────────────────────────── */
    if (componentSpecs.length > 0) {
      try {
        // Check if the optimized batch method exists
        if (
          typeof this.#entityManager.batchAddComponentsOptimized === 'function'
        ) {
          // Use optimized batch update that emits a single event
          const { updateCount, errors } =
            await this.#entityManager.batchAddComponentsOptimized(
              componentSpecs,
              true // emit single batch event
            );

          if (errors && errors.length > 0) {
            for (const { spec, error } of errors) {
              safeDispatchError(
                this.#dispatcher,
                `ADD_PERCEPTION_LOG_ENTRY: failed to update ${spec.instanceId}: ${error.message}`,
                { stack: error.stack, entityId: spec.instanceId }
              );
            }
          }

          log.debug(
            `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updateCount}/${entityIds.size} perceivers ${
              usingExplicitRecipients ? '(targeted)' : `in ${locationId}`
            } (batch mode)`
          );
        } else {
          // Fallback to regular batch method if optimized version doesn't exist
          let updated = 0;
          for (const spec of componentSpecs) {
            try {
              await this.#entityManager.addComponent(
                spec.instanceId,
                spec.componentTypeId,
                spec.componentData
              );
              updated++;
            } catch (e) {
              safeDispatchError(
                this.#dispatcher,
                `ADD_PERCEPTION_LOG_ENTRY: failed to update ${spec.instanceId}: ${e.message}`,
                { stack: e.stack, entityId: spec.instanceId }
              );
            }
          }

          log.debug(
            `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updated}/${entityIds.size} perceivers ${
              usingExplicitRecipients ? '(targeted)' : `in ${locationId}`
            }`
          );
        }
      } catch (e) {
        log.error('ADD_PERCEPTION_LOG_ENTRY: Batch update failed', e);
        // Fallback to individual updates if batch fails
        let updated = 0;
        for (const spec of componentSpecs) {
          try {
            await this.#entityManager.addComponent(
              spec.instanceId,
              spec.componentTypeId,
              spec.componentData
            );
            updated++;
          } catch (err) {
            safeDispatchError(
              this.#dispatcher,
              `ADD_PERCEPTION_LOG_ENTRY: failed to update ${spec.instanceId}: ${err.message}`,
              { stack: err.stack, entityId: spec.instanceId }
            );
          }
        }

          log.debug(
            `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updated}/${entityIds.size} perceivers ${
              usingExplicitRecipients ? '(targeted)' : `in ${locationId}`
            } (fallback mode)`
          );
      }
    } else {
      log.debug(
        `ADD_PERCEPTION_LOG_ENTRY: No perceivers found in location ${locationId}`
      );
    }
  }
}

export default AddPerceptionLogEntryHandler;
