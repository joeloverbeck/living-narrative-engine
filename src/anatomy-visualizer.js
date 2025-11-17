// anatomy-visualizer.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { registerVisualizerComponents } from './dependencyInjection/registrations/visualizerRegistrations.js';
import AnatomyVisualizerUI from './domUI/AnatomyVisualizerUI.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

let visualizerUI;

/**
 * Initialize the anatomy visualizer using the CommonBootstrapper
 */
async function initialize() {
  const bootstrapper = new CommonBootstrapper();

  try {
    // Bootstrap the application with minimal configuration
    const { container, services } = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      postInitHook: async (services, container) => {
        try {
          // Register visualizer components that aren't included in minimal configuration
          registerVisualizerComponents(container);

          // Initialize UI after all services are ready
          const { logger, registry, entityManager, eventDispatcher } = services;
          const anatomyDescriptionService = container.resolve(
            tokens.AnatomyDescriptionService
          );
          const visualizerStateController = container.resolve(
            tokens.VisualizerStateController
          );
          const visualizationComposer = container.resolve(
            tokens.VisualizationComposer
          );

          // Try to resolve ClothingManagementService - it may not be registered
          let clothingManagementService = null;
          try {
            clothingManagementService = container.resolve(
              tokens.ClothingManagementService
            );
          } catch (err) {
            logger.warn(
              'ClothingManagementService not available - equipment panel will be disabled'
            );
          }

          logger.info('Anatomy Visualizer: Initializing UI...');
          visualizerUI = new AnatomyVisualizerUI({
            logger,
            registry,
            entityManager,
            anatomyDescriptionService,
            eventDispatcher,
            documentContext: { document },
            visualizerStateController,
            visualizationComposer,
            clothingManagementService,
          });

          await visualizerUI.initialize();

          // Setup back button
          const backButton = document.getElementById('back-button');
          if (backButton) {
            backButton.addEventListener('click', () => {
              window.location.href = 'index.html';
            });
          }

          logger.info('Anatomy Visualizer: Initialization complete');
        } catch (error) {
          // Re-throw the error to be caught by the outer try-catch
          throw error;
        }
      },
    });
  } catch (error) {
    bootstrapper.displayFatalStartupError(
      `Failed to initialize anatomy visualizer: ${error.message}`,
      error
    );
  }
}

export { initialize };

// Initialize when DOM is ready
if (shouldAutoInitializeDom()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}
