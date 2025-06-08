// src/domUI/domUiFacade.js
/**
 * @file Facade providing access to all UI rendering components.
 */

/** @typedef {import('./actionButtonsRenderer').ActionButtonsRenderer} ActionButtonsRenderer */
/** @typedef {import('./locationRenderer').LocationRenderer} LocationRenderer */
/** @typedef {import('./titleRenderer').TitleRenderer} TitleRenderer */
/** @typedef {import('./inputStateController').InputStateController} InputStateController */
/** @typedef {import('./perceptionLogRenderer').PerceptionLogRenderer} PerceptionLogRenderer */
/** @typedef {import('./saveGameUI').default} SaveGameUI */
/** @typedef {import('./loadGameUI').default} LoadGameUI */
/** @typedef {import('./llmSelectionModal').LlmSelectionModal} LlmSelectionModal */
/** @typedef {import('./speechBubbleRenderer').SpeechBubbleRenderer} SpeechBubbleRenderer */

/** @typedef {import('./actionResultRenderer.js').ActionResultRenderer} ActionResultRenderer */

/**
 * Provides a single point of access to the various UI rendering/controller components.
 * This facade is intended to be injected into other services that need to interact
 * with the UI layer, simplifying dependency management. It performs no logic itself,
 * simply exposing the underlying components via getters.
 */
export class DomUiFacade {
  #actionButtonsRenderer;
  #locationRenderer;
  #titleRenderer;
  #inputStateController;
  #perceptionLogRenderer;
  #saveGameUI;
  #loadGameUI;
  #llmSelectionModal;
  #speechBubbleRenderer;
  #actionResultRenderer;

  /**
   * Creates an instance of DomUiFacade.
   *
   * @param {object} deps - Dependencies object containing all required renderers/controllers.
   * @param {ActionButtonsRenderer} deps.actionButtonsRenderer - Renderer for action buttons.
   * @param {LocationRenderer} deps.locationRenderer - Renderer for location details.
   * @param {TitleRenderer} deps.titleRenderer - Renderer for the main game title.
   * @param {InputStateController} deps.inputStateController - Controller for the player input element's state.
   * @param {SpeechBubbleRenderer} deps.speechBubbleRenderer - Renderer for speech bubbles.
   * @param {PerceptionLogRenderer} deps.perceptionLogRenderer - Renderer for perception logs.
   * @param {ActionResultRenderer} deps.actionResultRenderer - Renderer for action result bubbles.
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
    speechBubbleRenderer,
    perceptionLogRenderer,
    actionResultRenderer,
    saveGameUI,
    loadGameUI,
    llmSelectionModal,
  }) {
    // Basic validation to ensure all renderers are provided
    if (
      !actionButtonsRenderer ||
      typeof actionButtonsRenderer.refreshList !== 'function'
    )
      throw new Error(
        'DomUiFacade: Missing or invalid actionButtonsRenderer dependency.'
      ); // Changed to refreshList
    if (!locationRenderer || typeof locationRenderer.render !== 'function')
      throw new Error(
        'DomUiFacade: Missing or invalid locationRenderer dependency.'
      );
    if (!titleRenderer || typeof titleRenderer.set !== 'function')
      throw new Error(
        'DomUiFacade: Missing or invalid titleRenderer dependency.'
      );
    if (
      !inputStateController ||
      typeof inputStateController.setEnabled !== 'function'
    )
      throw new Error(
        'DomUiFacade: Missing or invalid inputStateController dependency.'
      );
    if (
      !speechBubbleRenderer ||
      typeof speechBubbleRenderer.renderSpeech !== 'function'
    )
      throw new Error(
        'DomUiFacade: Missing or invalid speechBubbleRenderer dependency.'
      );
    if (
      !perceptionLogRenderer ||
      typeof perceptionLogRenderer.refreshList !== 'function'
    )
      throw new Error(
        'DomUiFacade: Missing or invalid perceptionLogRenderer dependency.'
      ); // Changed to refreshList
    if (!actionResultRenderer)
      throw new Error(
        'DomUiFacade: Missing or invalid actionResultRenderer dependency.'
      );
    if (!saveGameUI || typeof saveGameUI.show !== 'function')
      throw new Error('DomUiFacade: Missing or invalid saveGameUI dependency.');
    if (!loadGameUI || typeof loadGameUI.show !== 'function')
      throw new Error('DomUiFacade: Missing or invalid loadGameUI dependency.');
    if (!llmSelectionModal || typeof llmSelectionModal.show !== 'function')
      throw new Error(
        'DomUiFacade: Missing or invalid llmSelectionModal dependency.'
      );

    this.#actionButtonsRenderer = actionButtonsRenderer;
    this.#locationRenderer = locationRenderer;
    this.#titleRenderer = titleRenderer;
    this.#inputStateController = inputStateController;
    this.#speechBubbleRenderer = speechBubbleRenderer;
    this.#perceptionLogRenderer = perceptionLogRenderer;
    this.#actionResultRenderer = actionResultRenderer;
    this.#saveGameUI = saveGameUI;
    this.#loadGameUI = loadGameUI;
    this.#llmSelectionModal = llmSelectionModal;
  }

  /**
   * Provides the ActionButtonsRenderer instance.
   *
   * @returns {ActionButtonsRenderer} Renderer controlling action buttons.
   */
  get actionButtons() {
    return this.#actionButtonsRenderer;
  }

  /**
   * Provides the LocationRenderer instance.
   *
   * @returns {LocationRenderer} Renderer for location details.
   */
  get location() {
    return this.#locationRenderer;
  }

  /**
   * Provides the TitleRenderer instance.
   *
   * @returns {TitleRenderer} Renderer for the main title.
   */
  get title() {
    return this.#titleRenderer;
  }

  /**
   * Provides the InputStateController instance.
   *
   * @returns {InputStateController} Controller for the player input element.
   */
  get input() {
    return this.#inputStateController;
  }

  /**
   * Provides the SpeechBubbleRenderer instance.
   *
   * @returns {SpeechBubbleRenderer} Renderer for speech bubbles.
   */
  get speechBubble() {
    return this.#speechBubbleRenderer;
  }

  /**
   * Provides the PerceptionLogRenderer instance.
   *
   * @returns {PerceptionLogRenderer} Renderer for the perception log.
   */
  get perceptionLog() {
    return this.#perceptionLogRenderer;
  }

  /**
   * Provides the ActionResultRenderer instance.
   *
   * @returns {ActionResultRenderer} Renderer for success/failure action bubbles.
   */
  get actionResults() {
    return this.#actionResultRenderer;
  }

  /**
   * Provides the SaveGameUI instance.
   *
   * @returns {SaveGameUI} Save game dialog component.
   */
  get saveGame() {
    return this.#saveGameUI;
  }

  /**
   * Provides the LoadGameUI instance.
   *
   * @returns {LoadGameUI} Load game dialog component.
   */
  get loadGame() {
    return this.#loadGameUI;
  }

  /**
   * Provides the LlmSelectionModal instance.
   *
   * @returns {LlmSelectionModal} Modal for choosing an LLM.
   */
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
    this.#speechBubbleRenderer?.dispose?.();
    this.#perceptionLogRenderer?.dispose?.();
    this.#actionResultRenderer?.dispose?.();
    this.#saveGameUI?.dispose?.();
    this.#loadGameUI?.dispose?.();
    this.#llmSelectionModal?.dispose?.();
  }
}
