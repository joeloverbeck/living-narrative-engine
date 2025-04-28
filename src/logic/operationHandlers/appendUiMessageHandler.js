// src/logic/operationHandlers/appendUiMessageHandler.js

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
// Optional: If you have a dedicated DomRenderer service to inject
/** @typedef {import('../../core/domRenderer.js').default} DomRenderer */

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
 * Finds a specified DOM container and appends a new message element to it,
 * using provided text and type for content and styling.
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

    // --- Option 1: Inject DomRenderer (Preferred) ---
    // /**
    //  * @private
    //  * @readonly
    //  * @type {DomRenderer}
    //  */
    // #domRenderer;

    /**
     * Creates an instance of AppendUiMessageHandler.
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger - Logging service.
     * @param {DomRenderer} [dependencies.domRenderer] - Optional: UI rendering service. If provided, DOM manipulation will be delegated.
     * @throws {Error} If logger is not a valid ILogger instance.
     */
    constructor({ logger, domRenderer }) {
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('AppendUiMessageHandler requires a valid ILogger instance.');
        }
        this.#logger = logger;

        // --- Option 1: Store injected DomRenderer ---
        // if (domRenderer && typeof domRenderer.renderMessage === 'function') {
        //     this.#domRenderer = domRenderer;
        //     this.#logger.debug("AppendUiMessageHandler initialized with DomRenderer delegation.");
        // } else {
        //     this.#logger.debug("AppendUiMessageHandler initialized for direct DOM manipulation (DomRenderer not provided or invalid).");
        // }
    }

    /**
     * Executes the APPEND_UI_MESSAGE operation.
     * Appends a message div to the specified container element.
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
            logger.error('APPEND_UI_MESSAGE: Invalid or missing required "text" parameter.', { params });
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

        logger.debug(`APPEND_UI_MESSAGE: Attempting to append message to selector "${selector}"`, {
            text: messageText, // Log the actual text being used
            type: messageType,
            allowHtml: allowHtml
        });

        // --- Option 1: Delegate to DomRenderer (if injected) ---
        // if (this.#domRenderer) {
        //     try {
        //         // Check if DomRenderer's renderMessage matches the needs exactly.
        //         // It takes (message, type). If we need custom selectors or allowHtml,
        //         // DomRenderer might need adjustments or we stick to direct DOM manipulation.
        //         // Assuming renderMessage handles selector implicitly (#outputDiv) and doesn't support allowHtml directly:
        //         if (selector === '#outputDiv' && !allowHtml) {
        //              this.#domRenderer.renderMessage(messageText, messageType);
        //              logger.debug(`APPEND_UI_MESSAGE: Delegated message rendering to DomRenderer.`);
        //              return; // Handled by renderer
        //         } else {
        //             logger.warn(`APPEND_UI_MESSAGE: Cannot delegate to DomRenderer due to non-default selector ('${selector}') or allowHtml=true. Falling back to direct DOM manipulation.`);
        //              // Fall through to direct DOM manipulation below
        //         }
        //     } catch (renderError) {
        //          logger.error(`APPEND_UI_MESSAGE: Error occurred while delegating to DomRenderer.`, { error: renderError });
        //          return; // Stop execution on renderer error
        //     }
        // }

        // --- Option 2: Direct DOM Manipulation (Fallback or if no DomRenderer) ---
        try {
            const containerElement = document.querySelector(selector);

            if (!containerElement) {
                logger.error(`APPEND_UI_MESSAGE: Container element not found for selector "${selector}". Cannot append message.`);
                return;
            }

            // Create the new message element
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', `message-${messageType}`); // Add base and type-specific class

            // Set content safely based on allow_html flag
            if (allowHtml) {
                messageDiv.innerHTML = messageText; // Use innerHTML if allowed
            } else {
                messageDiv.textContent = messageText; // Use textContent for safety (default)
            }

            // Append the new message
            containerElement.appendChild(messageDiv);

            // Scroll the container to make the new message visible
            // Ensure scroll happens after the element is added and rendered
            // requestAnimationFrame(() => { // Defer scroll slightly if needed
            containerElement.scrollTop = containerElement.scrollHeight;
            // });


            logger.debug(`APPEND_UI_MESSAGE: Successfully appended message to "${selector}".`);

        } catch (error) {
            logger.error(`APPEND_UI_MESSAGE: Error during direct DOM manipulation for selector "${selector}".`, {
                error: error,
                params: params
            });
        }
    }
}

export default AppendUiMessageHandler;