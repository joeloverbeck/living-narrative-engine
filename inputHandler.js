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
    #onCommandCallback;
    /** @type {EventBus} */
    #eventBus; // Added EventBus dependency
    /** @type {boolean} */
    #isEnabled = false; // Tracks if handler should process input commands

    /**
     * Creates an instance of InputHandler.
     * @param {HTMLInputElement} inputElement - The HTML input element to manage for commands.
     * @param {(command: string) => void} onCommandCallback - The function to call when a valid command is entered.
     * @param {EventBus} eventBus - The application's event bus instance.
     */
    constructor(inputElement, onCommandCallback, eventBus) { // Added eventBus parameter
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
            throw new Error("InputHandler requires a valid HTMLInputElement.");
        }
        if (typeof onCommandCallback !== 'function') {
            throw new Error("InputHandler requires an onCommandCallback function.");
        }
        // --- Added EventBus validation ---
        if (!eventBus || typeof eventBus.dispatch !== 'function') {
            throw new Error("InputHandler requires a valid EventBus instance.");
        }

        this.#inputElement = inputElement;
        this.#onCommandCallback = onCommandCallback;
        this.#eventBus = eventBus; // Store eventBus
        this.#isEnabled = false; // Tracks if handler should process command input

        this._bindEvents();
        this.disable(); // Start disabled (internal state)
    }

    /**
     * Binds the necessary event listeners.
     * @private
     */
    _bindEvents() {
        // --- Listen on the input element specifically for Enter key ---
        this.#inputElement.addEventListener('keydown', this._handleInputKeyDown.bind(this));

        // --- Listen on the document globally for other keys (like 'I') ---
        // This allows toggling UI even if input isn't focused
        document.addEventListener('keydown', this._handleGlobalKeyDown.bind(this));


        // Prevent form submission if the input is part of a form
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
        // Handle 'Enter' for command submission if enabled
        if (event.key === 'Enter' && this.#isEnabled) {
            event.preventDefault(); // Prevent potential form submission or newline

            const command = this.#inputElement.value.trim();
            this.#inputElement.value = ''; // Clear field

            if (command) {
                this.#onCommandCallback(command);
            } else {
                // Optional: Re-focus if Enter pressed on empty field (might already be focused)
                this.#inputElement.focus();
            }
        }
        // Allow other keys (like 'i') to bubble up to the global handler if needed,
        // or handle them here if specific input-focused behavior is desired.
    }

    /**
     * Handles keydown events globally on the document (for UI toggles, etc.).
     * @param {KeyboardEvent} event
     * @private
     */
    _handleGlobalKeyDown(event) {
        // --- Check for Inventory Toggle Key ('I') ---
        // We check regardless of whether command input is enabled,
        // as UI toggles might be desired anytime.
        // We also check if the event target is the input field itself
        // to avoid toggling inventory when typing 'i' *into* the command input.
        if (event.key.toLowerCase() === 'i' && event.target !== this.#inputElement) {
            event.preventDefault(); // Prevent default action (like typing 'i' if focus is elsewhere)
            console.log("InputHandler: Detected 'I' key press. Dispatching ui:toggle_inventory.");
            this.#eventBus.dispatch('ui:toggle_inventory', {}); // Dispatch the event
        }

        // Add checks for other global keys here (e.g., 'Q' for Quest Log)
        // if (event.key.toLowerCase() === 'q' && event.target !== this.#inputElement) {
        //     event.preventDefault();
        //     this.#eventBus.dispatch('ui:toggle_quest_log', {});
        // }
    }

    /**
     * Enables the handler to process Enter key presses in the input field and focuses it.
     * Does NOT change visual state (disabled/placeholder).
     */
    enable() {
        this.#isEnabled = true;
        this.#inputElement.focus(); // Set focus when enabling logical input
        // console.log("InputHandler: Enabled command input listening");
    }

    /**
     * Disables the handler from processing Enter key presses in the input field.
     * Does NOT change visual state (disabled/placeholder).
     */
    disable() {
        this.#isEnabled = false;
        // console.log("InputHandler: Disabled command input listening");
    }

    /**
     * Clears the input field's current value.
     */
    clear() {
        this.#inputElement.value = '';
    }
}

export default InputHandler;