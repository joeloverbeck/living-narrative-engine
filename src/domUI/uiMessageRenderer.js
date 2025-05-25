// src/domUI/uiMessageRenderer.js
import {RendererBase} from './rendererBase.js';
import DomElementFactory from './domElementFactory.js';
import {ACTION_FAILED_ID, DISPLAY_MESSAGE_ID, SYSTEM_ERROR_OCCURRED_ID} from "../constants/eventIds.js";   // keep this import

/**
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription // Added for clarity
 * @typedef {import('../core/interfaces/IEvent').IEvent} IEvent // Added for clarity
 */

/**
 * @typedef {'info'|'warning'|'error'|'success'|'combat'|'combat_hit'|'combat_critical'|'sound'|'prompt'|'internal'|'debug'|'echo'|'fatal'|'speech'} MessageType
 */

/**
 * @typedef {object} DisplayMessagePayload
 * @property {string} message The message content to display to the user.
 * @property {MessageType} [type='info'] A category hint for the message.
 * @property {boolean} [allowHtml=false] If true, the message content will be treated as HTML.
 */

/**
 * Renders player-facing messages (info, echo, fatal, etc.) and wires
 * itself to the VED so tests can invoke the same code paths.
 */
export class UiMessageRenderer extends RendererBase {
    /** @type {HTMLElement|null}                 */ #messageList = null;
    /** @type {HTMLElement|null}                 */ #outputDivElement = null; // For scrolling
    /** @type {DomElementFactory|null}           */ #domElementFactory;
    /** @type {Array<IEventSubscription|undefined>} */ #subscriptions = [];

    /**
     * @param {object}  deps
     * @param {ILogger} deps.logger
     * @param {IDocumentContext} deps.documentContext
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher
     * @param {DomElementFactory|null} [deps.domElementFactory]
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory = null
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            this.logger.error(`${this._logPrefix} DomElementFactory dependency is missing or invalid.`);
            this.#domElementFactory = null;
        } else {
            this.#domElementFactory = domElementFactory;
        }

        // Cache #outputDiv for scrolling
        this.#outputDivElement = this.documentContext.query('#outputDiv');
        if (!this.#outputDivElement) {
            this.logger.error(`${this._logPrefix} Could not find #outputDiv element! Automatic scrolling of chat panel may not work.`);
        } else {
            this.logger.debug(`${this._logPrefix} Cached #outputDiv element for scrolling.`);
        }

        this.#ensureMessageList(); // This ensures #messageList exists, possibly creating it inside #outputDiv

        // ------------------------------------------------------------
        // VED subscriptions
        // ------------------------------------------------------------
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe(
                DISPLAY_MESSAGE_ID,
                this.#onShow.bind(this)
            )
        );
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe(
                SYSTEM_ERROR_OCCURRED_ID,
                this.#onShowFatal.bind(this)
            )
        );
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe(
                ACTION_FAILED_ID,
                this.#onCommandEcho.bind(this)
            )
        );

        this.logger.debug(`${this._logPrefix} Subscribed to VED events.`);

        // ------------------------------------------------------------
        // *** Test hooks ***
        // ------------------------------------------------------------
        Object.defineProperty(this, '_UiMessageRenderer__messageList', {
            configurable: true,
            enumerable: false,
            get: () => this.#messageList,
            set: v => {
                this.#messageList = v;
            }
        });
        Object.defineProperty(this, '_UiMessageRenderer__outputDivElement', {
            configurable: true,
            enumerable: false,
            get: () => this.#outputDivElement,
            set: v => {
                this.#outputDivElement = v;
            }
        });
        this['_UiMessageRenderer__onShowFatal'] = this.#onShowFatal.bind(this);
        this['_UiMessageRenderer__onCommandEcho'] = this.#onCommandEcho.bind(this);
    }

    //----------------------------------------------------------------------
    // Private helpers
    //----------------------------------------------------------------------

    /** Ensure the <ul id="message-list"> exists (or create it). */
    #ensureMessageList() {
        if (this.#messageList) {
            if (this.#outputDivElement && this.#messageList.parentElement !== this.#outputDivElement) {
                this.logger.warn(`${this._logPrefix} #message-list's parent is not the cached #outputDiv. Scrolling might be affected.`);
            }
            return;
        }

        this.#messageList = this.documentContext.query('#message-list');
        if (this.#messageList) {
            if (!this.#outputDivElement && this.#messageList.parentElement) {
                if (this.#messageList.parentElement.id === 'outputDiv') {
                    this.#outputDivElement = /** @type {HTMLElement} */ (this.#messageList.parentElement);
                    this.logger.info(`${this._logPrefix} #outputDiv element was not initially cached but inferred from #message-list parent.`);
                } else {
                    this.logger.warn(`${this._logPrefix} #message-list found, but its parent is not #outputDiv. Scrolling might be affected.`);
                }
            } else if (this.#outputDivElement && this.#messageList.parentElement !== this.#outputDivElement) {
                this.logger.warn(`${this._logPrefix} #message-list found, but its parent is not the cached #outputDiv. Scrolling might be affected.`);
            }
            return;
        }

        this.logger.info(`${this._logPrefix} #message-list element not found. Attempting to create it.`);

        if (!this.#outputDivElement) {
            this.#outputDivElement = this.documentContext.query('#outputDiv');
            if (!this.#outputDivElement) {
                this.logger.error(`${this._logPrefix} Cannot create #message-list: #outputDiv container not found. Messages may not display correctly and scrolling will fail.`);
                return;
            }
        }

        if (this.#domElementFactory) {
            const created = this.#domElementFactory.create('ul', {
                id: 'message-list',
                attrs: {'aria-live': 'polite'}
            });

            if (created) {
                this.#outputDivElement.appendChild(created);
                this.#messageList = created;
                this.logger.info(`${this._logPrefix} #message-list created dynamically inside #outputDiv with aria-live.`);
            } else {
                this.logger.error(`${this._logPrefix} Failed to create #message-list element dynamically using .create().`);
            }
        } else {
            this.logger.error(`${this._logPrefix} Cannot create #message-list dynamically: DomElementFactory is missing.`);
        }

        if (!this.#messageList) {
            this.logger.error(`${this._logPrefix} Critical: Failed to find or create #message-list. Messages will not be displayed.`);
        }
    }

    /** Scroll the #outputDiv (actual scroll container) to bottom. */
    #scrollToBottom() {
        if (this.#outputDivElement && typeof this.#outputDivElement.scrollTop !== 'undefined' && typeof this.#outputDivElement.scrollHeight !== 'undefined') {
            this.#outputDivElement.scrollTop = this.#outputDivElement.scrollHeight;
        } else {
            this.logger.warn(`${this._logPrefix} Could not scroll #outputDiv. Element or properties missing. Attempting fallback scroll on #message-list.`);
            if (this.#messageList && this.#messageList.lastChild && typeof this.#messageList.lastChild.scrollIntoView === 'function') {
                this.#messageList.lastChild.scrollIntoView({behavior: 'auto', block: 'end'});
                this.logger.debug(`${this._logPrefix} Fallback: Scrolled last message in #message-list into view.`);
            } else {
                this.logger.warn(`${this._logPrefix} Fallback scroll method also failed for #message-list.`);
            }
        }
    }

    //----------------------------------------------------------------------
    // Public API
    //----------------------------------------------------------------------

    /**
     * Push a message into the list.
     * @param {string}       text
     * @param {MessageType}  [type='info']
     * @param {boolean}      [allowHtml=false]
     */
    render(text, type = 'info', allowHtml = false) {
        if (!this.#outputDivElement) {
            this.#outputDivElement = this.documentContext.query('#outputDiv');
            if (!this.#outputDivElement) {
                this.logger.error(`${this._logPrefix} #outputDiv element missing. Cannot render message effectively or ensure scrolling.`);
            }
        }

        this.#ensureMessageList();

        if (!this.#messageList || typeof this.#messageList.appendChild !== 'function') {
            this.logger.error(
                `${this._logPrefix} Cannot render message: #message-list element is invalid, not found, or unappendable.`
            );
            return;
        }
        if (!this.#domElementFactory) {
            this.logger.error(
                `${this._logPrefix} Cannot render message: DomElementFactory is missing.`
            );
            return;
        }

        const li = this.#domElementFactory.li(null);
        if (!li) {
            this.logger.error(`${this._logPrefix} Failed to create message item (li) element using DomElementFactory.`);
            return;
        }

        li.classList.add('message'); // <<< ADDED THIS LINE BACK
        li.classList.add(`message-${type}`);

        if (allowHtml) {
            li.innerHTML = text;
        } else {
            li.textContent = text;
        }

        this.#messageList.appendChild(li);
        this.#scrollToBottom();
        // <<< ADJUSTED LOG FORMAT TO MATCH TEST EXPECTATIONS >>>
        this.logger.debug(`${this._logPrefix} Rendered message: ${type} - ${String(text).substring(0, 50)}`);
    }

    //----------------------------------------------------------------------
    // VED handlers
    //----------------------------------------------------------------------

    /**
     * Handles the 'textUI:display_message' event.
     * @param {IEvent<DisplayMessagePayload>} eventObject The full event object delivered by the event bus.
     */
    #onShow(eventObject) {
        if (eventObject && eventObject.payload && typeof eventObject.payload.message === 'string') {
            const message = eventObject.payload.message;
            const type = eventObject.payload.type || 'info';
            const allowHtml = eventObject.payload.allowHtml || false;
            this.render(message, type, allowHtml);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid or malformed 'textUI:display_message' event object.`, eventObject);
        }
    }

    /**
     * Handles the 'core:system_error_occurred' event.
     * @param {IEvent<any>} eventObject The full event object.
     */
    #onShowFatal(eventObject) {
        const payload = eventObject?.payload;
        if (!payload || typeof payload.message !== 'string') {
            this.logger.error(`${this._logPrefix} Received invalid 'core:system_error_occurred' payload.`, eventObject);
            this.render('An unspecified fatal system error occurred.', 'fatal');
            return;
        }
        let msg = payload.message;
        if (payload.error?.message) msg += `\nDetails: ${payload.error.message}`;
        this.logger.error(`${this._logPrefix} Fatal error displayed: ${msg}`);
        this.render(msg, 'fatal');
    }

    /**
     * Handles 'core:action_executed' and 'core:action_failed' for command echo.
     * @param {IEvent<any>} eventObject The full event object.
     */
    #onCommandEcho(eventObject) {
        const payload = eventObject?.payload;
        if (payload && typeof payload.originalInput === 'string' && payload.originalInput.trim()) {
            this.render(`> ${payload.originalInput}`, 'echo');
        } else if (payload && payload.command && typeof payload.command === 'string' && payload.command.trim()) {
            this.logger.info(`${this._logPrefix} Echoing 'command' field as 'originalInput' was missing or empty.`);
            this.render(`> ${payload.command}`, 'echo');
        } else {
            this.logger.warn(`${this._logPrefix} Received command echo event without valid originalInput or command.`, eventObject);
        }
    }

    //----------------------------------------------------------------------
    // Cleanup
    //----------------------------------------------------------------------

    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
        });
        this.#subscriptions = [];
        this.#messageList = null;
        this.#outputDivElement = null;
        super.dispose();
    }
}