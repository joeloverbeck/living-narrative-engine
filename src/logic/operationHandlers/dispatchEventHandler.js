// src/logic/operationHandlers/dispatchEventHandler.js
// --- JSDoc Imports ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */ // ** Corrected type for 2nd arg **
/** @typedef {import('../../events/eventBus.js').default} EventBus */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

// --- Handler Implementation ---
/**
 * Parameters accepted by {@link DispatchEventHandler#execute}.
 * Placeholders in `eventType` or `payload` values are assumed to be pre-resolved by OperationInterpreter.
 *
 * @typedef {object} DispatchEventParameters
 * @property {string}                eventType                Namespaced event id.
 * @property {Record<string, any>=}  payload                  Optional payload object.
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
    const dispatcherValid =
      dispatcher &&
      (typeof dispatcher.dispatchValidated === 'function' ||
        typeof dispatcher.dispatch === 'function');
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
   * Emit a new game-event using pre-resolved parameters.
   *
   * @param {DispatchEventParameters|null|undefined} params - Parameters with placeholders already resolved.
   * @param {ExecutionContext} executionContext - The context (used for services, not resolution here).
   */
  execute(params, executionContext) {
    const logger = this.#logger; // Use the injected logger

    // 1. Validate resolved params and Trim eventType
    // Ensure params exists and eventType is a non-blank string *after* trimming.
    if (
      !params ||
      typeof params.eventType !== 'string' ||
      !params.eventType.trim()
    ) {
      logger.error(
        'DispatchEventHandler: Invalid or missing "eventType" parameter (must be a non-blank string). Dispatch cancelled.',
        { params }
      );
      return;
    }
    // *** CORRECTION: Trim eventType before using it ***
    const eventType = params.eventType.trim();

    // 2. Use the resolved payload (handle if it's not an object after resolution, though rare)
    let payload = params.payload ?? {}; // Default to {} if null/undefined
    if (typeof payload !== 'object' || payload === null) {
      logger.warn(
        `DispatchEventHandler: Resolved 'payload' is not an object (got ${typeof payload}). Using empty object {}.`,
        {
          eventType, // Use the trimmed eventType for context
          resolvedPayload: params.payload, // Log the original non-object payload received
        }
      );
      payload = {};
    }

    // --- REMOVED Placeholder Resolution Logic ---
    // The payload received here is assumed to be fully resolved by OperationInterpreter.

    // 3. Dispatch
    logger.debug(
      `DispatchEventHandler: Attempting to dispatch event "${eventType}" with resolved payload...`,
      { payload }
    );
    try {
      if (typeof this.#dispatcher.dispatchValidated === 'function') {
        this.#dispatcher
          .dispatchValidated(eventType, payload)
          .then(() => {
            logger.debug(
              `DispatchEventHandler: Event "${eventType}" dispatched (Validated).`
            );
          })
          .catch((err) => {
            logger.error(
              `DispatchEventHandler: Error during async processing of event "${eventType}" via ValidatedEventDispatcher.`,
              {
                error: err,
                eventType,
                payload,
              }
            );
          });
      } else if (typeof this.#dispatcher.dispatch === 'function') {
        // Fallback to EventBus interface
        Promise.resolve(this.#dispatcher.dispatch(eventType, payload))
          .then(() => {
            // Check listener count if the method exists (best effort)
            const listenerCount =
              typeof this.#dispatcher.listenerCount === 'function'
                ? this.#dispatcher.listenerCount(eventType)
                : NaN;
            if (listenerCount === 0) {
              logger.warn(
                `DispatchEventHandler: No listeners for event "${eventType}".`
              );
            } else {
              // Log success, handle NaN case for unknown count
              logger.debug(
                `DispatchEventHandler: Dispatched "${eventType}" to ${Number.isNaN(listenerCount) ? 'unknown' : listenerCount} listener(s) via EventBus.`
              );
            }
          })
          .catch((err) => {
            logger.error(
              `DispatchEventHandler: Error during dispatch of event "${eventType}" via EventBus.`,
              {
                error: err,
                eventType,
                payload,
              }
            );
          });
      } else {
        // This case should ideally be prevented by the constructor check
        logger.error(
          `DispatchEventHandler: Internal error – dispatcher lacks a recognised dispatch method. "${eventType}" not sent.`
        );
      }
    } catch (syncError) {
      logger.error(
        `DispatchEventHandler: Synchronous error occurred when trying to initiate dispatch for event "${eventType}".`,
        {
          error: syncError,
          eventType,
          payload,
        }
      );
    }
  }
}

export default DispatchEventHandler;
