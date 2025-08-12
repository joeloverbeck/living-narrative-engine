/**
 * @file Entry point for Clichés Generator page
 * @see ClichesGeneratorController.js
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { ClichesGeneratorController } from './clichesGenerator/controllers/ClichesGeneratorController.js';

/**
 * Initialize the Clichés Generator application
 */
const initializeApp = async () => {
  const bootstrap = new CharacterBuilderBootstrap();

  try {
    console.log('Initializing Clichés Generator...');

    // Bootstrap with proper configuration
    const result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      customSchemas: ['/data/schemas/cliche.schema.json'],
      eventDefinitions: [
        {
          id: 'core:cliche_generation_started',
          description: 'Fired when cliché generation begins',
          payloadSchema: {
            type: 'object',
            required: ['directionId', 'conceptId'],
            properties: {
              directionId: { type: 'string' },
              conceptId: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
        {
          id: 'core:cliche_generation_completed',
          description: 'Fired when cliché generation completes',
          payloadSchema: {
            type: 'object',
            required: ['directionId', 'clicheId'],
            properties: {
              directionId: { type: 'string' },
              clicheId: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
        {
          id: 'core:cliche_generation_failed',
          description: 'Fired when cliché generation fails',
          payloadSchema: {
            type: 'object',
            required: ['directionId', 'error'],
            properties: {
              directionId: { type: 'string' },
              error: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      ],
      hooks: {
        postInit: (controller) => {
          // Store controller reference for debugging
          if (process.env.NODE_ENV === 'development') {
            window.__clichesController = controller;
            console.log('Debug: Controller exposed on window object');
          }
        },
      },
    });

    if (result && result.bootstrapTime) {
      console.log(
        `Clichés Generator initialized in ${result.bootstrapTime.toFixed(2)}ms`
      );
    }

    // Set up cleanup on page unload
    window.addEventListener('beforeunload', async () => {
      if (result.controller?.cleanup) {
        await result.controller.cleanup();
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to initialize Clichés Generator:', error);

    // Show user-friendly error
    const errorContainer = document.getElementById(
      'cliches-generator-container'
    );
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="cb-error-page">
          <h1>Unable to Load Clichés Generator</h1>
          <p>Something went wrong while loading the page.</p>
          <p class="error-details">${error.message}</p>
          <button onclick="location.reload()" class="cb-btn cb-btn--primary">
            Reload Page
          </button>
        </div>
      `;
    }

    throw error;
  }
};

// Handle DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded
  initializeApp();
}

// Export for testing
export { initializeApp };
