// src/logic/operationHandlers/appendUiMessageHandler.js

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
/** @typedef {import('../../core/domRenderer.js').default} DomRenderer */ // Now required

/**
 * Parameters for the APPEND_UI_MESSAGE operation.
 * Note: Assumes placeholders in text/message_type are resolved before execution.
 * @typedef {object} AppendUiMessageParams
 * @property {string} [selector='#outputDiv'] - CSS selector for the container element.
 * @property {string} text - The message content (required, pre-resolved).
 * @property {string} [message_type='info'] - The type hint for styling (pre-resolved).
 * @property {boolean} [allow_html=false] - Whether to treat 'text' as HTML.
 */

/**
 * @class AppendUiMessageHandler
 * Implements the OperationHandler interface for the "APPEND_UI_MESSAGE" operation type.
 * Delegates to DomRenderer to append a new message element to a specified DOM container.
 *
 * @implements {OperationHandler}
 */
class AppendUiMessageHandler {
    /**
     * @private
     * @readonly
     * @type {ILogger}
     */
    #logger;

    /**
     * @private
     * @readonly
     * @type {DomRenderer}
     */
    #domRenderer; // Now required and stored

    /**
     * Creates an instance of AppendUiMessageHandler.
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger - Logging service.
     * @param {DomRenderer} dependencies.domRenderer - UI rendering service. Required for DOM manipulation.
     * @throws {Error} If logger is not a valid ILogger instance.
     * @throws {Error} If domRenderer is not provided.
     */
    constructor({logger, domRenderer}) {
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('AppendUiMessageHandler requires a valid ILogger instance.');
        }
        if (!domRenderer) { // Add check
            throw new Error('DomRenderer required');
        }
        this.#logger = logger;
        this.#domRenderer = domRenderer; // Store domRenderer
        this.#logger.debug("AppendUiMessageHandler initialized with DomRenderer."); // Update log message
    }

    /**
     * Executes the APPEND_UI_MESSAGE operation.
     * Delegates message rendering to the DomRenderer.
     *
     * @param {OperationParams | AppendUiMessageParams | null | undefined} params - The parameters for the operation.
     * @param {ExecutionContext} executionContext - The context of the execution (used for logging).
     * @returns {void}
     */
    execute(params, executionContext) {
        const logger = executionContext?.logger ?? this.#logger;

        // 1. Validate Parameters
        // Check if params exist and text is a non-empty string (as it's required)
        if (!params || typeof params.text !== 'string' || !params.text.trim()) {
            logger.error('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params});
            return;
        }

        // 2. Determine Parameter Values (with defaults from schema)
        const selector = (typeof params.selector === 'string' && params.selector.trim())
            ? params.selector.trim()
            : '#outputDiv'; // Default selector
        const messageText = params.text; // Already validated as non-empty string
        const messageType = (typeof params.message_type === 'string' && params.message_type.trim())
            ? params.message_type.trim()
            : 'info'; // Default type
        const allowHtml = typeof params.allow_html === 'boolean'
            ? params.allow_html
            : false; // Default allow_html

        logger.debug(`APPEND_UI_MESSAGE: Attempting to append message via DomRenderer to selector "${selector}"`, {
            text: messageText, // Log the actual text being used
            type: messageType,
            allowHtml: allowHtml
        });

        // 3. Delegate Rendering to DomRenderer
        try {
            const ok = this.#domRenderer.renderMessage(
                messageText,
                messageType,
                {selector, allowHtml} // Pass options object
            );
            if (!ok) {
                // Error already logged by DomRenderer presumably, but log failure here too.
                logger.error('APPEND_UI_MESSAGE: Failed to render via DomRenderer.');
            } else {
                logger.debug(`APPEND_UI_MESSAGE: Successfully rendered message via DomRenderer to "${selector}".`);
            }
        } catch (error) {
            logger.error(`APPEND_UI_MESSAGE: Error occurred while calling DomRenderer for selector "${selector}".`, {
                error: error,
                params: params
            });
        }
        // Direct DOM Manipulation branch removed as requested.
    }
}

export default AppendUiMessageHandler;