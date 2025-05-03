// src/domUI/uiMessageRenderer.js
// ****** CORRECTED FILE ******

import {RendererBase} from './rendererBase.js';
import DomElementFactory from './domElementFactory.js'; // Keep this import

/**
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 * @typedef {import('./domElementFactory').DomElementFactory} DomElementFactory
 */

/**
 * @typedef {'info' | 'error' | 'echo' | 'fatal'} MessageType
 */

/**
 * @class UiMessageRenderer
 * @extends RendererBase
 * @description Handles rendering general messages, command echoes, and fatal errors to the UI.
 */
export class UiMessageRenderer extends RendererBase {
    /** @private @type {HTMLElement|null} */
    #messageList = null;
    /** @private @type {DomElementFactory} */
    #domElementFactory;
    /** @private @type {Array<IEventSubscription>} */
    #subscriptions = [];

    /**
     * Creates an instance of UiMessageRenderer.
     * @param {object} dependencies - The dependencies object.
     * @param {ILogger} dependencies.logger - The logger instance.
     * @param {IDocumentContext} dependencies.documentContext - The document context abstraction.
     * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The validated event dispatcher.
     * @param {DomElementFactory} dependencies.domElementFactory - The DOM element factory.
     * @throws {Error} If the DomElementFactory dependency is missing or invalid.
     */
    constructor({logger, documentContext, validatedEventDispatcher, domElementFactory}) {
        // Pass the relevant dependencies in an object map to the base constructor
        super({logger, documentContext, validatedEventDispatcher});

        // Validate and store the factory dependency specific to this class
        if (!domElementFactory || typeof domElementFactory.create !== 'function') { // Added check for factory validity
            throw new Error(`${this.constructor.name}: DomElementFactory dependency is missing or invalid.`);
        }
        this.#domElementFactory = domElementFactory;

        this.#ensureMessageList();

        // Subscribe to events via VED (validatedEventDispatcher is now available via this.validatedEventDispatcher from base)
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe('textUI:display_message', this.#onShow.bind(this))
        );
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe('core:system_error_occurred', this.#onShowFatal.bind(this))
        );
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe('core:action_executed', this.#onCommandEcho.bind(this))
        );
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe('core:action_failed', this.#onCommandEcho.bind(this))
        );

        // Logger is available via this.logger from base
        this.logger.debug(`${this._logPrefix} Subscribed to VED events.`);
    }

    /**
     * Finds or creates the message list container element.
     * @private
     */
    #ensureMessageList() {
        if (!this.#messageList) {
            // Use documentContext from base class
            this.#messageList = this.documentContext.query('#message-list');
            if (!this.#messageList) {
                // Use logger from base class
                this.logger.error(`${this._logPrefix} Could not find #message-list element!`);
                const mainContent = this.documentContext.query('#main-content');
                if (mainContent && this.#domElementFactory) { // Check factory exists
                    this.#messageList = this.#domElementFactory.ul('message-list'); // Create UL
                    if (this.#messageList) { // Check creation succeeded
                        this.#messageList.classList.add('message-list'); // Add class separately
                        mainContent.appendChild(this.#messageList);
                        this.logger.warn(`${this._logPrefix} #message-list created dynamically.`);
                    } else {
                        this.logger.error(`${this._logPrefix} Failed to create #message-list element dynamically.`);
                        this.#messageList = null; // Explicitly null if creation failed
                    }
                } else if (!mainContent) {
                    this.logger.error(`${this._logPrefix} Cannot find #main-content to append message list.`);
                    this.#messageList = null; // Explicitly null
                } else {
                    // Factory missing case (should have been caught in constructor)
                    this.logger.error(`${this._logPrefix} Cannot create #message-list dynamically due to missing factory.`);
                    this.#messageList = null;
                }
            }
        }
        // Handle the case where messageList is still null after attempts
        if (!this.#messageList) {
            this.logger.error(`${this._logPrefix} Failed to find or create #message-list. Messages may not be displayed.`);
            // Optionally create a dummy element to prevent errors later, or just accept messages won't render
            // this.#messageList = document.createElement('ul'); // Or use factory if possible, but it might be the issue
        }
    }


    /**
     * Renders a message to the UI.
     * @param {string} text - The message text.
     * @param {MessageType} [type='info'] - The type of message ('info', 'error', 'echo', 'fatal').
     * @param {boolean} [allowHtml=false] - Whether to render the text as HTML.
     */
    render(text, type = 'info', allowHtml = false) {
        this.#ensureMessageList(); // Make sure the list exists

        // Check if the list exists and is a valid element before proceeding
        if (!this.#messageList || typeof this.#messageList.appendChild !== 'function') {
            this.logger.error(`${this._logPrefix} Cannot render message, list element invalid or not found. Type: ${type}, Text: ${text.substring(0, 100)}`);
            return;
        }
        // Check if factory exists before using it
        if (!this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render message, DomElementFactory is missing.`);
            return;
        }


        // Use factory to create the list item
        const messageItem = this.#domElementFactory.li(null); // Create li element
        if (!messageItem) {
            this.logger.error(`${this._logPrefix} Failed to create message item element.`);
            return;
        }

        // Add classes using classList API for safety
        messageItem.classList.add('message', `message-${type}`);


        if (allowHtml) {
            messageItem.innerHTML = text; // Be cautious with HTML rendering
        } else {
            messageItem.textContent = text;
        }

        this.#messageList.appendChild(messageItem);
        this.#scrollToBottom();
        // Use logger from base
        this.logger.debug(`${this._logPrefix} Rendered message: ${type} - ${text.substring(0, 50)}...`);
    }

    /**
     * Handles the 'textUI:display_message' event from VED.
     * @private
     * @param {object} payload - The event payload.
     * @param {string} payload.message - The text to display.
     * @param {MessageType} [payload.type='info'] - The message type.
     * @param {boolean} [payload.allowHtml=false] - Whether HTML is allowed.
     */
    #onShow(payload) {
        // Validate payload structure before rendering
        if (payload && typeof payload.message === 'string') {
            this.render(payload.message, payload.type || 'info', payload.allowHtml || false);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid 'textUI:display_message' payload.`, payload);
        }
    }

    /**
     * Handles the 'core:system_error_occurred' event from VED.
     * @private
     * @param {object} payload - The event payload.
     * @param {string} payload.message - The error message text.
     * @param {Error} [payload.error] - Optional associated error object.
     */
    #onShowFatal(payload) {
        // Validate payload
        if (!payload || typeof payload.message !== 'string') {
            this.logger.error(`${this._logPrefix} Received invalid 'core:system_error_occurred' payload.`, payload);
            this.render('An unspecified fatal system error occurred.', 'fatal'); // Render a generic message
            return;
        }

        let message = payload.message;
        if (payload.error && payload.error.message) {
            message += `\nDetails: ${payload.error.message}`;
        }
        this.logger.fatal(`${this._logPrefix} Fatal error displayed: ${message}`); // Use logger from base
        this.render(message, 'fatal', false); // Render as plain text for safety
    }

    /**
     * Handles command echo events ('core:action_executed', 'core:action_failed') from VED.
     * @private
     * @param {object} payload - The event payload.
     * @param {string} payload.originalInput - The original command input by the player.
     */
    #onCommandEcho(payload) {
        if (payload && typeof payload.originalInput === 'string' && payload.originalInput.trim()) {
            this.render(`> ${payload.originalInput}`, 'echo');
        } else {
            // Use logger from base
            this.logger.warn(`${this._logPrefix} Received command echo event without valid originalInput.`, payload);
        }
    }

    /**
     * Scrolls the message list to the bottom.
     * @private
     */
    #scrollToBottom() {
        if (this.#messageList && typeof this.#messageList.scrollTop !== 'undefined') { // Check scroll properties exist
            this.#messageList.scrollTop = this.#messageList.scrollHeight;
        } else if (this.#messageList) {
            // Fallback for environments where scroll properties might not behave as expected initially
            // or for elements that aren't scrollable containers themselves.
            this.#messageList.scrollIntoView?.({behavior: 'smooth', block: 'end'});
        }
    }

    /**
     * Unsubscribes from all VED events.
     */
    dispose() {
        // Use logger from base
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => sub.unsubscribe());
        this.#subscriptions = [];
        super.dispose(); // Call base dispose
    }
}