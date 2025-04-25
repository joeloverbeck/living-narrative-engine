// src/logic/operationHandlers/dispatchEventHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
/** @typedef {import('../../core/eventBus.js').default} EventBus */ // For fallback type hinting
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

/**
 * @typedef {object} DispatchEventOperationParams
 * @property {string} eventType - The type/ID of the event to dispatch (e.g., "PLAYER_LEVEL_UP").
 * @property {object} [payload] - The data payload associated with the event. Defaults to an empty object if omitted or null/undefined.
 */

/**
 * @class DispatchEventHandler
 * Implements the OperationHandler interface for the "DISPATCH_EVENT" operation type.
 * Takes an event type and payload from parameters and dispatches a new event
 * using the injected ValidatedEventDispatcher or EventBus.
 *
 * @implements {OperationHandler}
 */
class DispatchEventHandler {
    /**
     * The event dispatching service (preferably ValidatedEventDispatcher).
     * @private
     * @readonly
     * @type {ValidatedEventDispatcher | EventBus}
     */
    #dispatcher;

    /**
     * Creates an instance of DispatchEventHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {ValidatedEventDispatcher | EventBus} dependencies.dispatcher - The event dispatching service. ValidatedEventDispatcher is preferred.
     * @throws {Error} If dispatcher is missing or invalid (doesn't have dispatchValidated or publish method).
     */
    constructor({ dispatcher }) {
        // Prefer ValidatedEventDispatcher, fallback check for EventBus
        const hasDispatchValidated = dispatcher && typeof dispatcher.dispatchValidated === 'function';
        const hasPublish = dispatcher && typeof dispatcher.publish === 'function';

        if (!hasDispatchValidated && !hasPublish) {
            throw new Error('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
        }
        this.#dispatcher = dispatcher;
    }

    /**
     * Executes the DISPATCH_EVENT operation.
     * Validates parameters, constructs the event, and calls the dispatcher's method.
     * Uses `dispatchValidated` if available (ValidatedEventDispatcher), otherwise `publish` (EventBus).
     * Note: This handler executes synchronously. Asynchronous dispatch operations
     * (like `dispatchValidated`) are initiated but not awaited. Their success/failure
     * occurs later, potentially logging errors via the dispatcher's own logger or the catch block here.
     *
     * @param {OperationParams | DispatchEventOperationParams | null | undefined} params - The parameters for the DISPATCH_EVENT operation. Expected properties: `eventType` (string, required), `payload` (object, optional).
     * @param {ExecutionContext} executionContext - The context of the execution, containing logger etc.
     * @returns {void}
     */
    execute(params, executionContext) {
        // --- 1. Get Logger from Context ---
        const logger = executionContext?.logger;
        if (!logger || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            // Log to console as a last resort if context logger is unusable
            console.error('DispatchEventHandler: Critical - Missing or invalid logger in execution context.', { context: executionContext });
            // Cannot proceed reliably without logging capability.
            return;
        }

        // --- 2. Validate Parameters ---
        if (!params || typeof params.eventType !== 'string' || !params.eventType.trim()) {
            logger.error('DispatchEventHandler: Invalid or missing "eventType" parameter. Dispatch cancelled.', { params });
            return; // Stop execution
        }

        const eventType = params.eventType.trim();
        let payload = params.payload ?? {}; // Default payload to empty object if null/undefined

        // Ensure payload is actually an object if provided
        if (typeof payload !== 'object' || payload === null) {
            logger.warn(`DispatchEventHandler: Invalid 'payload' provided (expected object or null/undefined, got ${typeof params.payload}). Defaulting to empty object {}.`, { eventType, providedPayload: params.payload });
            payload = {};
        }

        // --- 3. Dispatch Event ---
        logger.debug(`DispatchEventHandler: Attempting to dispatch event "${eventType}"...`, { payload });

        try {
            if (typeof this.#dispatcher.dispatchValidated === 'function') {
                // Use ValidatedEventDispatcher (preferred) - Fire and forget with async error handling
                this.#dispatcher.dispatchValidated(eventType, payload)
                    .then(dispatched => {
                        // Validation/dispatch results are handled by ValidatedEventDispatcher's logging
                        if (dispatched) {
                            logger.debug(`DispatchEventHandler: Event "${eventType}" dispatch process initiated via ValidatedEventDispatcher.`);
                        } else {
                            // Logged as error/warn by ValidatedEventDispatcher already
                            logger.debug(`DispatchEventHandler: ValidatedEventDispatcher reported event "${eventType}" was not dispatched (validation fail/skip).`);
                        }
                    })
                    .catch(error => {
                        // Catch async errors from the dispatchValidated promise itself
                        logger.error(`DispatchEventHandler: Error during asynchronous processing of event "${eventType}" dispatch via ValidatedEventDispatcher.`, { error, eventType, payload });
                    });
            } else if (typeof this.#dispatcher.publish === 'function') {
                // Fallback to basic EventBus (synchronous publish)
                this.#dispatcher.publish(eventType, payload);
                logger.debug(`DispatchEventHandler: Event "${eventType}" published via EventBus.`);
            } else {
                // This case should not be reachable due to constructor validation
                logger.error(`DispatchEventHandler: Internal Error - Dispatcher instance is invalid (no dispatchValidated or publish method). Event "${eventType}" not dispatched.`);
            }
        } catch (syncError) {
            // Catch potential synchronous errors if calling the dispatch/publish method itself fails immediately
            logger.error(`DispatchEventHandler: Synchronous error occurred when trying to initiate dispatch for event "${eventType}".`, { error: syncError, eventType, payload });
        }
    }
}

export default DispatchEventHandler;