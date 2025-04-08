// domRenderer.js

/**
 * @typedef {import('./eventBus.js').default} EventBus
 */

/**
 * @typedef {object} LocationRenderData
 * @property {string} name - The name of the location.
 * @property {string} description - The descriptive text of the location.
 * @property {string[]} exits - A list of available exit directions.
 * @property {string[]} [items] - Optional list of visible item names. (For future use)
 * @property {string[]} [npcs] - Optional list of visible NPC names. (For future use)
 */

/**
 * Implements the IGameRenderer contract using direct DOM manipulation.
 * Handles rendering messages, location details, controlling the input element's visual state,
 * and subscribes itself to necessary UI events via the EventBus.
 */
class DomRenderer {
    /** @type {HTMLElement} */
    #outputDiv;
    /** @type {HTMLInputElement} */
    #inputElement;
    /** @type {EventBus} */
    #eventBus;

    /**
     * Creates an instance of DomRenderer.
     * @param {HTMLElement} outputDiv - The main element where game output is displayed.
     * @param {HTMLInputElement} inputElement - The input element for player commands.
     * @param {EventBus} eventBus - The application's event bus instance.
     */
    constructor(outputDiv, inputElement, eventBus) {
        if (!outputDiv || !(outputDiv instanceof HTMLElement)) {
            throw new Error("DomRenderer requires a valid output HTMLElement.");
        }
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
            throw new Error("DomRenderer requires a valid HTMLInputElement.");
        }
        // Ensure a valid EventBus instance is provided
        if (!eventBus || typeof eventBus.subscribe !== 'function' || typeof eventBus.dispatch !== 'function') {
            throw new Error("DomRenderer requires a valid EventBus instance.");
        }

        this.#outputDiv = outputDiv;
        this.#inputElement = inputElement;
        this.#eventBus = eventBus; // Store the event bus instance

        // Subscribe to necessary events internally
        this.#subscribeToEvents();

        console.log("DomRenderer initialized and subscribed to events.");
    }

    /**
     * Internal method to set up all necessary EventBus subscriptions.
     * Called automatically by the constructor.
     * @private
     */
    #subscribeToEvents() {
        // --- Subscribe to UI Events ---

        this.#eventBus.subscribe('ui:message_display', (message) => {
            // Defensive check: Ensure message object and text property exist
            if (message && typeof message.text === 'string') {
                this.renderMessage(message.text, message.type || 'info');
            } else {
                // Log a warning if the event data is malformed
                console.warn("DomRenderer received 'ui:message_display' with invalid data:", message);
                // Optionally display a generic error to the user
                // this.renderMessage("Received an invalid internal message.", "error");
            }
        });

        this.#eventBus.subscribe('ui:command_echo', (data) => {
            // Defensive check: Ensure data object and command property exist
            if (data && typeof data.command === 'string') {
                this.renderMessage(`> ${data.command}`, 'command');
            } else {
                console.warn("DomRenderer received 'ui:command_echo' with invalid data:", data);
            }
        });

        this.#eventBus.subscribe('ui:enable_input', (data) => {
            // Defensive check: Ensure data object and placeholder property exist
            if (data && typeof data.placeholder === 'string') {
                this.setInputState(true, data.placeholder);
            } else {
                // If data is missing/invalid, still enable input but use a default placeholder
                console.warn("DomRenderer received 'ui:enable_input' with invalid/missing data, using default placeholder:", data);
                this.setInputState(true, "Enter command...");
            }
        });

        this.#eventBus.subscribe('ui:disable_input', (data) => {
            // Allow disabling even if data or message is missing, provide a default message.
            const message = (data && typeof data.message === 'string') ? data.message : "Input disabled.";
            if (!data || typeof data.message !== 'string') { // Adjusted warning logic
                console.warn("DomRenderer received 'ui:disable_input' without specific message, using default:", data, ` -> "${message}"`);
            }
            this.setInputState(false, message);
        });


        this.#eventBus.subscribe('ui:display_location', (locationData) => {
            // Perform a more robust check on the expected structure of locationData
            if (locationData && typeof locationData.name === 'string' && typeof locationData.description === 'string' && Array.isArray(locationData.exits)) {
                this.renderLocation(locationData);
                // TODO: Consider validating items/npcs arrays if they become required
            } else {
                console.warn("DomRenderer received 'ui:display_location' event with invalid or incomplete data:", locationData);
                // Display an error message to the user via the renderer itself
                this.renderMessage("Error: Could not display location details due to invalid data.", "error");
            }
        });

        console.log("DomRenderer event subscriptions complete.");
    }

    /**
     * Renders a single feedback message (command echo, error, info, etc.)
     * to the output area.
     * @param {string} message - The HTML or text message to display.
     * @param {string} [type='info'] - Optional type ('info', 'error', 'command', 'warning', 'location') for styling.
     */
    renderMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `message-${type}`);
        messageDiv.innerHTML = message; // Use innerHTML carefully
        this.#outputDiv.appendChild(messageDiv);
        this.#outputDiv.scrollTop = this.#outputDiv.scrollHeight; // Auto-scroll
    }

    /**
     * Renders the description, exits, and potentially items/NPCs of the current location.
     * Appends the formatted location details to the output area using specific classes.
     * @param {LocationRenderData} locationData - The structured data for the location.
     */
    renderLocation(locationData) {
        let outputHtml = "";
        outputHtml += `<h2 class="location__name">${locationData.name || 'Unnamed Location'}</h2>`;
        outputHtml += `<p class="location__description">${locationData.description || 'You see nothing remarkable.'}</p>`;

        if (locationData.items && locationData.items.length > 0) {
            outputHtml += `<p class="location__items">Items here: ${locationData.items.join(', ')}</p>`;
        }
        if (locationData.npcs && locationData.npcs.length > 0) {
            outputHtml += `<p class="location__npcs">You see: ${locationData.npcs.join(', ')}</p>`;
        }

        if (locationData.exits && locationData.exits.length > 0) {
            outputHtml += `<p class="location__exits">Exits: ${locationData.exits.join(', ')}</p>`;
        } else {
            outputHtml += `<p class="location__exits">There are no obvious exits.</p>`;
        }

        // Render the combined location info as one block message with type 'location'
        this.renderMessage(outputHtml, 'location');
    }


    /**
     * Clears the main output area.
     */
    clearOutput() {
        this.#outputDiv.innerHTML = '';
    }

    /**
     * Manages the enabled/disabled status and placeholder text of the command input element.
     * @param {boolean} enabled - True to enable the input, false to disable.
     * @param {string} placeholderText - The text to display as a placeholder.
     */
    setInputState(enabled, placeholderText) {
        this.#inputElement.disabled = !enabled;
        this.#inputElement.placeholder = placeholderText;
    }
}

// Export the class if using modules elsewhere, or ensure it's loaded globally
// For this setup using modules:
export default DomRenderer;