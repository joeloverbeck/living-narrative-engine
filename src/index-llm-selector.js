/**
 * @file LLM selector initialization for index.html
 * @description Initializes the LLM selection modal and status display on the index page
 * @see index.html
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { LLMSelectionPersistence } from './llms/services/llmSelectionPersistence.js';

/**
 * Simple controller for the index page LLM selector
 */
class IndexLLMController {
  #container;
  #llmAdapter;

  constructor({ container }) {
    this.#container = container;
    this.#llmAdapter = container.resolve('ILLMAdapter');
  }

  async init() {
    // Update the current LLM display
    await this.updateCurrentLLMDisplay();
    
    // Initialize the LLM selection modal
    const llmSelectionModal = this.#container.resolve('LlmSelectionModal');
    
    // Add event listener to update display when modal is closed
    const modalElement = document.getElementById('llm-selection-modal');
    if (modalElement) {
      // Use MutationObserver to detect when modal is hidden
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
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
        attributeFilter: ['style'] 
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
        const availableOptions = await this.#llmAdapter.getAvailableLlmOptions();
        const currentOption = availableOptions.find(opt => opt.configId === currentLlmId);
        
        if (currentOption) {
          llmNameElement.textContent = currentOption.displayName || currentLlmId;
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLLMSelector);
} else {
  initializeLLMSelector();
}