/**
 * @file Handler that emits a core:perceptible_event with standardized payload
 * structure. Optionally logs the event via AddPerceptionLogEntryHandler.
 */

// --- Type Imports -----------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./addPerceptionLogEntryHandler.js').default} AddPerceptionLogEntryHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';
import { assertParamsObject } from '../../utils/handlerUtils.js';

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
   * @param {ExecutionContext} _ctx - Execution context (unused).
   */
  execute(params, _ctx) {
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

    if (typeof location_id !== 'string' || !location_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_PERCEPTIBLE_EVENT: location_id required',
        { location_id }
      );
      return;
    }
    if (typeof description_text !== 'string' || !description_text.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_PERCEPTIBLE_EVENT: description_text required',
        { description_text }
      );
      return;
    }
    if (typeof perception_type !== 'string' || !perception_type.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_PERCEPTIBLE_EVENT: perception_type required',
        { perception_type }
      );
      return;
    }
    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_PERCEPTIBLE_EVENT: actor_id required',
        { actor_id }
      );
      return;
    }

    const payload = {
      eventName: EVENT_ID,
      locationId: location_id,
      descriptionText: description_text,
      timestamp: new Date().toISOString(),
      perceptionType: perception_type,
      actorId: actor_id,
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
        location_id,
        entry: {
          descriptionText: description_text,
          timestamp: payload.timestamp,
          perceptionType: perception_type,
          actorId: actor_id,
          targetId: target_id ?? null,
          involvedEntities: Array.isArray(involved_entities)
            ? involved_entities
            : [],
        },
        originating_actor_id: actor_id,
      });
    }
  }
}

export default DispatchPerceptibleEventHandler;
