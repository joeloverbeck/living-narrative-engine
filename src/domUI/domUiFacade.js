// src/domUI/domUiFacade.js
/**
 * @fileoverview Facade providing access to all UI rendering components.
 */

/** @typedef {import('./actionButtonsRenderer').ActionButtonsRenderer} ActionButtonsRenderer */
/** @typedef {import('./inventoryPanel').InventoryPanel} InventoryPanel */
/** @typedef {import('./locationRenderer').LocationRenderer} LocationRenderer */
/** @typedef {import('./titleRenderer').TitleRenderer} TitleRenderer */
/** @typedef {import('./inputStateController').InputStateController} InputStateController */

/** @typedef {import('./uiMessageRenderer').UiMessageRenderer} UiMessageRenderer */

/**
 * Provides a single point of access to the various UI rendering/controller components.
 * This facade is intended to be injected into other services that need to interact
 * with the UI layer, simplifying dependency management. It performs no logic itself,
 * simply exposing the underlying components via getters.
 */
export class DomUiFacade {
    /** @private @type {ActionButtonsRenderer} */ #actionButtonsRenderer;
    /** @private @type {InventoryPanel} */ #inventoryPanel;
    /** @private @type {LocationRenderer} */ #locationRenderer;
    /** @private @type {TitleRenderer} */ #titleRenderer;
    /** @private @type {InputStateController} */ #inputStateController;
    /** @private @type {UiMessageRenderer} */ #uiMessageRenderer;

    /**
     * Creates an instance of DomUiFacade.
     *
     * @param {object} deps - Dependencies object containing all required renderers/controllers.
     * @param {ActionButtonsRenderer} deps.actionButtonsRenderer - Renderer for action buttons.
     * @param {InventoryPanel} deps.inventoryPanel - Controller/Renderer for the inventory panel.
     * @param {LocationRenderer} deps.locationRenderer - Renderer for location details.
     * @param {TitleRenderer} deps.titleRenderer - Renderer for the main game title.
     * @param {InputStateController} deps.inputStateController - Controller for the player input element's state.
     * @param {UiMessageRenderer} deps.uiMessageRenderer - Renderer for UI messages (echo, info, error).
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({
                    actionButtonsRenderer,
                    inventoryPanel,
                    locationRenderer,
                    titleRenderer,
                    inputStateController,
                    uiMessageRenderer
                }) {
        // Basic validation to ensure all renderers are provided
        if (!actionButtonsRenderer || typeof actionButtonsRenderer.render !== 'function') throw new Error('DomUiFacade: Missing or invalid actionButtonsRenderer dependency.');
        if (!inventoryPanel || typeof inventoryPanel.toggle !== 'function') throw new Error('DomUiFacade: Missing or invalid inventoryPanel dependency.');
        if (!locationRenderer || typeof locationRenderer.render !== 'function') throw new Error('DomUiFacade: Missing or invalid locationRenderer dependency.');
        if (!titleRenderer || typeof titleRenderer.set !== 'function') throw new Error('DomUiFacade: Missing or invalid titleRenderer dependency.');
        if (!inputStateController || typeof inputStateController.setEnabled !== 'function') throw new Error('DomUiFacade: Missing or invalid inputStateController dependency.');
        if (!uiMessageRenderer || typeof uiMessageRenderer.render !== 'function') throw new Error('DomUiFacade: Missing or invalid uiMessageRenderer dependency.');

        this.#actionButtonsRenderer = actionButtonsRenderer;
        this.#inventoryPanel = inventoryPanel;
        this.#locationRenderer = locationRenderer;
        this.#titleRenderer = titleRenderer;
        this.#inputStateController = inputStateController;
        this.#uiMessageRenderer = uiMessageRenderer;

        // No logging here as this facade is just a thin wrapper
        // console.log('[DomUiFacade] Initialized.');
    }

    /** @returns {ActionButtonsRenderer} */
    get actionButtons() {
        return this.#actionButtonsRenderer;
    }

    /** @returns {InventoryPanel} */
    get inventory() {
        return this.#inventoryPanel;
    }

    /** @returns {LocationRenderer} */
    get location() {
        return this.#locationRenderer;
    }

    /** @returns {TitleRenderer} */
    get title() {
        return this.#titleRenderer;
    }

    /** @returns {InputStateController} */
    get input() {
        return this.#inputStateController;
    }

    /** @returns {UiMessageRenderer} */
    get messages() {
        return this.#uiMessageRenderer;
    }

    /**
     * Optional: Dispose method to potentially call dispose on all managed renderers.
     * Useful if the facade's lifecycle manages the renderers' lifecycle.
     */
    dispose() {
        // console.log('[DomUiFacade] Disposing...');
        // Call dispose on each renderer if they have a dispose method
        this.#actionButtonsRenderer?.dispose?.();
        this.#inventoryPanel?.dispose?.();
        this.#locationRenderer?.dispose?.();
        this.#titleRenderer?.dispose?.();
        this.#inputStateController?.dispose?.();
        this.#uiMessageRenderer?.dispose?.();
        // console.log('[DomUiFacade] Disposal complete.');
    }
}