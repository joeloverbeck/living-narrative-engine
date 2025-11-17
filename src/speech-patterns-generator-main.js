/**
 * @file Entry point for the Speech Patterns Generator application
 * This file initializes the Speech Patterns Generator controller and UI
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { SpeechPatternsGeneratorController } from './characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import { LLMSelectionPersistence } from './llms/services/llmSelectionPersistence.js';
import { tokens } from './dependencyInjection/tokens.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

/**
 * Update the LLM status display on the page
 * @param {object} container - Dependency injection container
 */
async function updateLLMDisplay(container) {
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
 * Initialize the Speech Patterns Generator application
 */
async function initializeSpeechPatternsGenerator() {
  try {
    const bootstrap = new CharacterBuilderBootstrap();

    const { controller, container } = await bootstrap.bootstrap({
      pageName: 'Speech Patterns Generator',
      controllerClass: SpeechPatternsGeneratorController,
      includeModLoading: true, // Enable mod loading to include event definitions
    });

    // Update LLM status display
    await updateLLMDisplay(container);

    console.info('Speech Patterns Generator initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Speech Patterns Generator:', error);

    // Display error to user
    const container = document.getElementById('speech-patterns-container');
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

// Initialize when DOM is ready
if (shouldAutoInitializeDom()) {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initializeSpeechPatternsGenerator
    );
  } else {
    initializeSpeechPatternsGenerator();
  }
}
