/**
 * @file Entry point for Traits Generator page
 * @see TraitsGeneratorController.js
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { TraitsGeneratorController } from './characterBuilder/controllers/TraitsGeneratorController.js';
import { TraitsDisplayEnhancer } from './characterBuilder/services/TraitsDisplayEnhancer.js';

/**
 * Initialize the Traits Generator application
 *
 * @returns {Promise<object>} Bootstrap result with controller and container
 */
const initializeApp = async () => {
  const bootstrap = new CharacterBuilderBootstrap();

  try {
    console.log('Initializing Traits Generator...');

    // Bootstrap with proper configuration
    const result = await bootstrap.bootstrap({
      pageName: 'traits-generator',
      controllerClass: TraitsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/trait.schema.json'],
      services: {
        traitsDisplayEnhancer: TraitsDisplayEnhancer,
      },
      hooks: {
        postInit: (controller) => {
          // Store controller reference for debugging
          if (
            globalThis.process?.env?.NODE_ENV === 'development' &&
            typeof window !== 'undefined'
          ) {
            window.__traitsGeneratorController = controller;
            console.log('Debug: Controller exposed on window object');
          }
        },
      },
    });

    return result;
  } catch (error) {
    console.error('Failed to initialize Traits Generator:', error);
    throw error;
  }
};

// Initialize when DOM is loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
}
