/**
 * @file Handler that emits a core:perceptible_event with standardized payload
 * structure. Optionally logs the event via AddPerceptionLogEntryHandler.
 */

// --- Type Imports -----------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./addPerceptionLogEntryHandler.js').default} AddPerceptionLogEntryHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import {
  assertParamsObject,
  requireNonBlankString,
} from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

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
 * @property {boolean=} log_entry           - If true, also log via AddPerceptionLogEntryHandler.
 */

/**
 * @implements {OperationHandler}
 */
class DispatchPerceptibleEventHandler {
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {ILogger} */
  #logger;
  /** @type {AddPerceptionLogEntryHandler} */
  #logHandler;

  /**
   * @param {object} deps
   * @param {ISafeEventDispatcher} deps.dispatcher - Dispatcher used to emit events.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {AddPerceptionLogEntryHandler} deps.addPerceptionLogEntryHandler - Handler used for optional logging.
   */
  constructor({ dispatcher, logger, addPerceptionLogEntryHandler }) {
    if (!dispatcher?.dispatch) {
      throw new Error(
        'DispatchPerceptibleEventHandler requires ISafeEventDispatcher'
      );
    }
    if (!logger?.debug) {
      throw new Error('DispatchPerceptibleEventHandler requires ILogger');
    }
    if (!addPerceptionLogEntryHandler?.execute) {
      throw new Error(
        'DispatchPerceptibleEventHandler requires AddPerceptionLogEntryHandler'
      );
    }

    this.#dispatcher = dispatcher;
    this.#logger = logger;
    this.#logHandler = addPerceptionLogEntryHandler;
  }

  /**
   * Build the event payload and dispatch. If `log_entry` is true, also invoke
   * {@link AddPerceptionLogEntryHandler} to store the log entry for observers.
   *
   * @param {DispatchPerceptibleEventParams} params - Resolved parameters.
   * @param {ExecutionContext} executionContext - Execution context (unused).
   */
  execute(params, executionContext) {
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
      log_entry = false,
    } = params;

    const locationId = requireNonBlankString(
      location_id,
      'location_id',
      this.#logger,
      this.#dispatcher
    );
    if (!locationId) return;
    const descriptionText = requireNonBlankString(
      description_text,
      'description_text',
      this.#logger,
      this.#dispatcher
    );
    if (!descriptionText) return;
    const perceptionType = requireNonBlankString(
      perception_type,
      'perception_type',
      this.#logger,
      this.#dispatcher
    );
    if (!perceptionType) return;
    const actorId = requireNonBlankString(
      actor_id,
      'actor_id',
      this.#logger,
      this.#dispatcher
    );
    if (!actorId) return;

    const payload = {
      eventName: EVENT_ID,
      locationId,
      descriptionText,
      timestamp: new Date().toISOString(),
      perceptionType,
      actorId,
      targetId: target_id ?? null,
      involvedEntities: Array.isArray(involved_entities)
        ? involved_entities
        : [],
      contextualData:
        typeof contextual_data === 'object' && contextual_data !== null
          ? contextual_data
          : {},
    };

    this.#logger.debug('DISPATCH_PERCEPTIBLE_EVENT: dispatching event', {
      payload,
    });
    this.#dispatcher.dispatch(EVENT_ID, payload);

    if (log_entry) {
      this.#logHandler.execute({
        location_id: locationId,
        entry: {
          descriptionText,
          timestamp: payload.timestamp,
          perceptionType,
          actorId,
          targetId: target_id ?? null,
          involvedEntities: Array.isArray(involved_entities)
            ? involved_entities
            : [],
        },
        originating_actor_id: actorId,
      });
    }
  }
}

export default DispatchPerceptibleEventHandler;
