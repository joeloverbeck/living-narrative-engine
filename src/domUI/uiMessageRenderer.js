// src/domUI/uiMessageRenderer.js
import {RendererBase} from './rendererBase.js';
import DomElementFactory from './domElementFactory.js';

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
    #factory;
    /** @private @type {Array<IEventSubscription>} */
    #subscriptions = [];

    /**
     * @param {ILogger} logger
     * @param {IDocumentContext} doc
     * @param {IValidatedEventDispatcher} ved
     * @param {DomElementFactory} factory
     */
    constructor(logger, doc, ved, factory) {
        super(logger, doc, ved); // VED is now passed here

        if (!factory) throw new Error(`${this.constructor.name}: DomElementFactory dependency is missing.`);
        this.#factory = factory;

        this.#ensureMessageList();

        // Subscribe to events via VED
        this.#subscriptions.push(
            this.ved.subscribe('textUI:display_message', this.#onShow.bind(this))
        );
        this.#subscriptions.push(
            this.ved.subscribe('core:system_error_occurred', this.#onShowFatal.bind(this))
        );
        this.#subscriptions.push(
            this.ved.subscribe('core:action_executed', this.#onCommandEcho.bind(this))
        );
        this.#subscriptions.push(
            this.ved.subscribe('core:action_failed', this.#onCommandEcho.bind(this))
        );

        this.logger.debug(`[${this.constructor.name}] Subscribed to VED events.`);
    }

    /**
     * Finds or creates the message list container element.
     * @private
     */
    #ensureMessageList() {
        if (!this.#messageList) {
            this.#messageList = this.doc.query('#message-list');
            if (!this.#messageList) {
                this.logger.error('[UiMessageRenderer] Could not find #message-list element!');
                const mainContent = this.doc.query('#main-content');
                if (mainContent) {
                    this.#messageList = this.#factory.ul('message-list', ['message-list']);
                    mainContent.appendChild(this.#messageList);
                    this.logger.warn('[UiMessageRenderer] #message-list created dynamically.');
                } else {
                    this.logger.error('[UiMessageRenderer] Cannot find #main-content to append message list.');
                    this.#messageList = this.#factory.ul('message-list-fallback', []);
                }
            }
        }
        if (!this.#messageList) {
            this.logger.fatal('[UiMessageRenderer] Failed to find or create #message-list. Messages will not be displayed.');
            this.#messageList = this.#factory.ul('message-list-dummy', []);
        }
    }

    /**
     * Renders a message to the UI.
     * @param {string} text - The message text.
     * @param {MessageType} [type='info'] - The type of message ('info', 'error', 'echo', 'fatal').
     * @param {boolean} [allowHtml=false] - Whether to render the text as HTML.
     */
    render(text, type = 'info', allowHtml = false) {
        this.#ensureMessageList();
        if (!this.#messageList || !this.#messageList.appendChild) { // Extra check for valid element
            this.logger.error(`[UiMessageRenderer] Cannot render message, list element invalid or not found. Type: ${type}, Text: ${text}`);
            return;
        }

        const messageItem = this.#factory.li(null, ['message', `message-${type}`]);

        if (allowHtml) {
            messageItem.innerHTML = text;
        } else {
            messageItem.textContent = text;
        }

        this.#messageList.appendChild(messageItem);
        this.#scrollToBottom();
        this.logger.debug(`[UiMessageRenderer] Rendered message: ${type} - ${text.substring(0, 50)}...`);
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
        this.render(payload.message, payload.type || 'info', payload.allowHtml || false);
    }

    /**
     * Handles the 'core:system_error_occurred' event from VED.
     * @private
     * @param {object} payload - The event payload.
     * @param {string} payload.message - The error message text.
     * @param {Error} [payload.error] - Optional associated error object.
     */
    #onShowFatal(payload) {
        let message = payload.message;
        if (payload.error && payload.error.message) {
            message += `\nDetails: ${payload.error.message}`;
        }
        this.logger.fatal(`[UiMessageRenderer] Fatal error displayed: ${message}`);
        this.render(message, 'fatal', false);
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
            this.logger.warn('[UiMessageRenderer] Received command echo event without valid originalInput.', payload);
        }
    }

    /**
     * Scrolls the message list to the bottom.
     * @private
     */
    #scrollToBottom() {
        if (this.#messageList && typeof this.#messageList.scrollTop !== 'undefined') { // Check scroll properties exist
            this.#messageList.scrollTop = this.#messageList.scrollHeight;
        }
    }

    /**
     * Unsubscribes from all VED events.
     */
    dispose() {
        this.logger.debug(`[${this.constructor.name}] Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => sub.unsubscribe());
        this.#subscriptions = [];
        super.dispose(); // Call base dispose
    }
}
