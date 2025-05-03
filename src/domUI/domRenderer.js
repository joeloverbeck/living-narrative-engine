// src/domUI/domRenderer.js
// --- FIX for TC3: Added 'success' to validTypes ---
// --- FIX for TC2 (Current Issue): Changed 'warn' to 'warning' ---
// --- T-2.2: Removed title handling logic ---

// --- Import Utilities ---
// Assuming setPropertyByPath exists and is needed for other cases.
import {setPropertyByPath} from '../utils/domUtils.js';

// --- Import Interfaces ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */

/**
 * Implements the IGameRenderer contract using direct DOM manipulation.
 * Handles rendering messages, location details, controlling the input element's visual state,
 * updating the main title, managing the inventory UI panel, and rendering action buttons.
 * Subscribes itself to necessary UI events via the EventBus.
 * Uses ValidatedEventDispatcher for specific outgoing events requiring validation.
 *
 * @deprecated This class is being refactored into smaller, focused components. Functionality is being moved. See `dom-ui/` directory.
 */
class DomRenderer {
    /** @type {HTMLElement} */
    #outputDiv;
    /** @type {HTMLInputElement} */
    #inputElement;
    // T-2.2: Removed #titleElement
    // /** @type {HTMLHeadingElement} */
    // #titleElement;
    /** @type {EventBus} */
    #eventBus;
    // --- EVENT-MIGR-018: Inject ValidatedEventDispatcher ---
    /** @type {ValidatedEventDispatcher} */
    #validatedEventDispatcher;
    // --- EVENT-MIGR-018: Inject ILogger ---
    /** @type {ILogger} */
    #logger;

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
     * @param {object} dependencies - The required dependencies.
     * @param {HTMLElement} dependencies.outputDiv - The main element where game output is displayed.
     * @param {HTMLInputElement} dependencies.inputElement - The input element for player commands.
     * @param {EventBus} dependencies.eventBus - The application's event bus instance.
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Service for dispatching validated events.
     * @param {ILogger} dependencies.logger - Service for logging messages.
     * T-2.2: Removed titleElement dependency
     * @param {HTMLHeadingElement} dependencies.titleElement - The H1 element for displaying titles/status. REMOVED
     */
    constructor({outputDiv, inputElement, /* T-2.2: titleElement, */ eventBus, validatedEventDispatcher, logger}) {
        // --- Constructor Validation ---
        if (!outputDiv || typeof outputDiv !== 'object' || outputDiv.nodeType !== 1) {
            throw new Error('DomRenderer requires a valid output DOM Element.');
        }
        if (!inputElement || typeof inputElement !== 'object' || inputElement.nodeType !== 1 || inputElement.tagName !== 'INPUT') {
            throw new Error('DomRenderer requires a valid HTMLInputElement.');
        }
        // T-2.2: Removed titleElement validation
        // if (!titleElement || typeof titleElement !== 'object' || titleElement.nodeType !== 1 || titleElement.tagName !== 'H1') {
        //     throw new Error('DomRenderer requires a valid HTMLHeadingElement (H1).');
        // }
        if (!eventBus || typeof eventBus.subscribe !== 'function' || typeof eventBus.dispatch !== 'function') {
            throw new Error('DomRenderer requires a valid EventBus instance.');
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            throw new Error('DomRenderer requires a valid ValidatedEventDispatcher instance.'); // AC5
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('DomRenderer requires a valid ILogger instance.'); // AC5
        }

        this.#outputDiv = outputDiv;
        this.#inputElement = inputElement;
        // T-2.2: Removed #titleElement assignment
        // this.#titleElement = titleElement;
        this.#eventBus = eventBus;
        this.#validatedEventDispatcher = validatedEventDispatcher; // AC5
        this.#logger = logger; // AC5

        // --- Initialize Inventory UI ---
        const doc = this.#outputDiv?.ownerDocument || (typeof document !== 'undefined' ? document : null);

        if (doc) {
            this.#createInventoryPanel(doc);
            this.#actionButtonsContainer = doc.getElementById('action-buttons-container');
            if (!this.#actionButtonsContainer) {
                this.#logger.error("DomRenderer Error: Could not find the required '#action-buttons-container' element in the DOM. Action buttons will not be rendered.");
            } else {
                this.#logger.info("DomRenderer: Found '#action-buttons-container'.");
            }
        } else {
            this.#logger.warn('DomRenderer: Skipping UI panel/container initialization as "document" context could not be determined.');
        }


        // Subscribe to necessary events internally
        this.#subscribeToEvents();

        // T-2.2: Adjusted log message
        this.#logger.info('DomRenderer initialized (title handling moved to TitleRenderer).');
    }

    #createInventoryPanel(doc) { // Pass document context
        if (!doc) {
            this.#logger.warn('DomRenderer: Cannot create inventory panel, "document" context is not available.');
            return;
        }

        this.#inventoryPanel = doc.createElement('div');
        this.#inventoryPanel.id = 'inventory-panel';
        this.#inventoryPanel.classList.add('inventory-panel', 'hidden'); // Start hidden

        const header = doc.createElement('h3');
        header.textContent = 'Inventory';
        this.#inventoryPanel.appendChild(header);

        this.#inventoryList = doc.createElement('ul');
        this.#inventoryList.id = 'inventory-list';
        this.#inventoryPanel.appendChild(this.#inventoryList);

        const closeButton = doc.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.onclick = () => this.toggleInventory(false); // Force hide
        this.#inventoryPanel.appendChild(closeButton);

        const gameContainer = doc.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(this.#inventoryPanel);
        } else {
            this.#logger.warn('DomRenderer: Could not find #game-container to append inventory panel. Appending to body.');
            doc.body.appendChild(this.#inventoryPanel);
        }
    }


    #subscribeToEvents() {
        // --- Standard UI Events (Ticket 18) ---
        // M-1.2: Removed subscription for event:command_echo
        this.#eventBus.subscribe('event:disable_input', this.#handleDisableInput.bind(this)); // Standardized input disable
        // M-1.2: Removed subscription for ui:show_message
        // M-1.2: Removed subscription for ui:show_fatal_error
        // T-2.2: Removed subscription for ui:set_title
        // this.#eventBus.subscribe('ui:set_title', this.#handleSetTitle.bind(this));

        // --- Game Specific UI Events ---
        this.#eventBus.subscribe('event:display_location', this.#handleDisplayLocation.bind(this));

        // --- Inventory UI Events ---
        this.#eventBus.subscribe('event:render_inventory', this.#handleRenderInventory.bind(this));
        this.#eventBus.subscribe('event:toggle_inventory', () => this.toggleInventory());
        // Note: 'ui:request_inventory_render' is dispatched internally by toggleInventory

        // --- Action Buttons Events (FEAT-UI-ACTIONS-03) ---
        this.#eventBus.subscribe('event:update_available_actions', this.#handleUpdateActions.bind(this));

        // T-2.2: Removed subscriptions for Initialization Events (handled by TitleRenderer now)
        // --- Initialization Events (Ticket 17) ---
        // this.#eventBus.subscribe('initialization:initialization_service:started', this.#handleInitializationStarted.bind(this));
        // this.#eventBus.subscribe('initialization:initialization_service:completed', this.#handleInitializationCompleted.bind(this));
        // this.#eventBus.subscribe('initialization:initialization_service:failed', this.#handleInitializationFailed.bind(this));
        // this.#eventBus.subscribe('initialization:world_loader:started', this.#handleInitializationStepStarted.bind(this));
        // this.#eventBus.subscribe('initialization:system_initializer:started', this.#handleInitializationStepStarted.bind(this));
        // this.#eventBus.subscribe('initialization:game_state_initializer:started', this.#handleInitializationStepStarted.bind(this));
        // this.#eventBus.subscribe('initialization:world_initializer:started', this.#handleInitializationStepStarted.bind(this));
        // this.#eventBus.subscribe('initialization:input_setup_service:started', this.#handleInitializationStepStarted.bind(this));
        // this.#eventBus.subscribe('initialization:world_loader:failed', this.#handleInitializationStepFailed.bind(this));
        // this.#eventBus.subscribe('initialization:system_initializer:failed', this.#handleInitializationStepFailed.bind(this));
        // this.#eventBus.subscribe('initialization:game_state_initializer:failed', this.#handleInitializationStepFailed.bind(this));
        // this.#eventBus.subscribe('initialization:world_initializer:failed', this.#handleInitializationStepFailed.bind(this));
        // this.#eventBus.subscribe('initialization:input_setup_service:failed', this.#handleInitializationStepFailed.bind(this));

        // T-2.2: Adjusted log message
        this.#logger.info('DomRenderer event subscriptions complete (excluding title/init events).');
    }

    // --- Private Event Handlers ---

    // M-1.2: Removed #handleCommandEcho method body

    /**
     * Handles disabling the input field. (Ticket 18: Standardized Event)
     * @private
     * @param {object} data - Expected { type: string, payload: EventDisableInputPayload }
     */
    #handleDisableInput(data) {
        const payload = data?.payload;
        const message = (payload && typeof payload.message === 'string') ? payload.message : 'Input disabled.';
        if (!payload || typeof payload.message !== 'string') {
            this.#logger.warn("DomRenderer received 'event:disable_input' without specific message in payload, using default:", data, ` -> "${message}"`);
        }
        this.setInputState(false, message);
    }


    /**
     * @private
     * @param {object} data - Expected { type: string, payload: InventoryRenderPayload }
     */
    #handleRenderInventory(data) {
        const payload = data?.payload;
        if (!this.#inventoryList) {
            this.#logger.error('Inventory list element not found!');
            return;
        }
        const doc = this.#inventoryList?.ownerDocument;
        if (!doc) {
            this.#logger.error('DomRenderer: Cannot update inventory UI, document context not found.');
            return;
        }

        if (!payload || !Array.isArray(payload.items)) {
            this.#logger.warn("DomRenderer received 'event:render_inventory' with invalid data structure or payload:", data);
            this.#inventoryList.innerHTML = '<li>Error loading inventory.</li>';
            return;
        }
        this.#updateInventoryUI(payload.items, doc); // Pass doc
    }

    /**
     * @private
     * @param {object} data - Expected { type: string, payload: LocationDisplayPayload }
     */
    #handleDisplayLocation(data) {
        const locationData = data?.payload;
        if (locationData &&
            typeof locationData.name === 'string' &&
            typeof locationData.description === 'string' &&
            Array.isArray(locationData.exits) &&
            (!locationData.items || Array.isArray(locationData.items)) &&
            (!locationData.entities || Array.isArray(locationData.entities))
        ) {
            this.renderLocation(locationData);
        } else {
            this.#logger.warn("DomRenderer received '" + data?.type + "' event with invalid or incomplete payload:", data);
            // M-1.2: NOTE: This uses renderMessage which is being removed.
            this.#logger.error('Error: Could not display location details due to invalid data format received. Payload:', data);
        }
    }

    // M-1.2: Removed #handleShowMessage method body

    // M-1.2: Removed #handleFatalError method body

    // T-2.2: Removed #handleSetTitle method
    // /**
    //  * Handles setting the main title directly via an event. (Ticket 18: Standardized Event - NEW)
    //  * @private
    //  * @param {object} data - Expected { type: string, payload: UISetTitlePayload }
    //  */
    // #handleSetTitle(data) {
    //     const payload = data?.payload;
    //     if (payload && typeof payload.text === 'string') {
    //         this.setTitle(payload.text);
    //     } else {
    //         this.#logger.warn("DomRenderer received 'ui:set_title' with invalid payload structure or missing 'text' property:", data);
    //     }
    // }

    /**
     * @private
     * @param {object} data - Expected { type: string, payload: UIUpdateActionsPayload }
     */
    #handleUpdateActions(data) {
        const eventData = data?.payload;

        if (!this.#actionButtonsContainer) {
            this.#logger.warn('DomRenderer: Cannot update action buttons, container element is null.');
            return; // Error already logged in constructor if applicable
        }
        const doc = this.#actionButtonsContainer.ownerDocument;
        if (!doc) {
            this.#logger.warn('DomRenderer: Cannot update action buttons, document context not found.');
            return;
        }

        this.#actionButtonsContainer.innerHTML = ''; // Clear existing buttons

        if (!eventData || !Array.isArray(eventData.actions)) {
            this.#logger.warn('DomRenderer received invalid "event:update_available_actions" payload structure:', data);
            return;
        }

        const actions = eventData.actions;
        if (actions.length === 0) {
            this.#logger.debug('DomRenderer: No actions received, clearing action buttons.');
            return;
        }

        actions.forEach(actionString => {
            try {
                if (typeof actionString !== 'string' || actionString.trim() === '') {
                    this.#logger.warn(`DomRenderer: Skipping invalid action string: "${actionString}"`);
                    return;
                }
                const button = doc.createElement('button'); // Use correct document
                button.textContent = actionString;
                button.classList.add('action-button');
                button.setAttribute('title', `Click to ${actionString}`);

                button.addEventListener('click', async () => {
                    const commandToSubmit = button.textContent;
                    this.#logger.debug(`DomRenderer: Action button "${commandToSubmit}" clicked. Attempting validated dispatch...`);
                    const dispatched = await this.#validatedEventDispatcher.dispatchValidated(
                        'command:submit',
                        {command: commandToSubmit}
                    );
                    if (dispatched) {
                        this.#logger.debug(`DomRenderer: Event 'command:submit' for "${commandToSubmit}" dispatched successfully.`);
                    } else {
                        this.#logger.warn(`DomRenderer: Event 'command:submit' for "${commandToSubmit}" was NOT dispatched (validation failed or other error). See previous dispatcher logs.`);
                    }
                });
                this.#actionButtonsContainer.appendChild(button);
            } catch (error) {
                this.#logger.error(`DomRenderer: Error creating button for action "${actionString}":`, error);
            }
        });
    }

    // --- Ticket 17 / T-2.2: Initialization Event Handlers REMOVED ---
    // These are now handled by TitleRenderer and potentially UiMessageRenderer
    // #handleInitializationStarted(...) { ... }
    // #handleInitializationStepStarted(...) { ... }
    // #handleInitializationCompleted(...) { ... }
    // #handleInitializationFailed(...) { ... }
    // #handleInitializationStepFailed(...) { ... }

    // --- Public Rendering Methods ---

    // T-2.2: Removed setTitle method
    // /** @param {string} titleText */
    // setTitle(titleText) {
    //     if (this.#titleElement) {
    //         this.#titleElement.textContent = titleText;
    //     } else {
    //         this.#logger.warn("DomRenderer: Cannot set title, #titleElement is null.");
    //     }
    // }

    // M-1.2: Removed renderMessage method body

    /**
     * @param {LocationDisplayPayload} locationData
     * @deprecated Functionality moved to LocationRenderer.
     * */
    renderLocation(locationData) {
        let outputHtml = '';
        outputHtml += `<h2 class="location__name">${locationData.name || 'Unnamed Location'}</h2>`;
        outputHtml += `<p class="location__description">${locationData.description || 'You see nothing remarkable.'}</p>`;
        if (locationData.items && locationData.items.length > 0) {
            const itemNames = locationData.items.map(item => item.name || 'unnamed item').join(', ');
            outputHtml += `<p class="location__items">Items here: ${itemNames}</p>`;
        }
        if (locationData.entities && locationData.entities.length > 0) {
            const entityNames = locationData.entities.map(entity => entity.name || 'unnamed entity').join(', ');
            outputHtml += `<p class="location__entities">Others here: ${entityNames}</p>`;
        }
        if (locationData.exits && locationData.exits.length > 0) {
            const exitDescriptions = locationData.exits.map(exit => exit.description || 'an exit').join('<br>  ');
            outputHtml += `<p class="location__exits">Exits:<br>  ${exitDescriptions}</p>`;
        } else {
            outputHtml += '<p class="location__exits">Exits: None</p>';
        }
        // M-1.2: NOTE: This uses renderMessage which is being removed.
        this.#logger.info(`Location HTML (was renderMessage): ${outputHtml}`);
        // this.renderMessage(outputHtml, 'location', {allowHtml: true}); // Original line
    }

    /** @deprecated Functionality likely moved to specific renderers or facade. */
    clearOutput() {
        if (this.#outputDiv) {
            this.#outputDiv.innerHTML = '';
        } else {
            this.#logger.warn("DomRenderer: Cannot clear output, #outputDiv is null.");
        }
    }

    /**
     * @param {boolean} enabled
     * @param {string} placeholderText
     * @deprecated Functionality moved to InputStateController.
     */
    setInputState(enabled, placeholderText) {
        if (!this.#inputElement) {
            this.#logger.error("DomRenderer: Cannot set input state, #inputElement is null.");
            return;
        }
        this.#inputElement.disabled = !enabled;
        this.#inputElement.placeholder = placeholderText;
    }

    /**
     * @param {boolean} [forceState]
     * @deprecated Functionality moved to InventoryPanel.
     * */
    toggleInventory(forceState) {
        if (!this.#inventoryPanel) {
            this.#logger.warn("DomRenderer: Cannot toggle inventory, panel element does not exist.");
            return;
        }
        const shouldBeVisible = forceState === undefined ? !this.#isInventoryVisible : forceState;
        if (shouldBeVisible) {
            const doc = this.#inventoryPanel.ownerDocument;
            if (!doc) {
                this.#logger.error("DomRenderer: Cannot request inventory render, document context unavailable.");
                return;
            }
            this.#eventBus.dispatch('ui:request_inventory_render', {}); // Request happens first
            this.#inventoryPanel.classList.remove('hidden'); // Then show panel
            this.#isInventoryVisible = true;
        } else {
            this.#inventoryPanel.classList.add('hidden');
            this.#isInventoryVisible = false;
        }
    }

    /**
     * @private
     * @param {ItemUIData[]} itemsData
     * @param {Document} doc - The document context to use for creating elements.
     * @deprecated Functionality moved to InventoryPanel.
     */
    #updateInventoryUI(itemsData, doc) { // Accept doc as parameter
        if (!doc) {
            this.#logger.error('DomRenderer: Cannot update inventory UI, document context is missing.');
            return;
        }
        if (!this.#inventoryList) {
            this.#logger.error('DomRenderer: Cannot update inventory UI, list element is null.');
            return;
        }
        this.#inventoryList.innerHTML = ''; // Clear existing items
        if (itemsData.length === 0) {
            const emptyLi = doc.createElement('li'); // Use correct document
            emptyLi.textContent = '(Empty)';
            emptyLi.classList.add('inventory-item-empty');
            this.#inventoryList.appendChild(emptyLi);
        } else {
            itemsData.forEach(item => {
                const li = doc.createElement('li'); // Use correct document
                li.classList.add('inventory-item');
                li.dataset.itemId = item.id;
                const itemName = item.name || '(Unnamed Item)';
                if (item.icon) {
                    const img = doc.createElement('img'); // Use correct document
                    img.src = item.icon;
                    img.alt = itemName;
                    img.classList.add('inventory-item-icon');
                    li.appendChild(img);
                } else {
                    const iconPlaceholder = doc.createElement('span'); // Use correct document
                    iconPlaceholder.classList.add('inventory-item-icon-placeholder');
                    iconPlaceholder.textContent = '📦';
                    li.appendChild(iconPlaceholder);
                }
                const nameSpan = doc.createElement('span'); // Use correct document
                nameSpan.classList.add('inventory-item-name');
                nameSpan.textContent = itemName;
                li.appendChild(nameSpan);
                const dropButton = doc.createElement('button'); // Use correct document
                dropButton.textContent = 'Drop';
                dropButton.classList.add('inventory-item-drop-button');
                dropButton.dataset.itemName = itemName;
                dropButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const clickedButton = /** @type {HTMLButtonElement} */ (event.target);
                    const parentLi = clickedButton.closest('li');
                    if (!parentLi) {
                        this.#logger.error('DomRenderer: Could not find parent <li> for drop button.');
                        return;
                    }
                    const itemIdToDrop = parentLi.dataset.itemId;
                    const itemNameToDrop = clickedButton.dataset.itemName;
                    if (!itemIdToDrop || !itemNameToDrop) {
                        this.#logger.error('DomRenderer: Drop button clicked, but missing item ID or name from dataset.');
                        return;
                    }
                    const commandString = `drop ${itemNameToDrop}`;
                    this.#logger.debug(`DomRenderer: Inventory Drop button for "${itemNameToDrop}" clicked. Attempting validated dispatch...`);
                    const dispatched = await this.#validatedEventDispatcher.dispatchValidated('command:submit', {command: commandString});
                    if (dispatched) {
                        this.#logger.debug(`DomRenderer: Event 'command:submit' for "${commandString}" dispatched successfully.`);
                        this.toggleInventory(false); // Close inventory
                    } else {
                        this.#logger.warn(`DomRenderer: Event 'command:submit' for "${commandString}" was NOT dispatched (validation failed or other error).`);
                    }
                });
                li.appendChild(dropButton);
                li.addEventListener('click', () => {
                    const currentSelected = this.#inventoryList?.querySelector('.selected');
                    if (currentSelected) {
                        currentSelected.classList.remove('selected');
                    }
                    li.classList.add('selected');
                    this.#logger.debug(`Selected item: ${itemName} (ID: ${item.id})`);
                });
                this.#inventoryList.appendChild(li);
            });
        }
    }

    /**
     * Mutates properties of DOM elements matching a selector within the correct document context.
     * Checks for document availability before attempting mutation.
     * Includes direct handling for 'textContent' and 'innerHTML'.
     * @param {string} selector - The CSS selector to query for elements.
     * @param {string} propertyPath - Dot-notation path to the property to set (e.g., 'style.color', 'dataset.value', 'textContent').
     * @param {*} value - The value to set the property to.
     * @returns {{count: number, modified: number, failed: number}} - Object indicating total elements found, how many were modified, and how many failed to update.
     * @deprecated Functionality likely moved to DomMutationService or specific renderers.
     */
    mutate(selector, propertyPath, value) {
        const doc = this.#outputDiv?.ownerDocument;
        if (!doc) {
            this.#logger.warn(`DomRenderer.mutate: Cannot mutate elements for selector "${selector}", document context is not available.`);
            return {count: 0, modified: 0, failed: 0};
        }

        let totalFound = 0;
        let successCount = 0;
        let elements;
        try {
            elements = doc.querySelectorAll(selector);
        } catch (error) {
            this.#logger.error(`DomRenderer.mutate: Invalid selector "${selector}".`, error);
            return {count: 0, modified: 0, failed: 0};
        }

        totalFound = elements.length;
        if (totalFound === 0) {
            this.#logger.debug(`DomRenderer.mutate: Selector "${selector}" found no elements in the current document context.`);
            return {count: 0, modified: 0, failed: 0};
        }

        elements.forEach(element => {
            try {
                if (propertyPath === 'textContent') {
                    if (element.textContent !== value) {
                        element.textContent = value;
                        successCount++;
                    }
                } else if (propertyPath === 'innerHTML') {
                    if (element.innerHTML !== value) {
                        element.innerHTML = value;
                        successCount++;
                    }
                } else {
                    const changed = setPropertyByPath(element, propertyPath, value);
                    if (changed) {
                        successCount++;
                    }
                }
            } catch (error) {
                this.#logger.error(`DomRenderer.mutate: Failed to set property "${propertyPath}" on element matched by "${selector}". Value: ${JSON.stringify(value)}`, error);
            }
        });

        const failedCount = totalFound - successCount;
        const modifiedCount = successCount;

        if (failedCount > 0) {
            this.#logger.warn(`DomRenderer.mutate: Encountered ${failedCount} issue(s) while setting property "${propertyPath}" for selector "${selector}".`);
        } else if (modifiedCount > 0) {
            this.#logger.debug(`DomRenderer.mutate: Successfully modified property "${propertyPath}" on ${modifiedCount} element(s) matching "${selector}"`);
        } else if (totalFound > 0 && modifiedCount === 0 && failedCount === 0) {
            this.#logger.debug(`DomRenderer.mutate: Found ${totalFound} element(s) for selector "${selector}", property "${propertyPath}" already had the target value.`);
        }

        return {
            count: totalFound,
            modified: modifiedCount,
            failed: failedCount
        };
    }


}

export default DomRenderer;