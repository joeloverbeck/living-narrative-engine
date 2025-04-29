// src/logic/operationHandlers/dispatchEventHandler.js

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Correct type for 2nd arg
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

// --- External Utilities ---
import resolvePath from '../../utils/resolvePath.js';

// --- Handler Implementation ---
/**
 * Parameters accepted by {@link DispatchEventHandler#execute}.
 * @typedef {object} DispatchEventParameters
 * @property {string}                eventType                Namespaced event id.
 * @property {Record<string, any>=}  payload                  Optional payload object.
 */

class DispatchEventHandler {
    /** @type {ValidatedEventDispatcher | EventBus} */
    #dispatcher;
    /** @type {ILogger} */ // Logger dependency
    #logger;

    /**
     * --- MODIFIED: Added logger dependency ---
     * @param {object} deps
     * @param {ValidatedEventDispatcher|EventBus} deps.dispatcher
     * @param {ILogger} deps.logger - The logger service instance.
     * @throws {Error} If dependencies are invalid.
     */
    constructor({dispatcher, logger}) { // Added logger
        // Validate Dispatcher
        const dispatcherValid = dispatcher && (typeof dispatcher.dispatchValidated === 'function' || typeof dispatcher.dispatch === 'function');
        if (!dispatcherValid) {
            throw new Error('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
        }
        this.#dispatcher = dispatcher;

        // Validate Logger
        if (!logger || typeof logger.debug !== 'function') { // Basic check
            throw new Error('DispatchEventHandler requires a valid ILogger instance.');
        }
        this.#logger = logger; // Store injected logger
    }

    /**
     * Emit a new game-event.
     * --- MODIFIED: Uses this.#logger, uses evaluationContext for placeholders ---
     * @param {DispatchEventParameters|null|undefined} params
     * @param {JsonLogicEvaluationContext} evaluationContext - The dynamic rule context (event, actor, target, context vars).
     */
    execute(params, evaluationContext) { // Renamed second arg
        // -----------------------------------------------------------------------
        // 0 • Use injected logger
        // -----------------------------------------------------------------------
        const logger = this.#logger; // Use the logger injected via constructor

        // --- Logger validation during execution (optional, belt-and-suspenders) ---
        // const hasLogger = logger && ['debug', 'info', 'warn', 'error'].every((m) => typeof logger[m] === 'function');
        // if (!hasLogger) {
        //     console.error('DispatchEventHandler: CRITICAL - Injected logger is missing or invalid at execution time.', { loggerInstance: logger });
        //     return; // Cannot proceed
        // }
        // --- End optional validation ---


        // -----------------------------------------------------------------------
        // 1 • Validate params / eventType (unchanged logic)
        // -----------------------------------------------------------------------
        if (!params || typeof params.eventType !== 'string') {
            logger.error('DispatchEventHandler: Invalid or missing "eventType" parameter. Dispatch cancelled.', {params});
            return;
        }
        const eventType = params.eventType.trim();
        if (!eventType) {
            logger.error('DispatchEventHandler: Invalid or missing "eventType" parameter. Dispatch cancelled.', {params});
            return;
        }

        // -----------------------------------------------------------------------
        // 2 • Normalise payload & Resolve Placeholders using evaluationContext
        // -----------------------------------------------------------------------
        let rawPayload = params.payload ?? {};
        if (typeof rawPayload !== 'object' || rawPayload === null) {
            logger.warn(`DispatchEventHandler: Invalid 'payload' provided (expected object or null/undefined, got ${typeof rawPayload}). Defaulting to empty object {}.`, {
                eventType,
                providedPayload: rawPayload
            });
            rawPayload = {};
        }

        // Resolve placeholders against the evaluationContext object
        const payload = {};
        for (const [k, v] of Object.entries(rawPayload)) {
            if (typeof v === 'string' && v.startsWith('$')) {
                // Pass evaluationContext as the root for resolving $event, $actor, $context etc.
                const resolved = resolvePath(evaluationContext, v.slice(1));
                payload[k] = resolved !== undefined ? resolved : v; // Keep literal if not found
            } else {
                payload[k] = v;
            }
        }

        // -----------------------------------------------------------------------
        // 3 • Dispatch (uses logger correctly now)
        // -----------------------------------------------------------------------
        logger.debug(`DispatchEventHandler: Attempting to dispatch event "${eventType}"...`, {payload});
        try {
            // Prefer ValidatedEventDispatcher if available
            if (typeof this.#dispatcher.dispatchValidated === 'function') {
                this.#dispatcher.dispatchValidated(eventType, payload)
                    .then(() => {
                        logger.debug(`DispatchEventHandler: Event "${eventType}" dispatched (Validated).`);
                    })
                    .catch((err) => {
                        logger.error(`DispatchEventHandler: Error during async processing of event "${eventType}" via ValidatedEventDispatcher.`, {
                            error: err,
                            eventType,
                            payload
                        });
                    });
            }
            // Fallback to regular EventBus dispatch
            else if (typeof this.#dispatcher.dispatch === 'function') {
                Promise.resolve(this.#dispatcher.dispatch(eventType, payload))
                    .then(() => {
                        const listenerCount = typeof this.#dispatcher.listenerCount === 'function' ? this.#dispatcher.listenerCount(eventType) : NaN;
                        if (listenerCount === 0) {
                            logger.warn(`DispatchEventHandler: No listeners for event "${eventType}".`);
                        } else {
                            logger.debug(`DispatchEventHandler: Dispatched "${eventType}" to ${Number.isNaN(listenerCount) ? 'unknown' : listenerCount} listener(s) via EventBus.`);
                        }
                    })
                    .catch((err) => {
                        logger.error(`DispatchEventHandler: Error during dispatch of event "${eventType}" via EventBus.`, {
                            error: err,
                            eventType,
                            payload
                        });
                    });
            } else {
                // Should not happen due to constructor validation
                logger.error(`DispatchEventHandler: Internal error – dispatcher lacks a recognised dispatch method. "${eventType}" not sent.`);
            }
        } catch (syncError) {
            logger.error(`DispatchEventHandler: Synchronous error occurred when trying to initiate dispatch for event "${eventType}".`, {
                error: syncError,
                eventType,
                payload
            });
        }
    }
}

export default DispatchEventHandler;