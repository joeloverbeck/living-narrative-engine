// src/core/domRenderer.js

// --- Import Utilities ---
import {setPropertyByPath} from '../utils/domUtils.js';

// --- Import Interfaces ---
/** @typedef {import('./eventBus.js').default} EventBus */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

// --- Import Specific Event Payload Types (if available/defined) ---
/** @typedef {import('../../types/events.js').InitializationStartedPayload} InitializationStartedPayload */
/** @typedef {import('../../types/events.js').InitializationCompletedPayload} InitializationCompletedPayload */
/** @typedef {import('../../types/events.js').InitializationFailedPayload} InitializationFailedPayload */
/** @typedef {import('../../types/events.js').InitializationStepStartedPayload} InitializationStepStartedPayload */
/** @typedef {import('../../types/events.js').InitializationStepCompletedPayload} InitializationStepCompletedPayload */
/** @typedef {import('../../types/events.js').InitializationStepFailedPayload} InitializationStepFailedPayload */
/** @typedef {import('../../types/events.js').LocationDisplayPayload} LocationDisplayPayload */
/** @typedef {import('../../types/events.js').InventoryRenderPayload} InventoryRenderPayload */
/** @typedef {import('../../types/events.js').ItemUIData} ItemUIData */
/** @typedef {import('../../types/events.js').UIUpdateActionsPayload} UIUpdateActionsPayload */
/** @typedef {import('../../types/events.js').UIShowMessagePayload} UIShowMessagePayload */ // Added
/** @typedef {import('../../types/events.js').UIShowFatalErrorPayload} UIShowFatalErrorPayload */ // Added
/** @typedef {import('../../types/events.js').UISetTitlePayload} UISetTitlePayload */ // Added
/** @typedef {import('../../types/events.js').EventEnableInputPayload} EventEnableInputPayload */ // Added
/** @typedef {import('../../types/events.js').EventDisableInputPayload} EventDisableInputPayload */ // Added
/** @typedef {import('../../types/events.js').EventCommandEchoPayload} EventCommandEchoPayload */ // Added


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
     * @param {HTMLElement} outputDiv - The main element where game output is displayed.
     * @param {HTMLInputElement} inputElement - The input element for player commands.
     * @param {HTMLHeadingElement} titleElement - The H1 element for displaying titles/status.
     * @param {EventBus} eventBus - The application's event bus instance.
     * @param {ValidatedEventDispatcher} validatedEventDispatcher - Service for dispatching validated events.
     * @param {ILogger} logger - Service for logging messages.
     */
    constructor({outputDiv, inputElement, titleElement, eventBus, validatedEventDispatcher, logger}) {
        // --- Constructor Validation ---
        if (!outputDiv || !(outputDiv instanceof HTMLElement)) {
            throw new Error('DomRenderer requires a valid output HTMLElement.');
        }
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
            throw new Error('DomRenderer requires a valid HTMLInputElement.');
        }
        if (!titleElement || !(titleElement instanceof HTMLHeadingElement)) {
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
        this.#createInventoryPanel();

        // --- Initialize Action Buttons Container (FEAT-UI-ACTIONS-03) ---
        this.#actionButtonsContainer = document.getElementById('action-buttons-container');
        if (!this.#actionButtonsContainer) {
            this.#logger.error("DomRenderer Error: Could not find the required '#action-buttons-container' element in the DOM. Action buttons will not be rendered.");
        } else {
            this.#logger.info("DomRenderer: Found '#action-buttons-container'.");
        }

        // Subscribe to necessary events internally
        this.#subscribeToEvents();

        this.#logger.info('DomRenderer initialized, inventory panel created, action button container referenced, and subscribed to events.');
    }

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

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.onclick = () => this.toggleInventory(false); // Force hide
        this.#inventoryPanel.appendChild(closeButton);

        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(this.#inventoryPanel);
        } else {
            this.#logger.warn('DomRenderer: Could not find #game-container to append inventory panel. Appending to body.');
            document.body.appendChild(this.#inventoryPanel);
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
     * @param {EventCommandEchoPayload} data
     */
    #handleCommandEcho(data) {
        if (data && typeof data.command === 'string') {
            // Use new renderMessage, default options are fine (to #outputDiv, allowHtml=false by default)
            this.renderMessage(`> ${data.command}`, 'command');
        } else {
            this.#logger.warn("DomRenderer received 'event:command_echo' with invalid data:", data);
        }
    }

    /**
     * Handles disabling the input field. (Ticket 18: Standardized Event)
     * @private
     * @param {EventDisableInputPayload} data - Payload may contain a `message` to use as placeholder.
     */
    #handleDisableInput(data) {
        // Verify payload and update input state/placeholder
        const message = (data && typeof data.message === 'string') ? data.message : 'Input disabled.';
        if (!data || typeof data.message !== 'string') {
            this.#logger.warn("DomRenderer received 'event:disable_input' without specific message, using default:", data, ` -> "${message}"`);
        }
        this.setInputState(false, message); // Set disabled state and placeholder message
    }


    /** @private @param {InventoryRenderPayload} payload */
    #handleRenderInventory(payload) {
        if (!this.#inventoryList) {
            this.#logger.error('Inventory list element not found!');
            return;
        }
        if (!payload || !Array.isArray(payload.items)) {
            this.#logger.warn("DomRenderer received 'event:render_inventory' with invalid data:", payload);
            this.#inventoryList.innerHTML = '<li>Error loading inventory.</li>';
            return;
        }
        this.#updateInventoryUI(payload.items);
    }

    /** @private @param {LocationDisplayPayload} locationData */
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
            this.#logger.warn("DomRenderer received '" + 'event:display_location' + "' event with invalid or incomplete data:", locationData);
            // Use new renderMessage, explicitly allow HTML for error message formatting if needed
            this.renderMessage('Error: Could not display location details due to invalid data format received.', 'error', {allowHtml: false});
        }
    }

    /**
     * Handles general message display events. (Ticket 18: Standardized Event)
     * @private
     * @param {UIShowMessagePayload} payload - Should contain `text` and optional `type`.
     */
    #handleShowMessage(payload) {
        // Verify payload and render message
        if (payload && typeof payload.text === 'string') {
            const type = ['info', 'warn', 'error', 'debug', 'system', 'system-success'].includes(payload.type) ? payload.type : 'info';
            // Use new renderMessage, defaults are fine (to #outputDiv, allowHtml=false)
            this.renderMessage(payload.text, type);
        } else {
            this.#logger.warn("DomRenderer received 'ui:show_message' with invalid payload:", payload);
        }
    }

    /**
     * Handles fatal error display events. (Ticket 18: Standardized Event)
     * Clears output, shows error in title and message area.
     * @private
     * @param {UIShowFatalErrorPayload} payload - Should contain `title`, `message`, and optional `details`.
     */
    #handleFatalError(payload) {
        // Verify payload and update UI for fatal error
        if (payload && typeof payload.title === 'string' && typeof payload.message === 'string') {
            this.clearOutput();
            this.setTitle(`FATAL ERROR: ${payload.title}`); // Update H1 Title
            // Render formatted error message in output div, allow HTML for title/message separation
            this.renderMessage(`<strong>${payload.title}</strong><br>${payload.message}`, 'error', {allowHtml: true});
            if (payload.details) {
                // Render details if provided, allow HTML for <pre> tag
                this.renderMessage(`Details: <pre>${payload.details}</pre>`, 'error', {allowHtml: true});
            }
            this.#logger.error(`FATAL ERROR displayed: ${payload.title} - ${payload.message}`);
        } else {
            this.#logger.warn("DomRenderer received 'ui:show_fatal_error' with invalid payload:", payload);
            this.setTitle('FATAL ERROR'); // Fallback title
            // Fallback message, no HTML needed
            this.renderMessage('An unspecified fatal error occurred.', 'error', {allowHtml: false});
        }
        // Input should generally be disabled by the service dispatching the fatal error.
    }

    /**
     * Handles setting the main title directly via an event. (Ticket 18: Standardized Event - NEW)
     * @private
     * @param {UISetTitlePayload} payload - Should contain `title` text.
     */
    #handleSetTitle(payload) {
        if (payload && typeof payload.title === 'string') {
            this.setTitle(payload.title); // Update H1 Title
        } else {
            this.#logger.warn("DomRenderer received 'ui:set_title' with invalid payload:", payload);
        }
    }

    // --- NEW: Handler for Action Buttons (FEAT-UI-ACTIONS-03) ---
    /** @private @param {UIUpdateActionsPayload} eventData */
    #handleUpdateActions(eventData) {
        if (!this.#actionButtonsContainer) {
            // Already logged in constructor if missing
            return;
        }
        this.#actionButtonsContainer.innerHTML = ''; // Clear existing buttons

        if (!eventData || !Array.isArray(eventData.actions)) {
            this.#logger.warn('DomRenderer received invalid "event:update_available_actions" payload:', eventData);
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

                const button = document.createElement('button');
                button.textContent = actionString;
                button.classList.add('action-button');
                button.setAttribute('title', `Click to ${actionString}`);

                // --- EVENT-MIGR-018: Refactor click listener for validation ---
                button.addEventListener('click', async () => { // Make listener async
                    const commandToSubmit = button.textContent; // Or actionString from the outer scope
                    this.#logger.debug(`DomRenderer: Action button "${commandToSubmit}" clicked. Attempting validated dispatch...`);

                    // AC1, AC2: Use ValidatedEventDispatcher for 'command:submit'
                    // AC4: Implicitly uses EventDefinition/payloadSchema via dispatcher
                    const dispatched = await this.#validatedEventDispatcher.dispatchValidated(
                        'command:submit',
                        {command: commandToSubmit}
                    );

                    // AC3: Failure handling (log, skip) is done *inside* dispatchValidated
                    // Log the outcome of the dispatch attempt
                    if (dispatched) {
                        this.#logger.debug(`DomRenderer: Event 'command:submit' for "${commandToSubmit}" dispatched successfully.`);
                    } else {
                        this.#logger.warn(`DomRenderer: Event 'command:submit' for "${commandToSubmit}" was NOT dispatched (validation failed or other error). See previous dispatcher logs.`); // Warning level as failure is significant
                    }
                });

                this.#actionButtonsContainer.appendChild(button);

            } catch (error) {
                this.#logger.error(`DomRenderer: Error creating button for action "${actionString}":`, error);
            }
        });
    }

    // --- Ticket 17: Initialization Event Handlers ---

    /**
     * Handles the overall initialization sequence starting.
     * @private
     * @param {InitializationStartedPayload} [payload] - Optional payload (e.g., worldName).
     */
    #handleInitializationStarted(payload) {
        const worldName = payload?.worldName ? ` for world '${payload.worldName}'` : '';
        const message = `Initializing game${worldName}...`;
        this.#logger.info(`DomRenderer: ${message}`);
        this.setTitle(message);
        this.clearOutput(); // Clear previous game output
        // Use new renderMessage, defaults are fine
        this.renderMessage(message, 'system');
    }

    /**
     * Handles the start of a specific initialization step (e.g., world loading).
     * Updates the title to show progress.
     * @private
     * @param {InitializationStepStartedPayload} payload - Event payload (contains eventName).
     * @param {string} eventName - The specific event name (e.g., 'initialization:world_loader:started').
     */
    #handleInitializationStepStarted(payload, eventName) {
        let statusMessage = "Initializing..."; // Default

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
                // Try to derive from event name if possible
                const parts = eventName.split(':');
                if (parts.length >= 3) {
                    statusMessage = `Initializing ${parts[1].replace(/_/g, ' ')}...`;
                }
        }

        this.#logger.info(`DomRenderer: Initialization Step Started - ${statusMessage}`);
        this.setTitle(statusMessage);
        // Use new renderMessage, defaults are fine
        this.renderMessage(statusMessage, 'system');
    }


    /**
     * Handles the completion of the overall initialization sequence.
     * @private
     * @param {InitializationCompletedPayload} [payload] - Optional payload.
     */
    #handleInitializationCompleted(payload) {
        const message = "Initialization complete. Ready to start!";
        this.#logger.info(`DomRenderer: ${message}`);
        this.setTitle("Game Ready"); // Or clear it, depending on preference
        // Use new renderMessage, defaults are fine
        this.renderMessage(message, 'system-success'); // Use a distinct style
        // Note: GameLoop will typically enable input after this via textUI:enable_input.
    }

    /**
     * Handles the failure of the overall initialization sequence.
     * Uses the fatal error handler for consistency.
     * @private
     * @param {InitializationFailedPayload} payload - Payload containing error details.
     */
    #handleInitializationFailed(payload) {
        this.#logger.error("DomRenderer: Received overall initialization failure event.", payload);
        // Use the standardized fatal error handler
        this.#handleFatalError({
            title: `Initialization Failed${payload?.worldName ? ` (World: ${payload.worldName})` : ''}`,
            message: payload?.error || 'An unknown initialization error occurred.',
            details: payload?.stack
        });
        // Input should already be disabled by InitializationService logic triggering this.
    }

    /**
     * Handles the failure of a specific initialization step.
     * Displays a non-fatal error message indicating the step that failed.
     * The overall sequence might still fail later, which would trigger #handleInitializationFailed.
     * @private
     * @param {InitializationStepFailedPayload} payload - Payload containing error details.
     * @param {string} eventName - The specific event name (e.g., 'initialization:world_loader:failed').
     */
    #handleInitializationStepFailed(payload, eventName) {
        // Try to derive step name from event name
        let stepName = 'A specific initialization step';
        const parts = eventName.split(':');
        if (parts.length >= 3) {
            stepName = `${parts[1].replace(/_/g, ' ')} initialization`;
        }

        const errorMessage = payload?.error || 'Unknown error during step.';
        const fullMessage = `${stepName} failed: ${errorMessage}`;

        this.#logger.error(`DomRenderer: Initialization Step Failed - ${fullMessage}`, payload);
        // Update title to show failure, but maybe not FATAL yet
        this.setTitle(`${stepName} Failed`);
        // Use new renderMessage, allowHtml=false is fine
        this.renderMessage(fullMessage, 'error', {allowHtml: false});
        if (payload?.stack) {
            // Use new renderMessage, allow HTML for <pre>
            this.renderMessage(`Details: <pre>${payload.stack}</pre>`, 'error', {allowHtml: true});
        }
        // Don't necessarily clear output or disable input here,
        // as the main InitializationService handles the final failure state.
    }

    // --- End Ticket 17 Handlers ---


    // --- Public Rendering Methods ---

    /**
     * Sets the main H1 title/status text.
     * @param {string} titleText
     */
    setTitle(titleText) {
        if (this.#titleElement) {
            this.#titleElement.textContent = titleText;
        } else {
            this.#logger.warn("DomRenderer: Cannot set title, #titleElement is null.");
        }
    }

    /**
     * Renders a message to a specified DOM element or the default output div.
     * @param {string} text - The text content or HTML string to render.
     * @param {string} [type='info'] - The message type (used for CSS class 'message-{type}'). Valid types: 'info', 'warn', 'error', 'debug', 'command', 'location', 'system', 'system-success'.
     * @param {{selector?: string, allowHtml?: boolean}=} [opts={}] - Rendering options.
     * @returns {boolean} - True if the message was successfully appended, false otherwise.
     */
    renderMessage(text, type = 'info', opts = {}) {
        const {selector, allowHtml = false} = opts;
        let targetElement;

        if (selector) {
            targetElement = document.querySelector(selector);
            if (!targetElement) {
                this.#logger.error(`DomRenderer.renderMessage: Selector "${selector}" did not match any element.`);
                return false;
            }
        } else {
            targetElement = this.#outputDiv;
            if (!targetElement) {
                // This should ideally not happen if constructor succeeded, but check defensively.
                this.#logger.error(`DomRenderer.renderMessage: Default target element (#outputDiv) is missing.`);
                return false;
            }
        }

        const messageDiv = document.createElement('div');
        // Ensure type is one of the known/styled types
        const validTypes = ['info', 'warn', 'error', 'debug', 'command', 'location', 'system', 'system-success'];
        const finalType = validTypes.includes(type) ? type : 'info';
        messageDiv.classList.add('message', `message-${finalType}`);

        if (allowHtml) {
            messageDiv.innerHTML = text;
        } else {
            messageDiv.textContent = text;
        }

        targetElement.appendChild(messageDiv);

        // Auto-scroll only if rendering to the default output div
        if (targetElement === this.#outputDiv) {
            this.#outputDiv.scrollTop = this.#outputDiv.scrollHeight;
        }

        return true;
    }

    /**
     * Renders the location details based on the provided payload.
     * @param {LocationDisplayPayload} locationData
     */
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
        // Use new renderMessage, explicitly allow HTML for the location block
        this.renderMessage(outputHtml, 'location', {allowHtml: true});
    }

    clearOutput() {
        this.#outputDiv.innerHTML = '';
    }

    /**
     * Sets the enabled/disabled state and placeholder text of the input element.
     * @param {boolean} enabled - True to enable, false to disable.
     * @param {string} placeholderText - Text to display when the input is empty.
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
     * Toggles the visibility of the inventory panel.
     * If the inventory is being shown, dispatches an event to request its content.
     * @param {boolean} [forceState] - Optional: true to force show, false to force hide.
     */
    toggleInventory(forceState) {
        if (!this.#inventoryPanel) return;
        const shouldBeVisible = forceState === undefined ? !this.#isInventoryVisible : forceState;

        if (shouldBeVisible) {
            // Dispatch event to request inventory data
            this.#eventBus.dispatch('ui:request_inventory_render', {});
            this.#inventoryPanel.classList.remove('hidden');
            this.#isInventoryVisible = true;
        } else {
            this.#inventoryPanel.classList.add('hidden');
            this.#isInventoryVisible = false;
        }
    }

    /**
     * Updates the inventory UI based on the provided item data payload.
     * @private
     * @param {ItemUIData[]} itemsData - Array of item data for UI rendering.
     */
    #updateInventoryUI(itemsData) {
        if (!this.#inventoryList) {
            this.#logger.error('DomRenderer: Cannot update inventory UI, list element is null.');
            return;
        }
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

                const itemName = item.name || '(Unnamed Item)';

                if (item.icon) {
                    const img = document.createElement('img');
                    img.src = item.icon;
                    img.alt = itemName;
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
                nameSpan.textContent = itemName;
                li.appendChild(nameSpan);

                const dropButton = document.createElement('button');
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

                    const dispatched = await this.#validatedEventDispatcher.dispatchValidated(
                        'command:submit',
                        {command: commandString}
                    );

                    if (dispatched) {
                        this.#logger.debug(`DomRenderer: Event 'command:submit' for "${commandString}" dispatched successfully.`);
                        this.toggleInventory(false); // Close inventory on successful drop command dispatch
                    } else {
                        this.#logger.warn(`DomRenderer: Event 'command:submit' for "${commandString}" was NOT dispatched (validation failed or other error). See previous dispatcher logs.`);
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
     * Mutates properties of DOM elements matching a selector.
     * @param {string} selector - The CSS selector to query for elements.
     * @param {string} propertyPath - Dot-notation path to the property to set (e.g., 'style.color', 'dataset.value').
     * @param {*} value - The value to set the property to.
     * @returns {{count: number, failed: number}} - Object indicating total elements found and how many failed to update.
     */
    mutate(selector, propertyPath, value) {
        let total = 0;
        let successCount = 0;
        let elements;

        try {
            elements = document.querySelectorAll(selector);
        } catch (error) {
            this.#logger.error(`DomRenderer.mutate: Invalid selector "${selector}".`, error);
            return {count: 0, failed: 0};
        }

        total = elements.length;

        if (total === 0) {
            this.#logger.warn(`DomRenderer.mutate: Selector "${selector}" found no elements.`);
            // Return success (0 found, 0 failed)
            return {count: 0, failed: 0};
        }

        elements.forEach(element => {
            try {
                // NOTE: The 'setPropertyByPath' utility function needs to be implemented
                // in src/utils/objectUtils.js for this to work.
                // Assuming it exists and works like: setPropertyByPath(object, path, value) -> throws on error
                setPropertyByPath(element, propertyPath, value);
                successCount++;
            } catch (error) {
                this.#logger.error(`DomRenderer.mutate: Failed to set property "${propertyPath}" on element matched by "${selector}".`, error);
                // Failure for this element is counted implicitly (total - successCount)
            }
        });

        const failedCount = total - successCount;
        if (failedCount > 0) {
            this.#logger.warn(`DomRenderer.mutate: Failed to set property "${propertyPath}" for ${failedCount} out of ${total} elements matching "${selector}".`);
        }

        return {count: total, failed: failedCount};
    }
}

export default DomRenderer;