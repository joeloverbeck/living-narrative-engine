// damage-simulator.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { registerDamageSimulatorComponents } from './dependencyInjection/registrations/damageSimulatorRegistrations.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

/**
 * Initialize the damage simulator using the CommonBootstrapper
 */
async function initialize() {
  const bootstrapper = new CommonBootstrapper();

  try {
    // Bootstrap the application with minimal configuration
    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      postInitHook: async (services, container) => {
        // Register damage simulator components
        registerDamageSimulatorComponents(container);

        const { logger } = services;

        // Resolve shared services
        const recipeSelectorService = container.resolve(
          tokens.IRecipeSelectorService
        );
        const entityLoadingService = container.resolve(
          tokens.IEntityLoadingService
        );
        const anatomyDataExtractor = container.resolve(
          tokens.IAnatomyDataExtractor
        );

        logger.info('[DamageSimulator] Initialized with services:', {
          recipeSelectorService: !!recipeSelectorService,
          entityLoadingService: !!entityLoadingService,
          anatomyDataExtractor: !!anatomyDataExtractor,
        });

        // TODO: Initialize DamageSimulatorUI in DAMAGESIMULATOR-007
      },
    });
  } catch (error) {
    bootstrapper.displayFatalStartupError(
      `Failed to initialize damage simulator: ${error.message}`,
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
