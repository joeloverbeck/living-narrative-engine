// anatomy-visualizer.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import AnatomyVisualizerUI from './domUI/AnatomyVisualizerUI.js';

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
        // Initialize UI after all services are ready
        const { logger, registry, entityManager, eventDispatcher } = services;
        const anatomyDescriptionService = container.resolve(
          tokens.AnatomyDescriptionService
        );
        const visualizerStateController = container.resolve(
          tokens.VisualizerStateController
        );

        logger.info('Anatomy Visualizer: Initializing UI...');
        visualizerUI = new AnatomyVisualizerUI({
          logger,
          registry,
          entityManager,
          anatomyDescriptionService,
          eventDispatcher,
          documentContext: { document },
          visualizerStateController,
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
      },
    });
  } catch (error) {
    bootstrapper.displayFatalStartupError(
      `Failed to initialize anatomy visualizer: ${error.message}`,
      error
    );
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
