// damage-simulator.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { registerVisualizerComponents } from './dependencyInjection/registrations/visualizerRegistrations.js';
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
        // Register shared visualizer components first (provides IRecipeSelectorService,
        // IEntityLoadingService, IAnatomyDataExtractor used by damage simulator)
        registerVisualizerComponents(container);

        // Register damage simulator specific components
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

        // Initialize DamageSimulatorUI (DAMAGESIMULATOR-006)
        const damageSimulatorUI = container.resolve(tokens.DamageSimulatorUI);
        await damageSimulatorUI.initialize();

        logger.info('[DamageSimulator] UI controller initialized');

        // Initialize HierarchicalAnatomyRenderer (DAMAGESIMULATOR-007)
        const anatomyTreeElement = document.getElementById('anatomy-tree');
        if (anatomyTreeElement) {
          const anatomyRendererFactory = container.resolve(
            tokens.HierarchicalAnatomyRenderer
          );
          const anatomyRenderer = anatomyRendererFactory(anatomyTreeElement);
          damageSimulatorUI.setChildComponent('anatomyRenderer', anatomyRenderer);
          logger.info('[DamageSimulator] Anatomy renderer initialized');
        } else {
          logger.warn(
            '[DamageSimulator] Anatomy tree element not found, skipping anatomy renderer'
          );
        }

        // Initialize DamageCapabilityComposer (DAMAGESIMULATOR-009)
        const damageFormElement = document.getElementById('damage-form');
        if (damageFormElement) {
          const damageComposerFactory = container.resolve(
            tokens.DamageCapabilityComposer
          );
          const damageComposer = damageComposerFactory(damageFormElement);
          damageSimulatorUI.setChildComponent('damageComposer', damageComposer);
          await damageComposer.initialize();
          logger.info('[DamageSimulator] Damage composer initialized');
        } else {
          logger.warn(
            '[DamageSimulator] Damage form element not found, skipping damage composer'
          );
        }

        // Initialize DamageExecutionService (DAMAGESIMULATOR-011)
        const executionService = container.resolve(tokens.DamageExecutionService);
        damageSimulatorUI.setChildComponent('executionService', executionService);
        logger.info('[DamageSimulator] Execution service initialized');

        // Initialize DamageHistoryTracker (DAMAGESIMULATOR-012)
        const historyLogElement = document.getElementById('history-log');
        if (historyLogElement) {
          const historyTrackerFactory = container.resolve(
            tokens.DamageHistoryTracker
          );
          const historyTracker = historyTrackerFactory(historyLogElement);
          damageSimulatorUI.setChildComponent('historyTracker', historyTracker);
          historyTracker.render();
          logger.info('[DamageSimulator] History tracker initialized');
        } else {
          logger.warn(
            '[DamageSimulator] History log element not found, skipping history tracker'
          );
        }
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
