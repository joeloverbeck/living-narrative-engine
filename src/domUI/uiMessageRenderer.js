// src/domUI/uiMessageRenderer.js
import {RendererBase} from './rendererBase.js';
import DomElementFactory from './domElementFactory.js';   // keep this import

/**
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 */

/**
 * @typedef {'info'|'error'|'echo'|'fatal'} MessageType
 */

/**
 * Renders player-facing messages (info, echo, fatal, etc.) and wires
 * itself to the VED so tests can invoke the same code paths.
 */
export class UiMessageRenderer extends RendererBase {
    /** @type {HTMLElement|null}                 */ #messageList = null;
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

        // Factory may be null – tests expect us to allow that.
        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            this.logger.error(`${this._logPrefix} DomElementFactory dependency is missing or invalid.`);
            this.#domElementFactory = null;
        } else {
            this.#domElementFactory = domElementFactory;
        }

        // Build / find the <ul id="message-list">
        this.#ensureMessageList();

        // ------------------------------------------------------------
        // VED subscriptions
        // ------------------------------------------------------------
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe(
                'textUI:display_message',
                this.#onShow.bind(this)
            )
        );
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe(
                'core:system_error_occurred',
                this.#onShowFatal.bind(this)
            )
        );
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe(
                'core:action_executed',
                this.#onCommandEcho.bind(this)
            )
        );
        this.#subscriptions.push(
            this.validatedEventDispatcher.subscribe(
                'core:action_failed',
                this.#onCommandEcho.bind(this)
            )
        );

        this.logger.debug(`${this._logPrefix} Subscribed to VED events.`);

        // ------------------------------------------------------------
        // *** Test hooks ***
        // ------------------------------------------------------------
        // Jest specs reach into these in order to unit-test the
        // private behaviour.  Expose safe aliases that forward
        // directly to the real private slots.
        Object.defineProperty(this, '_UiMessageRenderer__messageList', {
            configurable: true,
            enumerable: false,
            get: () => this.#messageList,
            set: v => {
                this.#messageList = v;
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
        if (this.#messageList) return;

        this.#messageList = this.documentContext.query('#message-list');
        if (this.#messageList) return;

        this.logger.error(`${this._logPrefix} Could not find #message-list element!`);

        const mainContent = this.documentContext.query('#main-content');
        if (mainContent && this.#domElementFactory) {
            const created = this.#domElementFactory.ul('message-list');
            if (created) {
                created.classList.add('message-list');
                mainContent.appendChild(created);
                this.#messageList = created;
                this.logger.warn(`${this._logPrefix} #message-list created dynamically.`);
            } else {
                this.logger.error(`${this._logPrefix} Failed to create #message-list element dynamically.`);
            }
        } else if (!mainContent) {
            this.logger.error(`${this._logPrefix} Cannot find #main-content to append message list.`);
        } else {
            this.logger.error(`${this._logPrefix} Cannot create #message-list dynamically due to missing factory.`);
        }

        if (!this.#messageList) {
            this.logger.error(`${this._logPrefix} Failed to find or create #message-list. Messages may not be displayed.`);
        }
    }

    /** Scroll list to bottom (best-effort for JSDOM and browsers). */
    #scrollToBottom() {
        if (this.#messageList && typeof this.#messageList.scrollTop !== 'undefined') {
            this.#messageList.scrollTop = this.#messageList.scrollHeight;
        } else if (this.#messageList?.scrollIntoView) {
            this.#messageList.scrollIntoView({behavior: 'smooth', block: 'end'});
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
        this.#ensureMessageList();

        if (!this.#messageList || typeof this.#messageList.appendChild !== 'function') {
            this.logger.error(
                `${this._logPrefix} Cannot render message, list element invalid or not found.`
            );
            return;
        }
        if (!this.#domElementFactory) {
            this.logger.error(
                `${this._logPrefix} Cannot render message, DomElementFactory is missing.`
            );
            return;
        }

        const li = this.#domElementFactory.li(null);
        if (!li) {
            this.logger.error(`${this._logPrefix} Failed to create message item element.`);
            return;
        }

        li.classList.add('message', `message-${type}`);
        if (allowHtml) {
            li.innerHTML = text;
        } else {
            li.textContent = text;
        }

        this.#messageList.appendChild(li);
        this.#scrollToBottom();
        this.logger.debug(`${this._logPrefix} Rendered message: ${type} - ${text.substring(0, 50)}...`);
    }

    //----------------------------------------------------------------------
    // VED handlers
    //----------------------------------------------------------------------

    #onShow(payload) {
        if (payload && typeof payload.message === 'string') {
            this.render(payload.message, payload.type || 'info', payload.allowHtml || false);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid 'textUI:display_message' payload.`, payload);
        }
    }

    #onShowFatal(payload) {
        if (!payload || typeof payload.message !== 'string') {
            this.logger.error(`${this._logPrefix} Received invalid 'core:system_error_occurred' payload.`, payload);
            this.render('An unspecified fatal system error occurred.', 'fatal');
            return;
        }
        let msg = payload.message;
        if (payload.error?.message) msg += `\nDetails: ${payload.error.message}`;
        this.logger.error(`${this._logPrefix} Fatal error displayed: ${msg}`);
        this.render(msg, 'fatal');
    }

    #onCommandEcho(payload) {
        if (payload && typeof payload.originalInput === 'string' && payload.originalInput.trim()) {
            this.render(`> ${payload.originalInput}`, 'echo');
        } else {
            this.logger.warn(`${this._logPrefix} Received command echo event without valid originalInput.`, payload);
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
        super.dispose();
    }
}