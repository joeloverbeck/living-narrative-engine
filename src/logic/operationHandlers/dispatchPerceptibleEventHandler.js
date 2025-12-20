/**
 * @file Handler for DISPATCH_PERCEPTIBLE_EVENT operation
 *
 * Emits standardized perceptible events (actions/events that can be observed by nearby entities)
 * with support for explicit recipient/exclusion lists. Perception log entries are handled
 * by the log_perceptible_events.rule.json rule that listens to core:perceptible_event.
 *
 * Operation flow:
 * 1. Validate required parameters (location_id, description_text, perception_type, actor_id)
 * 2. Normalize contextual_data with recipientIds/excludedActorIds (mutually exclusive)
 * 3. Build standardized payload with timestamp and involved entities
 * 4. Dispatch core:perceptible_event through event bus
 *
 * Related files:
 * @see data/schemas/operations/dispatchPerceptibleEvent.schema.json - Operation schema
 * @see data/mods/core/rules/log_perceptible_events.rule.json - Rule that logs perceptible events
 * @see src/dependencyInjection/tokens/tokens-core.js - DispatchPerceptibleEventHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 */

// --- Type Imports -----------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../perception/services/recipientRoutingPolicyService.js').default} RecipientRoutingPolicyService */

import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import {
  validateLocationId,
  normalizeEntityIds,
} from '../../utils/handlerUtils/perceptionParamsUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import {
  isValidPerceptionType,
  isLegacyType,
  getLegacyTypeMapping,
  suggestNearestType,
  getAllValidTypes,
} from '../../perception/registries/perceptionTypeRegistry.js';

const EVENT_ID = 'core:perceptible_event';

/**
 * Parameters accepted by {@link DispatchPerceptibleEventHandler#execute}.
 *
 * @typedef {object} DispatchPerceptibleEventParams
 * @property {string} location_id           - ID of the location where the event occurs.
 * @property {string} description_text      - Human readable summary text.
 * @property {string} perception_type       - Category of perceptible event.
 * @property {string} actor_id              - Entity primarily responsible.
 * @property {string=} target_id            - Optional target entity.
 * @property {string[]=} involved_entities  - Optional array of other entity IDs.
 * @property {object=} contextual_data      - Optional contextual data object.
 * @property {string[]=} contextual_data.recipientIds - Explicit recipients (mutually exclusive with excludedActorIds).
 * @property {string[]=} contextual_data.excludedActorIds - Actors to exclude from broadcast (mutually exclusive with recipientIds).
 * @property {string=} origin_location_id   - Optional origin location ID for loop prevention.
 */

/**
 * @implements {OperationHandler}
 */
class DispatchPerceptibleEventHandler {
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {ILogger} */
  #logger;
  /** @type {RecipientRoutingPolicyService} */
  #routingPolicyService;
  /** @type {import('../../perception/services/recipientSetBuilder.js').default} */
  #recipientSetBuilder;

  /**
   * @param {object} deps
   * @param {ISafeEventDispatcher} deps.dispatcher - Dispatcher used to emit events.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {RecipientRoutingPolicyService} deps.routingPolicyService - Unified routing policy service.
   * @param {import('../../perception/services/recipientSetBuilder.js').default} deps.recipientSetBuilder - Service to build recipient sets.
   */
  constructor({ dispatcher, logger, routingPolicyService, recipientSetBuilder }) {
    if (!dispatcher?.dispatch) {
      throw new Error(
        'DispatchPerceptibleEventHandler requires ISafeEventDispatcher'
      );
    }
    if (!logger?.debug) {
      throw new Error('DispatchPerceptibleEventHandler requires ILogger');
    }

    validateDependency(
      routingPolicyService,
      'IRecipientRoutingPolicyService',
      logger,
      { requiredMethods: ['validateAndHandle'] }
    );

    validateDependency(
      recipientSetBuilder,
      'IRecipientSetBuilder',
      logger,
      { requiredMethods: ['build'] }
    );

    this.#dispatcher = dispatcher;
    this.#logger = logger;
    this.#routingPolicyService = routingPolicyService;
    this.#recipientSetBuilder = recipientSetBuilder;
  }

  /**
   * Build the event payload and dispatch. Perception log entries are created
   * by the log_perceptible_events.rule.json rule that listens to core:perceptible_event.
   *
   * @param {DispatchPerceptibleEventParams} params - Resolved parameters.
   * @param {ExecutionContext} executionContext - Execution context (unused).
   */
  async execute(params, executionContext) {
    void executionContext;
    if (
      !assertParamsObject(
        params,
        this.#dispatcher,
        'DISPATCH_PERCEPTIBLE_EVENT'
      )
    ) {
      return;
    }

    const {
      location_id,
      description_text,
      perception_type,
      actor_id,
      target_id = null,
      involved_entities = [],
      contextual_data = {},
      actor_description,
      target_description,
      origin_location_id,
    } = params;

    const normalizedContextualData =
      typeof contextual_data === 'object' && contextual_data !== null
        ? { ...contextual_data }
        : {};

    // Normalize recipient/exclusion arrays using shared utility
    normalizedContextualData.recipientIds = normalizeEntityIds(
      normalizedContextualData.recipientIds
    );
    normalizedContextualData.excludedActorIds = normalizeEntityIds(
      normalizedContextualData.excludedActorIds
    );

    // Validate mutual exclusivity using unified routing policy service (error mode - abort on conflict)
    if (
      !this.#routingPolicyService.validateAndHandle(
        normalizedContextualData.recipientIds,
        normalizedContextualData.excludedActorIds,
        'DISPATCH_PERCEPTIBLE_EVENT'
      )
    ) {
      return;
    }

    // Use shared utility for location_id validation
    const validatedLocationId = validateLocationId(
      location_id,
      'DISPATCH_PERCEPTIBLE_EVENT',
      this.#dispatcher,
      this.#logger
    );
    if (!validatedLocationId) {
      return;
    }
    if (typeof description_text !== 'string' || !description_text.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_PERCEPTIBLE_EVENT: description_text required',
        { description_text },
        this.#logger
      );
      return;
    }
    if (typeof perception_type !== 'string' || !perception_type.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_PERCEPTIBLE_EVENT: perception_type required',
        { perception_type },
        this.#logger
      );
      return;
    }

    // Runtime validation of perception_type against registry
    // See specs/perceptionType-consolidation.md for type taxonomy
    let validatedPerceptionType = perception_type.trim();

    if (!isValidPerceptionType(validatedPerceptionType)) {
      const suggestion = suggestNearestType(validatedPerceptionType);
      const sampleTypes = getAllValidTypes().slice(0, 8).join(', ');
      safeDispatchError(
        this.#dispatcher,
        `DISPATCH_PERCEPTIBLE_EVENT: Invalid perception_type '${validatedPerceptionType}'. ` +
          `${suggestion ? `Did you mean '${suggestion}'? ` : ''}` +
          `Valid types include: ${sampleTypes}...`,
        { perception_type: validatedPerceptionType, suggestion },
        this.#logger
      );
      return;
    }

    // Handle legacy types with deprecation warning
    if (isLegacyType(validatedPerceptionType)) {
      const newType = getLegacyTypeMapping(validatedPerceptionType);
      this.#logger.warn(
        `DISPATCH_PERCEPTIBLE_EVENT: Deprecated perception_type '${validatedPerceptionType}' used. ` +
          `Please migrate to '${newType}'. Legacy types will be removed in a future version.`
      );
      validatedPerceptionType = newType;
    }

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_PERCEPTIBLE_EVENT: actor_id required',
        { actor_id },
        this.#logger
      );
      return;
    }

    const originLocationId =
      typeof origin_location_id === 'string' && origin_location_id.trim()
        ? origin_location_id
        : validatedLocationId;

    const timestamp = new Date().toISOString();
    const payload = {
      eventName: EVENT_ID,
      locationId: validatedLocationId,
      originLocationId,
      descriptionText: description_text,
      timestamp,
      perceptionType: validatedPerceptionType, // Use validated/normalized type
      actorId: actor_id,
      targetId: target_id ?? null,
      involvedEntities: Array.isArray(involved_entities)
        ? involved_entities
        : [],
      // Perspective-aware descriptions for actor/target routing
      actorDescription: actor_description ?? null,
      targetDescription: target_description ?? null,
      // Sense-aware filtering parameters
      alternateDescriptions: params.alternate_descriptions ?? null,
      senseAware: params.sense_aware ?? true,
      contextualData: normalizedContextualData,
    };

    this.#logger.debug('DISPATCH_PERCEPTIBLE_EVENT: dispatching event', {
      payload,
    });
    this.#dispatcher.dispatch(EVENT_ID, payload);
  }
}

export default DispatchPerceptibleEventHandler;
