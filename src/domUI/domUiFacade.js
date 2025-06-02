// src/domUI/domUiFacade.js

/**
 * @fileoverview Facade providing access to all UI rendering components.
 */

/** @typedef {import('./actionButtonsRenderer').ActionButtonsRenderer} ActionButtonsRenderer */
/** @typedef {import('./locationRenderer').LocationRenderer} LocationRenderer */
/** @typedef {import('./titleRenderer').TitleRenderer} TitleRenderer */
/** @typedef {import('./inputStateController').InputStateController} InputStateController */
/** @typedef {import('./uiMessageRenderer').UiMessageRenderer} UiMessageRenderer */
/** @typedef {import('./perceptionLogRenderer').PerceptionLogRenderer} PerceptionLogRenderer */
/** @typedef {import('./saveGameUI').default} SaveGameUI */
/** @typedef {import('./loadGameUI').default} LoadGameUI */
/** @typedef {import('./llmSelectionModal').LlmSelectionModal} LlmSelectionModal */

/** @typedef {import('./speechBubbleRenderer').SpeechBubbleRenderer} SpeechBubbleRenderer */

/**
 * Provides a single point of access to the various UI rendering/controller components.
 * This facade is intended to be injected into other services that need to interact
 * with the UI layer, simplifying dependency management. It performs no logic itself,
 * simply exposing the underlying components via getters.
 */
export class DomUiFacade {
    /** @private @type {ActionButtonsRenderer} */ #actionButtonsRenderer;
    /** @private @type {LocationRenderer} */ #locationRenderer;
    /** @private @type {TitleRenderer} */ #titleRenderer;
    /** @private @type {InputStateController} */ #inputStateController;
    /** @private @type {UiMessageRenderer} */ #uiMessageRenderer;
    /** @private @type {PerceptionLogRenderer} */ #perceptionLogRenderer;
    /** @private @type {SaveGameUI} */ #saveGameUI;
    /** @private @type {LoadGameUI} */ #loadGameUI;
    /** @private @type {LlmSelectionModal} */ #llmSelectionModal;
    /** @private @type {SpeechBubbleRenderer} */ #speechBubbleRenderer;

    /**
     * Creates an instance of DomUiFacade.
     *
     * @param {object} deps - Dependencies object containing all required renderers/controllers.
     * @param {ActionButtonsRenderer} deps.actionButtonsRenderer - Renderer for action buttons.
     * @param {LocationRenderer} deps.locationRenderer - Renderer for location details.
     * @param {TitleRenderer} deps.titleRenderer - Renderer for the main game title.
     * @param {InputStateController} deps.inputStateController - Controller for the player input element's state.
     * @param {UiMessageRenderer} deps.uiMessageRenderer - Renderer for UI messages (echo, info, error).
     * @param {SpeechBubbleRenderer} deps.speechBubbleRenderer - Renderer for speech bubbles.
     * @param {PerceptionLogRenderer} deps.perceptionLogRenderer - Renderer for perception logs.
     * @param {SaveGameUI} deps.saveGameUI - The Save Game UI component.
     * @param {LoadGameUI} deps.loadGameUI - The Load Game UI component.
     * @param {LlmSelectionModal} deps.llmSelectionModal - The LLM Selection Modal component.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({
                    actionButtonsRenderer,
                    locationRenderer,
                    titleRenderer,
                    inputStateController,
                    uiMessageRenderer,
                    speechBubbleRenderer,
                    perceptionLogRenderer,
                    saveGameUI,
                    loadGameUI,
                    llmSelectionModal
                }) {
        // Basic validation to ensure all renderers are provided
        if (!actionButtonsRenderer || typeof actionButtonsRenderer.refreshList !== 'function') throw new Error('DomUiFacade: Missing or invalid actionButtonsRenderer dependency.'); // Changed to refreshList
        if (!locationRenderer || typeof locationRenderer.render !== 'function') throw new Error('DomUiFacade: Missing or invalid locationRenderer dependency.');
        if (!titleRenderer || typeof titleRenderer.set !== 'function') throw new Error('DomUiFacade: Missing or invalid titleRenderer dependency.');
        if (!inputStateController || typeof inputStateController.setEnabled !== 'function') throw new Error('DomUiFacade: Missing or invalid inputStateController dependency.');
        if (!uiMessageRenderer || typeof uiMessageRenderer.render !== 'function') throw new Error('DomUiFacade: Missing or invalid uiMessageRenderer dependency.');
        if (!speechBubbleRenderer || typeof speechBubbleRenderer.renderSpeech !== 'function') throw new Error('DomUiFacade: Missing or invalid speechBubbleRenderer dependency.');
        if (!perceptionLogRenderer || typeof perceptionLogRenderer.refreshList !== 'function') throw new Error('DomUiFacade: Missing or invalid perceptionLogRenderer dependency.'); // Changed to refreshList
        if (!saveGameUI || typeof saveGameUI.show !== 'function') throw new Error('DomUiFacade: Missing or invalid saveGameUI dependency.');
        if (!loadGameUI || typeof loadGameUI.show !== 'function') throw new Error('DomUiFacade: Missing or invalid loadGameUI dependency.');
        if (!llmSelectionModal || typeof llmSelectionModal.show !== 'function') throw new Error('DomUiFacade: Missing or invalid llmSelectionModal dependency.');

        this.#actionButtonsRenderer = actionButtonsRenderer;
        this.#locationRenderer = locationRenderer;
        this.#titleRenderer = titleRenderer;
        this.#inputStateController = inputStateController;
        this.#uiMessageRenderer = uiMessageRenderer;
        this.#speechBubbleRenderer = speechBubbleRenderer;
        this.#perceptionLogRenderer = perceptionLogRenderer;
        this.#saveGameUI = saveGameUI;
        this.#loadGameUI = loadGameUI;
        this.#llmSelectionModal = llmSelectionModal;
    }

    /** @returns {ActionButtonsRenderer} */
    get actionButtons() {
        return this.#actionButtonsRenderer;
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

    /** @returns {SpeechBubbleRenderer} */
    get speechBubble() {
        return this.#speechBubbleRenderer;
    }

    /** @returns {PerceptionLogRenderer} */
    get perceptionLog() {
        return this.#perceptionLogRenderer;
    }

    /** @returns {SaveGameUI} */
    get saveGame() {
        return this.#saveGameUI;
    }

    /** @returns {LoadGameUI} */
    get loadGame() {
        return this.#loadGameUI;
    }

    /** @returns {LlmSelectionModal} */
    get llmSelectionModal() {
        return this.#llmSelectionModal;
    }

    /**
     * Optional: Dispose method to potentially call dispose on all managed renderers.
     * Useful if the facade's lifecycle manages the renderers' lifecycle.
     */
    dispose() {
        this.#actionButtonsRenderer?.dispose?.();
        this.#locationRenderer?.dispose?.();
        this.#titleRenderer?.dispose?.();
        this.#inputStateController?.dispose?.();
        this.#uiMessageRenderer?.dispose?.();
        this.#speechBubbleRenderer?.dispose?.();
        this.#perceptionLogRenderer?.dispose?.();
        this.#saveGameUI?.dispose?.();
        this.#loadGameUI?.dispose?.();
        this.#llmSelectionModal?.dispose?.();
    }
}