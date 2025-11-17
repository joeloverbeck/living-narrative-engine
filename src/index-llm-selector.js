/**
 * @file LLM selector initialization for index.html
 * @description Initializes the LLM selection modal and status display on the index page
 * @see index.html
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { LLMSelectionPersistence } from './llms/services/llmSelectionPersistence.js';
import { tokens } from './dependencyInjection/tokens.js';
import { LlmSelectionModal } from './domUI/llmSelectionModal.js';
import DocumentContext from './domUI/documentContext.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

/**
 * Simple controller for the index page LLM selector
 */
class IndexLLMController {
  #container;
  #llmAdapter;

  constructor({ container }) {
    this.#container = container;
    this.#llmAdapter = container.resolve(tokens.LLMAdapter);
  }

  /**
   * Initialize method required by CharacterBuilderBootstrap
   */
  async initialize() {
    return this.init();
  }

  async init() {
    // Update the current LLM display
    await this.updateCurrentLLMDisplay();

    // Initialize the LLM selection modal
    // Try to resolve the modal, but handle the case where UI might not be registered
    let llmSelectionModal = null;
    try {
      // First try with the token (correct way)
      llmSelectionModal = this.#container.resolve(tokens.LlmSelectionModal);
    } catch (error) {
      // If UI components aren't registered, register just the LlmSelectionModal
      console.info('LlmSelectionModal not found, registering it directly');

      // Ensure DocumentContext is registered
      if (!this.#container.isRegistered(tokens.DocumentContext)) {
        this.#container.register(
          tokens.DocumentContext,
          () => new DocumentContext(document),
          { lifecycle: 'singleton' }
        );
      }

      // Register the LlmSelectionModal as a singleton
      this.#container.register(
        tokens.LlmSelectionModal,
        () =>
          new LlmSelectionModal({
            logger: this.#container.resolve(tokens.ILogger),
            documentContext: this.#container.resolve(tokens.DocumentContext),
            llmAdapter: this.#container.resolve(tokens.LLMAdapter),
            validatedEventDispatcher: this.#container.resolve(
              tokens.IValidatedEventDispatcher
            ),
          }),
        { lifecycle: 'singleton' }
      );

      // Now resolve it
      llmSelectionModal = this.#container.resolve(tokens.LlmSelectionModal);
    }

    // Add event listener to update display when modal is closed
    const modalElement = document.getElementById('llm-selection-modal');
    if (modalElement && llmSelectionModal) {
      // Use MutationObserver to detect when modal is hidden
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'style'
          ) {
            const isHidden = modalElement.style.display === 'none';
            if (isHidden) {
              // Modal was closed, update the display
              this.updateCurrentLLMDisplay();
            }
          }
        });
      });

      observer.observe(modalElement, {
        attributes: true,
        attributeFilter: ['style'],
      });
    }

    console.info('LLM selector initialized successfully on index page');
  }

  /**
   * Update the current LLM display on the page
   */
  async updateCurrentLLMDisplay() {
    const llmNameElement = document.getElementById('current-llm-name');
    if (!llmNameElement) return;

    try {
      const currentLlmId = await this.#llmAdapter.getCurrentActiveLlmId();

      if (currentLlmId) {
        // Get the display name for the current LLM
        const availableOptions =
          await this.#llmAdapter.getAvailableLlmOptions();
        const currentOption = availableOptions.find(
          (opt) => opt.configId === currentLlmId
        );

        if (currentOption) {
          llmNameElement.textContent =
            currentOption.displayName || currentLlmId;
        } else {
          llmNameElement.textContent = currentLlmId;
        }
      } else {
        llmNameElement.textContent = 'Default LLM';
      }
    } catch (error) {
      console.error('Failed to update LLM display', error);
      llmNameElement.textContent = 'Error loading';
      llmNameElement.style.color = '#ff6b6b';
    }
  }
}

/**
 * Initialize the LLM selector for the index page
 */
async function initializeLLMSelector() {
  try {
    const bootstrap = new CharacterBuilderBootstrap();

    const { controller, container } = await bootstrap.bootstrap({
      pageName: 'Index LLM Selector',
      controllerClass: IndexLLMController,
      includeModLoading: false, // Don't need mod loading for this simple page
    });

    console.info('Index page LLM selector initialized successfully');
  } catch (error) {
    console.error('Failed to initialize index page LLM selector:', error);

    // Update display to show error state
    const llmNameElement = document.getElementById('current-llm-name');
    if (llmNameElement) {
      llmNameElement.textContent = 'Error loading';
      llmNameElement.style.color = '#ff6b6b';
    }
  }
}

// Initialize when DOM is ready
if (shouldAutoInitializeDom()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLLMSelector);
  } else {
    initializeLLMSelector();
  }
}
