// expressions-simulator.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { registerExpressionServices } from './dependencyInjection/registrations/expressionsRegistrations.js';
import ExpressionsSimulatorController from './domUI/expressions-simulator/ExpressionsSimulatorController.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

let simulatorController;

/**
 * Initialize the expressions simulator using the CommonBootstrapper
 */
async function initialize() {
  const bootstrapper = new CommonBootstrapper();

  try {
    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      postInitHook: async (services, container) => {
        if (!container.isRegistered(tokens.IExpressionRegistry)) {
          registerExpressionServices(container);
        }

        const {
          logger,
          registry: dataRegistry,
          entityManager,
        } = services;

        const emotionCalculatorService = container.resolve(
          tokens.IEmotionCalculatorService
        );
        const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
        const expressionContextBuilder = container.resolve(
          tokens.IExpressionContextBuilder
        );
        const expressionEvaluatorService = container.resolve(
          tokens.IExpressionEvaluatorService
        );
        const expressionDispatcher = container.resolve(
          tokens.IExpressionDispatcher
        );
        const eventBus = container.resolve(tokens.IEventBus);
        const perceptionEntryBuilder = container.resolve(
          tokens.IPerceptionEntryBuilder
        );

        simulatorController = new ExpressionsSimulatorController({
          logger,
          dataRegistry,
          entityManager,
          emotionCalculatorService,
          expressionRegistry,
          expressionContextBuilder,
          expressionEvaluatorService,
          expressionDispatcher,
          eventBus,
          perceptionEntryBuilder,
        });

        simulatorController.initialize();
        logger.info('[ExpressionsSimulator] Controller initialized.');
      },
    });
  } catch (error) {
    bootstrapper.displayFatalStartupError(
      `Failed to initialize expressions simulator: ${error.message}`,
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
