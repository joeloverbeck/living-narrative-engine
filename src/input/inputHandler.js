// inputHandler.js

/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */ // Changed from EventBus
/** @typedef {import('../types/eventTypes.js').SystemEventPayloads} SystemEventPayloads */ // Assuming event types defined here

import { IInputHandler } from '../interfaces/IInputHandler.js';

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

  /**
   * Creates an instance of InputHandler.
   * @param {HTMLInputElement} inputElement - The HTML input element to manage for commands.
   * @param {(command: string) => void} [onCommandCallback] - An *initial* command callback. Can be overridden later via setCommandCallback.
   * @param {IValidatedEventDispatcher} validatedEventDispatcher - The application's validated event dispatcher instance. // Changed from EventBus
   */
  constructor(
    inputElement,
    onCommandCallback = () => {},
    validatedEventDispatcher
  ) {
    // Changed parameter name
    super();

    if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
      throw new Error('InputHandler requires a valid HTMLInputElement.');
    }
    // Validate the initial callback if provided, otherwise use the default no-op
    if (onCommandCallback && typeof onCommandCallback !== 'function') {
      console.warn(
        'InputHandler: Invalid initial onCommandCallback provided, using default.'
      );
      this.#onCommandCallback = () => {}; // Default to no-op function
    } else {
      this.#onCommandCallback = onCommandCallback; // Use the provided valid callback or the default
    }
    // Updated validation for the new dependency
    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.dispatchValidated !== 'function' ||
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
   * @private
   */
  _bindEvents() {
    this.#inputElement.addEventListener(
      'keydown',
      this._handleInputKeyDown.bind(this)
    );
    document.addEventListener('keydown', this._handleGlobalKeyDown.bind(this));
    if (this.#inputElement.form) {
      this.#inputElement.form.addEventListener('submit', (e) =>
        e.preventDefault()
      );
    }
  }

  /**
   * Subscribes to application events for enabling/disabling input.
   * @private
   */
  _subscribeToEvents() {
    // Subscribe to enable event
    this.#validatedEventDispatcher.subscribe(
      'textUI:enable_input',
      /** @param {SystemEventPayloads['textUI:enable_input']} _event - Ignored event payload */
      (_event) => {
        console.log(
          "InputHandler: Received 'textUI:enable_input' event. Enabling input."
        );
        this.enable();
      }
    );

    // Subscribe to disable event
    this.#validatedEventDispatcher.subscribe(
      'textUI:disable_input',
      /** @param {SystemEventPayloads['textUI:disable_input']} _event - Ignored event payload */
      (_event) => {
        console.log(
          "InputHandler: Received 'textUI:disable_input' event. Disabling input."
        );
        this.disable();
      }
    );
    console.log(
      "InputHandler: Subscribed to 'textUI:enable_input' and 'textUI:disable_input' events."
    );
  }

  /**
   * Handles keydown events specifically within the input element (primarily for Enter).
   * @param {KeyboardEvent} event
   * @private
   */
  _handleInputKeyDown(event) {
    if (event.key === 'Enter' && this.#isEnabled) {
      // MODIFICATION: The original Enter key logic for command submission is now removed.
      // InputStateController is expected to handle preventDefault and stopImmediatePropagation
      // for the 'Enter' key on this input, effectively preventing this handler
      // from needing to process 'Enter' for command submission.

      // Log that Enter was pressed here, but we are not processing it for command submission.
      // This log might not even appear if InputStateController successfully stops propagation.
      console.log(
        "InputHandler: 'Enter' key pressed on command input. Command submission via 'Enter' is disabled; speech input preserved."
      );

      // DO NOT call event.preventDefault() here if InputStateController is already doing it.
      // DO NOT clear the input: this.#inputElement.value = '';
      // DO NOT call this.#onCommandCallback for 'Enter' key.
    }
    // Other non-Enter key specific logic for this input could remain if any.
  }

  /**
   * Handles keydown events globally on the document (for UI toggles, etc.).
   * @param {KeyboardEvent} event
   * @private
   */
  _handleGlobalKeyDown(event) {
    // Avoid capturing 'i' if typed into the input field itself
    /*if (event.key.toLowerCase() === 'i' && event.target !== this.#inputElement) {
            event.preventDefault();
            console.log("InputHandler: Detected 'I' key press. Dispatching ui:toggle_inventory.");
            // Use the new dispatcher
            this.#validatedEventDispatcher.dispatchValidated('ui:toggle_inventory', {})
                .catch(err => console.error("InputHandler: Failed to dispatch 'ui:toggle_inventory'", err));
        }
        */
    // Add other global key operationHandlers here
  }

  /**
   * Sets or replaces the function to be called when a command is submitted via Enter key.
   * @param {(command: string) => void} callbackFn - The new function to call with the command string.
   */
  setCommandCallback(callbackFn) {
    if (typeof callbackFn !== 'function') {
      console.error(
        'InputHandler: Attempted to set invalid command callback. Callback must be a function.'
      );
      return; // Keep the existing callback if the new one is invalid
    }
    console.log('InputHandler: Command callback updated.');
    this.#onCommandCallback = callbackFn;
  }

  /**
   * Enables the handler to process Enter key presses in the input field and focuses it.
   * Called internally or via 'textUI:enable_input' event.
   */
  enable() {
    if (this.#isEnabled) return; // Avoid redundant operations
    this.#isEnabled = true;
    console.log('InputHandler: Enabling input processing.');
    this.#inputElement.focus();
    // Note: Visual state (disabled attribute, placeholder) should be handled
    // by the InputStateController listening for the same 'textUI:enable_input' event.
  }

  /**
   * Disables the handler from processing Enter key presses in the input field.
   * Called internally or via 'textUI:disable_input' event.
   */
  disable() {
    if (!this.#isEnabled) return; // Avoid redundant operations
    this.#isEnabled = false;
    console.log('InputHandler: Disabling input processing.');
    // Note: Visual state (disabled attribute, placeholder) should be handled
    // by the InputStateController listening for the same 'textUI:disable_input' event.
  }

  /**
   * Clears the input field's current value.
   */
  clear() {
    this.#inputElement.value = '';
  }
}

export default InputHandler;
