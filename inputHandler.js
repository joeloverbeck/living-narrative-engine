// inputHandler.js

/**
 * Handles user input from a specified HTML input element.
 * It listens for the Enter key, processes the input,
 * notifies a listener via a callback when a command is submitted,
 * and manages focus.
 * It NO LONGER directly manages the disabled/placeholder state (delegated to Renderer).
 */
class InputHandler {
    /**
     * Creates an instance of InputHandler.
     * @param {HTMLInputElement} inputElement - The HTML input element to manage.
     * @param {(command: string) => void} onCommandCallback - The function to call when a valid command is entered.
     */
    constructor(inputElement, onCommandCallback) {
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
            throw new Error("InputHandler requires a valid HTMLInputElement.");
        }
        if (typeof onCommandCallback !== 'function') {
            throw new Error("InputHandler requires an onCommandCallback function.");
        }

        this.inputElement = inputElement;
        this.onCommandCallback = onCommandCallback;
        this.isEnabled = false; // Tracks if handler should process input and listen

        this._bindEvents();
        this.disable(); // Start disabled (internal state)
        // Initial visual state (disabled, placeholder) should be set by the caller via Renderer
    }

    /**
     * Binds the necessary event listeners to the input element.
     * @private
     */
    _bindEvents() {
        // Handle key press for Enter key detection
        this.inputElement.addEventListener('keypress', this._handleKeyPress.bind(this));

        // Prevent form submission if the input is part of a form
        if (this.inputElement.form) {
            this.inputElement.form.addEventListener('submit', (e) => e.preventDefault());
        }
    }

    /**
     * Handles the keypress event on the input element.
     * @param {KeyboardEvent} event
     * @private
     */
    _handleKeyPress(event) {
        // Only process if the handler is internally enabled
        if (event.key === 'Enter' && this.isEnabled) {
            event.preventDefault();

            const command = this.inputElement.value.trim();
            this.inputElement.value = ''; // Clear field

            if (command) {
                // No longer visually disables here. GameLoop/Renderer handles it.
                this.onCommandCallback(command);
                // GameLoop should call enable() + renderer.setInputState() again when ready
            } else {
                // Re-focus if Enter pressed on empty field
                this.inputElement.focus();
            }
        } else if (event.key === 'Enter' && !this.isEnabled) {
            // Optionally prevent default even if disabled to avoid weird form submits
            event.preventDefault();
        }
    }

    /**
     * Enables the handler to process keypresses and focuses the input field.
     * Does NOT change visual state (disabled/placeholder).
     */
    enable() {
        this.isEnabled = true;
        this.inputElement.focus(); // Set focus when enabling logical input
        // console.log("InputHandler: Enabled listening");
    }

    /**
     * Disables the handler from processing keypresses.
     * Does NOT change visual state (disabled/placeholder).
     */
    disable() {
        this.isEnabled = false;
        // console.log("InputHandler: Disabled listening");
    }

    /**
     * Clears the input field's current value.
     */
    clear() {
        this.inputElement.value = '';
    }
}

export default InputHandler;