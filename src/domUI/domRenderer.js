// src/domUI/domRenderer.js
// --- FIX for TC3: Added 'success' to validTypes ---
// --- FIX for TC2 (Current Issue): Changed 'warn' to 'warning' ---

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
     * @param {HTMLHeadingElement} dependencies.titleElement - The H1 element for displaying titles/status.
     * @param {EventBus} dependencies.eventBus - The application's event bus instance.
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Service for dispatching validated events.
     * @param {ILogger} dependencies.logger - Service for logging messages.
     */
    constructor({outputDiv, inputElement, titleElement, eventBus, validatedEventDispatcher, logger}) {
        // --- Constructor Validation ---
        // Check if outputDiv is a truthy object and an Element node (nodeType 1)
        if (!outputDiv || typeof outputDiv !== 'object' || outputDiv.nodeType !== 1) {
            throw new Error('DomRenderer requires a valid output DOM Element.');
        }
        // Check for input element specifically by nodeType and tagName
        if (!inputElement || typeof inputElement !== 'object' || inputElement.nodeType !== 1 || inputElement.tagName !== 'INPUT') {
            throw new Error('DomRenderer requires a valid HTMLInputElement.');
        }
        // Check for H1 element specifically by nodeType and tagName
        if (!titleElement || typeof titleElement !== 'object' || titleElement.nodeType !== 1 || titleElement.tagName !== 'H1') {
            throw new Error('DomRenderer requires a valid HTMLHeadingElement (H1).');
        }
        if (!eventBus || typeof eventBus.subscribe !== 'function' || typeof eventBus.dispatch !== 'function') {
            throw new Error('DomRenderer requires a valid EventBus instance.');
        }
        // --- EVENT-MIGR-018: Validate new dependencies ---
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            throw new Error('DomRenderer requires a valid ValidatedEventDispatcher instance.'); // AC5
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('DomRenderer requires a valid ILogger instance.'); // AC5
        }

        this.#outputDiv = outputDiv;
        this.#inputElement = inputElement;
        this.#titleElement = titleElement;
        this.#eventBus = eventBus;
        this.#validatedEventDispatcher = validatedEventDispatcher; // AC5
        this.#logger = logger; // AC5

        // --- Initialize Inventory UI ---
        // Get the document context from one of the passed elements
        const doc = this.#outputDiv?.ownerDocument || (typeof document !== 'undefined' ? document : null);

        if (doc) {
            this.#createInventoryPanel(doc);

            // --- Initialize Action Buttons Container (FEAT-UI-ACTIONS-03) ---
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

        this.#logger.info('DomRenderer initialized and subscribed to events.'); // Adjusted message
    }

    #createInventoryPanel(doc) { // Pass document context
        // Check if running in a browser environment with 'document'
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
        this.#eventBus.subscribe('event:command_echo', this.#handleCommandEcho.bind(this)); // Often useful for UI debugging
        this.#eventBus.subscribe('event:disable_input', this.#handleDisableInput.bind(this)); // Standardized input disable
        this.#eventBus.subscribe('ui:show_message', this.#handleShowMessage.bind(this)); // Standardized message display
        this.#eventBus.subscribe('ui:show_fatal_error', this.#handleFatalError.bind(this)); // Standardized fatal error display
        this.#eventBus.subscribe('ui:set_title', this.#handleSetTitle.bind(this)); // Standardized title update - NEW (Ticket 18)

        // --- Game Specific UI Events ---
        this.#eventBus.subscribe('event:display_location', this.#handleDisplayLocation.bind(this));

        // --- Inventory UI Events ---
        this.#eventBus.subscribe('event:render_inventory', this.#handleRenderInventory.bind(this));
        this.#eventBus.subscribe('event:toggle_inventory', () => this.toggleInventory());
        // Note: 'ui:request_inventory_render' is dispatched internally by toggleInventory

        // --- Action Buttons Events (FEAT-UI-ACTIONS-03) ---
        this.#eventBus.subscribe('event:update_available_actions', this.#handleUpdateActions.bind(this));

        // --- Initialization Events (Ticket 17) ---
        this.#eventBus.subscribe('initialization:initialization_service:started', this.#handleInitializationStarted.bind(this));
        this.#eventBus.subscribe('initialization:initialization_service:completed', this.#handleInitializationCompleted.bind(this));
        this.#eventBus.subscribe('initialization:initialization_service:failed', this.#handleInitializationFailed.bind(this));
        this.#eventBus.subscribe('initialization:world_loader:started', this.#handleInitializationStepStarted.bind(this));
        this.#eventBus.subscribe('initialization:system_initializer:started', this.#handleInitializationStepStarted.bind(this));
        this.#eventBus.subscribe('initialization:game_state_initializer:started', this.#handleInitializationStepStarted.bind(this));
        this.#eventBus.subscribe('initialization:world_initializer:started', this.#handleInitializationStepStarted.bind(this));
        this.#eventBus.subscribe('initialization:input_setup_service:started', this.#handleInitializationStepStarted.bind(this));
        this.#eventBus.subscribe('initialization:world_loader:failed', this.#handleInitializationStepFailed.bind(this));
        this.#eventBus.subscribe('initialization:system_initializer:failed', this.#handleInitializationStepFailed.bind(this));
        this.#eventBus.subscribe('initialization:game_state_initializer:failed', this.#handleInitializationStepFailed.bind(this));
        this.#eventBus.subscribe('initialization:world_initializer:failed', this.#handleInitializationStepFailed.bind(this));
        this.#eventBus.subscribe('initialization:input_setup_service:failed', this.#handleInitializationStepFailed.bind(this));

        this.#logger.info('DomRenderer event subscriptions complete (including standardized UI, initialization, actions).');
    }

    // --- Private Event Handlers ---

    /**
     * Handles command echo events.
     * @private
     * @param {object} data - Expected { type: string, payload: EventCommandEchoPayload }
     */
    #handleCommandEcho(data) {
        const payload = data?.payload; // Adjust based on actual event structure from EventBus
        if (payload && typeof payload.command === 'string') {
            this.renderMessage(`> ${payload.command}`, 'command');
        } else {
            this.#logger.warn("DomRenderer received 'event:command_echo' with invalid data structure:", data);
        }
    }

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
        // Get document context
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
            this.renderMessage('Error: Could not display location details due to invalid data format received.', 'error', {allowHtml: false});
        }
    }

    /**
     * Handles general message display events. (Ticket 18: Standardized Event)
     * @private
     * @param {object} data - Expected { type: string, payload: UIShowMessagePayload }
     */
    #handleShowMessage(data) {
        const payload = data?.payload;
        // Adjusted valid types list in this handler to align with renderMessage correction
        const validTypes = ['info', 'warning', 'error', 'success', 'debug', 'command', 'location', 'system', 'system-success'];
        if (payload && typeof payload.text === 'string') {
            // Use the corrected list for validation here as well, though renderMessage handles the default
            const type = validTypes.includes(payload.type) ? payload.type : 'info';
            this.renderMessage(payload.text, type);
        } else {
            this.#logger.warn("DomRenderer received 'ui:show_message' with invalid payload structure:", data);
        }
    }


    /**
     * Handles fatal error display events. (Ticket 18: Standardized Event)
     * Clears output, shows error in title and message area.
     * @private
     * @param {object} data - Expected { type: string, payload: UIShowFatalErrorPayload }
     */
    #handleFatalError(data) {
        const payload = data?.payload;
        if (payload && typeof payload.title === 'string' && typeof payload.message === 'string') {
            this.clearOutput();
            this.setTitle(`FATAL ERROR: ${payload.title}`);
            this.renderMessage(`<strong>${payload.title}</strong><br>${payload.message}`, 'error', {allowHtml: true});
            if (payload.details) {
                this.renderMessage(`Details: <pre>${payload.details}</pre>`, 'error', {allowHtml: true});
            }
            this.#logger.error(`FATAL ERROR displayed: ${payload.title} - ${payload.message}`);
        } else {
            this.#logger.warn("DomRenderer received 'ui:show_fatal_error' with invalid payload structure:", data);
            this.setTitle('FATAL ERROR');
            this.renderMessage('An unspecified fatal error occurred.', 'error', {allowHtml: false});
        }
    }

    /**
     * Handles setting the main title directly via an event. (Ticket 18: Standardized Event - NEW)
     * @private
     * @param {object} data - Expected { type: string, payload: UISetTitlePayload }
     */
    #handleSetTitle(data) {
        const payload = data?.payload;
        // Correctly uses 'text' property from payload
        if (payload && typeof payload.text === 'string') {
            this.setTitle(payload.text);
        } else {
            this.#logger.warn("DomRenderer received 'ui:set_title' with invalid payload structure or missing 'text' property:", data);
        }
    }

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

    // --- Ticket 17: Initialization Event Handlers ---
    // These handlers now expect the full event object { type, payload }

    /** @private @param {object} data - Expected { type: string, payload?: InitializationStartedPayload } */
    #handleInitializationStarted(data) {
        const payload = data?.payload;
        const worldName = payload?.worldName ? ` for world '${payload.worldName}'` : '';
        const message = `Initializing game${worldName}...`;
        this.#logger.info(`DomRenderer: ${message}`);
        this.setTitle(message);
        this.clearOutput();
        this.renderMessage(message, 'system');
    }

    /**
     * @private
     * @param {object} data - Expected { type: string, payload?: InitializationStepStartedPayload }
     */
    #handleInitializationStepStarted(data) {
        const payload = data?.payload;
        const eventName = data?.type; // Get event type from the event object
        let statusMessage = "Initializing...";

        // Determine message based on which step started
        switch (eventName) {
            case 'initialization:world_loader:started':
                statusMessage = `Loading world data${payload?.worldName ? ` for '${payload.worldName}'` : ''}...`;
                break;
            case 'initialization:system_initializer:started':
                statusMessage = `Initializing core systems${payload?.tag ? ` (tag: ${payload.tag})` : ''}...`;
                break;
            case 'initialization:game_state_initializer:started':
                statusMessage = "Setting up initial game state...";
                break;
            case 'initialization:world_initializer:started':
                statusMessage = "Creating world entities...";
                break;
            case 'initialization:input_setup_service:started':
                statusMessage = "Configuring input handler...";
                break;
            default:
                if (eventName) {
                    const parts = eventName.split(':');
                    if (parts.length >= 3) {
                        statusMessage = `Initializing ${parts[1].replace(/_/g, ' ')}...`;
                    }
                }
        }

        this.#logger.info(`DomRenderer: Initialization Step Started - ${statusMessage}`);
        this.setTitle(statusMessage);
        this.renderMessage(statusMessage, 'system');
    }


    /** @private @param {object} data - Expected { type: string, payload?: InitializationCompletedPayload } */
    #handleInitializationCompleted(data) {
        const message = "Initialization complete. Ready to start!";
        this.#logger.info(`DomRenderer: ${message}`);
        this.setTitle("Game Ready");
        this.renderMessage(message, 'system-success');
    }

    /** @private @param {object} data - Expected { type: string, payload: InitializationFailedPayload } */
    #handleInitializationFailed(data) {
        const payload = data?.payload;
        this.#logger.error("DomRenderer: Received overall initialization failure event.", data);
        this.#handleFatalError({ // Simulate the expected structure for fatal error handler
            type: 'ui:show_fatal_error',
            payload: {
                title: `Initialization Failed${payload?.worldName ? ` (World: ${payload.worldName})` : ''}`,
                message: payload?.error || 'An unknown initialization error occurred.',
                details: payload?.stack
            }
        });
    }

    /** @private @param {object} data - Expected { type: string, payload: InitializationStepFailedPayload } */
    #handleInitializationStepFailed(data) {
        const payload = data?.payload;
        const eventName = data?.type;
        let stepName = 'A specific initialization step';
        if (eventName) {
            const parts = eventName.split(':');
            if (parts.length >= 3) {
                stepName = `${parts[1].replace(/_/g, ' ')} initialization`;
            }
        }
        const errorMessage = payload?.error || 'Unknown error during step.';
        const fullMessage = `${stepName} failed: ${errorMessage}`;
        this.#logger.error(`DomRenderer: Initialization Step Failed - ${fullMessage}`, payload);
        this.setTitle(`${stepName} Failed`);
        this.renderMessage(fullMessage, 'error', {allowHtml: false});
        if (payload?.stack) {
            this.renderMessage(`Details: <pre>${payload.stack}</pre>`, 'error', {allowHtml: true});
        }
    }

    // --- End Ticket 17 Handlers ---


    // --- Public Rendering Methods ---

    /** @param {string} titleText */
    setTitle(titleText) {
        if (this.#titleElement) {
            this.#titleElement.textContent = titleText;
        } else {
            this.#logger.warn("DomRenderer: Cannot set title, #titleElement is null.");
        }
    }

    /**
     * @param {string} text
     * @param {string} [type='info']
     * @param {{selector?: string, allowHtml?: boolean}=} [opts={}]
     * @returns {boolean}
     */
    renderMessage(text, type = 'info', opts = {}) {
        const {selector, allowHtml = false} = opts;
        let targetElement;

        // Determine the document context
        const doc = this.#outputDiv?.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (!doc) {
            this.#logger.warn(`DomRenderer.renderMessage: Cannot render message (type: ${type}), document context not available.`);
            return false;
        }

        if (selector) {
            targetElement = doc.querySelector(selector); // Use correct document
            if (!targetElement) {
                this.#logger.error(`DomRenderer.renderMessage: Selector "${selector}" did not match any element in the current document context.`);
                return false;
            }
        } else {
            targetElement = this.#outputDiv;
            if (!targetElement) {
                this.#logger.error(`DomRenderer.renderMessage: Default target element (#outputDiv) is missing.`);
                return false;
            }
        }

        const messageDiv = doc.createElement('div'); // Use correct document
        // --- CORRECTED LINE: Replaced 'warn' with 'warning' ---
        const validTypes = ['info', 'warning', 'error', 'success', 'debug', 'command', 'location', 'system', 'system-success'];
        const finalType = validTypes.includes(type) ? type : 'info';
        messageDiv.classList.add('message', `message-${finalType}`);
        if (allowHtml) {
            messageDiv.innerHTML = text;
        } else {
            messageDiv.textContent = text;
        }
        targetElement.appendChild(messageDiv);
        if (targetElement === this.#outputDiv) {
            this.#outputDiv.scrollTop = this.#outputDiv.scrollHeight;
        }
        return true;
    }


    /** @param {LocationDisplayPayload} locationData */
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
        this.renderMessage(outputHtml, 'location', {allowHtml: true});
    }

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
     */
    setInputState(enabled, placeholderText) {
        if (!this.#inputElement) {
            this.#logger.error("DomRenderer: Cannot set input state, #inputElement is null.");
            return;
        }
        this.#inputElement.disabled = !enabled;
        this.#inputElement.placeholder = placeholderText;
    }

    /** @param {boolean} [forceState] */
    toggleInventory(forceState) {
        if (!this.#inventoryPanel) {
            this.#logger.warn("DomRenderer: Cannot toggle inventory, panel element does not exist.");
            return;
        }
        const shouldBeVisible = forceState === undefined ? !this.#isInventoryVisible : forceState;
        if (shouldBeVisible) {
            // Get document context before dispatching render request
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
     */
    mutate(selector, propertyPath, value) {
        // --- FIX: Get document context from a known element ---
        const doc = this.#outputDiv?.ownerDocument; // Or this.#inputElement?.ownerDocument, etc.
        if (!doc) {
            this.#logger.warn(`DomRenderer.mutate: Cannot mutate elements for selector "${selector}", document context is not available.`);
            return {count: 0, modified: 0, failed: 0};
        }
        // --- END FIX ---

        let total = 0;
        let successCount = 0;
        let elements;
        try {
            // --- FIX: Use the correct document context ---
            elements = doc.querySelectorAll(selector);
            // --- END FIX ---
        } catch (error) {
            this.#logger.error(`DomRenderer.mutate: Invalid selector "${selector}".`, error);
            return {count: 0, modified: 0, failed: 0};
        }
        total = elements.length;
        if (total === 0) {
            // This is expected if the selector is valid but finds nothing (e.g., in TC7)
            // Changed from warn to debug to reduce noise for expected "not found" cases.
            this.#logger.debug(`DomRenderer.mutate: Selector "${selector}" found no elements in the current document context.`);
            return {count: 0, modified: 0, failed: 0};
        }

        elements.forEach(element => {
            try {
                // --- Direct handling for common properties ---
                if (propertyPath === 'textContent') {
                    element.textContent = value;
                } else if (propertyPath === 'innerHTML') {
                    element.innerHTML = value;
                } else {
                    // Fallback to utility for nested/complex properties
                    // Make sure setPropertyByPath also works correctly with the element context
                    setPropertyByPath(element, propertyPath, value);
                }
                // --- End direct handling ---
                successCount++;
            } catch (error) {
                // Log error with stringified value for better debugging
                this.#logger.error(`DomRenderer.mutate: Failed to set property "${propertyPath}" on element matched by "${selector}". Value: ${JSON.stringify(value)}`, error);
            }
        });

        const failedCount = total - successCount;
        const modifiedCount = successCount; // Renamed for clarity

        if (failedCount > 0) {
            this.#logger.warn(`DomRenderer.mutate: Failed to set property "${propertyPath}" for ${failedCount} out of ${total} elements matching "${selector}".`);
        } else if (modifiedCount > 0) {
            // Changed from debug to info for successful mutations as they are key outcomes.
            this.#logger.info(`DomRenderer.mutate: Successfully set property "${propertyPath}" on ${modifiedCount} element(s) matching "${selector}"`);
        }
        // If modifiedCount is 0 and failedCount is 0, it implies elements were found but the property might not have changed or setPropertyByPath handled it silently

        // Return value adjusted slightly to match previous logging structure better, although the return object itself isn't directly used in ModifyDomElementHandler currently
        // Reverted return value structure for consistency with ModifyDomElementHandler expectation
        return {
            count: total,
            modifiedCount: modifiedCount, // Use 'modifiedCount' key
            failures: failedCount > 0 ? [{selector, propertyPath, error: 'Mutation failed on some elements'}] : []
        }; // Provide minimal failure info if needed
    }


}

export default DomRenderer;