// src/domUI/uiMessageRenderer.js
/**
 * @fileoverview Renders command echoes, general messages, and fatal errors
 * to a designated output container in the DOM.
 */

import RendererBase from './RendererBase.js';
import DomElementFactory from './domElementFactory.js'; // Assuming shared factory
import DocumentContext from './documentContext.js'; // To create context for factory

// --- Import Interfaces ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../core/eventBus.js').EventListener} EventListener */ // Type for listener functions
/** @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext */

// --- Import Event Payloads (assuming these structures exist based on DomRenderer) ---
/** @typedef {import('../eventSystem/payloads.js').EventCommandEchoPayload} EventCommandEchoPayload */
/** @typedef {import('../eventSystem/payloads.js').UIShowMessagePayload} UIShowMessagePayload */

/** @typedef {import('../eventSystem/payloads.js').UIShowFatalErrorPayload} UIShowFatalErrorPayload */

/**
 * Handles rendering messages, command echoes, and fatal errors to a specific DOM element.
 */
class UiMessageRenderer extends RendererBase {
    /** @private @type {HTMLElement} The root element where messages are appended. */
    #outputDiv;
    /** @private @type {DomElementFactory} Factory for creating DOM elements. */
    #factory;
    /**
     * @private
     * @type {Map<string, EventListener>} Map to store event names and their bound handler functions for disposal.
     * Key: eventName (string)
     * Value: bound handler function (EventListener)
     */
    #subscriptions = new Map();

    /**
     * Creates an instance of UiMessageRenderer.
     * @param {object} dependencies - The required dependencies.
     * @param {ILogger} dependencies.logger - Service for logging messages.
     * @param {ValidatedEventDispatcher} dependencies.ved - Service for dispatching/subscribing to validated events.
     * @param {HTMLElement} dependencies.outputDiv - The DOM element to render messages into.
     * @throws {Error} If outputDiv is not a valid HTMLElement.
     * @throws {Error} If required dependencies are missing or invalid (handled by RendererBase).
     */
    constructor({logger, ved, outputDiv}) {
        if (!outputDiv || !(outputDiv instanceof HTMLElement)) {
            throw new Error('UiMessageRenderer requires a valid outputDiv HTMLElement.');
        }

        // Create a specific DocumentContext for the outputDiv's ownerDocument
        const docContext = new DocumentContext(outputDiv);
        // Create a DomElementFactory using this context
        const factory = new DomElementFactory(docContext);

        // Pass core dependencies and the derived docContext to the base class
        super({logger, ved, docContext});

        this.#outputDiv = outputDiv;
        this.#factory = factory; // Store the factory instance

        this.#subscribeToEvents();
        this.logger.info(`${this._logPrefix} Initialized and subscribed to VED events.`);
    }

    /**
     * Subscribes to relevant events from the ValidatedEventDispatcher and stores handlers for disposal.
     * @private
     */
    #subscribeToEvents() {
        // Define event names and their corresponding bound handler methods
        const eventHandlers = {
            'event:command_echo': this.#handleCommandEcho.bind(this),
            'ui:show_message': this.#handleShowMessage.bind(this),
            'ui:show_fatal_error': this.#handleFatalError.bind(this),
        };

        // Iterate, subscribe, and store the handler for later unsubscribe
        for (const [eventName, handler] of Object.entries(eventHandlers)) {
            try {
                this.ved.subscribe(eventName, handler);
                this.#subscriptions.set(eventName, handler); // Store eventName and the *exact* bound function reference
                this.logger.debug(`${this._logPrefix} Subscribed to VED event: ${eventName}`);
            } catch (error) {
                this.logger.error(`${this._logPrefix} Failed to subscribe to VED event ${eventName}:`, error);
            }
        }

        this.logger.debug(`${this._logPrefix} Finished setting up ${this.#subscriptions.size} VED subscriptions.`);
    }

    // --- REMOVED: #findEventNameByHandler - No longer needed with the new subscription approach ---

    /**
     * Renders a message text into the output container.
     *
     * @param {string} text - The message content.
     * @param {string} [type='info'] - The type of message (e.g., 'info', 'error', 'warning', 'command', 'system'). Used for CSS styling.
     * @param {boolean} [allowHtml=false] - If true, the text is treated as HTML; otherwise, it's treated as plain text.
     * @returns {boolean} True if the message was rendered successfully, false otherwise.
     */
    render(text, type = 'info', allowHtml = false) {
        if (!this.#outputDiv || !this.#factory) {
            this.logger.error(`${this._logPrefix} Cannot render message - outputDiv or factory is not available.`);
            return false;
        }

        // Define valid message types for CSS class generation
        const validTypes = ['info', 'warning', 'error', 'success', 'debug', 'command', 'location', 'system', 'system-success'];
        const finalType = validTypes.includes(type) ? type : 'info';

        // Use the factory to create a paragraph element for the message
        const messageElement = this.#factory.p([`message`, `message--${finalType}`]); // Use BEM-like convention

        if (!messageElement) {
            this.logger.error(`${this._logPrefix} Failed to create message element using factory.`);
            // *** FIX 2: Return false on failure ***
            return false;
        }

        // Set content based on allowHtml flag
        if (allowHtml) {
            messageElement.innerHTML = text; // Be cautious with HTML injection
        } else {
            messageElement.textContent = text;
        }

        // Append to the output container
        this.#outputDiv.appendChild(messageElement);

        // Scroll to the bottom
        // Avoid error in test environments where layout properties might not be fully supported
        try {
            this.#outputDiv.scrollTop = this.#outputDiv.scrollHeight;
        } catch (e) {
            this.logger.warn(`${this._logPrefix} Could not set scrollTop, possibly due to test environment limitations.`, e);
        }


        this.logger.debug(`${this._logPrefix} Rendered message (type: ${finalType}, html: ${allowHtml}): "${text.substring(0, 50)}..."`);
        return true;
    }

    /**
     * Clears all messages from the output container.
     */
    clearOutput() {
        if (this.#outputDiv) {
            this.#outputDiv.innerHTML = '';
            this.logger.info(`${this._logPrefix} Output cleared.`);
        } else {
            this.logger.warn(`${this._logPrefix} Cannot clear output, outputDiv is null.`);
        }
    }


    // --- Private Event Handlers ---

    /**
     * Handles command echo events.
     * @private
     * @param {EventCommandEchoPayload} payload - The event payload.
     * @param {string} eventName - The name of the event.
     */
    #handleCommandEcho(payload, eventName) {
        if (payload && typeof payload.command === 'string') {
            this.render(`> ${payload.command}`, 'command', false); // Commands are usually plain text
        } else {
            this.logger.warn(`${this._logPrefix} Received '${eventName}' with invalid payload structure:`, payload);
        }
    }

    /**
     * Handles general message display events.
     * @private
     * @param {UIShowMessagePayload} payload - The event payload.
     * @param {string} eventName - The name of the event.
     */
    #handleShowMessage(payload, eventName) {
        if (payload && typeof payload.text === 'string') {
            // Type and allowHtml are optional in payload, default handled by render()
            this.render(payload.text, payload.type, payload.allowHtml);
        } else {
            this.logger.warn(`${this._logPrefix} Received '${eventName}' with invalid payload structure:`, payload);
        }
    }

    /**
     * Handles fatal error display events. Clears previous output first.
     * @private
     * @param {UIShowFatalErrorPayload} payload - The event payload.
     * @param {string} eventName - The name of the event.
     */
    #handleFatalError(payload, eventName) {
        if (payload && typeof payload.title === 'string' && typeof payload.message === 'string') {
            this.clearOutput(); // Clear previous messages on fatal error
            // Render title and message, allowing HTML for potential formatting
            this.render(`<strong>FATAL ERROR: ${payload.title}</strong><br>${payload.message}`, 'error', true);
            if (payload.details) {
                // Render details separately, potentially pre-formatted
                this.render(`Details: <pre>${payload.details}</pre>`, 'error', true);
            }
            this.logger.error(`${this._logPrefix} FATAL ERROR displayed via event '${eventName}': ${payload.title} - ${payload.message}`);
        } else {
            this.logger.warn(`${this._logPrefix} Received '${eventName}' with invalid payload structure:`, payload);
            // Render a generic fatal error message if payload is bad
            this.clearOutput();
            this.render('<strong>An unspecified fatal error occurred.</strong>', 'error', true);
        }
    }

    /**
     * Unsubscribes all event listeners this instance created by iterating through the stored handlers.
     * Should be called when the component is destroyed or no longer needed.
     */
    dispose() {
        let count = 0;
        // *** FIX for VED: Iterate stored handlers and call VED.unsubscribe ***
        this.#subscriptions.forEach((handler, eventName) => {
            try {
                // Call VED's unsubscribe with the event name and the stored handler function
                this.ved.unsubscribe(eventName, handler);
                count++;
                this.logger.debug(`${this._logPrefix} Unsubscribed from VED event: ${eventName}`);
            } catch (error) {
                this.logger.error(`${this._logPrefix} Error unsubscribing from VED event ${eventName}:`, error);
            }
        });
        this.#subscriptions.clear(); // Clear the internal map
        this.logger.info(`${this._logPrefix} Disposed ${count} event subscriptions.`);
    }
}

export default UiMessageRenderer;