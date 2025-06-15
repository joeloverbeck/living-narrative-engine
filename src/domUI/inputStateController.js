// src/domUI/inputStateController.js
import { RendererBase } from './rendererBase.js';
import { DISPLAY_ERROR_ID } from '../constants/eventIds.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * Manages the enabled/disabled state and placeholder text of a specific HTML input element.
 * Subscribes to VED events like 'core:disable_input' and 'core:enable_input'
 * to reactively update the input's state.
 * It also prevents the 'Enter' key from submitting forms or triggering other default actions
 * when pressed in the managed input element by intercepting the event in the capturing phase.
 */
export class InputStateController extends RendererBase {
  /**
   * The HTML input element being controlled.
   *
   * @private
   * @type {HTMLInputElement}
   */
  #inputElement;

  // #subscriptions array is no longer needed, managed by RendererBase
  // #boundHandleKeydown is no longer needed as a field

  /**
   * Creates an instance of InputStateController.
   *
   * @param {object} deps - Dependencies object.
   * @param {ILogger} deps.logger - The logger instance.
   * @param {IDocumentContext} deps.documentContext - The document context (not directly used but part of RendererBase).
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - The event dispatcher.
   * @param {HTMLElement | null} deps.inputElement - The specific input element to manage. Must be an HTMLInputElement.
   * @throws {Error} If dependencies are invalid or inputElement is not a valid HTMLInputElement.
   */
  constructor({ logger, documentContext, safeEventDispatcher, inputElement }) {
    // Pass base dependencies to RendererBase constructor
    super({
      logger,
      documentContext,
      validatedEventDispatcher: safeEventDispatcher,
    });

    // --- Validate specific inputElement dependency ---
    if (!inputElement || inputElement.nodeType !== 1) {
      const errMsg = `${this._logPrefix} 'inputElement' dependency is missing or not a valid DOM element.`;
      this.validatedEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: errMsg,
        details: { inputElement },
      });
      throw new Error(errMsg);
    }
    // Check specifically if it's an INPUT element
    if (inputElement.tagName !== 'INPUT') {
      const errMsg = `${this._logPrefix} 'inputElement' must be an HTMLInputElement (<input>), but received '${inputElement.tagName}'.`;
      this.validatedEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: errMsg,
        details: { element: inputElement },
      });
      throw new Error(errMsg);
    }

    this.#inputElement = /** @type {HTMLInputElement} */ (inputElement);
    this.logger.debug(`${this._logPrefix} Attached to INPUT element.`);

    // Bind and add the keydown listener using RendererBase's _addDomListener
    // #handleKeydown uses 'this.logger', so it needs to be bound.
    this._addDomListener(
      this.#inputElement,
      'keydown',
      this.#handleKeydown.bind(this),
      true
    );
    this.logger.debug(
      `${this._logPrefix} Added keydown listener in capturing phase to input element to intercept 'Enter' key.`
    );

    // Subscribe to events that affect the input state
    this.#subscribeToEvents();
  }

  /**
   * Subscribes to VED events relevant for updating the input state.
   *
   * @private
   */
  #subscribeToEvents() {
    const ved = this.validatedEventDispatcher; // Alias for brevity

    // Use _addSubscription from RendererBase
    this._addSubscription(
      ved.subscribe('core:disable_input', this.#handleDisableInput.bind(this))
    );

    this._addSubscription(
      ved.subscribe('core:enable_input', this.#handleEnableInput.bind(this))
    );

    this.logger.debug(
      `${this._logPrefix} Subscribed to VED events 'core:disable_input' and 'core:enable_input'.`
    );
  }

  /**
   * Handles keydown events on the input element.
   * Specifically intercepts the 'Enter' key to prevent default actions and stop further propagation.
   *
   * @private
   * @param {KeyboardEvent} event - The keyboard event.
   */
  #handleKeydown(event) {
    if (event.key === 'Enter') {
      this.logger.debug(
        `${this._logPrefix} 'Enter' key pressed in input field. Preventing default action and stopping immediate propagation.`
      );
      event.preventDefault();
      // MODIFIED: Ensure immediate propagation is stopped to prevent other listeners on the same element
      event.stopImmediatePropagation();
    }
  }

  /**
   * Handles the 'core:disable_input' event.
   *
   * @private
   * @param {DisableInputEvent} event - The full event object ({ type, payload }).
   */
  #handleDisableInput(event) {
    const payload = event.payload;
    const eventType = event.type;
    const defaultMessage = 'Input disabled.';
    const message =
      payload && typeof payload.message === 'string'
        ? payload.message
        : defaultMessage;

    if (
      message === defaultMessage &&
      (!payload || typeof payload.message !== 'string')
    ) {
      this.logger.warn(
        `${this._logPrefix} Received '${eventType}' without valid 'message' string in payload, using default: "${defaultMessage}"`,
        { receivedEvent: event }
      );
    }
    this.setEnabled(false, message);
  }

  /**
   * Handles the 'core:enable_input' event.
   *
   * @private
   * @param {EnableInputEvent} event - The full event object ({ type, payload }).
   */
  #handleEnableInput(event) {
    const payload = event.payload;
    const eventType = event.type;
    const defaultPlaceholder = 'Enter speech (optional)...';
    const placeholder =
      payload && typeof payload.placeholder === 'string'
        ? payload.placeholder
        : defaultPlaceholder;

    if (
      placeholder === defaultPlaceholder &&
      (!payload || typeof payload.placeholder !== 'string')
    ) {
      this.logger.debug(
        `${this._logPrefix} Received '${eventType}' without valid 'placeholder' string in payload, using default placeholder: "${defaultPlaceholder}"`,
        { receivedEvent: event }
      );
    }
    this.setEnabled(true, placeholder);
  }

  /**
   * Enables or disables the managed input element and sets its placeholder text.
   *
   * @param {boolean} enabled - `true` to enable the input, `false` to disable it.
   * @param {string} [placeholderText] - The placeholder text to display in the input field. Defaults to empty string.
   */
  setEnabled(enabled, placeholderText = '') {
    if (!this.#inputElement) {
      const errMsg = `${this._logPrefix} Cannot set input state, internal #inputElement reference is missing.`;
      this.validatedEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: errMsg,
        details: { element: this.#inputElement },
      });
      return;
    }

    const isDisabled = !enabled;
    const placeholder = String(placeholderText);

    if (this.#inputElement.disabled !== isDisabled) {
      this.#inputElement.disabled = isDisabled;
      this.logger.debug(
        `${this._logPrefix} Input ${isDisabled ? 'disabled' : 'enabled'}.`
      );
    }

    if (this.#inputElement.placeholder !== placeholder) {
      this.#inputElement.placeholder = placeholder;
      this.logger.debug(
        `${this._logPrefix} Input placeholder set to: "${placeholder}"`
      );
    }
  }

  /**
   * Dispose method for cleanup.
   * Relies on RendererBase.dispose() to unsubscribe from VED events
   * and remove managed DOM event listeners.
   */
  dispose() {
    this.logger.debug(`${this._logPrefix} Disposing.`); // Specific log before super
    // Manual unsubscription from VED events is no longer needed.
    // Manual removal of DOM event listeners is no longer needed.
    // Clearing #subscriptions array and #boundHandleKeydown field is no longer needed.
    super.dispose(); // Handles cleanup of subscriptions and DOM listeners added via _addSubscription and _addDomListener
  }
}
