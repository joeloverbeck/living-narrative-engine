// prototype-analysis.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { diagnosticsTokens } from './dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from './dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from './dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

/**
 * Initialize the Prototype Analysis page.
 */
async function initialize() {
  const bootstrapper = new CommonBootstrapper();

  try {
    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      postInitHook: async (services, container) => {
        registerExpressionServices(container);
        registerExpressionDiagnosticsServices(container);

        const logger = container.resolve(tokens.ILogger);
        logger.info('[PrototypeAnalysis] Bootstrap complete.');

        // Resolve and initialize the controller
        const controller = container.resolve(
          diagnosticsTokens.IPrototypeAnalysisController
        );
        await controller.initialize();
      },
    });
  } catch (error) {
    bootstrapper.displayFatalStartupError(
      `Failed to initialize Prototype Analysis: ${error.message}`,
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
