// src/logic/operationHandlers/appendUiMessageHandler.js
// --- REFACTORED to use UiMessageRenderer ---

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
/** @typedef {import('../../domUI/uiMessageRenderer.js').UiMessageRenderer} UiMessageRenderer */ // Import the correct renderer

/**
 * Parameters for the APPEND_UI_MESSAGE operation.
 * Note: Assumes placeholders in text/message_type are resolved before execution.
 * @typedef {object} AppendUiMessageParams
 * @property {string} [selector='#outputDiv'] - CSS selector for the container element. (NOTE: Now IGNORED by this handler due to UiMessageRenderer)
 * @property {string} text - The message content (required, pre-resolved).
 * @property {string} [message_type='info'] - The type hint for styling (pre-resolved).
 * @property {boolean} [allow_html=false] - Whether to treat 'text' as HTML.
 */

/**
 * @class AppendUiMessageHandler
 * Implements the OperationHandler interface for the "APPEND_UI_MESSAGE" operation type.
 * Delegates to UiMessageRenderer to append a new message element to the standard message list.
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
     * @type {UiMessageRenderer} // Dependency changed
     */
    #uiMessageRenderer; // Now required and stored

    /**
     * Creates an instance of AppendUiMessageHandler.
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger - Logging service.
     * @param {UiMessageRenderer} dependencies.uiMessageRenderer - UI message rendering service. Required.
     * @throws {Error} If logger is not a valid ILogger instance.
     * @throws {Error} If uiMessageRenderer is not provided or invalid.
     */
    constructor({logger, uiMessageRenderer}) {
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('AppendUiMessageHandler requires a valid ILogger instance.');
        }
        // Check if uiMessageRenderer has the expected 'render' method
        if (!uiMessageRenderer || typeof uiMessageRenderer.render !== 'function') {
            throw new Error('AppendUiMessageHandler requires a valid UiMessageRenderer instance.');
        }
        this.#logger = logger;
        this.#uiMessageRenderer = uiMessageRenderer; // Store uiMessageRenderer
        this.#logger.debug("AppendUiMessageHandler initialized with UiMessageRenderer."); // Update log message
    }

    /**
     * Executes the APPEND_UI_MESSAGE operation.
     * Delegates message rendering to the UiMessageRenderer.
     *
     * @param {OperationParams | AppendUiMessageParams | null | undefined} params - The parameters for the operation.
     * @param {ExecutionContext} executionContext - The context of the execution (used for logging).
     * @returns {void}
     */
    execute(params, executionContext) {
        const logger = executionContext?.logger ?? this.#logger;

        // --- DEBUG: Log raw parameters received ---
        logger.debug('APPEND_UI_MESSAGE: Received params:', params);
        // --- END DEBUG ---

        // 1. Validate Parameters
        // Check if params exist and text is a non-empty string (as it's required)
        if (!params || typeof params.text !== 'string' || !params.text.trim()) {
            logger.error('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', {params});
            return;
        }

        // 2. Determine Parameter Values (with defaults from schema)
        const selector = (typeof params.selector === 'string' && params.selector.trim())
            ? params.selector.trim()
            : '#outputDiv'; // Default selector (but will be ignored)
        const messageText = params.text; // Already validated as non-empty string
        const messageType = (typeof params.message_type === 'string' && params.message_type.trim())
            ? params.message_type.trim()
            : 'info'; // Default type
        const allowHtml = typeof params.allow_html === 'boolean'
            ? params.allow_html
            : false; // Default allow_html

        logger.debug(`APPEND_UI_MESSAGE: Attempting to append message via UiMessageRenderer`, {
            text: messageText,
            type: messageType,
            allowHtml: allowHtml,
            originalSelector: selector // Log the selector received, even if unused
        });

        // --- Log if selector was provided but is ignored ---
        if (params.selector && selector !== '#outputDiv') {
            logger.warn(`APPEND_UI_MESSAGE: The 'selector' parameter ("${selector}") is provided but ignored. UiMessageRenderer always targets the default message list.`);
        }

        // 3. Delegate Rendering to UiMessageRenderer
        try {
            // Call UiMessageRenderer's render method
            this.#uiMessageRenderer.render(
                messageText,
                messageType,
                allowHtml
            );
            // Assume success if no error is thrown by UiMessageRenderer
            logger.debug(`APPEND_UI_MESSAGE: Successfully delegated message rendering to UiMessageRenderer.`);

        } catch (error) {
            // Catch errors specifically from the UiMessageRenderer call
            logger.error(`APPEND_UI_MESSAGE: Error occurred while calling UiMessageRenderer.render.`, {
                error: error,
                params: { // Log the parameters used for the call
                    text: messageText,
                    type: messageType,
                    allowHtml: allowHtml
                }
            });
        }
    }
}

export default AppendUiMessageHandler;