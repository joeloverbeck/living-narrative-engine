// src/domUI/domRenderer.js
// --- FIX for TC3: Added 'success' to validTypes ---
// --- FIX for TC2 (Current Issue): Changed 'warn' to 'warning' ---
// --- T-2.2: Removed title handling logic ---
// --- I-3.2: Removed input handling logic (setInputState, #handleDisableInput) ---
// --- L-4.2: Removed location handling logic (renderLocation, #handleDisplayLocation) ---
// --- INV-5.2: Removed inventory logic (#createInventoryPanel, #updateInventoryUI, toggleInventory, #handleRenderInventory) ---

// --- Import Utilities ---
// Assuming setPropertyByPath exists and is needed for other cases.
import {setPropertyByPath} from '../utils/domUtils.js';

// --- Import Interfaces ---
/** @typedef {import('../core/eventBus.js').default} EventBus */ // Legacy, should be removed eventually if EventBus dependency is fully purged
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */

/**
 * Implements the IGameRenderer contract using direct DOM manipulation.
 * Handles rendering messages, location details, updating the main title,
 * managing the inventory UI panel, and rendering action buttons.
 * Subscribes itself to necessary UI events via the EventBus.
 * Uses ValidatedEventDispatcher for specific outgoing events requiring validation.
 *
 * Input state control has been moved to `InputStateController`.
 * Title control has been moved to `TitleRenderer`.
 * Message rendering has been moved to `UiMessageRenderer`.
 * Location rendering has been moved to `LocationRenderer`.
 * Inventory panel management has been moved to `InventoryPanel`.
 *
 * @deprecated This class is being refactored into smaller, focused components. Functionality is being moved. See `dom-ui/` directory.
 */
class DomRenderer {
    /** @type {HTMLElement} */
    #outputDiv; // Might be needed by clearOutput or mutate
    /** @type {HTMLInputElement} */
    #inputElement; // Needed by InputStateController, but reference might be needed elsewhere temporarily?
    /** @type {EventBus} */
    #eventBus; // Legacy, aim to remove
    /** @type {ValidatedEventDispatcher} */
    #validatedEventDispatcher;
    /** @type {ILogger} */
    #logger;

    // --- INV-5.2: Inventory UI Elements REMOVED ---
    // /** @type {HTMLElement | null} */
    // #inventoryPanel = null; // REMOVED
    // /** @type {HTMLElement | null} */
    // #inventoryList = null; // REMOVED
    // /** @type {boolean} */
    // #isInventoryVisible = false; // REMOVED

    // --- Action Buttons Elements ---
    /** @type {HTMLElement | null} */
    #actionButtonsContainer = null;

    /**
     * Creates an instance of DomRenderer.
     * @param {object} dependencies - The required dependencies.
     * @param {HTMLElement} dependencies.outputDiv - The main element where game output is displayed (might be used by remaining methods).
     * @param {HTMLInputElement} dependencies.inputElement - The input element for player commands (used by InputStateController now).
     * @param {EventBus} dependencies.eventBus - The application's event bus instance (legacy).
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Service for dispatching validated events.
     * @param {ILogger} dependencies.logger - Service for logging messages.
     * @param {HTMLHeadingElement} [dependencies.titleElement] - DEPRECATED: Handled by TitleRenderer.
     */
    constructor({outputDiv, inputElement, /* titleElement, */ eventBus, validatedEventDispatcher, logger}) {
        // --- Constructor Validation ---
        if (!outputDiv || typeof outputDiv !== 'object' || outputDiv.nodeType !== 1) {
            throw new Error('DomRenderer requires a valid output DOM Element.');
        }
        if (!inputElement || typeof inputElement !== 'object' || inputElement.nodeType !== 1 || inputElement.tagName !== 'INPUT') {
            throw new Error('DomRenderer requires a valid HTMLInputElement.');
        }
        // titleElement validation removed (T-2.2)
        if (!eventBus || typeof eventBus.subscribe !== 'function' || typeof eventBus.dispatch !== 'function') {
            // Keeping legacy EventBus for now if still needed by some parts
            this.#logger?.warn('DomRenderer: EventBus instance validation passed, but aim to remove this dependency.');
            // throw new Error('DomRenderer requires a valid EventBus instance.'); // Soften error during transition
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            throw new Error('DomRenderer requires a valid ValidatedEventDispatcher instance.');
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('DomRenderer requires a valid ILogger instance.');
        }

        this.#outputDiv = outputDiv;
        this.#inputElement = inputElement;
        this.#eventBus = eventBus; // Store legacy bus if provided
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#logger = logger;

        // --- INV-5.2: Initialize Inventory UI REMOVED ---
        // const doc = this.#outputDiv?.ownerDocument || (typeof document !== 'undefined' ? document : null);
        // if (doc) {
        // this.#createInventoryPanel(doc); // REMOVED
        // } else { ... }

        // --- Initialize Action Buttons Container ---
        const doc = this.#outputDiv?.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (doc) {
            this.#actionButtonsContainer = doc.getElementById('action-buttons-container');
            if (!this.#actionButtonsContainer) {
                this.#logger.error("DomRenderer Error: Could not find the required '#action-buttons-container' element in the DOM. Action buttons will not be rendered.");
            } else {
                this.#logger.info("DomRenderer: Found '#action-buttons-container'.");
            }
        } else {
            this.#logger.warn('DomRenderer: Skipping action button container initialization as "document" context could not be determined.');
        }


        // Subscribe to necessary events internally
        this.#subscribeToEvents();

        // T-2.2 / I-3.2 / L-4.2 / INV-5.2: Adjusted log message
        this.#logger.info('DomRenderer initialized (title, input, location, & inventory handling moved).');
    }

    // --- INV-5.2: #createInventoryPanel REMOVED ---
    // #createInventoryPanel(doc) { ... }

    #subscribeToEvents() {
        // --- Standard UI Events ---
        // M-1.2: Removed subscription for event:command_echo
        // I-3.2: Removed subscription for event:disable_input
        // M-1.2: Removed subscription for ui:show_message
        // M-1.2: Removed subscription for ui:show_fatal_error
        // T-2.2: Removed subscription for ui:set_title

        // --- Game Specific UI Events ---
        // L-4.2: REMOVED subscription for event:display_location

        // --- INV-5.2: Inventory UI Events REMOVED ---
        // this.#eventBus.subscribe('event:render_inventory', this.#handleRenderInventory.bind(this)); // REMOVED
        // this.#eventBus.subscribe('event:toggle_inventory', () => this.toggleInventory()); // REMOVED

        // --- Action Buttons Events ---
        // Assuming this stays in DomRenderer for now, or moves to ActionButtonsRenderer later
        // TODO: Migrate to VED if possible/necessary
        if (this.#eventBus) { // Check if legacy bus exists
            this.#eventBus.subscribe('event:update_available_actions', this.#handleUpdateActions.bind(this));
        } else {
            this.#logger.warn('DomRenderer: Skipping subscription to "event:update_available_actions" as legacy EventBus is not available.');
            // Potentially subscribe via VED if event exists there
            // this.#validatedEventDispatcher.subscribe('event:update_available_actions', ...)
        }


        // T-2.2: Removed subscriptions for Initialization Events

        // T-2.2 / I-3.2 / L-4.2 / INV-5.2: Adjusted log message
        this.#logger.info('DomRenderer event subscriptions complete (excluding title/init/input/location/inventory events).');
    }

    // --- Private Event Handlers ---

    // M-1.2: Removed #handleCommandEcho method body

    // I-3.2: Removed #handleDisableInput method

    // --- INV-5.2: #handleRenderInventory REMOVED ---
    // /**
    //  * @private
    //  * @param {object} data - Expected { type: string, payload: InventoryRenderPayload }
    //  * @deprecated Moved to InventoryPanel
    //  */
    // #handleRenderInventory(data) { ... } // REMOVED

    // L-4.2: REMOVED #handleDisplayLocation method

    // M-1.2: Removed #handleShowMessage method body

    // M-1.2: Removed #handleFatalError method body

    // T-2.2: Removed #handleSetTitle method

    /**
     * @private
     * @param {object} data - Expected { type: string, payload: UIUpdateActionsPayload }
     * @deprecated Functionality should move to ActionButtonsRenderer.
     */
    #handleUpdateActions(data) {
        const eventData = data?.payload;

        if (!this.#actionButtonsContainer) {
            // Logged in constructor if null initially. Log subsequent calls if it becomes null.
            // this.#logger.warn('DomRenderer: Cannot update action buttons, container element is null.');
            return;
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
                    if (!commandToSubmit) { // Basic check
                        this.#logger.warn(`DomRenderer: Action button clicked, but textContent is empty.`);
                        return;
                    }
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

    // --- Public Rendering Methods ---

    // T-2.2: Removed setTitle method

    // M-1.2: Removed renderMessage method body

    // L-4.2: REMOVED renderLocation method

    /** @deprecated Functionality likely moved to specific renderers or facade. May still be useful for clearing general output area if needed. */
    clearOutput() {
        if (this.#outputDiv) {
            this.#outputDiv.innerHTML = ''; // Or more robust clearing
        } else {
            this.#logger.warn("DomRenderer: Cannot clear output, #outputDiv is null.");
        }
    }

    // I-3.2: Removed setInputState method

    // --- INV-5.2: toggleInventory REMOVED ---
    // /**
    //  * @param {boolean} [forceState]
    //  * @deprecated Functionality moved to InventoryPanel.
    //  * */
    // toggleInventory(forceState) { ... } // REMOVED

    // --- INV-5.2: #updateInventoryUI REMOVED ---
    // /**
    //  * @private
    //  * @param {ItemUIData[]} itemsData
    //  * @param {Document} doc - The document context to use for creating elements.
    //  * @deprecated Functionality moved to InventoryPanel.
    //  */
    // #updateInventoryUI(itemsData, doc) { ... } // REMOVED

    /**
     * Mutates properties of DOM elements matching a selector within the correct document context.
     * Checks for document availability before attempting mutation.
     * Includes direct handling for 'textContent' and 'innerHTML'.
     * @param {string} selector - The CSS selector to query for elements.
     * @param {string} propertyPath - Dot-notation path to the property to set (e.g., 'style.color', 'dataset.value', 'textContent').
     * @param {*} value - The value to set the property to.
     * @returns {{count: number, modified: number, failed: number}} - Object indicating total elements found, how many were modified, and how many failed to update.
     * @deprecated Functionality likely moved to DomMutationService or specific renderers. Consider removal if unused.
     */
    mutate(selector, propertyPath, value) {
        // Use document context from outputDiv if available, fallback otherwise
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
            // This is common, change to debug level
            this.#logger.debug(`DomRenderer.mutate: Selector "${selector}" found no elements in the current document context.`);
            return {count: 0, modified: 0, failed: 0};
        }

        elements.forEach(element => {
            try {
                // Direct property checks first
                if (propertyPath === 'textContent') {
                    if (element.textContent !== value) {
                        element.textContent = value;
                        successCount++;
                    }
                } else if (propertyPath === 'innerHTML') {
                    // Use with caution due to XSS risks if value is user-controlled
                    if (element.innerHTML !== value) {
                        element.innerHTML = value;
                        successCount++;
                    }
                } else {
                    // Use utility for nested properties
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

        // Refined logging based on outcome
        if (failedCount > 0) {
            this.#logger.warn(`DomRenderer.mutate: Encountered ${failedCount} issue(s) while setting property "${propertyPath}" for selector "${selector}". ${modifiedCount} succeeded out of ${totalFound}.`);
        } else if (modifiedCount > 0) {
            this.#logger.debug(`DomRenderer.mutate: Successfully modified property "${propertyPath}" on ${modifiedCount} element(s) matching "${selector}"`);
        } else if (totalFound > 0 && modifiedCount === 0 && failedCount === 0) {
            // This means the property already had the target value
            this.#logger.debug(`DomRenderer.mutate: Found ${totalFound} element(s) for selector "${selector}", property "${propertyPath}" already had the target value.`);
        }

        return {
            count: totalFound,
            modified: modifiedCount,
            failed: failedCount
        };
    }

    /**
     * Dispose method for cleanup.
     * Unsubscribes from any remaining legacy EventBus listeners.
     * @deprecated Part of the overall deprecation of DomRenderer.
     */
    dispose() {
        this.#logger.debug('DomRenderer disposing...');
        // If EventBus subscriptions were added, ensure they are removed
        // Example (requires storing subscription handles, which wasn't done above):
        // this.#eventBus?.unsubscribe(...);
        // For now, just log
        if (this.#eventBus) {
            this.#logger.debug('DomRenderer: Manual cleanup of legacy EventBus subscriptions might be needed if handlers were stored.');
        }
    }
}

export default DomRenderer;