/**
 * @file Entry point for the Speech Patterns Generator application
 * This file initializes the Speech Patterns Generator controller and UI
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { SpeechPatternsGeneratorController } from './characterBuilder/controllers/SpeechPatternsGeneratorController.js';

/**
 * Initialize the Speech Patterns Generator application
 */
async function initializeSpeechPatternsGenerator() {
  try {
    const bootstrap = new CharacterBuilderBootstrap();

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Speech Patterns Generator',
      controllerClass: SpeechPatternsGeneratorController,
      includeModLoading: false,
    });

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
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeSpeechPatternsGenerator
  );
} else {
  initializeSpeechPatternsGenerator();
}
