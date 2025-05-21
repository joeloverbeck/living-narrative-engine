// src/domUI/inputStateController.js
import {RendererBase} from './rendererBase.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 * @typedef {import('../core/interfaces/EventTypes').EventObject<import('../core/validation/schemas/eventPayloads').EventDisableInputPayload>} DisableInputEvent // Type for the whole event object
 * @typedef {import('../core/interfaces/EventTypes').EventObject<import('../core/validation/schemas/eventPayloads').TextUIEnableInputPayload>} EnableInputEvent // Type for the whole event object
 */

/**
 * Manages the enabled/disabled state and placeholder text of a specific HTML input element.
 * Subscribes to VED events like 'textUI:disable_input' and 'textUI:enable_input'
 * to reactively update the input's state.
 * It also prevents the 'Enter' key from submitting forms or triggering other default actions
 * when pressed in the managed input element by intercepting the event in the capturing phase.
 */
export class InputStateController extends RendererBase {
    /**
     * The HTML input element being controlled.
     * @private
     * @type {HTMLInputElement}
     */
    #inputElement;

    /**
     * Stores VED subscriptions for later disposal.
     * @private
     * @type {Array<IEventSubscription|undefined>}
     */
    #subscriptions = [];

    /**
     * Stores the bound event handler for the keydown event on the input element.
     * @private
     * @type {((event: KeyboardEvent) => void) | null}
     */
    #boundHandleKeydown = null;

    /**
     * Creates an instance of InputStateController.
     *
     * @param {object} deps - Dependencies object.
     * @param {ILogger} deps.logger - The logger instance.
     * @param {IDocumentContext} deps.documentContext - The document context (not directly used but part of RendererBase).
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - The event dispatcher.
     * @param {HTMLElement | null} deps.inputElement - The specific input element to manage. Must be an HTMLInputElement.
     * @throws {Error} If dependencies are invalid or inputElement is not a valid HTMLInputElement.
     */
    constructor({logger, documentContext, validatedEventDispatcher, inputElement}) {
        // Pass base dependencies to RendererBase constructor
        super({logger, documentContext, validatedEventDispatcher});

        // --- Validate specific inputElement dependency ---
        if (!inputElement || inputElement.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'inputElement' dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        // Check specifically if it's an INPUT element
        if (inputElement.tagName !== 'INPUT') {
            const errMsg = `${this._logPrefix} 'inputElement' must be an HTMLInputElement (<input>), but received '${inputElement.tagName}'.`;
            this.logger.error(errMsg, {element: inputElement});
            throw new Error(errMsg);
        }

        this.#inputElement = /** @type {HTMLInputElement} */ (inputElement);
        this.logger.debug(`${this._logPrefix} Attached to INPUT element.`);

        // Bind and add the keydown listener to prevent Enter key submissions
        this.#boundHandleKeydown = this.#handleKeydown.bind(this);
        // MODIFIED: Add listener in CAPTURING phase
        this.#inputElement.addEventListener('keydown', this.#boundHandleKeydown, true);
        this.logger.debug(`${this._logPrefix} Added keydown listener in capturing phase to input element to intercept 'Enter' key.`);

        // Subscribe to events that affect the input state
        this.#subscribeToEvents();
    }

    /**
     * Subscribes to VED events relevant for updating the input state.
     * @private
     */
    #subscribeToEvents() {
        const ved = this.validatedEventDispatcher; // Alias for brevity

        this.#subscriptions.push(
            ved.subscribe('textUI:disable_input', this.#handleDisableInput.bind(this))
        );

        this.#subscriptions.push(
            ved.subscribe('textUI:enable_input', this.#handleEnableInput.bind(this))
        );

        this.logger.debug(`${this._logPrefix} Subscribed to VED events 'textUI:disable_input' and 'textUI:enable_input'.`);
    }

    /**
     * Handles keydown events on the input element.
     * Specifically intercepts the 'Enter' key to prevent default actions and stop further propagation.
     * @private
     * @param {KeyboardEvent} event - The keyboard event.
     */
    #handleKeydown(event) {
        if (event.key === 'Enter') {
            this.logger.debug(`${this._logPrefix} 'Enter' key pressed in input field. Preventing default action and stopping immediate propagation.`);
            event.preventDefault();
            // MODIFIED: Ensure immediate propagation is stopped to prevent other listeners on the same element
            event.stopImmediatePropagation();
        }
    }

    /**
     * Handles the 'textUI:disable_input' event.
     * @private
     * @param {DisableInputEvent} event - The full event object ({ type, payload }).
     */
    #handleDisableInput(event) {
        const payload = event.payload;
        const eventType = event.type;
        const defaultMessage = 'Input disabled.';
        const message = (payload && typeof payload.message === 'string') ? payload.message : defaultMessage;

        if (message === defaultMessage && (!payload || typeof payload.message !== 'string')) {
            this.logger.warn(`${this._logPrefix} Received '${eventType}' without valid 'message' string in payload, using default: "${defaultMessage}"`, {receivedEvent: event});
        }
        this.setEnabled(false, message);
    }

    /**
     * Handles the 'textUI:enable_input' event.
     * @private
     * @param {EnableInputEvent} event - The full event object ({ type, payload }).
     */
    #handleEnableInput(event) {
        const payload = event.payload;
        const eventType = event.type;
        const defaultPlaceholder = 'Enter speech (optional)...';
        const placeholder = (payload && typeof payload.placeholder === 'string') ? payload.placeholder : defaultPlaceholder;

        if (placeholder === defaultPlaceholder && (!payload || typeof payload.placeholder !== 'string')) {
            this.logger.info(`${this._logPrefix} Received '${eventType}' without valid 'placeholder' string in payload, using default placeholder: "${defaultPlaceholder}"`, {receivedEvent: event});
        }
        this.setEnabled(true, placeholder);
    }

    /**
     * Enables or disables the managed input element and sets its placeholder text.
     *
     * @param {boolean} enabled - `true` to enable the input, `false` to disable it.
     * @param {string} [placeholderText=''] - The placeholder text to display in the input field. Defaults to empty string.
     */
    setEnabled(enabled, placeholderText = '') {
        if (!this.#inputElement) {
            this.logger.error(`${this._logPrefix} Cannot set input state, internal #inputElement reference is missing.`);
            return;
        }

        const isDisabled = !Boolean(enabled);
        const placeholder = String(placeholderText);

        if (this.#inputElement.disabled !== isDisabled) {
            this.#inputElement.disabled = isDisabled;
            this.logger.debug(`${this._logPrefix} Input ${isDisabled ? 'disabled' : 'enabled'}.`);
        }

        if (this.#inputElement.placeholder !== placeholder) {
            this.#inputElement.placeholder = placeholder;
            this.logger.debug(`${this._logPrefix} Input placeholder set to: "${placeholder}"`);
        }
    }

    /**
     * Dispose method for cleanup. Unsubscribes from all VED events and removes DOM event listeners.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions and event listeners.`);
        this.#subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        this.#subscriptions = [];

        if (this.#inputElement && this.#boundHandleKeydown) {
            // MODIFIED: Ensure correct arguments for removeEventListener (true for capture phase)
            this.#inputElement.removeEventListener('keydown', this.#boundHandleKeydown, true);
            this.logger.debug(`${this._logPrefix} Removed keydown listener (capturing phase) from input element.`);
            this.#boundHandleKeydown = null;
        }
        super.dispose();
    }
}