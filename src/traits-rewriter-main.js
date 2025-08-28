/**
 * @file Entry point for the Traits Rewriter application
 * This file initializes the Traits Rewriter controller and UI
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { TraitsRewriterController } from './characterBuilder/controllers/TraitsRewriterController.js';

/**
 * Initialize the Traits Rewriter application
 */
async function initializeTraitsRewriter() {
  try {
    const bootstrap = new CharacterBuilderBootstrap();

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Traits Rewriter',
      controllerClass: TraitsRewriterController,
      includeModLoading: true, // Enable mod loading to include event definitions
    });

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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTraitsRewriter);
} else {
  initializeTraitsRewriter();
}
