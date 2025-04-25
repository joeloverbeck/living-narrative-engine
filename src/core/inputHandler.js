// inputHandler.js

/** @typedef {import('./eventBus.js').default} EventBus */

/**
 * Handles user input from a specified HTML input element and global key presses.
 * It listens for the Enter key in the input field to submit commands,
 * and listens globally for specific keys (like 'I' for inventory).
 * Notifies listeners via callbacks or EventBus.
 */
class InputHandler {
  /** @type {HTMLInputElement} */
  #inputElement;
  /** @type {(command: string) => void} */
  #onCommandCallback; // Stores the function to call on command submission
  /** @type {EventBus} */
  #eventBus;
  /** @type {boolean} */
  #isEnabled = false;

  /**
     * Creates an instance of InputHandler.
     * @param {HTMLInputElement} inputElement - The HTML input element to manage for commands.
     * @param {(command: string) => void} [onCommandCallback = () => {}] - An *initial* command callback. Can be overridden later via setCommandCallback.
     * @param {EventBus} eventBus - The application's event bus instance.
     */
  constructor(inputElement, onCommandCallback = () => {}, eventBus) { // Made initial callback optional
    if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
      throw new Error('InputHandler requires a valid HTMLInputElement.');
    }
    // Validate the initial callback if provided, otherwise use the default no-op
    if (onCommandCallback && typeof onCommandCallback !== 'function') {
      console.warn('InputHandler: Invalid initial onCommandCallback provided, using default.');
      this.#onCommandCallback = () => {}; // Default to no-op function
    } else {
      this.#onCommandCallback = onCommandCallback; // Use the provided valid callback or the default
    }
    if (!eventBus || typeof eventBus.dispatch !== 'function') {
      throw new Error('InputHandler requires a valid EventBus instance.');
    }

    this.#inputElement = inputElement;
    this.#eventBus = eventBus;
    this.#isEnabled = false; // Start disabled internally

    this._bindEvents();
    this.disable(); // Set initial visual/logical state to disabled
  }

  /**
     * Binds the necessary event listeners.
     * @private
     */
  _bindEvents() {
    this.#inputElement.addEventListener('keydown', this._handleInputKeyDown.bind(this));
    document.addEventListener('keydown', this._handleGlobalKeyDown.bind(this));
    if (this.#inputElement.form) {
      this.#inputElement.form.addEventListener('submit', (e) => e.preventDefault());
    }
  }

  /**
     * Handles keydown events specifically within the input element (primarily for Enter).
     * @param {KeyboardEvent} event
     * @private
     */
  _handleInputKeyDown(event) {
    if (event.key === 'Enter' && this.#isEnabled) {
      event.preventDefault();
      const command = this.#inputElement.value.trim();
      this.#inputElement.value = '';

      if (command) {
        // Ensure the callback exists before calling
        if (this.#onCommandCallback) {
          this.#onCommandCallback(command);
        } else {
          console.warn('InputHandler: Enter pressed, but no command callback is set.');
        }
      } else {
        this.#inputElement.focus();
      }
    }
  }

  /**
     * Handles keydown events globally on the document (for UI toggles, etc.).
     * @param {KeyboardEvent} event
     * @private
     */
  _handleGlobalKeyDown(event) {
    if (event.key.toLowerCase() === 'i' && event.target !== this.#inputElement) {
      event.preventDefault();
      console.log("InputHandler: Detected 'I' key press. Dispatching ui:toggle_inventory.");
      this.#eventBus.dispatch('ui:toggle_inventory', {});
    }
    // Add other global key operationHandlers here
  }

  /**
     * Sets or replaces the function to be called when a command is submitted via Enter key.
     * @param {(command: string) => void} callbackFn - The new function to call with the command string.
     */
  setCommandCallback(callbackFn) {
    if (typeof callbackFn !== 'function') {
      console.error('InputHandler: Attempted to set invalid command callback. Callback must be a function.');
      // Optional: throw an error instead of just logging
      // throw new Error("Command callback must be a function.");
      return; // Keep the existing callback if the new one is invalid
    }
    console.log('InputHandler: Command callback updated.');
    this.#onCommandCallback = callbackFn;
  }

  /**
     * Enables the handler to process Enter key presses in the input field and focuses it.
     */
  enable() {
    this.#isEnabled = true;
    this.#inputElement.focus();
    // Note: Does not change the visual state (like removing disabled attribute or placeholder)
    // That should be handled via EventBus ('event:enable_input') if needed.
  }

  /**
     * Disables the handler from processing Enter key presses in the input field.
     */
  disable() {
    this.#isEnabled = false;
    // Note: Does not change the visual state (like adding disabled attribute or placeholder)
    // That should be handled via EventBus ('event:disable_input') if needed.
  }

  /**
     * Clears the input field's current value.
     */
  clear() {
    this.#inputElement.value = '';
  }
}

export default InputHandler;