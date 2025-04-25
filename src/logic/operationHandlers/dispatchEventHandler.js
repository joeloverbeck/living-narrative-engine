// src/logic/operationHandlers/dispatchEventHandler.js

// -----------------------------------------------------------------------------
// JSDoc imports (for editors / IDE-help only)
// -----------------------------------------------------------------------------
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger}  ILogger */
/** @typedef {import('../defs.js').ExecutionContext}                    ExecutionContext */
/** @typedef {import('../../core/eventBus.js').default}                 EventBus */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

// -----------------------------------------------------------------------------
// External utilities
// -----------------------------------------------------------------------------
import resolvePath from '../../utils/resolvePath.js';

// -----------------------------------------------------------------------------
// Handler implementation
// -----------------------------------------------------------------------------
/**
 * Parameters accepted by {@link DispatchEventHandler#execute}.
 * @typedef {object} DispatchEventParameters
 * @property {string}                eventType                Namespaced event id.
 * @property {Record<string, any>=}  payload                  Optional payload object.
 */

class DispatchEventHandler {
    /** @type {ValidatedEventDispatcher | EventBus} */
    #dispatcher;

    /**
     * @param {{dispatcher: ValidatedEventDispatcher|EventBus}} deps
     */
    constructor({dispatcher}) {
        const valid =
            dispatcher &&
            (typeof dispatcher.dispatchValidated === 'function' ||
                typeof dispatcher.publish === 'function');

        if (!valid) {
            throw new Error(
                'DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.'
            );
        }
        this.#dispatcher = dispatcher;
    }

    /**
     * Emit a new game-event according to refined spec T-03.
     * @param {DispatchEventParameters|null|undefined} params
     * @param {ExecutionContext}                       executionContext
     */
    execute(params, executionContext) {
        // -----------------------------------------------------------------------
        // 0 • Grab logger — abort hard if unusable
        // -----------------------------------------------------------------------
        const logger = executionContext?.logger;
        const hasLogger =
            logger &&
            ['debug', 'info', 'warn', 'error'].every((m) => typeof logger[m] === 'function');
        if (!hasLogger) {
            console.error(
                'DispatchEventHandler: Critical - Missing or invalid logger in execution context.',
                {context: executionContext}
            );
            return;
        }

        // -----------------------------------------------------------------------
        // 1 • Validate params / eventType
        // -----------------------------------------------------------------------
        if (!params || typeof params.eventType !== 'string') {
            logger.error(
                'DispatchEventHandler: Invalid or missing "eventType" parameter. Dispatch cancelled.',
                {params}
            );
            return;
        }

        const eventType = params.eventType.trim();
        if (!eventType) {
            logger.error(
                'DispatchEventHandler: Invalid or missing "eventType" parameter. Dispatch cancelled.',
                {params}
            );
            return;
        }

        // -----------------------------------------------------------------------
        // 2 • Normalise payload
        // -----------------------------------------------------------------------
        let rawPayload = params.payload ?? {};
        if (typeof rawPayload !== 'object' || rawPayload === null) {
            logger.warn(
                `DispatchEventHandler: Invalid 'payload' provided (expected object or null/undefined, got ${typeof rawPayload}). Defaulting to empty object {}.`,
                {eventType, providedPayload: rawPayload}
            );
            rawPayload = {};
        }

        // Shallow-clone & substitute placeholders
        const evaluationRoot = executionContext.evaluationContext;
        const payload = {};
        for (const [k, v] of Object.entries(rawPayload)) {
            if (typeof v === 'string' && v.startsWith('$')) {
                const resolved = resolvePath(evaluationRoot, v.slice(1));
                payload[k] = resolved !== undefined ? resolved : v; // leave literal if not found
            } else {
                payload[k] = v;
            }
        }

        // -----------------------------------------------------------------------
        // 3 • Dispatch
        // -----------------------------------------------------------------------
        logger.debug(`DispatchEventHandler: Attempting to dispatch event "${eventType}"...`, {
            payload
        });

        try {
            if (typeof this.#dispatcher.dispatchValidated === 'function') {
                // Preferred path — fire & forget
                this.#dispatcher
                    .dispatchValidated(eventType, payload)
                    .then(() => {
                        logger.debug(`DispatchEventHandler: Event "${eventType}" dispatched (Validated).`);
                    })
                    .catch((err) => {
                        logger.error(
                            `DispatchEventHandler: Error during asynchronous processing of event "${eventType}" dispatch via ValidatedEventDispatcher.`,
                            {error: err, eventType, payload}
                        );
                    });
            } else if (typeof this.#dispatcher.publish === 'function') {
                // Fallback to plain EventBus
                Promise.resolve(this.#dispatcher.publish(eventType, payload))
                    .then(() => {
                        const listenerCount =
                            typeof this.#dispatcher.listenerCount === 'function'
                                ? this.#dispatcher.listenerCount(eventType)
                                : NaN;

                        if (listenerCount === 0) {
                            logger.warn(`DispatchEventHandler: No listeners for event "${eventType}".`);
                        } else {
                            logger.debug(
                                `DispatchEventHandler: Dispatched "${eventType}" to ${Number.isNaN(
                                    listenerCount
                                )
                                    ? 'unknown'
                                    : listenerCount} listener(s) via EventBus.`
                            );
                        }
                    })
                    .catch((err) => {
                        logger.error(
                            `DispatchEventHandler: Error during asynchronous publish of event "${eventType}" via EventBus.`,
                            {error: err, eventType, payload}
                        );
                    });
            } else {
                // Shouldn’t happen – constructor guards against it
                logger.error(
                    `DispatchEventHandler: Internal error – dispatcher lacks a recognised dispatch method. "${eventType}" not sent.`
                );
            }
        } catch (syncError) {
            logger.error(
                `DispatchEventHandler: Synchronous error occurred when trying to initiate dispatch for event "${eventType}".`,
                {error: syncError, eventType, payload}
            );
        }
    }
}

export default DispatchEventHandler;