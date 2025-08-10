/**
 * @file Entry point for Clichés Generator page
 * @see ClichesGeneratorController.js
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { ClichesGeneratorController } from './clichesGenerator/controllers/ClichesGeneratorController.js';
import { ClicheGenerator } from './characterBuilder/services/ClicheGenerator.js';
import { ensureValidLogger } from './utils/loggerUtils.js';

/**
 * Bootstrap function for the Clichés Generator page
 */
async function bootstrapClichesGenerator() {
  const logger = ensureValidLogger(console, 'ClichesGeneratorMain');

  try {
    logger.info('Starting Clichés Generator bootstrap...');

    // Create bootstrap instance
    const bootstrap = new CharacterBuilderBootstrap({
      logger,
      pageName: 'Clichés Generator',
    });

    // Register page-specific services
    bootstrap.registerService('clicheGenerator', ClicheGenerator);

    // Initialize common services
    await bootstrap.initialize();

    // Get initialized services
    const services = bootstrap.getServices();

    // Create controller with all required dependencies
    const controller = new ClichesGeneratorController({
      logger: services.logger,
      characterBuilderService: services.characterBuilderService,
      eventBus: services.eventBus,
      schemaValidator: services.schemaValidator,
      clicheGenerator: services.clicheGenerator,
    });

    // Store controller reference for debugging
    window.__clichesGeneratorController = controller;

    // Initialize the controller
    await controller.initialize();

    logger.info('Clichés Generator page initialized successfully');

    // Set up cleanup on page unload
    window.addEventListener('beforeunload', async () => {
      logger.info('Page unloading, cleaning up...');
      try {
        await controller.cleanup();
        await bootstrap.cleanup();
      } catch (error) {
        logger.error('Error during cleanup:', error);
      }
    });

    return controller;
  } catch (error) {
    logger.error('Failed to bootstrap Clichés Generator:', error);

    // Display error to user
    const container = document.getElementById('cliches-generator-container');
    if (container) {
      container.innerHTML = `
        <div class="error-state">
          <h2>Failed to Initialize</h2>
          <p>Unable to load the Clichés Generator. Please refresh the page.</p>
          <p class="error-details">${error.message || 'Unknown error'}</p>
          <button onclick="location.reload()" class="cb-button cb-button-primary">
            Refresh Page
          </button>
        </div>
      `;
    }

    throw error;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapClichesGenerator);
} else {
  // DOM is already loaded
  bootstrapClichesGenerator().catch((error) => {
    console.error('Failed to initialize Clichés Generator:', error);
  });
}

// Export for testing
export { bootstrapClichesGenerator };
