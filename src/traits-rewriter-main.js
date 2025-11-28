/**
 * @file Entry point for the Traits Rewriter application
 * This file initializes the Traits Rewriter controller and UI
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { TraitsRewriterController } from './characterBuilder/controllers/TraitsRewriterController.js';
import { LLMSelectionPersistence } from './llms/services/llmSelectionPersistence.js';
import { tokens } from './dependencyInjection/tokens.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

/**
 * Update the LLM status display on the page
 *
 * @param {object} container - Dependency injection container
 */
export async function updateLLMDisplay(container) {
  const llmNameElement = document.getElementById('active-llm-name');
  if (!llmNameElement) return;

  try {
    const llmAdapter = container.resolve(tokens.LLMAdapter);
    const currentLlmId = await llmAdapter.getCurrentActiveLlmId();

    if (currentLlmId) {
      // Get the display name for the current LLM
      const availableOptions = await llmAdapter.getAvailableLlmOptions();
      const currentOption = availableOptions.find(
        (opt) => opt.configId === currentLlmId
      );

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
    llmNameElement.textContent = 'Unknown';
  }
}

/**
 * Initialize the Traits Rewriter application
 */
export async function initializeTraitsRewriter() {
  try {
    const bootstrap = new CharacterBuilderBootstrap();

    const { controller, container } = await bootstrap.bootstrap({
      pageName: 'Traits Rewriter',
      controllerClass: TraitsRewriterController,
      includeModLoading: true, // Enable mod loading to include event definitions
    });

    // Update LLM status display
    await updateLLMDisplay(container);

    console.info('Traits Rewriter initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Traits Rewriter:', error);

    // Display error to user
    const container = document.getElementById('rewritten-traits-container');
    if (container) {
      container.innerHTML = `
        <div class="cb-error-message">
          <p>Failed to initialize the application. Please refresh the page.</p>
          <p class="error-details">${error.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Start the application if the environment allows it
 */
export function startApp() {
  if (shouldAutoInitializeDom()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeTraitsRewriter);
    } else {
      initializeTraitsRewriter();
    }
  }
}

// Initialize when DOM is ready
startApp();
