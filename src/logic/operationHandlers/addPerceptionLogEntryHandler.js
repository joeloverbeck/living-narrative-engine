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

// --- Type Imports -----------------------------------------------------------
/** @typedef {import('../../perception/services/recipientRoutingPolicyService.js').default} RecipientRoutingPolicyService */

import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import {
  validateLocationId,
  normalizeEntityIds,
} from '../../utils/handlerUtils/perceptionParamsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

const DEFAULT_MAX_LOG_ENTRIES = 50;
const SENSORIAL_LINKS_COMPONENT_ID = 'locations:sensorial_links';
const LOCATION_NAME_COMPONENT_ID = 'core:name';

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
 */
class AddPerceptionLogEntryHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default}       */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../../perception/services/perceptionFilterService.js').default|null} */ #perceptionFilterService;
  /** @type {RecipientRoutingPolicyService} */ #routingPolicyService;

  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    perceptionFilterService,
    routingPolicyService,
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

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    // perceptionFilterService is optional for backward compatibility
    this.#perceptionFilterService = perceptionFilterService ?? null;
    this.#routingPolicyService = routingPolicyService;
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
   * @param {AddPerceptionLogEntryParams} params
   * @param {import('../defs.js').ExecutionContext} executionContext – Unused for now.
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

    /* ── perceive who? ──────────────────────────────────────────── */
    // Recipients and exclusions are already normalized in #validateParams
    const usingExplicitRecipients = recipients.length > 0;
    const usingExclusions = excludedActors.length > 0;

    // Validate mutual exclusivity using unified routing policy service (error mode - abort on conflict)
    if (
      !this.#routingPolicyService.validateAndHandle(
        recipients,
        excludedActors,
        'ADD_PERCEPTION_LOG_ENTRY'
      )
    ) {
      return;
    }

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

    const writeEntriesForRecipients = async ({
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
    }) => {
      const locationLabel = logLabel ?? targetLocationId;
      if (targetEntityIds.size === 0) {
        log.debug(
          targetUsingExplicitRecipients
            ? `ADD_PERCEPTION_LOG_ENTRY: No matching recipients for ${locationLabel}`
            : targetUsingExclusions
              ? `ADD_PERCEPTION_LOG_ENTRY: All actors excluded for ${locationLabel}`
              : `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationLabel}`
        );
        return;
      }

      // Determine if sense filtering should be applied:
      // - sense_aware must not be explicitly false
      // - alternate_descriptions must be provided
      // - perceptionFilterService must be available
      const shouldFilter =
        sense_aware !== false &&
        targetAlternateDescriptions &&
        this.#perceptionFilterService;

      let filteredRecipientsMap = null;
      if (shouldFilter) {
        const filteredRecipients =
          this.#perceptionFilterService.filterEventForRecipients(
            {
              perception_type: targetEntry.perceptionType,
              description_text: targetEntry.descriptionText,
              alternate_descriptions: targetAlternateDescriptions,
            },
            [...targetEntityIds],
            targetLocationId,
            originating_actor_id
          );

        // Build lookup map for filtered results
        filteredRecipientsMap = new Map(
          filteredRecipients.map((fr) => [fr.entityId, fr])
        );

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
        // Determine which description this recipient should receive based on role
        let descriptionForRecipient = targetEntry.descriptionText;
        let skipSenseFiltering = false;
        let perceivedVia;

        // Actor receives actor_description WITHOUT filtering
        if (targetActorDescription && id === originating_actor_id) {
          descriptionForRecipient = targetActorDescription;
          skipSenseFiltering = true;
          perceivedVia = 'self';
        }
        // Target receives target_description WITH filtering (only if not also actor)
        else if (
          targetTargetDescription &&
          id === targetTargetId &&
          id !== originating_actor_id
        ) {
          descriptionForRecipient = targetTargetDescription;
          // Will be filtered below if filtering enabled
        }
        // Observers receive description_text (default - already set)

        // Apply sense filtering if needed (unless skipped for actor)
        let finalEntry;
        const hasCustomDescription =
          descriptionForRecipient !== targetEntry.descriptionText;
        if (!skipSenseFiltering && filteredRecipientsMap) {
          const filtered = filteredRecipientsMap.get(id);
          if (filtered) {
            // Custom descriptions (target_description) take priority over filtered observer text
            // This ensures target sees "Pitch removes my shoes" not "Pitch removes Cress's shoes"
            finalEntry = {
              ...targetEntry,
              descriptionText: hasCustomDescription
                ? descriptionForRecipient
                : (filtered.descriptionText ?? targetEntry.descriptionText),
              perceivedVia: filtered.sense,
            };
          } else {
            // If no filtering data, keep original entry or create new one for custom description
            finalEntry =
              descriptionForRecipient === targetEntry.descriptionText
                ? targetEntry
                : { ...targetEntry, descriptionText: descriptionForRecipient };
          }
        } else if (
          perceivedVia ||
          descriptionForRecipient !== targetEntry.descriptionText
        ) {
          // Need to create new entry for actor or custom description
          finalEntry = {
            ...targetEntry,
            descriptionText: descriptionForRecipient,
            ...(perceivedVia && { perceivedVia }),
          };
        } else {
          // No changes needed, use original entry (preserve referential equality)
          finalEntry = targetEntry;
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
              `ADD_PERCEPTION_LOG_ENTRY: wrote entry to ${updateCount}/${targetEntityIds.size} perceivers ${
                targetUsingExplicitRecipients
                  ? '(targeted)'
                  : `in ${locationLabel}`
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
    };

    const canPropagateSensorialLinks =
      !usingExplicitRecipients &&
      (!originLocationId || originLocationId === locationId);

    if (entityIds.size > 0) {
      await writeEntriesForRecipients({
        locationId,
        entityIds,
        entry,
        alternateDescriptions: alternate_descriptions,
        actorDescription: actor_description,
        targetDescription: target_description,
        targetId: target_id,
        usingExplicitRecipients,
        usingExclusions,
      });
    } else if (!canPropagateSensorialLinks) {
      log.debug(
        usingExplicitRecipients
          ? `ADD_PERCEPTION_LOG_ENTRY: No matching recipients for ${locationId}`
          : usingExclusions
            ? `ADD_PERCEPTION_LOG_ENTRY: All actors excluded for ${locationId}`
            : `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationId}`
      );
      return;
    }

    const sensorialTargets = canPropagateSensorialLinks
      ? this.#entityManager.getComponentData(
          locationId,
          SENSORIAL_LINKS_COMPONENT_ID
        )?.targets
      : null;

    const linkedLocationIds = Array.isArray(sensorialTargets)
      ? [...new Set(sensorialTargets)].filter(
          (targetId) => typeof targetId === 'string' && targetId !== locationId
        )
      : [];

    if (linkedLocationIds.length === 0) {
      if (entityIds.size === 0) {
        log.debug(
          usingExplicitRecipients
            ? `ADD_PERCEPTION_LOG_ENTRY: No matching recipients for ${locationId}`
            : usingExclusions
              ? `ADD_PERCEPTION_LOG_ENTRY: All actors excluded for ${locationId}`
              : `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${locationId}`
        );
      }
      return;
    }

    const originNameComponent = this.#entityManager.getComponentData(
      locationId,
      LOCATION_NAME_COMPONENT_ID
    );

    const originName =
      typeof originNameComponent?.text === 'string' &&
      originNameComponent.text.trim()
        ? originNameComponent.text.trim()
        : locationId;

    const prefixText = `(From ${originName}) `;

    if (prefixText && linkedLocationIds.length > 0) {
      const prefixValue = prefixText;
      const applyPrefix = (text) =>
        typeof text === 'string' && text.length > 0 ? `${prefixValue}${text}` : text;

      const prefixedAlternateDescriptions = alternate_descriptions
        ? Object.fromEntries(
            Object.entries(alternate_descriptions).map(([key, value]) => [
              key,
              typeof value === 'string' ? applyPrefix(value) : value,
            ])
          )
        : alternate_descriptions;

      const prefixedEntry = {
        ...entry,
        descriptionText: applyPrefix(entry.descriptionText),
      };

      const prefixedActorDescription = actor_description
        ? applyPrefix(actor_description)
        : actor_description;

      const prefixedTargetDescription = target_description
        ? applyPrefix(target_description)
        : target_description;

      const exclusionSet = new Set(excludedActors);
      if (originating_actor_id) {
        exclusionSet.add(originating_actor_id);
      }

      for (const linkedLocationId of linkedLocationIds) {
        const linkedEntities =
          this.#entityManager.getEntitiesInLocation(linkedLocationId) ??
          new Set();
        const linkedEntityIds =
          exclusionSet.size > 0
            ? new Set(
                [...linkedEntities].filter((id) => !exclusionSet.has(id))
              )
            : linkedEntities;

        await writeEntriesForRecipients({
          locationId: linkedLocationId,
          entityIds: linkedEntityIds,
          entry: prefixedEntry,
          alternateDescriptions: prefixedAlternateDescriptions,
          actorDescription: prefixedActorDescription,
          targetDescription: prefixedTargetDescription,
          targetId: target_id,
          usingExplicitRecipients: false,
          usingExclusions: exclusionSet.size > 0,
          logLabel: `${linkedLocationId} (sensorial link)`,
        });
      }
    }
  }
}

export default AddPerceptionLogEntryHandler;
