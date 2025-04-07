// domRenderer.js

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
 * Handles rendering messages, location details, and controlling the input element's visual state.
 */
class DomRenderer {
    /**
     * Creates an instance of DomRenderer.
     * @param {HTMLElement} outputDiv - The main element where game output is displayed.
     * @param {HTMLInputElement} inputElement - The input element for player commands.
     */
    constructor(outputDiv, inputElement) {
        if (!outputDiv || !(outputDiv instanceof HTMLElement)) {
            throw new Error("DomRenderer requires a valid output HTMLElement.");
        }
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
            throw new Error("DomRenderer requires a valid HTMLInputElement.");
        }
        this.outputDiv = outputDiv;
        this.inputElement = inputElement;
        console.log("DomRenderer initialized.");
    }

    /**
     * Renders a single feedback message (command echo, error, info, etc.)
     * to the output area.
     * @param {string} message - The HTML or text message to display.
     * @param {string} [type='info'] - Optional type ('info', 'error', 'command', 'warning', 'location') for styling.
     */
    renderMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        // Ensure 'message' class is always added, plus the specific type
        messageDiv.classList.add('message', `message-${type}`);
        // Use innerHTML carefully
        messageDiv.innerHTML = message;
        this.outputDiv.appendChild(messageDiv);
        // Auto-scroll
        this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
    }

    /**
     * Renders the description, exits, and potentially items/NPCs of the current location.
     * Appends the formatted location details to the output area using specific classes.
     * @param {LocationRenderData} locationData - The structured data for the location.
     */
    renderLocation(locationData) {
        let outputHtml = "";

        // 1. Display Name with class
        outputHtml += `<h2 class="location__name">${locationData.name || 'Unnamed Location'}</h2>`;

        // 2. Display Description with class
        outputHtml += `<p class="location__description">${locationData.description || 'You see nothing remarkable.'}</p>`;

        // 3. TODO: Display Items (Future Enhancement - add class if implemented)
        if (locationData.items && locationData.items.length > 0) {
            outputHtml += `<p class="location__items">Items here: ${locationData.items.join(', ')}</p>`; // Added class
        }

        // 4. TODO: Display NPCs (Future Enhancement - add class if implemented)
        if (locationData.npcs && locationData.npcs.length > 0) {
            outputHtml += `<p class="location__npcs">You see: ${locationData.npcs.join(', ')}</p>`; // Added class
        }

        // 5. Display Exits with class
        if (locationData.exits && locationData.exits.length > 0) {
            outputHtml += `<p class="location__exits">Exits: ${locationData.exits.join(', ')}</p>`;
        } else {
            // Use the same class even if there are no exits for consistency
            outputHtml += `<p class="location__exits">There are no obvious exits.</p>`;
        }

        // Render the combined location info as one block message with type 'location'
        this.renderMessage(outputHtml, 'location');
    }

    /**
     * Clears the main output area.
     */
    clearOutput() {
        this.outputDiv.innerHTML = '';
    }

    /**
     * Manages the enabled/disabled status and placeholder text of the command input element.
     * @param {boolean} enabled - True to enable the input, false to disable.
     * @param {string} placeholderText - The text to display as a placeholder.
     */
    setInputState(enabled, placeholderText) {
        this.inputElement.disabled = !enabled;
        this.inputElement.placeholder = placeholderText;
        // Note: focus() is handled by InputHandler as it's related to capturing input
    }
}

// Export the class if using modules elsewhere, or ensure it's loaded globally
// For this setup using modules:
export default DomRenderer;