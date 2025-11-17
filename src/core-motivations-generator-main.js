/**
 * @file Entry point for Core Motivations Generator page
 * @see CoreMotivationsGeneratorController.js
 */

/* eslint-disable no-console */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { CoreMotivationsGeneratorController } from './coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { CoreMotivationsDisplayEnhancer } from './coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';
import { CoreMotivationsGenerator } from './characterBuilder/services/CoreMotivationsGenerator.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

/**
 * Initialize the Core Motivations Generator application
 *
 * @returns {Promise<object>} Bootstrap result with controller and container
 */
const initializeApp = async () => {
  const bootstrap = new CharacterBuilderBootstrap();

  try {
    console.log('Initializing Core Motivations Generator...');

    // Bootstrap with proper configuration
    const result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true, // Load core mod for event definitions
      customSchemas: [
        '/data/schemas/core-motivation.schema.json', // Will be created in CORMOTGEN-006
      ],
      // Note: Event definitions will be loaded from data/mods/core/events/*.event.json
      // These will be created in CORMOTGEN-005
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
      hooks: {
        postInit: (controller) => {
          // Store controller reference for debugging
          if (
            globalThis.process?.env?.NODE_ENV === 'development' &&
            typeof window !== 'undefined'
          ) {
            window.__coreMotivationsController = controller;
            console.log('Debug: Controller exposed on window object');
          }
        },
      },
    });

    if (result && result.bootstrapTime) {
      console.log(
        `Core Motivations Generator initialized in ${result.bootstrapTime.toFixed(2)}ms`
      );
    } else if (result) {
      console.log('Core Motivations Generator initialized successfully');
    }

    // Set up cleanup on page unload when running in a browser
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', async () => {
        if (result.controller?.cleanup) {
          await result.controller.cleanup();
        }
      });
    }

    return result;
  } catch (error) {
    console.error('Failed to initialize Core Motivations Generator:', error);

    // Show user-friendly error
    if (typeof document !== 'undefined') {
      const errorContainer = document.getElementById(
        'core-motivations-container'
      );
      if (errorContainer) {
        errorContainer.innerHTML = `
          <div class="cb-error-page">
            <h1>Unable to Load Core Motivations Generator</h1>
            <p>Something went wrong while loading the page.</p>
            <p class="error-details">${error.message}</p>
            <button onclick="location.reload()" class="cb-btn cb-btn--primary">
              Reload Page
            </button>
          </div>
        `;
      }
    }

    throw error;
  }
};

// Handle DOM ready
if (shouldAutoInitializeDom()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    // DOM already loaded
    initializeApp();
  }
}

// Export for testing
export { initializeApp };
