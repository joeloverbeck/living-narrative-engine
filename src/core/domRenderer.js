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
 * @typedef {object} ItemUIData
 * @property {string} id - Unique ID of the item.
 * @property {string} name - Display name of the item.
 * @property {string} [icon] - Optional path or identifier for an icon.
 * @property {string} [description] - Optional description for item details view.
 */

/**
 * @typedef {object} InventoryRenderPayload
 * @property {ItemUIData[]} items - Array of items to display in the inventory.
 */


/**
 * Implements the IGameRenderer contract using direct DOM manipulation.
 * Handles rendering messages, location details, controlling the input element's visual state,
 * updating the main title, and managing the inventory UI panel.
 * Subscribes itself to necessary UI events via the EventBus.
 */
class DomRenderer {
    /** @type {HTMLElement} */
    #outputDiv;
    /** @type {HTMLInputElement} */
    #inputElement;
    /** @type {HTMLHeadingElement} */ // Added type
    #titleElement; // Added
    /** @type {EventBus} */
    #eventBus;

    // --- Inventory UI Elements ---
    /** @type {HTMLElement | null} */
    #inventoryPanel = null;
    /** @type {HTMLElement | null} */
    #inventoryList = null;
    /** @type {boolean} */
    #isInventoryVisible = false;

    /**
     * Creates an instance of DomRenderer.
     * @param {HTMLElement} outputDiv - The main element where game output is displayed.
     * @param {HTMLInputElement} inputElement - The input element for player commands.
     * @param {HTMLHeadingElement} titleElement - The H1 element for displaying titles/status.
     * @param {EventBus} eventBus - The application's event bus instance.
     */
    constructor(outputDiv, inputElement, titleElement, eventBus) {
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
        this.#createInventoryPanel(); // Create the panel elements

        // Subscribe to necessary events internally
        this.#subscribeToEvents();


        console.log("DomRenderer initialized, inventory panel created, and subscribed to events.");
    }

    /**
     * Creates the initial HTML structure for the inventory panel.
     * It's initially hidden.
     * @private
     */
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

    /**
     * Internal method to set up all necessary EventBus subscriptions.
     * Called automatically by the constructor.
     * @private
     */
    #subscribeToEvents() {
        // --- Standard UI Events ---
        this.#eventBus.subscribe('ui:message_display', this.#handleMessageDisplay.bind(this));
        this.#eventBus.subscribe('ui:command_echo', this.#handleCommandEcho.bind(this));
        this.#eventBus.subscribe('ui:enable_input', this.#handleEnableInput.bind(this));
        this.#eventBus.subscribe('ui:disable_input', this.#handleDisableInput.bind(this));
        this.#eventBus.subscribe('ui:display_location', this.#handleDisplayLocation.bind(this));
        this.#eventBus.subscribe('ui:set_title', this.#handleSetTitle.bind(this));

        // --- Inventory UI Events ---
        // Event to update the content of the inventory UI
        this.#eventBus.subscribe('ui:render_inventory', this.#handleRenderInventory.bind(this));
        // Event to toggle visibility (can be triggered by InputHandler)
        this.#eventBus.subscribe('ui:toggle_inventory', () => this.toggleInventory());


        console.log("DomRenderer event subscriptions complete.");
    }

    // --- Private Event Handlers (Refactored for clarity) ---

    /** @private @param {{text: string, type?: string}} message */
    #handleMessageDisplay(message) {
        if (message && typeof message.text === 'string') {
            this.renderMessage(message.text, message.type || 'info');
        } else {
            console.warn("DomRenderer received 'ui:message_display' with invalid data:", message);
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

    /** @private @param {LocationRenderData} locationData */
    #handleDisplayLocation(locationData) {
        if (locationData && typeof locationData.name === 'string' && typeof locationData.description === 'string' && Array.isArray(locationData.exits)) {
            this.renderLocation(locationData);
        } else {
            console.warn("DomRenderer received 'ui:display_location' event with invalid or incomplete data:", locationData);
            this.renderMessage("Error: Could not display location details due to invalid data.", "error");
        }
    }

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
            // Optionally set a default error title or do nothing
            // this.#titleElement.textContent = "Error Setting Title";
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

    /**
     * Renders a single feedback message. (Implementation unchanged)
     * @param {string} message - The HTML or text message to display.
     * @param {string} [type='info'] - Optional type for styling.
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

    /**
     * Toggles the visibility of the inventory panel.
     * Optionally force show or hide.
     * @param {boolean} [forceState] - If true, shows the panel; if false, hides it. If undefined, toggles.
     */
    toggleInventory(forceState) {
        if (!this.#inventoryPanel) return;

        const shouldBeVisible = forceState === undefined ? !this.#isInventoryVisible : forceState;

        if (shouldBeVisible) {
            // Before showing, request fresh inventory data
            // The GameEngine or another manager should listen for this event,
            // gather data (EntityManager -> Player -> InventoryComponent -> Item Names),
            // and dispatch 'ui:render_inventory'
            this.#eventBus.dispatch('ui:request_inventory_render', {});

            this.#inventoryPanel.classList.remove('hidden');
            this.#isInventoryVisible = true;
            // Optional: Maybe disable game input while inventory is open?
            // this.#eventBus.dispatch('ui:disable_input', { message: 'Inventory open...' });
        } else {
            this.#inventoryPanel.classList.add('hidden');
            this.#isInventoryVisible = false;
            // Optional: Re-enable game input if it was disabled
            // this.#eventBus.dispatch('ui:enable_input', { placeholder: 'Enter command...' });
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

        // Clear previous items
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
                li.dataset.itemId = item.id; // Store item ID for potential interactions

                // Display Icon (if available) - Unchanged
                if (item.icon) {
                    // ... icon logic ...
                    const img = document.createElement('img');
                    img.src = item.icon; // Assuming icon is a path
                    img.alt = item.name;
                    img.classList.add('inventory-item-icon');
                    li.appendChild(img);
                } else {
                    // ... placeholder logic ...
                    const iconPlaceholder = document.createElement('span');
                    iconPlaceholder.classList.add('inventory-item-icon-placeholder');
                    iconPlaceholder.textContent = '📦'; // Simple box emoji as placeholder
                    li.appendChild(iconPlaceholder);
                }

                // Display Name - Unchanged
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('inventory-item-name');
                nameSpan.textContent = item.name || '(Unnamed Item)';
                li.appendChild(nameSpan);

                // ADD DROP BUTTON ---
                const dropButton = document.createElement('button');
                dropButton.textContent = 'Drop';
                dropButton.classList.add('inventory-item-drop-button');
                // Store item name directly on the button for the event listener
                dropButton.dataset.itemName = item.name || '(Unnamed Item)';

                dropButton.addEventListener('click', (event) => {
                    event.stopPropagation(); // VERY IMPORTANT: Prevent li's click listener

                    const clickedButton = /** @type {HTMLButtonElement} */ (event.target);
                    const parentLi = clickedButton.closest('li');
                    if (!parentLi) return; // Should not happen

                    const itemIdToDrop = parentLi.dataset.itemId;
                    const itemNameToDrop = clickedButton.dataset.itemName; // Retrieve from button's dataset

                    if (!itemIdToDrop || !itemNameToDrop) {
                        console.error('Drop button clicked, but missing item ID or name from dataset.');
                        return;
                    }

                    // Construct the command
                    const commandString = `drop ${itemNameToDrop}`;
                    console.log(`Drop button clicked for item: ${itemNameToDrop} (ID: ${itemIdToDrop}). Constructing command: "${commandString}"`);

                    // Submit the command via EventBus
                    // The GameLoop should listen for 'command:submit'
                    this.#eventBus.dispatch('command:submit', {command: commandString});

                    // Optional: Close inventory after dropping
                    this.toggleInventory(false);
                });
                li.appendChild(dropButton);

                // Add click listener for selection (basic feedback) - Unchanged
                li.addEventListener('click', () => {
                    // Remove 'selected' from previously selected item
                    const currentSelected = this.#inventoryList?.querySelector('.selected');
                    if (currentSelected) {
                        currentSelected.classList.remove('selected');
                    }
                    // Add 'selected' to clicked item
                    li.classList.add('selected');
                    console.log(`Selected item: ${item.name} (ID: ${item.id})`);
                    // Optional: Dispatch 'ui:inventory_item_selected' event
                    // this.#eventBus.dispatch('ui:inventory_item_selected', { itemData: item });
                });

                this.#inventoryList.appendChild(li);
            });
        }
    }
}

// Export the class if using modules elsewhere, or ensure it's loaded globally
// For this setup using modules:
export default DomRenderer;