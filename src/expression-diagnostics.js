// expression-diagnostics.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { diagnosticsTokens } from './dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionDiagnosticsServices } from './dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import ExpressionDiagnosticsController from './domUI/expression-diagnostics/ExpressionDiagnosticsController.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

let controller = null;

async function initialize() {
  const bootstrapper = new CommonBootstrapper();

  try {
    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      postInitHook: async (services, container) => {
        // Register diagnostics services
        registerExpressionDiagnosticsServices(container);

        // Resolve dependencies
        const logger = container.resolve(tokens.ILogger);
        const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
        const gateAnalyzer = container.resolve(
          diagnosticsTokens.IGateConstraintAnalyzer
        );
        const boundsCalculator = container.resolve(
          diagnosticsTokens.IIntensityBoundsCalculator
        );

        // Initialize controller
        controller = new ExpressionDiagnosticsController({
          logger,
          expressionRegistry,
          gateAnalyzer,
          boundsCalculator,
        });

        await controller.initialize();

        logger.info('[ExpressionDiagnostics] Controller initialized.');
      },
    });
  } catch (error) {
    bootstrapper.displayFatalStartupError(
      `Failed to initialize Expression Diagnostics: ${error.message}`,
      error
    );
  }
}

// Back button handler
document.getElementById('back-button')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});

export { initialize };

if (shouldAutoInitializeDom()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}
