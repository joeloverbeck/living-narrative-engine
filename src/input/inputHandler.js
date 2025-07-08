// inputHandler.js

/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */ // Changed from EventBus
/** @typedef {import('../types/eventTypes.js').SystemEventPayloads} SystemEventPayloads */ // Assuming event types defined here

import { IInputHandler } from '../interfaces/IInputHandler.js';

/**
 * Callback signature for DOM event listeners.
 *
 * @typedef {(event: Event) => void} EventListener
 */

/**
 * A reusable no-op function for default callbacks.
 *
 * @type {() => void}
 */
const NO_OP = () => {};

/**
 * Handles user input from a specified HTML input element and global key presses.
 * It listens for the Enter key in the input field to submit commands,
 * listens globally for specific keys (like 'I' for inventory),
 * and subscribes to events to enable/disable input processing.
 * Notifies listeners via callbacks or ValidatedEventDispatcher.
 */
class InputHandler extends IInputHandler {
  /** @type {HTMLInputElement} */
  #inputElement;
  /** @type {(command: string) => void} */
  #onCommandCallback; // Stores the function to call on command submission
  /** @type {IValidatedEventDispatcher} */ // Changed from EventBus
  #validatedEventDispatcher;
  /** @type {boolean} */
  #isEnabled = false;
  /** @type {Document} */
  #document;
  /** @type {{ debug: Function, warn: Function, error: Function }} */
  #logger;
  /** @type {Array<() => void>} */
  #vedUnsubs = [];
  /** @type {EventListener} */
  #boundDocKeydown;
  /** @type {EventListener} */
  #boundFormSubmit;

  /**
   * Creates an instance of InputHandler.
   *
   * @param {HTMLInputElement} inputElement - The HTML input element to manage for commands.
   * @param {(command: string) => void} [onCommandCallback] - An *initial* command callback. Defaults to `NO_OP`. Can be overridden later via setCommandCallback.
   * @param {IValidatedEventDispatcher} validatedEventDispatcher - The application's validated event dispatcher instance. // Changed from EventBus
   * @param {{ document: Document, logger: { debug: Function, warn: Function, error: Function } }} options -
   *        Environment dependencies.
   */
  constructor(
    inputElement,
    onCommandCallback = NO_OP,
    validatedEventDispatcher,
    { document, logger } = {}
  ) {
    // Changed parameter name
    super();

    if (
      !document ||
      typeof document.addEventListener !== 'function' ||
      typeof document.removeEventListener !== 'function'
    ) {
      throw new Error(
        'InputHandler requires a valid document with addEventListener and removeEventListener.'
      );
    }

    if (
      !logger ||
      typeof logger.debug !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      throw new Error(
        'InputHandler requires a logger implementing debug, warn, and error.'
      );
    }

    this.#document = document;
    this.#logger = logger;

    if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
      throw new Error('InputHandler requires a valid HTMLInputElement.');
    }
    // Validate the initial callback if provided, otherwise use the default no-op
    if (onCommandCallback && typeof onCommandCallback !== 'function') {
      this.#logger.warn(
        'InputHandler: Invalid initial onCommandCallback provided, using default.'
      );
      this.#onCommandCallback = NO_OP; // Default to no-op function
    } else {
      this.#onCommandCallback = onCommandCallback; // Use the provided valid callback or the default
    }
    // Updated validation for the new dependency
    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.dispatch !== 'function' ||
      typeof validatedEventDispatcher.subscribe !== 'function'
    ) {
      throw new Error(
        'InputHandler requires a valid IValidatedEventDispatcher instance.'
      );
    }

    this.#inputElement = inputElement;
    this.#validatedEventDispatcher = validatedEventDispatcher; // Updated assignment
    this.#isEnabled = false; // Start disabled internally

    this._bindEvents();
    this._subscribeToEvents(); // Subscribe to enable/disable events
    this.disable(); // Set initial visual/logical state to disabled
  }

  /**
   * Binds the necessary DOM event listeners.
   *
   * @private
   */
  _bindEvents() {
    this.#boundDocKeydown = this._handleInputKeyDown.bind(this);
    this.#document.addEventListener('keydown', this.#boundDocKeydown);

    if (this.#inputElement.form) {
      this.#boundFormSubmit = (e) => e.preventDefault();
      this.#inputElement.form.addEventListener('submit', this.#boundFormSubmit);
    }
  }

  /**
   * Subscribes to application events for enabling/disabling input.
   *
   * @private
   */
  _subscribeToEvents() {
    const enableUnsub = this.#validatedEventDispatcher.subscribe(
      'core:enable_input',
      /**
       * Handles 'core:enable_input' events.
       *
       * @param {SystemEventPayloads['core:enable_input']} _event - Event payload (unused).
       */
      (_event) => {
        this.enable();
      }
    );

    const disableUnsub = this.#validatedEventDispatcher.subscribe(
      'core:disable_input',
      /**
       * Handles 'core:disable_input' events.
       *
       * @param {SystemEventPayloads['core:disable_input']} _event - Event payload (unused).
       */
      (_event) => {
        this.disable();
      }
    );

    this.#vedUnsubs.push(enableUnsub, disableUnsub);
    this.#logger.debug(
      "InputHandler: Subscribed to 'core:enable_input' and 'core:disable_input' events."
    );
  }

  /**
   * Handles keydown events specifically within the input element (primarily for Enter).
   *
   * @param {KeyboardEvent} event - Keydown event object.
   * @private
   */
  _handleInputKeyDown(event) {
    if (event.key === 'Enter' && this.#isEnabled) {
      const command = this.#inputElement.value.trim();
      if (command) {
        this.#onCommandCallback(command);
        this.#inputElement.value = '';
      }
    }
    // Other non-Enter key specific logic for this input could remain if any.
  }

  /**
   * Sets or replaces the function to be called when a command is submitted via Enter key.
   *
   * @param {(command: string) => void} callbackFn - The new function to call with the command string.
   */
  setCommandCallback(callbackFn) {
    if (typeof callbackFn !== 'function') {
      this.#logger.error(
        'InputHandler: Attempted to set invalid command callback. Callback must be a function.'
      );
      return; // Keep the existing callback if the new one is invalid
    }
    this.#logger.debug('InputHandler: Command callback updated.');
    this.#onCommandCallback = callbackFn;
  }

  /**
   * Enables the handler to process Enter key presses in the input field and focuses it.
   * Called internally or via 'core:enable_input' event.
   */
  enable() {
    if (this.#isEnabled) return; // Avoid redundant operations
    this.#isEnabled = true;
    this.#inputElement.focus();
    // Note: Visual state (disabled attribute, placeholder) should be handled
    // by the InputStateController listening for the same 'core:enable_input' event.
  }

  /**
   * Disables the handler from processing Enter key presses in the input field.
   * Called internally or via 'core:disable_input' event.
   */
  disable() {
    if (!this.#isEnabled) return; // Avoid redundant operations
    this.#isEnabled = false;
    // Note: Visual state (disabled attribute, placeholder) should be handled
    // by the InputStateController listening for the same 'core:disable_input' event.
  }

  /**
   * Clears the input field's current value.
   */
  clear() {
    this.#inputElement.value = '';
  }

  /**
   * Cleans up VED subscriptions and DOM event listeners.
   *
   * @public
   * @returns {void}
   */
  dispose() {
    this.#vedUnsubs.forEach((unsub) => {
      try {
        unsub();
      } catch (err) {
        this.#logger.warn('InputHandler: Error during VED unsubscribe', err);
      }
    });
    this.#vedUnsubs = [];

    if (this.#boundDocKeydown) {
      this.#document.removeEventListener('keydown', this.#boundDocKeydown);
      this.#boundDocKeydown = undefined;
    }

    if (this.#inputElement.form && this.#boundFormSubmit) {
      this.#inputElement.form.removeEventListener(
        'submit',
        this.#boundFormSubmit
      );
      this.#boundFormSubmit = undefined;
    }

    this.#logger.debug('InputHandler: Disposed.');
  }
}

export default InputHandler;
