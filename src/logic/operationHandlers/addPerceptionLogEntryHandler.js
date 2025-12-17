/**
 * @file Handler for ADD_PERCEPTION_LOG_ENTRY operation
 *
 * Adds perception log entries to entities with core:perception_log components, supporting
 * explicit recipients, exclusion lists, and optimized batch updates for performance.
 *
 * Operation flow:
 * 1. Validate parameters (location_id, entry, optional recipient_ids/excluded_actor_ids)
 * 2. Determine recipients (explicit list, location broadcast, or location broadcast with exclusions)
 * 3. Build batch component update specs for all recipients
 * 4. Execute optimized batch update or fallback to individual updates
 * 5. Handle maxEntries truncation and log entry deduplication
 *
 * Related files:
 * @see data/schemas/operations/addPerceptionLogEntry.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - AddPerceptionLogEntryHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import {
  validateLocationId,
  normalizeEntityIds,
  validateRecipientExclusionExclusivity,
} from '../../utils/handlerUtils/perceptionParamsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

const DEFAULT_MAX_LOG_ENTRIES = 50;

/**
 * @typedef {object} AddPerceptionLogEntryParams
 * @property {string} location_id           – Required. Location where the event happened.
 * @property {object} entry                 – Required. Log entry (descriptionText, timestamp, perceptionType, actorId…).
 * @property {string=} originating_actor_id – Optional. Actor who raised the event (auditing only).
 * @property {string[]|string=} recipient_ids – Optional. Explicit list of recipients or a placeholder resolving
 *                                              to one or more recipients. Mutually exclusive with excluded_actor_ids.
 * @property {string[]|string=} excluded_actor_ids – Optional. Actor IDs to exclude from location broadcast.
 *                                                   Mutually exclusive with recipient_ids.
 */
class AddPerceptionLogEntryHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default}       */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../../perception/services/perceptionFilterService.js').default|null} */ #perceptionFilterService;

  constructor({ logger, entityManager, safeEventDispatcher, perceptionFilterService }) {
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
    // perceptionFilterService is optional for backward compatibility
    this.#perceptionFilterService = perceptionFilterService ?? null;
  }

  /**
   * @description Validate parameters for {@link execute}.
   * @param {AddPerceptionLogEntryParams|null|undefined} params - Raw params object.
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
   * @returns {{locationId:string, entry:object, recipients:string[], excludedActors:string[]}|null} Normalized values or `null` when invalid.
   * @private
   */
  #validateParams(params, logger) {
    if (
      !assertParamsObject(params, this.#dispatcher, 'ADD_PERCEPTION_LOG_ENTRY')
    ) {
      return null;
    }
    const { location_id, entry, recipient_ids, excluded_actor_ids } = params;

    // Use shared utility for location_id validation
    const locationId = validateLocationId(
      location_id,
      'ADD_PERCEPTION_LOG_ENTRY',
      this.#dispatcher,
      logger
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

    // Use shared utility for ID array normalization
    const recipients = normalizeEntityIds(recipient_ids);
    const excludedActors = normalizeEntityIds(excluded_actor_ids);

    return {
      locationId,
      entry,
      recipients,
      excludedActors,
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
    const { locationId, entry, recipients, excludedActors } = validated;

    /* ── perceive who? ──────────────────────────────────────────── */
    // Recipients and exclusions are already normalized in #validateParams
    const usingExplicitRecipients = recipients.length > 0;
    const usingExclusions = excludedActors.length > 0;

    // Validate mutual exclusivity using shared utility (warn mode - continue with recipients)
    validateRecipientExclusionExclusivity(
      recipients,
      excludedActors,
      'ADD_PERCEPTION_LOG_ENTRY',
      this.#dispatcher,
      log,
      'warn'
    );

    // Determine final recipient set
    let entityIds;
    if (usingExplicitRecipients) {
      // Explicit recipients (existing behavior)
      entityIds = new Set(recipients);
    } else {
      // All actors in location (existing or new exclusion behavior)
      const allInLocation =
        this.#entityManager.getEntitiesInLocation(locationId) ?? new Set();

      if (usingExclusions) {
        // Remove excluded actors
        const exclusionSet = new Set(excludedActors);
        entityIds = new Set(
          [...allInLocation].filter((id) => !exclusionSet.has(id))
        );
      } else {
        // Default: all actors in location
        entityIds = allInLocation;
      }
    }

    if (entityIds.size === 0) {
      log.debug(
        usingExplicitRecipients
          ? `ADD_PERCEPTION_LOG_ENTRY: No matching recipients for ${locationId}`
          : usingExclusions
            ? `ADD_PERCEPTION_LOG_ENTRY: All actors excluded for ${locationId}`
            : `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationId}`
      );
      return;
    }

    /* ── sense-aware filtering ────────────────────────────────────── */
    // Extract sense_aware, alternate_descriptions, and routing parameters from params
    const {
      sense_aware = true,
      alternate_descriptions,
      actor_description,
      target_description,
      target_id,
      originating_actor_id,
    } = params;

    // Determine if sense filtering should be applied:
    // - sense_aware must not be explicitly false
    // - alternate_descriptions must be provided
    // - perceptionFilterService must be available
    const shouldFilter =
      sense_aware !== false &&
      alternate_descriptions &&
      this.#perceptionFilterService;

    let filteredRecipientsMap = null;
    if (shouldFilter) {
      const filteredRecipients =
        this.#perceptionFilterService.filterEventForRecipients(
          {
            perception_type: entry.perceptionType,
            description_text: entry.descriptionText,
            alternate_descriptions,
          },
          [...entityIds],
          locationId,
          params.originating_actor_id
        );

      // Build lookup map for filtered results
      filteredRecipientsMap = new Map(
        filteredRecipients.map((fr) => [fr.entityId, fr])
      );

      log.debug(
        `ADD_PERCEPTION_LOG_ENTRY: sense filtering applied - ${filteredRecipients.filter((fr) => fr.canPerceive).length}/${filteredRecipients.length} can perceive`
      );
    }

    /* ── warn if target_description provided but target lacks perception log ── */
    if (target_description && target_id) {
      if (
        !this.#entityManager.hasComponent(target_id, PERCEPTION_LOG_COMPONENT_ID)
      ) {
        log.warn(
          `ADD_PERCEPTION_LOG_ENTRY: target_description provided for entity '${target_id}' ` +
            `but entity lacks perception log component. The target_description will be ignored.`
        );
      }
    }

    // Prepare batch updates
    const componentSpecs = [];

    /* ── prepare batch updates ──────────────────────────────────── */
    for (const id of entityIds) {
      if (!this.#entityManager.hasComponent(id, PERCEPTION_LOG_COMPONENT_ID)) {
        continue; // not a perceiver
      }

      // Check if recipient can perceive (when filtering enabled)
      if (filteredRecipientsMap) {
        const filtered = filteredRecipientsMap.get(id);
        if (!filtered || !filtered.canPerceive) {
          continue; // Silent filter - recipient can't perceive
        }
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
      // Determine which description this recipient should receive based on role
      let descriptionForRecipient = entry.descriptionText;
      let skipSenseFiltering = false;
      let perceivedVia;

      // Actor receives actor_description WITHOUT filtering
      if (actor_description && id === originating_actor_id) {
        descriptionForRecipient = actor_description;
        skipSenseFiltering = true;
        perceivedVia = 'self';
      }
      // Target receives target_description WITH filtering (only if not also actor)
      else if (
        target_description &&
        id === target_id &&
        id !== originating_actor_id
      ) {
        descriptionForRecipient = target_description;
        // Will be filtered below if filtering enabled
      }
      // Observers receive description_text (default - already set)

      // Apply sense filtering if needed (unless skipped for actor)
      let finalEntry;
      if (!skipSenseFiltering && filteredRecipientsMap) {
        const filtered = filteredRecipientsMap.get(id);
        if (filtered) {
          finalEntry = {
            ...entry,
            descriptionText: filtered.descriptionText ?? descriptionForRecipient,
            perceivedVia: filtered.sense,
          };
        } else {
          // If no filtering data, keep original entry or create new one for custom description
          finalEntry =
            descriptionForRecipient === entry.descriptionText
              ? entry
              : { ...entry, descriptionText: descriptionForRecipient };
        }
      } else if (perceivedVia || descriptionForRecipient !== entry.descriptionText) {
        // Need to create new entry for actor or custom description
        finalEntry = {
          ...entry,
          descriptionText: descriptionForRecipient,
          ...(perceivedVia && { perceivedVia }),
        };
      } else {
        // No changes needed, use original entry (preserve referential equality)
        finalEntry = entry;
      }

      const nextLogEntries = [...logEntries, finalEntry].slice(-maxEntries);
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
