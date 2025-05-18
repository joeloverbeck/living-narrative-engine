// src/domUI/inputStateController.js
import {RendererBase} from './rendererBase.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 * @typedef {import('../core/interfaces/EventTypes').EventObject<import('../core/validation/schemas/eventPayloads').EventDisableInputPayload>} DisableInputEvent // Type for the whole event object
 * @typedef {import('../core/interfaces/EventTypes').EventObject<import('../core/validation/schemas/eventPayloads').TextUIEnableInputPayload>} EnableInputEvent // Type for the whole event object
 */

/**
 * Manages the enabled/disabled state and placeholder text of a specific HTML input element.
 * Subscribes to VED events like 'textUI:disable_input' and 'textUI:enable_input'
 * to reactively update the input's state.
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
        // Using tagName for broader compatibility (works in jsdom/browser)
        if (inputElement.tagName !== 'INPUT') {
            const errMsg = `${this._logPrefix} 'inputElement' must be an HTMLInputElement (<input>), but received '${inputElement.tagName}'.`;
            this.logger.error(errMsg, {element: inputElement});
            throw new Error(errMsg); // Acceptance criteria: Throws if element not <input>
        }

        this.#inputElement = /** @type {HTMLInputElement} */ (inputElement);
        this.logger.debug(`${this._logPrefix} Attached to INPUT element.`);

        // Subscribe to events that affect the input state
        this.#subscribeToEvents();
    }

    /**
     * Subscribes to VED events relevant for updating the input state.
     * @private
     */
    #subscribeToEvents() {
        const ved = this.validatedEventDispatcher; // Alias for brevity

        // Listen for events telling us to disable the input
        this.#subscriptions.push(
            ved.subscribe('textUI:disable_input', this.#handleDisableInput.bind(this))
        );

        // Listen for events telling us to enable the input (used in tests, future-proofing)
        this.#subscriptions.push(
            ved.subscribe('textUI:enable_input', this.#handleEnableInput.bind(this))
        );

        this.logger.debug(`${this._logPrefix} Subscribed to VED events 'textUI:disable_input' and 'textUI:enable_input'.`);
    }

    // --- Private Event Handlers ---

    /**
     * Handles the 'textUI:disable_input' event.
     * @private
     * @param {DisableInputEvent} event - The full event object ({ type, payload }).
     */
    #handleDisableInput(event) {
        const payload = event.payload;
        const eventType = event.type;

        const defaultMessage = 'Input disabled.'; // Behavior unchanged for disable
        const message = (payload && typeof payload.message === 'string') ? payload.message : defaultMessage;

        if (message === defaultMessage) {
            if (!payload || typeof payload.message !== 'string') {
                this.logger.warn(`${this._logPrefix} Received '${eventType}' without valid 'message' string in payload, using default: "${defaultMessage}"`, {receivedEvent: event});
            }
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

        // Default placeholder if payload is missing or placeholder is not a string
        // Ticket 3.1: Changed default placeholder for speech input
        const defaultPlaceholder = 'Enter speech (optional)...';
        const placeholder = (payload && typeof payload.placeholder === 'string') ? payload.placeholder : defaultPlaceholder;

        // Log warning if the specific placeholder wasn't found and the default was used.
        // Ticket 3.1: Ensure log message correctly refers to "placeholder" (already does)
        // and reflects the new default if it's used.
        if (placeholder === defaultPlaceholder) {
            // This condition means we are using the defaultPlaceholder.
            // We log a warning specifically if the reason for using the default
            // is that the payload was missing or didn't contain a valid placeholder string.
            if (!payload || typeof payload.placeholder !== 'string') {
                this.logger.warn(`${this._logPrefix} Received '${eventType}' without valid 'placeholder' string in payload, using default placeholder: "${defaultPlaceholder}"`, {receivedEvent: event});
            }
        }

        this.setEnabled(true, placeholder);
    }

    // --- Public API ---

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
     * Dispose method for cleanup. Unsubscribes from all VED events.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        this.#subscriptions = [];
        super.dispose();
    }
}