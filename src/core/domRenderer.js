// src/ui/domRenderer.js

/**
 * @typedef {import('./eventBus.js').default} EventBus
 * @typedef {import('../types/eventTypes.js').LocationDisplayPayload} LocationDisplayPayload
 * @typedef {import('../types/eventTypes.js').InventoryRenderPayload} InventoryRenderPayload
 * @typedef {import('../types/eventTypes.js').UIUpdateActionsPayload} UIUpdateActionsPayload // Added for action buttons
 * @typedef {import('../types/eventTypes.js').ItemUIData} ItemUIData
 */

// Import necessary event types
import {
    EVENT_DISPLAY_LOCATION,
    EVENT_DISPLAY_MESSAGE,
    EVENT_UPDATE_ACTIONS // <-- Import the new event type (AC Ref: Import)
} from "../types/eventTypes.js";

/**
 * Implements the IGameRenderer contract using direct DOM manipulation.
 * Handles rendering messages, location details, controlling the input element's visual state,
 * updating the main title, managing the inventory UI panel, and rendering action buttons.
 * Subscribes itself to necessary UI events via the EventBus.
 */
class DomRenderer {
    /** @type {HTMLElement} */
    #outputDiv;
    /** @type {HTMLInputElement} */
    #inputElement;
    /** @type {HTMLHeadingElement} */
    #titleElement;
    /** @type {EventBus} */
    #eventBus;

    // --- Inventory UI Elements ---
    /** @type {HTMLElement | null} */
    #inventoryPanel = null;
    /** @type {HTMLElement | null} */
    #inventoryList = null;
    /** @type {boolean} */
    #isInventoryVisible = false;

    // --- Action Buttons Elements (FEAT-UI-ACTIONS-03) ---
    /** @type {HTMLElement | null} */ // AC1: Container Reference Property
    #actionButtonsContainer = null;

    /**
     * Creates an instance of DomRenderer.
     * @param {HTMLElement} outputDiv - The main element where game output is displayed.
     * @param {HTMLInputElement} inputElement - The input element for player commands.
     * @param {HTMLHeadingElement} titleElement - The H1 element for displaying titles/status.
     * @param {EventBus} eventBus - The application's event bus instance.
     */
    constructor(outputDiv, inputElement, titleElement, eventBus) {
        // Constructor validation remains the same...
        if (!outputDiv || !(outputDiv instanceof HTMLElement)) {
            throw new Error("DomRenderer requires a valid output HTMLElement.");
        }
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
            throw new Error("DomRenderer requires a valid HTMLInputElement.");
        }
        if (!titleElement || !(titleElement instanceof HTMLHeadingElement)) {
            throw new Error("DomRenderer requires a valid HTMLHeadingElement (H1).");
        }
        if (!eventBus || typeof eventBus.subscribe !== 'function' || typeof eventBus.dispatch !== 'function') {
            throw new Error("DomRenderer requires a valid EventBus instance.");
        }

        this.#outputDiv = outputDiv;
        this.#inputElement = inputElement;
        this.#titleElement = titleElement;
        this.#eventBus = eventBus;

        // --- Initialize Inventory UI ---
        this.#createInventoryPanel();

        // --- Initialize Action Buttons Container (FEAT-UI-ACTIONS-03) ---
        // AC1: Retrieve Container Reference & Error Handling
        this.#actionButtonsContainer = document.getElementById('action-buttons-container');
        if (!this.#actionButtonsContainer) {
            // Log an error but don't throw, as the rest of the renderer might still be useful
            console.error("DomRenderer Error: Could not find the required '#action-buttons-container' element in the DOM. Action buttons will not be rendered.");
            // Optionally, could dispatch an error message to the UI if the logger/eventbus is ready
            // this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, { text: "UI Init Warning: Action button container missing.", type: 'warning'});
        } else {
            console.log("DomRenderer: Found '#action-buttons-container'.");
        }

        // Subscribe to necessary events internally
        this.#subscribeToEvents();


        console.log("DomRenderer initialized, inventory panel created, action button container referenced, and subscribed to events.");
    }

    // #createInventoryPanel method remains unchanged...
    #createInventoryPanel() {
        this.#inventoryPanel = document.createElement('div');
        this.#inventoryPanel.id = 'inventory-panel';
        this.#inventoryPanel.classList.add('inventory-panel', 'hidden'); // Start hidden

        const header = document.createElement('h3');
        header.textContent = 'Inventory';
        this.#inventoryPanel.appendChild(header);

        this.#inventoryList = document.createElement('ul');
        this.#inventoryList.id = 'inventory-list';
        this.#inventoryPanel.appendChild(this.#inventoryList);

        // Add close button (optional)
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.onclick = () => this.toggleInventory(false); // Force hide
        this.#inventoryPanel.appendChild(closeButton);

        // Append to the body or a specific container (e.g., game-container)
        // Appending to game-container for better structure relative to output/input
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(this.#inventoryPanel);
        } else {
            console.warn("DomRenderer: Could not find #game-container to append inventory panel. Appending to body.");
            document.body.appendChild(this.#inventoryPanel);
        }
    }


    #subscribeToEvents() {
        // --- Standard UI Events ---
        this.#eventBus.subscribe(EVENT_DISPLAY_MESSAGE, this.#handleMessageDisplay.bind(this));
        this.#eventBus.subscribe('ui:command_echo', this.#handleCommandEcho.bind(this));
        this.#eventBus.subscribe('ui:enable_input', this.#handleEnableInput.bind(this));
        this.#eventBus.subscribe('ui:disable_input', this.#handleDisableInput.bind(this));
        this.#eventBus.subscribe(EVENT_DISPLAY_LOCATION, this.#handleDisplayLocation.bind(this));
        this.#eventBus.subscribe('ui:set_title', this.#handleSetTitle.bind(this));

        // --- Inventory UI Events ---
        this.#eventBus.subscribe('ui:render_inventory', this.#handleRenderInventory.bind(this));
        this.#eventBus.subscribe('ui:toggle_inventory', () => this.toggleInventory());

        // --- Action Buttons Events (FEAT-UI-ACTIONS-03) ---
        // AC2: Subscribe to EVENT_UPDATE_ACTIONS
        this.#eventBus.subscribe(EVENT_UPDATE_ACTIONS, this.#handleUpdateActions.bind(this));


        console.log("DomRenderer event subscriptions complete (including action updates).");
    }

    // --- Private Event Handlers ---

    // #handleMessageDisplay, #handleCommandEcho, #handleEnableInput, #handleDisableInput remain the same...
    /** @private @param {{text: string, type?: string}} message */
    #handleMessageDisplay(message) {
        if (message && typeof message.text === 'string') {
            this.renderMessage(message.text, message.type || 'info');
        } else {
            console.warn("DomRenderer received EVENT_DISPLAY_MESSAGE with invalid data:", message);
        }
    }

    /** @private @param {{command: string}} data */
    #handleCommandEcho(data) {
        if (data && typeof data.command === 'string') {
            this.renderMessage(`> ${data.command}`, 'command');
        } else {
            console.warn("DomRenderer received 'ui:command_echo' with invalid data:", data);
        }
    }

    /** @private @param {{placeholder: string}} data */
    #handleEnableInput(data) {
        if (data && typeof data.placeholder === 'string') {
            this.setInputState(true, data.placeholder);
        } else {
            console.warn("DomRenderer received 'ui:enable_input' with invalid/missing data, using default placeholder:", data);
            this.setInputState(true, "Enter command...");
        }
    }

    /** @private @param {{message?: string}} data */
    #handleDisableInput(data) {
        const message = (data && typeof data.message === 'string') ? data.message : "Input disabled.";
        if (!data || typeof data.message !== 'string') {
            console.warn("DomRenderer received 'ui:disable_input' without specific message, using default:", data, ` -> "${message}"`);
        }
        this.setInputState(false, message);
    }

    // #handleSetTitle, #handleRenderInventory remain the same...
    /**
     * Handles the 'ui:set_title' event.
     * @private
     * @param {{text: string}} data - The event payload. Should contain the new title text.
     */
    #handleSetTitle(data) {
        if (data && typeof data.text === 'string') {
            this.#titleElement.textContent = data.text;
        } else {
            console.warn("DomRenderer received 'ui:set_title' with invalid data:", data);
        }
    }

    /**
     * Handles the 'ui:render_inventory' event, updating the inventory panel content.
     * @private
     * @param {InventoryRenderPayload} payload - Data containing the list of items.
     */
    #handleRenderInventory(payload) {
        if (!this.#inventoryList) {
            console.error("Inventory list element not found!");
            return;
        }
        if (!payload || !Array.isArray(payload.items)) {
            console.warn("DomRenderer received 'ui:render_inventory' with invalid data:", payload);
            this.#inventoryList.innerHTML = '<li>Error loading inventory.</li>'; // Display error
            return;
        }
        this.#updateInventoryUI(payload.items);
    }

    // #handleDisplayLocation remains the same...
    /**
     * Event handler for EVENT_DISPLAY_LOCATION. Validates payload and calls renderLocation.
     * @private
     * @param {LocationDisplayPayload} locationData - The payload received from the event bus.
     */
    #handleDisplayLocation(locationData) {
        if (locationData &&
            typeof locationData.name === 'string' &&
            typeof locationData.description === 'string' &&
            Array.isArray(locationData.exits) &&
            (!locationData.items || Array.isArray(locationData.items)) &&
            (!locationData.entities || Array.isArray(locationData.entities))
        ) {
            this.renderLocation(locationData);
        } else {
            console.warn("DomRenderer received '" + EVENT_DISPLAY_LOCATION + "' event with invalid or incomplete data:", locationData);
            this.renderMessage("Error: Could not display location details due to invalid data format received.", "error");
        }
    }

    // --- NEW: Handler for Action Buttons (FEAT-UI-ACTIONS-03) ---
    /**
     * Handles the EVENT_UPDATE_ACTIONS event.
     * Clears the existing action buttons and renders new ones based on the payload.
     * @private
     * @param {UIUpdateActionsPayload} eventData - The payload containing the list of action strings.
     */
    #handleUpdateActions(eventData) {
        // AC3: Handler Implementation
        if (!this.#actionButtonsContainer) {
            // console.warn("DomRenderer: Cannot update action buttons because container element is missing."); // Already logged in constructor
            return; // Exit if the container wasn't found during construction
        }

        // AC4: Clearing - Efficiently remove all existing buttons
        this.#actionButtonsContainer.innerHTML = '';

        // Validate payload structure
        if (!eventData || !Array.isArray(eventData.actions)) {
            console.warn("DomRenderer received invalid EVENT_UPDATE_ACTIONS payload:", eventData);
            // Container is already cleared, so the empty state (AC11) is achieved implicitly
            return;
        }

        const actions = eventData.actions;

        // AC11: Empty State - If no actions, the container remains empty after clearing
        if (actions.length === 0) {
            // console.log("DomRenderer: No actions received, clearing action buttons."); // Optional log
            return; // Nothing more to do
        }

        // AC5: Button Creation Loop
        actions.forEach(actionString => {
            try {
                // Basic validation for the action string itself
                if (typeof actionString !== 'string' || actionString.trim() === '') {
                    // AC12: Error Handling - Skip invalid/empty strings
                    console.warn(`DomRenderer: Skipping invalid action string: "${actionString}"`);
                    return; // 'continue' equivalent in forEach
                }

                // AC5: Create button element
                const button = document.createElement('button');

                // AC6: Button Content/Styling
                button.textContent = actionString; // Set text to the action command
                button.classList.add('action-button'); // Add CSS class for styling
                button.setAttribute('title', `Click to ${actionString}`); // AC6: Accessibility title

                // AC7: Click Listener
                button.addEventListener('click', () => {
                    // AC8: Click Action - Retrieve the action string
                    const commandToSubmit = button.textContent; // Or actionString from the outer scope

                    // AC9: Command Dispatch
                    this.#eventBus.dispatch('command:submit', {command: commandToSubmit});
                    // console.log(`Action button clicked: "${commandToSubmit}". Dispatched command:submit.`); // Optional debug log
                });

                // AC10: Appending - Add the configured button to the container
                this.#actionButtonsContainer.appendChild(button);

            } catch (error) {
                // AC12: Error Handling - Catch errors during individual button creation/configuration
                console.error(`DomRenderer: Error creating button for action "${actionString}":`, error);
                // Continue to the next action, preventing one error from breaking all buttons
            }
        });
    }


    // --- Public Rendering Methods ---

    // renderMessage, renderLocation, clearOutput, setInputState remain unchanged...
    /**
     * Renders a single feedback message.
     * @param {string} message - The HTML or text message to display.
     * @param {string} [type='info'] - Optional type for styling.
     */
    renderMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `message-${type}`);
        messageDiv.innerHTML = message; // Assumes message is safe HTML or plain text
        this.#outputDiv.appendChild(messageDiv);
        this.#outputDiv.scrollTop = this.#outputDiv.scrollHeight; // Auto-scroll
    }

    /**
     * Renders the description, exits, items, and entities of the current location.
     * @param {LocationDisplayPayload} locationData - The structured data for the location.
     */
    renderLocation(locationData) {
        let outputHtml = "";
        outputHtml += `<h2 class="location__name">${locationData.name || 'Unnamed Location'}</h2>`;
        outputHtml += `<p class="location__description">${locationData.description || 'You see nothing remarkable.'}</p>`;

        if (locationData.items && locationData.items.length > 0) {
            const itemNames = locationData.items.map(item => item.name).join(', ');
            outputHtml += `<p class="location__items">Items here: ${itemNames}</p>`;
        }

        if (locationData.entities && locationData.entities.length > 0) {
            const entityNames = locationData.entities.map(entity => entity.name).join(', ');
            outputHtml += `<p class="location__entities">Others here: ${entityNames}</p>`;
        }

        if (locationData.exits && locationData.exits.length > 0) {
            const exitDescriptions = locationData.exits.map(exit => exit.description).join('<br>  ');
            outputHtml += `<p class="location__exits">Exits:<br>  ${exitDescriptions}</p>`;
        } else {
            outputHtml += `<p class="location__exits">Exits: None</p>`;
        }

        this.renderMessage(outputHtml, 'location');
    }

    /** Clears the main output area. */
    clearOutput() {
        this.#outputDiv.innerHTML = '';
    }

    /** Manages the enabled/disabled status and placeholder text of the command input element. */
    setInputState(enabled, placeholderText) {
        this.#inputElement.disabled = !enabled;
        this.#inputElement.placeholder = placeholderText;
    }


    // toggleInventory and #updateInventoryUI remain the same...
    /**
     * Toggles the visibility of the inventory panel.
     * @param {boolean} [forceState] - If true, shows the panel; if false, hides it. If undefined, toggles.
     */
    toggleInventory(forceState) {
        if (!this.#inventoryPanel) return;

        const shouldBeVisible = forceState === undefined ? !this.#isInventoryVisible : forceState;

        if (shouldBeVisible) {
            this.#eventBus.dispatch('ui:request_inventory_render', {});
            this.#inventoryPanel.classList.remove('hidden');
            this.#isInventoryVisible = true;
        } else {
            this.#inventoryPanel.classList.add('hidden');
            this.#isInventoryVisible = false;
        }
    }

    /**
     * Updates the inventory list display based on the provided item data.
     * Adds a "Drop" button to each item.
     * @private
     * @param {ItemUIData[]} itemsData - An array of item data objects.
     */
    #updateInventoryUI(itemsData) {
        if (!this.#inventoryList) return;

        this.#inventoryList.innerHTML = '';

        if (itemsData.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.textContent = '(Empty)';
            emptyLi.classList.add('inventory-item-empty');
            this.#inventoryList.appendChild(emptyLi);
        } else {
            itemsData.forEach(item => {
                const li = document.createElement('li');
                li.classList.add('inventory-item');
                li.dataset.itemId = item.id;

                if (item.icon) {
                    const img = document.createElement('img');
                    img.src = item.icon;
                    img.alt = item.name;
                    img.classList.add('inventory-item-icon');
                    li.appendChild(img);
                } else {
                    const iconPlaceholder = document.createElement('span');
                    iconPlaceholder.classList.add('inventory-item-icon-placeholder');
                    iconPlaceholder.textContent = '📦';
                    li.appendChild(iconPlaceholder);
                }

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('inventory-item-name');
                nameSpan.textContent = item.name || '(Unnamed Item)';
                li.appendChild(nameSpan);

                const dropButton = document.createElement('button');
                dropButton.textContent = 'Drop';
                dropButton.classList.add('inventory-item-drop-button');
                dropButton.dataset.itemName = item.name || '(Unnamed Item)';

                dropButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const clickedButton = /** @type {HTMLButtonElement} */ (event.target);
                    const parentLi = clickedButton.closest('li');
                    if (!parentLi) return;
                    const itemIdToDrop = parentLi.dataset.itemId;
                    const itemNameToDrop = clickedButton.dataset.itemName;
                    if (!itemIdToDrop || !itemNameToDrop) {
                        console.error('Drop button clicked, but missing item ID or name from dataset.');
                        return;
                    }
                    const commandString = `drop ${itemNameToDrop}`;
                    this.#eventBus.dispatch('command:submit', {command: commandString});
                    this.toggleInventory(false);
                });
                li.appendChild(dropButton);

                li.addEventListener('click', () => {
                    const currentSelected = this.#inventoryList?.querySelector('.selected');
                    if (currentSelected) {
                        currentSelected.classList.remove('selected');
                    }
                    li.classList.add('selected');
                    // console.log(`Selected item: ${item.name} (ID: ${item.id})`);
                });

                this.#inventoryList.appendChild(li);
            });
        }
    }
}

export default DomRenderer;