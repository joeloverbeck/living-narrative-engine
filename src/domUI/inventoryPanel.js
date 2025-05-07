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
 * The panel is appended to a container element (expected to be '#inventory-widget')
 * and manages its own visibility within that container using a 'hidden' class.
 */
export class InventoryPanel extends RendererBase {
    /**
     * The main container element for the inventory panel's UI (e.g., <div id="inventory-panel">).
     * This element is appended into this.#containerElement.
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
     * The parent DOM element into which the inventory panel (#panelElement) is appended.
     * This is expected to be '#inventory-widget' provided via DI.
     * @private
     * @type {HTMLElement}
     */
    #containerElement; // This will be #inventory-widget

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

    /** @private @type {string} */
    #panelHeadingId = 'inventory-panel-heading';


    /**
     * Creates an instance of InventoryPanel.
     *
     * @param {object} deps - Dependencies object.
     * @param {ILogger} deps.logger - The logger instance.
     * @param {IDocumentContext} deps.documentContext - The document context.
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - The event dispatcher.
     * @param {DomElementFactory} deps.domElementFactory - Factory for creating DOM elements.
     * @param {HTMLElement} deps.containerElement - The parent element to append the inventory panel to.
     * As per Ticket #204, this is expected to be '#inventory-widget'
     * and provided via DI.
     * @throws {Error} If dependencies are invalid, especially a missing or non-HTMLElement containerElement,
     * or an invalid domElementFactory.
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    containerElement // Expected to be #inventory-widget
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        // --- Validate specific dependencies ---
        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!containerElement || !(containerElement instanceof HTMLElement)) {
            const errMsg = `${this._logPrefix} 'containerElement' dependency (expected to be #inventory-widget) is missing or not a valid HTMLElement. Panel cannot be initialized.`;
            this.logger.error(errMsg, {receivedElement: containerElement});
            throw new Error(errMsg);
        }
        this.#containerElement = containerElement;


        // --- Initialize Panel ---
        this.#createPanelStructure();
        this.#subscribeToEvents();

        this.logger.info(`${this._logPrefix} Initialized. Panel structure created within '#${this.#containerElement.id || 'UnknownContainer'}'. Panel is initially hidden.`);
    }

    /**
     * Creates the basic DOM structure for the inventory panel (this.#panelElement)
     * and appends it to the this.#containerElement (which is #inventory-widget).
     * The panel is created with a 'hidden' class by default.
     * @private
     */
    #createPanelStructure() {
        const factory = this.#domElementFactory;

        this.#panelElement = factory.div(['inventory-panel', 'hidden']);
        if (!this.#panelElement) {
            this.logger.error(`${this._logPrefix} Failed to create main panel element (#inventory-panel).`);
            return;
        }
        this.#panelElement.id = 'inventory-panel';
        this.#panelElement.setAttribute('role', 'region');
        // aria-labelledby will be set after header is created

        const header = factory.h3('inventory-panel__header', 'Inventory');
        if (header) {
            header.id = this.#panelHeadingId;
            this.#panelElement.setAttribute('aria-labelledby', this.#panelHeadingId);
        } else {
            this.logger.warn(`${this._logPrefix} Failed to create inventory panel header. aria-labelledby will not be set.`);
            // Fallback: provide a generic aria-label if header fails
            this.#panelElement.setAttribute('aria-label', 'Inventory Panel');
        }


        this.#listElement = factory.ul('inventory-panel__list');
        if (this.#listElement) {
            this.#listElement.id = 'inventory-list';
        } else {
            this.logger.error(`${this._logPrefix} Failed to create inventory list (UL) element.`);
        }

        const closeButton = factory.button('Close', 'inventory-panel__close-button');
        if (closeButton) {
            closeButton.setAttribute('aria-label', 'Close inventory panel');
            closeButton.onclick = () => this.toggle(false);
        } else {
            this.logger.warn(`${this._logPrefix} Failed to create close button.`);
        }

        if (header) this.#panelElement.appendChild(header);
        if (this.#listElement) this.#panelElement.appendChild(this.#listElement);
        if (closeButton) this.#panelElement.appendChild(closeButton);

        try {
            this.#containerElement.appendChild(this.#panelElement);
            this.logger.debug(`${this._logPrefix} Panel structure (#inventory-panel) created and appended to container (#${this.#containerElement.id}).`);
        } catch (error) {
            this.logger.error(`${this._logPrefix} Failed to append inventory panel (#inventory-panel) to container element (#${this.#containerElement.id}):`, error);
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

        this.logger.debug(`${this._logPrefix} Subscribed to VED events 'event:render_inventory', 'event:toggle_inventory'.`);
    }

    /**
     * Handles the 'event:render_inventory' event from VED.
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

        if (payload && Array.isArray(payload.items)) {
            const itemsData = /** @type {ItemUIData[]} */ (payload.items);
            this.#updateList(itemsData);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid payload for '${eventType}'. Displaying error. Payload:`, payload);
            this.#listElement.innerHTML = '';
            const errorLi = this.#domElementFactory.li('inventory-panel__item inventory-panel__item--error', 'Error loading inventory.');
            if (errorLi) {
                this.#listElement.appendChild(errorLi);
            }
        }
    }

    /**
     * Handles the 'event:toggle_inventory' event from VED.
     * @private
     */
    #handleToggleInventory() {
        this.logger.debug(`${this._logPrefix} Received 'event:toggle_inventory'. Calling toggle().`);
        this.toggle();
    }


    /**
     * Clears and rebuilds the inventory list display.
     * @private
     * @param {ItemUIData[]} itemsData - Array of items to display.
     */
    #updateList(itemsData) {
        if (!this.#listElement || !this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot update inventory list, UL element or DOM factory is missing.`);
            return;
        }

        const factory = this.#domElementFactory;
        this.#listElement.innerHTML = '';

        if (!itemsData || itemsData.length === 0) {
            const emptyLi = factory.li('inventory-panel__item inventory-panel__item--empty', '(Empty)');
            if (emptyLi) {
                this.#listElement.appendChild(emptyLi);
            }
            this.logger.debug(`${this._logPrefix} Inventory list updated: empty.`);
            return;
        }

        itemsData.forEach(item => {
            if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') {
                this.logger.warn(`${this._logPrefix} Skipping invalid item data during render:`, item);
                return;
            }

            const li = factory.li('inventory-panel__item');
            if (!li) return;

            li.dataset.itemId = item.id;

            if (item.icon) {
                const img = factory.img(item.icon, '', 'inventory-panel__item-icon'); // Alt text is empty as name is adjacent
                if (img) {
                    img.setAttribute('aria-hidden', 'true'); // Decorative if name is present
                    li.appendChild(img);
                }
            } else {
                const iconPlaceholder = factory.span('inventory-panel__item-icon inventory-panel__item-icon--placeholder', '📦');
                if (iconPlaceholder) {
                    iconPlaceholder.setAttribute('aria-hidden', 'true');
                    li.appendChild(iconPlaceholder);
                }
            }

            const nameSpan = factory.span('inventory-panel__item-name', item.name || '(Unnamed Item)');
            if (nameSpan) li.appendChild(nameSpan);

            const dropButton = factory.button('Drop', 'inventory-panel__item-drop-button');
            if (dropButton) {
                dropButton.dataset.itemName = item.name || '';
                dropButton.setAttribute('title', `Drop ${item.name || 'item'}`);
                dropButton.setAttribute('aria-label', `Drop ${item.name || 'item'}`); // More explicit label
                dropButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const clickedButton = /** @type {HTMLButtonElement} */ (event.target);
                    const itemName = clickedButton.dataset.itemName;

                    if (!itemName) {
                        this.logger.error(`${this._logPrefix} Drop button clicked, but missing item name.`, {itemId: item.id});
                        return;
                    }

                    const commandString = `drop ${itemName}`;
                    const dispatched = await this.#dispatchSubmitCommand(commandString);
                    if (dispatched && this.#isVisible) {
                        this.toggle(false);
                    }
                });
                li.appendChild(dropButton);
            }
            this.#listElement.appendChild(li);
        });

        this.logger.debug(`${this._logPrefix} Inventory list updated with ${itemsData.length} valid items.`);
    }

    /**
     * Helper to dispatch a 'core:submit_command' event.
     * @private
     * @param {string} commandString - The command text to submit.
     * @returns {Promise<boolean>} True if dispatched.
     */
    async #dispatchSubmitCommand(commandString) {
        this.logger.debug(`${this._logPrefix} Attempting to dispatch 'core:submit_command' for: "${commandString}"`);
        try {
            const dispatched = await this.validatedEventDispatcher.dispatchValidated(
                'core:submit_command',
                {command: commandString}
            );
            if (dispatched) {
                this.logger.info(`${this._logPrefix} Event 'core:submit_command' for "${commandString}" dispatched successfully.`);
                return true;
            } else {
                this.logger.warn(`${this._logPrefix} Event 'core:submit_command' for "${commandString}" was NOT dispatched.`);
                return false;
            }
        } catch (error) {
            this.logger.error(`${this._logPrefix} Error dispatching 'core:submit_command' for "${commandString}":`, error);
            return false;
        }
    }


    /**
     * Toggles the visibility of the inventory panel.
     * @param {boolean} [forceState] - Optional. True to show, false to hide.
     */
    toggle(forceState) {
        if (!this.#panelElement) {
            this.logger.warn(`${this._logPrefix} Cannot toggle inventory, panel element does not exist.`);
            return;
        }

        const shouldBeVisible = forceState === undefined ? !this.#isVisible : Boolean(forceState);

        if (shouldBeVisible === this.#isVisible) {
            if (shouldBeVisible) { // If already visible and asked to be visible, refresh data
                this.logger.debug(`${this._logPrefix} Panel #inventory-panel already visible, requesting inventory refresh.`);
                this.validatedEventDispatcher.dispatchValidated('ui:request_inventory_render', {});
            }
            return;
        }

        if (shouldBeVisible) {
            this.logger.debug(`${this._logPrefix} Toggling #inventory-panel to visible.`);
            this.validatedEventDispatcher.dispatchValidated('ui:request_inventory_render', {});
            this.#panelElement.classList.remove('hidden');
            this.#panelElement.removeAttribute('aria-hidden');
            this.#isVisible = true;
            // Focus management: consider moving focus into the panel, e.g., to the close button or first item.
            const closeButton = this.#panelElement.querySelector('.inventory-panel__close-button');
            closeButton?.focus();
        } else {
            this.logger.debug(`${this._logPrefix} Toggling #inventory-panel to hidden.`);
            this.#panelElement.classList.add('hidden');
            this.#panelElement.setAttribute('aria-hidden', 'true');
            this.#isVisible = false;
            // Focus management: consider returning focus to the element that opened the panel.
        }
    }

    /**
     * Dispose method for cleanup.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => sub?.unsubscribe());
        this.#subscriptions = [];

        if (this.#panelElement && this.#panelElement.parentNode === this.#containerElement) {
            try {
                this.#containerElement.removeChild(this.#panelElement);
                this.logger.debug(`${this._logPrefix} Removed #inventory-panel from DOM.`);
            } catch (error) {
                this.logger.warn(`${this._logPrefix} Error removing #inventory-panel during dispose:`, error);
            }
        }
        this.#panelElement = null;
        this.#listElement = null;

        super.dispose();
    }
}