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
 */

// --- Type Imports -----------------------------------------------------------
/** @typedef {import('../../perception/services/recipientRoutingPolicyService.js').default} RecipientRoutingPolicyService */
/** @typedef {import('../../perception/services/recipientSetBuilder.js').default} RecipientSetBuilder */
/** @typedef {import('../../perception/services/perceptionEntryBuilder.js').default} PerceptionEntryBuilder */
/** @typedef {import('../../perception/services/sensorialPropagationService.js').default} SensorialPropagationService */

import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import {
  validateLocationId,
  normalizeEntityIds,
} from '../../utils/handlerUtils/perceptionParamsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import RecipientSetBuilder from '../../perception/services/recipientSetBuilder.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

const DEFAULT_MAX_LOG_ENTRIES = 50;

/**
 * @typedef {object} AddPerceptionLogEntryParams
 * @property {string} location_id           – Required. Location where the event happened.
 * @property {object} entry                 – Required. Log entry (descriptionText, timestamp, perceptionType, actorId…).
 * @property {string=} originating_actor_id – Optional. Actor who raised the event (auditing only).
 * @property {string=} origin_location_id   – Optional. Origin location ID for sensorial link propagation.
 * @property {string[]|string=} recipient_ids – Optional. Explicit list of recipients or a placeholder resolving
 *                                              to one or more recipients. Mutually exclusive with excluded_actor_ids.
 * @property {string[]|string=} excluded_actor_ids – Optional. Actor IDs to exclude from location broadcast.
 *                                                   Mutually exclusive with recipient_ids.
 * @property {boolean=} sense_aware - Optional. Enable sense filtering (default true).
 * @property {object|undefined} alternate_descriptions - Optional. Sense-based alternate descriptions.
 * @property {string|undefined} actor_description - Optional. Actor-specific description.
 * @property {string|undefined} target_description - Optional. Target-specific description.
 * @property {string|undefined} target_id - Optional. Target entity ID.
 */
/**
 * @typedef {object} WriteEntriesParams
 * @property {string} locationId - Target location for perception entries.
 * @property {Set<string>} entityIds - Set of recipient entity IDs.
 * @property {object} entry - The perception entry to write.
 * @property {object|undefined} alternateDescriptions - Sense-based alternates.
 * @property {string|undefined} actorDescription - Description for the actor.
 * @property {string|undefined} targetDescription - Description for the target.
 * @property {string|undefined} targetId - ID of the target entity.
 * @property {boolean} usingExplicitRecipients - Whether explicit targeting is used.
 * @property {boolean} usingExclusions - Whether exclusion mode is active.
 * @property {string} [logLabel] - Label for debug logging.
 */
/**
 * @typedef {object} WriteEntriesContext
 * @property {import('../../interfaces/coreServices.js').ILogger} log - Logger instance.
 * @property {boolean} senseAware - Whether sense filtering is enabled.
 * @property {string|undefined} originatingActorId - Actor who initiated the event.
 * @property {{ totalRecipientsProcessed: number, locationsProcessed: Set<string> }} telemetry - Telemetry counters.
 * @property {string} operationId - Operation identifier for telemetry correlation.
 */
/**
 * Handler for ADD_PERCEPTION_LOG_ENTRY operations.
 *
 * @augments BaseOperationHandler
 */
class AddPerceptionLogEntryHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default}       */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../../perception/services/perceptionFilterService.js').default|null} */ #perceptionFilterService;
  /** @type {RecipientRoutingPolicyService} */ #routingPolicyService;
  /** @type {RecipientSetBuilder} */ #recipientSetBuilder;
  /** @type {PerceptionEntryBuilder} */ #entryBuilder;
  /** @type {SensorialPropagationService} */ #sensorialPropagationService;

  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    perceptionFilterService,
    routingPolicyService,
    recipientSetBuilder,
    perceptionEntryBuilder,
    sensorialPropagationService,
  }) {
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

    validateDependency(
      routingPolicyService,
      'IRecipientRoutingPolicyService',
      logger,
      { requiredMethods: ['validateAndHandle'] }
    );

    const resolvedRecipientSetBuilder =
      recipientSetBuilder ??
      new RecipientSetBuilder({
        entityManager,
        logger,
      });

    validateDependency(
      resolvedRecipientSetBuilder,
      'IRecipientSetBuilder',
      logger,
      { requiredMethods: ['build'] }
    );

    validateDependency(perceptionEntryBuilder, 'IPerceptionEntryBuilder', logger, {
      requiredMethods: ['buildForRecipient'],
    });

    validateDependency(
      sensorialPropagationService,
      'ISensorialPropagationService',
      logger,
      { requiredMethods: ['shouldPropagate', 'getLinkedLocationsWithPrefixedEntries'] }
    );

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    // perceptionFilterService is optional for backward compatibility
    this.#perceptionFilterService = perceptionFilterService ?? null;
    this.#routingPolicyService = routingPolicyService;
    this.#recipientSetBuilder = resolvedRecipientSetBuilder;
    this.#entryBuilder = perceptionEntryBuilder;
    this.#sensorialPropagationService = sensorialPropagationService;
  }

  /**
   * Resolve the logger for the current execution context.
   *
   * @param {import('../defs.js').ExecutionContext} [executionContext] - Optional execution context.
   * @returns {import('../../interfaces/coreServices.js').ILogger} Logger instance.
   */
  getLogger(executionContext) {
    return super.getLogger(executionContext);
  }

  /**
   * Validate parameters for {@link execute}.
   *
   * @param {AddPerceptionLogEntryParams|null|undefined} params - Raw params object.
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
   * @returns {{locationId:string, entry:object, recipients:string[], excludedActors:string[], originLocationId: string|null}|null} Normalized values or `null` when invalid.
   */
  #validateParams(params, logger) {
    if (
      !assertParamsObject(params, this.#dispatcher, 'ADD_PERCEPTION_LOG_ENTRY')
    ) {
      return null;
    }
    const {
      location_id,
      entry,
      recipient_ids,
      excluded_actor_ids,
      origin_location_id,
    } = params;

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

    const originLocationId =
      typeof origin_location_id === 'string' && origin_location_id.trim()
        ? origin_location_id
        : null;

    return {
      locationId,
      entry,
      recipients,
      excludedActors,
      originLocationId,
    };
  }

  /**
   * Writes perception log entries to recipient entities.
   *
   * @param {WriteEntriesParams} params - Entry parameters.
   * @param {WriteEntriesContext} context - Execution context.
   */
  async #writeEntriesForRecipients(params, context) {
    const {
      locationId: targetLocationId,
      entityIds: targetEntityIds,
      entry: targetEntry,
      alternateDescriptions: targetAlternateDescriptions,
      actorDescription: targetActorDescription,
      targetDescription: targetTargetDescription,
      targetId: targetTargetId,
      usingExplicitRecipients: targetUsingExplicitRecipients,
      usingExclusions: targetUsingExclusions,
      logLabel,
    } = params;
    const { log, senseAware, originatingActorId, telemetry, operationId } =
      context;
    const locationLabel = logLabel ?? targetLocationId;
    /* ── Guard: Empty recipient set ────────────────────────────────────────
     * Note: The explicit-recipient branch is logically unreachable because
     * RecipientSetBuilder.build() only returns mode='explicit' when the
     * explicitRecipients array is non-empty, which yields entityIds.size > 0.
     * See src/perception/services/recipientSetBuilder.js:68-73 for the invariant.
     */
    if (targetEntityIds.size === 0) {
      if (targetUsingExclusions) {
        log.debug(
          `ADD_PERCEPTION_LOG_ENTRY: All actors excluded for ${locationLabel}`
        );
        return;
      }

      log.debug(
        `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationLabel}`
      );
      return;
    }

    // Determine if sense filtering should be applied:
    // - sense_aware must not be explicitly false
    // - alternate_descriptions must be provided
    // - perceptionFilterService must be available
    const shouldFilter =
      senseAware !== false &&
      targetAlternateDescriptions &&
      this.#perceptionFilterService;

    let filteredRecipientsMap = null;
    let filterDuration = 0;
    if (shouldFilter) {
      const filterStartTime = Date.now();
      const filteredRecipients =
        this.#perceptionFilterService.filterEventForRecipients(
          {
            perception_type: targetEntry.perceptionType,
            description_text: targetEntry.descriptionText,
            alternate_descriptions: targetAlternateDescriptions,
          },
          [...targetEntityIds],
          targetLocationId,
          originatingActorId
        );
      filterDuration = Date.now() - filterStartTime;

      // Build lookup map for filtered results
      filteredRecipientsMap = new Map(
        filteredRecipients.map((fr) => [fr.entityId, fr])
      );

      const perceivableCount = filteredRecipients.filter(
        (fr) => fr.canPerceive
      ).length;
      const excludedCount = filteredRecipients.length - perceivableCount;
      log.debug('ADD_PERCEPTION_LOG_ENTRY: Filtering complete', {
        operationId,
        locationId: targetLocationId,
        filteredCount: perceivableCount,
        excludedCount,
        filteringApplied: true,
        durationMs: filterDuration,
      });

      log.debug(
        `ADD_PERCEPTION_LOG_ENTRY: sense filtering applied - ${filteredRecipients.filter((fr) => fr.canPerceive).length}/${filteredRecipients.length} can perceive`
      );
    }

    // Prepare batch updates
    const componentSpecs = [];

    /* ── prepare batch updates ──────────────────────────────────── */
    for (const id of targetEntityIds) {
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
      // Use PerceptionEntryBuilder to handle role-based description selection
      // and sense filtering (extracted per ADDPERLOGENTHANROB-004)
      const finalEntry = this.#entryBuilder.buildForRecipient({
        recipientId: id,
        baseEntry: targetEntry,
        actorDescription: targetActorDescription,
        targetDescription: targetTargetDescription,
        originatingActorId,
        targetId: targetTargetId,
        filteredRecipientsMap,
      });

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
    const writeStartTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    let usedBatchUpdate = false;
    if (componentSpecs.length > 0) {
      try {
        // Check if the optimized batch method exists
        if (
          typeof this.#entityManager.batchAddComponentsOptimized === 'function'
        ) {
          usedBatchUpdate = true;
          // Use optimized batch update that emits a single event
          const { updateCount, errors } =
            await this.#entityManager.batchAddComponentsOptimized(
              componentSpecs,
              true // emit single batch event
            );
          const attemptedCount = componentSpecs.length;
          const resolvedUpdateCount =
            typeof updateCount === 'number' ? updateCount : 0;
          successCount = resolvedUpdateCount;
          failureCount = Math.max(0, attemptedCount - resolvedUpdateCount);

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
            `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updateCount}/${targetEntityIds.size} perceivers ${
              targetUsingExplicitRecipients
                ? '(targeted)'
                : `in ${locationLabel}`
            } (batch mode)`
          );
        } else {
          // Fallback to regular batch method if optimized version doesn't exist
          let updated = 0;
          let failed = 0;
          for (const spec of componentSpecs) {
            try {
              await this.#entityManager.addComponent(
                spec.instanceId,
                spec.componentTypeId,
                spec.componentData
              );
              updated++;
            } catch (e) {
              failed++;
              safeDispatchError(
                this.#dispatcher,
                `ADD_PERCEPTION_LOG_ENTRY: failed to update ${spec.instanceId}: ${e.message}`,
                { stack: e.stack, entityId: spec.instanceId }
              );
            }
          }
          successCount = updated;
          failureCount = failed;

          log.debug(
            `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updated}/${targetEntityIds.size} perceivers ${
              targetUsingExplicitRecipients
                ? '(targeted)'
                : `in ${locationLabel}`
            }`
          );
        }
      } catch (e) {
        log.error('ADD_PERCEPTION_LOG_ENTRY: Batch update failed', e);
        // Fallback to individual updates if batch fails
        let updated = 0;
        let failed = 0;
        for (const spec of componentSpecs) {
          try {
            await this.#entityManager.addComponent(
              spec.instanceId,
              spec.componentTypeId,
              spec.componentData
            );
            updated++;
          } catch (err) {
            failed++;
            safeDispatchError(
              this.#dispatcher,
              `ADD_PERCEPTION_LOG_ENTRY: failed to update ${spec.instanceId}: ${err.message}`,
              { stack: err.stack, entityId: spec.instanceId }
            );
          }
        }
        successCount = updated;
        failureCount = failed;

        log.debug(
          `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updated}/${targetEntityIds.size} perceivers ${
            targetUsingExplicitRecipients
              ? '(targeted)'
              : `in ${locationLabel}`
          } (fallback mode)`
        );
      }
    } else {
      log.debug(
        `ADD_PERCEPTION_LOG_ENTRY: No perceivers found in location ${locationLabel}`
      );
    }

    const writeDuration = Date.now() - writeStartTime;
    log.debug('ADD_PERCEPTION_LOG_ENTRY: Entries written', {
      operationId,
      locationId: targetLocationId,
      successCount,
      failureCount,
      batchMode: usedBatchUpdate,
      durationMs: writeDuration,
    });

    telemetry.totalRecipientsProcessed += targetEntityIds.size;
    telemetry.locationsProcessed.add(targetLocationId);
  }

  /**
   * Execute the operation handler for the given parameters.
   *
   * @param {AddPerceptionLogEntryParams} params - Operation parameters.
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context (unused).
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    /* ── validation ─────────────────────────────────────────────── */
    const validated = this.#validateParams(params, log);
    if (!validated) return;
    const {
      locationId,
      entry,
      recipients,
      excludedActors,
      originLocationId,
    } = validated;
    const startTime = Date.now();
    const operationId =
      executionContext?.operationId ?? `aple_${Date.now()}`;
    const telemetry = {
      totalRecipientsProcessed: 0,
      locationsProcessed: new Set([locationId]),
    };

    /* ── perceive who? ──────────────────────────────────────────── */
    // Validate mutual exclusivity using unified routing policy service (error mode - abort on conflict)
    if (
      !this.#routingPolicyService.validateAndHandle(
        recipients,
        excludedActors,
        'ADD_PERCEPTION_LOG_ENTRY'
      )
    ) {
      log.debug('ADD_PERCEPTION_LOG_ENTRY: Operation complete', {
        operationId,
        totalDurationMs: Date.now() - startTime,
        totalRecipientsProcessed: telemetry.totalRecipientsProcessed,
        locationsProcessed: telemetry.locationsProcessed.size,
      });
      return;
    }

    const { entityIds, mode } = this.#recipientSetBuilder.build({
      locationId,
      explicitRecipients: recipients,
      excludedActors,
    });
    const recipientEntityIds =
      entityIds instanceof Set ? entityIds : new Set(entityIds);

    const usingExplicitRecipients = mode === 'explicit';
    const usingExclusions = mode === 'exclusion';

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

    const recipientCount = recipientEntityIds.size;
    log.debug('ADD_PERCEPTION_LOG_ENTRY: Starting operation', {
      operationId,
      locationId,
      recipientMode: mode,
      recipientCount,
      senseAware: sense_aware !== false,
      hasAlternateDescriptions: !!alternate_descriptions,
      hasActorDescription: !!actor_description,
      hasTargetDescription: !!target_description,
    });

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

    // Determine if sensorial propagation should occur using dedicated service
    // (extracted per ADDPERLOGENTHANROB-005 for single responsibility)
    const shouldPropagate = this.#sensorialPropagationService.shouldPropagate(
      usingExplicitRecipients,
      originLocationId,
      locationId
    );

    if (recipientEntityIds.size > 0) {
      await this.#writeEntriesForRecipients(
        {
          locationId,
          entityIds: recipientEntityIds,
          entry,
          alternateDescriptions: alternate_descriptions,
          actorDescription: actor_description,
          targetDescription: target_description,
          targetId: target_id,
          usingExplicitRecipients,
          usingExclusions,
        },
        {
          log,
          senseAware: sense_aware,
          originatingActorId: originating_actor_id,
          telemetry,
          operationId,
        }
      );
    } else if (!shouldPropagate) {
      // Note: usingExplicitRecipients branch is unreachable here because explicit mode
      // requires non-empty recipient_ids, which creates a non-empty entityIds Set
      log.debug(
        usingExclusions
          ? `ADD_PERCEPTION_LOG_ENTRY: All actors excluded for ${locationId}`
          : `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationId}`
      );
      log.debug('ADD_PERCEPTION_LOG_ENTRY: Sensorial propagation', {
        operationId,
        originLocationId: locationId,
        linkedLocationCount: 0,
        propagated: false,
        totalPropagatedEntries: 0,
      });
      log.debug('ADD_PERCEPTION_LOG_ENTRY: Operation complete', {
        operationId,
        totalDurationMs: Date.now() - startTime,
        totalRecipientsProcessed: telemetry.totalRecipientsProcessed,
        locationsProcessed: telemetry.locationsProcessed.size,
      });
      return;
    }

    // Get linked locations with prefixed entries from service
    if (!shouldPropagate) {
      log.debug('ADD_PERCEPTION_LOG_ENTRY: Sensorial propagation', {
        operationId,
        originLocationId: locationId,
        linkedLocationCount: 0,
        propagated: false,
        totalPropagatedEntries: 0,
      });
      log.debug('ADD_PERCEPTION_LOG_ENTRY: Operation complete', {
        operationId,
        totalDurationMs: Date.now() - startTime,
        totalRecipientsProcessed: telemetry.totalRecipientsProcessed,
        locationsProcessed: telemetry.locationsProcessed.size,
      });
      return;
    }

    const linkedLocations =
      this.#sensorialPropagationService.getLinkedLocationsWithPrefixedEntries({
        originLocationId: locationId,
        entry,
        alternateDescriptions: alternate_descriptions,
        actorDescription: actor_description,
        targetDescription: target_description,
        targetId: target_id,
        excludedActors,
        originatingActorId: originating_actor_id,
      });

    const totalPropagatedEntries = linkedLocations.reduce(
      (total, linked) => total + (linked.entityIds?.size ?? 0),
      0
    );
    log.debug('ADD_PERCEPTION_LOG_ENTRY: Sensorial propagation', {
      operationId,
      originLocationId: locationId,
      linkedLocationCount: linkedLocations.length,
      propagated: shouldPropagate,
      totalPropagatedEntries,
    });

    if (linkedLocations.length === 0) {
      if (recipientEntityIds.size === 0) {
        // Note: usingExplicitRecipients branch is unreachable here because explicit mode
        // requires non-empty recipient_ids, which creates a non-empty entityIds Set
        log.debug(
          usingExclusions
            ? `ADD_PERCEPTION_LOG_ENTRY: All actors excluded for ${locationId}`
            : `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationId}`
        );
      }
      log.debug('ADD_PERCEPTION_LOG_ENTRY: Operation complete', {
        operationId,
        totalDurationMs: Date.now() - startTime,
        totalRecipientsProcessed: telemetry.totalRecipientsProcessed,
        locationsProcessed: telemetry.locationsProcessed.size,
      });
      return;
    }

    // Write entries to linked locations
    for (const linked of linkedLocations) {
      telemetry.locationsProcessed.add(linked.locationId);
      await this.#writeEntriesForRecipients(
        {
          locationId: linked.locationId,
          entityIds: linked.entityIds,
          entry: linked.prefixedEntry,
          alternateDescriptions: linked.prefixedAlternateDescriptions,
          actorDescription: linked.prefixedActorDescription,
          targetDescription: linked.prefixedTargetDescription,
          targetId: target_id,
          usingExplicitRecipients: false,
          usingExclusions: linked.mode === 'exclusion',
          logLabel: `${linked.locationId} (sensorial link)`,
        },
        {
          log,
          senseAware: sense_aware,
          originatingActorId: originating_actor_id,
          telemetry,
          operationId,
        }
      );
    }

    log.debug('ADD_PERCEPTION_LOG_ENTRY: Operation complete', {
      operationId,
      totalDurationMs: Date.now() - startTime,
      totalRecipientsProcessed: telemetry.totalRecipientsProcessed,
      locationsProcessed: telemetry.locationsProcessed.size,
    });
  }
}

export default AddPerceptionLogEntryHandler;
