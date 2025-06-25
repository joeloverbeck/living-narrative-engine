// src/logic/operationHandlers/dispatchEventHandler.js
// --- JSDoc Imports ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */ // ** Corrected type for 2nd arg **
/** @typedef {import('../../events/eventBus.js').default} EventBus */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../defs.js').EventDispatchDeps} EventDispatchDeps */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

// --- Handler Implementation ---
/**
 * Parameters accepted by {@link DispatchEventHandler#execute}.
 * Placeholders in `eventType` or `payload` values are assumed to be pre-resolved by OperationInterpreter.
 *
 * @typedef {object} DispatchEventParameters
 * @property {string}                eventType                Namespaced event id.
 * @property {Record<string, any>=}  payload                  Optional payload object.
 */

/**
 * @typedef {object} DispatchEventOperationParams
 * @property {string} event_type - The namespaced identifier for the event type (e.g., "core:example").
 * @property {*} [event_payload] - Optional data to include with the event.
 */

/**
 * @implements {OperationHandler}
 */
class DispatchEventHandler {
  /** @type {ValidatedEventDispatcher | EventBus} */
  #dispatcher;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {ValidatedEventDispatcher|EventBus} deps.dispatcher
   * @param {ILogger} deps.logger - The logger service instance.
   * @throws {Error} If dependencies are invalid.
   */
  constructor({ dispatcher, logger }) {
    // FIX: Simplified the validation since both methods are now named 'dispatch'
    const dispatcherValid =
      dispatcher && typeof dispatcher.dispatch === 'function';
    if (!dispatcherValid) {
      throw new Error(
        'DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.'
      );
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'DispatchEventHandler requires a valid ILogger instance.'
      );
    }
    this.#dispatcher = dispatcher;
    this.#logger = logger;
  }

  /**
   * @description Validate and sanitize parameters passed to {@link execute}.
   * @param {DispatchEventParameters|null|undefined} params - Raw parameters.
   * @param {ILogger} logger - Logger for diagnostics.
   * @returns {{eventType: string, payload: object}|null} Normalized values or `null` if invalid.
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, logger, 'DISPATCH_EVENT')) return null;

    if (
      !params ||
      typeof params.eventType !== 'string' ||
      !params.eventType.trim()
    ) {
      logger.error(
        'DispatchEventHandler: Invalid or missing "eventType" parameter (must be a non-blank string). Dispatch cancelled.',
        { params }
      );
      return null;
    }

    const eventType = params.eventType.trim();
    let payload = params.payload ?? {};

    if (typeof payload !== 'object' || payload === null) {
      logger.warn(
        `DispatchEventHandler: Resolved 'payload' is not an object (got ${typeof payload}). Using empty object {}.`,
        { eventType, resolvedPayload: params.payload }
      );
      payload = {};
    }

    return { eventType, payload };
  }

  /**
   * @description Dispatch using an EventBus instance.
   * @param {string} eventType - Normalized event name.
   * @param {object} payload - Normalized payload object.
   * @returns {void}
   * @private
   */
  #dispatchViaEventBus(eventType, payload) {
    const logger = this.#logger;
    Promise.resolve(this.#dispatcher.dispatch(eventType, payload))
      .then(() => {
        const listenerCount = this.#dispatcher.listenerCount(eventType);
        if (listenerCount === 0) {
          logger.warn(
            `DispatchEventHandler: No listeners for event "${eventType}".`
          );
        } else {
          logger.debug(
            `DispatchEventHandler: Dispatched "${eventType}" to ${
              Number.isNaN(listenerCount) ? 'unknown' : listenerCount
            } listener(s) via EventBus.`
          );
        }
      })
      .catch((err) => {
        logger.error(
          `DispatchEventHandler: Error during dispatch of event "${eventType}" via EventBus.`,
          { error: err, eventType, payload }
        );
      });
  }

  /**
   * @description Dispatch using a ValidatedEventDispatcher instance.
   * @param {string} eventType - Normalized event name.
   * @param {object} payload - Normalized payload object.
   * @returns {void}
   * @private
   */
  #dispatchViaValidatedDispatcher(eventType, payload) {
    const logger = this.#logger;
    this.#dispatcher
      .dispatch(eventType, payload)
      .then(() => {
        logger.debug(
          `DispatchEventHandler: Event "${eventType}" dispatched (Validated).`
        );
      })
      .catch((err) => {
        logger.error(
          `DispatchEventHandler: Error during async processing of event "${eventType}" via ValidatedEventDispatcher.`,
          { error: err, eventType, payload }
        );
      });
  }

  /**
   * Emit a new game-event using pre-resolved parameters.
   *
   * @param {DispatchEventParameters|null|undefined} params - Parameters with placeholders already resolved.
   * @param {ExecutionContext} executionContext - The context (used for services, not resolution here).
   */
  execute(params, executionContext) {
    void executionContext;
    const logger = this.#logger;
    const validated = this.#validateParams(params, logger);
    if (!validated) return;

    const { eventType, payload } = validated;
    logger.debug(
      `DispatchEventHandler: Attempting to dispatch event "${eventType}" with resolved payload...`,
      { payload }
    );

    try {
      if (typeof this.#dispatcher.listenerCount === 'function') {
        this.#dispatchViaEventBus(eventType, payload);
      } else if (typeof this.#dispatcher.dispatch === 'function') {
        this.#dispatchViaValidatedDispatcher(eventType, payload);
      } else {
        logger.error(
          `DispatchEventHandler: Internal error – dispatcher lacks a recognised dispatch method. "${eventType}" not sent.`
        );
      }
    } catch (syncError) {
      logger.error(
        `DispatchEventHandler: Synchronous error occurred when trying to initiate dispatch for event "${eventType}".`,
        { error: syncError, eventType, payload }
      );
    }
  }
}

export default DispatchEventHandler;
