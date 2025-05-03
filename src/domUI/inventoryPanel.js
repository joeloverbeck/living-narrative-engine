// src/domUI/inventoryPanel.js
import {RendererBase} from './rendererBase.js';
import DomElementFactory from './domElementFactory.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 */

/**
 * Represents the UI data for a single inventory item.
 * Derived from the payload structure of 'event:render_inventory'.
 * @typedef {object} ItemUIData
 * @property {string} id - Unique identifier for the item.
 * @property {string} name - Display name of the item.
 * @property {string} [icon] - Optional URL/path to an icon image.
 * // Add other relevant UI properties if needed (e.g., quantity, description tooltip)
 */

/**
 * Expected payload structure for the 'event:render_inventory' event.
 * @typedef {object} InventoryRenderPayload
 * @property {ItemUIData[]} items - An array of items to display.
 */

/**
 * Manages the inventory UI panel, including its visibility and content.
 * Subscribes to VED events to update the inventory display and handle toggling.
 */
export class InventoryPanel extends RendererBase {
    /**
     * The main container element for the inventory panel.
     * @private
     * @type {HTMLElement | null}
     */
    #panelElement = null;

    /**
     * The UL element where inventory items are listed.
     * @private
     * @type {HTMLUListElement | null}
     */
    #listElement = null;

    /**
     * Factory for creating DOM elements programmatically.
     * @private
     * @type {DomElementFactory}
     */
    #domElementFactory;

    /**
     * The container element into which the inventory panel is appended.
     * @private
     * @type {HTMLElement}
     */
    #containerElement;

    /**
     * Tracks the current visibility state of the panel.
     * @private
     * @type {boolean}
     */
    #isVisible = false;

    /**
     * Stores VED subscriptions for later disposal.
     * @private
     * @type {Array<IEventSubscription|undefined>}
     */
    #subscriptions = [];

    /**
     * Creates an instance of InventoryPanel.
     *
     * @param {object} deps - Dependencies object.
     * @param {ILogger} deps.logger - The logger instance.
     * @param {IDocumentContext} deps.documentContext - The document context.
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - The event dispatcher.
     * @param {DomElementFactory} deps.domElementFactory - Factory for creating DOM elements.
     * @param {HTMLElement | null} deps.containerElement - The parent element to append the inventory panel to (e.g., '#game-container').
     * @throws {Error} If dependencies are invalid, especially containerElement or domElementFactory.
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    containerElement
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        // --- Validate specific dependencies ---
        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!containerElement || containerElement.nodeType !== 1) {
            // Attempt to find default container if none provided, log warning
            const defaultContainer = this.documentContext.query('#game-container');
            if (defaultContainer && defaultContainer.nodeType === 1) {
                this.logger.warn(`${this._logPrefix} 'containerElement' was invalid or missing. Found and using '#game-container' as fallback.`);
                containerElement = /** @type {HTMLElement} */ (defaultContainer);
            } else {
                const errMsg = `${this._logPrefix} 'containerElement' dependency is missing or not a valid DOM element, and fallback '#game-container' not found. Cannot append panel.`;
                this.logger.error(errMsg, {receivedElement: containerElement});
                throw new Error(errMsg);
            }
        }
        // Ensure it's an HTMLElement type after validation/fallback
        this.#containerElement = /** @type {HTMLElement} */ (containerElement);


        // --- Initialize Panel ---
        this.#createPanelStructure(); // Creates elements, initially hidden
        this.#subscribeToEvents();

        this.logger.info(`${this._logPrefix} Initialized. Panel is initially hidden.`);
    }

    /**
     * Creates the basic DOM structure for the inventory panel and appends it
     * to the container element. The panel is created with a 'hidden' class.
     * @private
     */
    #createPanelStructure() {
        const factory = this.#domElementFactory;

        this.#panelElement = factory.div(['inventory-panel', 'hidden']); // Start hidden (Acceptance Criteria)
        if (!this.#panelElement) {
            this.logger.error(`${this._logPrefix} Failed to create main panel element.`);
            return;
        }
        this.#panelElement.id = 'inventory-panel'; // Assign ID

        const header = factory.h3('inventory-panel__header', 'Inventory');
        this.#listElement = factory.ul('inventory-panel__list');
        if (this.#listElement) {
            this.#listElement.id = 'inventory-list'; // Assign ID
        } else {
            this.logger.error(`${this._logPrefix} Failed to create inventory list (UL) element.`);
        }

        const closeButton = factory.button('Close', 'inventory-panel__close-button');
        if (closeButton) {
            closeButton.onclick = () => this.toggle(false); // Force hide on click
        } else {
            this.logger.warn(`${this._logPrefix} Failed to create close button.`);
        }

        // Append elements safely
        if (header) this.#panelElement.appendChild(header);
        if (this.#listElement) this.#panelElement.appendChild(this.#listElement);
        if (closeButton) this.#panelElement.appendChild(closeButton);

        // Append the panel to the designated container
        try {
            this.#containerElement.appendChild(this.#panelElement);
            this.logger.debug(`${this._logPrefix} Panel structure created and appended to container.`);
        } catch (error) {
            this.logger.error(`${this._logPrefix} Failed to append inventory panel to container element:`, error);
            // Reset panel element if appending failed, so other methods don't assume it exists
            this.#panelElement = null;
            this.#listElement = null;
        }
    }

    /**
     * Subscribes to VED events relevant for the inventory panel.
     * @private
     */
    #subscribeToEvents() {
        const ved = this.validatedEventDispatcher;

        this.#subscriptions.push(
            ved.subscribe('event:render_inventory', this.#handleRenderInventory.bind(this))
        );
        this.#subscriptions.push(
            ved.subscribe('event:toggle_inventory', this.#handleToggleInventory.bind(this))
        );
        // Note: 'ui:request_inventory_render' is dispatched by the toggle method

        this.logger.debug(`${this._logPrefix} Subscribed to VED events 'event:render_inventory', 'event:toggle_inventory'.`);
    }

    // --- Private Event Handlers ---

    /**
     * Handles the 'event:render_inventory' event from VED.
     * Validates the payload and calls the private update helper.
     * @private
     * @param {InventoryRenderPayload | object} payload - Expected payload.
     * @param {string} eventType - The name of the triggered event.
     */
    #handleRenderInventory(payload, eventType) {
        this.logger.debug(`${this._logPrefix} Received '${eventType}' event. Payload:`, payload);

        if (!this.#listElement) {
            this.logger.error(`${this._logPrefix} Cannot render inventory, list element not found.`);
            return;
        }

        // Basic payload validation
        if (payload && Array.isArray(payload.items)) {
            const itemsData = /** @type {ItemUIData[]} */ (payload.items);
            this.#updateList(itemsData);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid payload for '${eventType}'. Displaying error. Payload:`, payload);
            this.#listElement.innerHTML = ''; // Clear previous content
            const errorLi = this.#domElementFactory.li('inventory-panel__item inventory-panel__item--error', 'Error loading inventory.');
            if (errorLi) {
                this.#listElement.appendChild(errorLi);
            }
        }
    }

    /**
     * Handles the 'event:toggle_inventory' event from VED.
     * Calls the public toggle method without forcing a specific state.
     * @private
     */
    #handleToggleInventory() {
        this.logger.debug(`${this._logPrefix} Received 'event:toggle_inventory'. Calling toggle().`);
        this.toggle(); // Let toggle() determine the new state
    }


    // --- Private Update Helpers ---

    /**
     * Clears and rebuilds the inventory list display based on the provided item data.
     * Attaches necessary event listeners to items (e.g., drop buttons).
     * @private
     * @param {ItemUIData[]} itemsData - Array of items to display.
     */
    #updateList(itemsData) {
        if (!this.#listElement || !this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot update inventory list, element or factory is missing.`);
            return;
        }

        const factory = this.#domElementFactory;
        this.#listElement.innerHTML = ''; // Clear existing items

        if (!itemsData || itemsData.length === 0) {
            const emptyLi = factory.li('inventory-panel__item inventory-panel__item--empty', '(Empty)');
            if (emptyLi) {
                this.#listElement.appendChild(emptyLi);
            }
            this.logger.debug(`${this._logPrefix} Inventory list updated: empty.`);
            return;
        }

        itemsData.forEach(item => {
            // Validate essential item data
            if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') {
                this.logger.warn(`${this._logPrefix} Skipping invalid item data during render:`, item);
                return;
            }

            const li = factory.li('inventory-panel__item');
            if (!li) return; // Skip if li creation failed

            li.dataset.itemId = item.id; // Store item ID for potential future use

            // Icon
            if (item.icon) {
                const img = factory.img(item.icon, item.name, 'inventory-panel__item-icon');
                if (img) li.appendChild(img);
            } else {
                const iconPlaceholder = factory.span('inventory-panel__item-icon inventory-panel__item-icon--placeholder', '📦');
                if (iconPlaceholder) li.appendChild(iconPlaceholder);
            }

            // Name
            const nameSpan = factory.span('inventory-panel__item-name', item.name || '(Unnamed Item)');
            if (nameSpan) li.appendChild(nameSpan);

            // Drop Button
            const dropButton = factory.button('Drop', 'inventory-panel__item-drop-button');
            if (dropButton) {
                dropButton.dataset.itemName = item.name || ''; // Store name for command
                dropButton.setAttribute('title', `Drop ${item.name || 'item'}`);
                dropButton.addEventListener('click', async (event) => {
                    event.stopPropagation(); // Prevent li click handler if any
                    const clickedButton = /** @type {HTMLButtonElement} */ (event.target);
                    const itemName = clickedButton.dataset.itemName;

                    if (!itemName) {
                        this.logger.error(`${this._logPrefix} Drop button clicked, but missing item name from dataset.`, {itemId: item.id});
                        return;
                    }

                    const commandString = `drop ${itemName}`;
                    const dispatched = await this.#dispatchSubmitCommand(commandString);
                    if (dispatched) {
                        this.logger.debug(`${this._logPrefix} Drop command dispatched successfully.`);
                        // Only toggle if the panel is currently visible
                        if (this.#isVisible) {
                            this.toggle(false); // Close inventory on successful drop command dispatch
                        }
                    } else {
                        this.logger.warn(`${this._logPrefix} Drop command dispatch failed or was prevented.`);
                        // Optionally provide user feedback here if dispatch fails
                    }
                });
                li.appendChild(dropButton);
            }

            // Optional: Add click listener to LI for item selection/details
            // li.addEventListener('click', () => {
            //     const currentSelected = this.#listElement?.querySelector('.selected');
            //     if (currentSelected) {
            //         currentSelected.classList.remove('selected');
            //     }
            //     li.classList.add('selected');
            //     this.logger.debug(`${this._logPrefix} Selected item: ${item.name} (ID: ${item.id})`);
            //     // Potentially dispatch an event here: ui:inventory_item_selected { itemId: item.id }
            // });

            this.#listElement.appendChild(li);
        });

        this.logger.debug(`${this._logPrefix} Inventory list updated with ${itemsData.length} valid items.`);
    }

    /**
     * Helper to dispatch a 'command:submit' event via VED.
     * @private
     * @param {string} commandString - The command text to submit.
     * @returns {Promise<boolean>} True if the event was successfully dispatched, false otherwise.
     */
    async #dispatchSubmitCommand(commandString) {
        this.logger.debug(`${this._logPrefix} Attempting to dispatch 'command:submit' for: "${commandString}"`);
        try {
            const dispatched = await this.validatedEventDispatcher.dispatchValidated(
                'command:submit',
                {command: commandString}
            );
            if (dispatched) {
                this.logger.info(`${this._logPrefix} Event 'command:submit' for "${commandString}" dispatched successfully.`);
                return true;
            } else {
                this.logger.warn(`${this._logPrefix} Event 'command:submit' for "${commandString}" was NOT dispatched (validation failed or prevented).`);
                return false;
            }
        } catch (error) {
            this.logger.error(`${this._logPrefix} Error occurred during dispatch of 'command:submit' for "${commandString}":`, error);
            return false;
        }
    }


    // --- Public API ---

    /**
     * Toggles the visibility of the inventory panel.
     * If showing the panel, it dispatches 'ui:request_inventory_render'
     * to request fresh data before displaying.
     *
     * @param {boolean} [forceState] - Optional. If true, forces the panel to show.
     * If false, forces the panel to hide.
     * If undefined, toggles the current state.
     */
    toggle(forceState) {
        if (!this.#panelElement) {
            this.logger.warn(`${this._logPrefix} Cannot toggle inventory, panel element does not exist (might have failed during creation/appending).`);
            return;
        }

        const shouldBeVisible = forceState === undefined ? !this.#isVisible : Boolean(forceState);

        if (shouldBeVisible === this.#isVisible) {
            this.logger.debug(`${this._logPrefix} Toggle called but visibility state (${shouldBeVisible}) already matches.`);
            // If forcing visible and it's already visible, refresh data just in case
            if (shouldBeVisible) {
                this.logger.debug(`${this._logPrefix} Panel already visible, requesting inventory refresh.`);
                // Use non-async dispatch for UI events if appropriate
                this.validatedEventDispatcher.dispatchValidated('ui:request_inventory_render', {});
            }
            return; // No change needed
        }


        if (shouldBeVisible) {
            this.logger.debug(`${this._logPrefix} Toggling inventory panel to visible.`);
            // Request update *before* showing to avoid flicker with old data
            // Use non-async dispatch for UI events if appropriate
            this.validatedEventDispatcher.dispatchValidated('ui:request_inventory_render', {});
            this.#panelElement.classList.remove('hidden');
            this.#isVisible = true;
        } else {
            this.logger.debug(`${this._logPrefix} Toggling inventory panel to hidden.`);
            this.#panelElement.classList.add('hidden');
            this.#isVisible = false;
        }
    }

    /**
     * Dispose method for cleanup. Unsubscribes from all VED events.
     * Optionally removes the panel from the DOM.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        this.#subscriptions = [];

        // Optional: Remove the panel element from the DOM during dispose
        if (this.#panelElement && this.#panelElement.parentNode === this.#containerElement) {
            try {
                this.#containerElement.removeChild(this.#panelElement);
                this.logger.debug(`${this._logPrefix} Removed panel element from DOM.`);
            } catch (error) {
                this.logger.warn(`${this._logPrefix} Error removing panel element during dispose:`, error);
            }
        }
        this.#panelElement = null;
        this.#listElement = null;
        // this.#containerElement = null; // Avoid nulling injected dependencies unless strictly necessary

        super.dispose(); // Call base class dispose for logging
    }
}