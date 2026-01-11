// expression-diagnostics.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { diagnosticsTokens } from './dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from './dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from './dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import ExpressionDiagnosticsController from './domUI/expression-diagnostics/ExpressionDiagnosticsController.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';
import MonteCarloReportGenerator from './expressionDiagnostics/services/MonteCarloReportGenerator.js';
import MonteCarloReportModal from './domUI/expression-diagnostics/MonteCarloReportModal.js';
import DocumentContext from './domUI/documentContext.js';

let controller = null;

/**
 *
 */
async function initialize() {
  const bootstrapper = new CommonBootstrapper();

  try {
    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      postInitHook: async (services, container) => {
        // Register expression services (required for IExpressionRegistry)
        // This is needed because minimal container config doesn't include game systems
        registerExpressionServices(container);

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
        const monteCarloSimulator = container.resolve(
          diagnosticsTokens.IMonteCarloSimulator
        );
        const failureExplainer = container.resolve(
          diagnosticsTokens.IFailureExplainer
        );
        const expressionStatusService = container.resolve(
          diagnosticsTokens.IExpressionStatusService
        );
        const pathSensitiveAnalyzer = container.resolve(
          diagnosticsTokens.IPathSensitiveAnalyzer
        );
        const prototypeFitRankingService = container.resolve(
          diagnosticsTokens.IPrototypeFitRankingService
        );
        const prototypeConstraintAnalyzer = container.resolve(
          diagnosticsTokens.IPrototypeConstraintAnalyzer
        );

        // Create report generator and modal for Monte Carlo report generation
        const reportGenerator = new MonteCarloReportGenerator({
          logger,
          prototypeConstraintAnalyzer,
          prototypeFitRankingService,
        });
        const documentContext = new DocumentContext(document, logger);

        // Create a minimal noop event dispatcher for the modal
        // The modal uses it only for VED subscription management which we don't need
        const noopEventDispatcher = {
          dispatch: async () => true,
          subscribe: () => () => {},
          unsubscribe: () => false,
        };

        const reportModal = new MonteCarloReportModal({
          logger,
          documentContext,
          validatedEventDispatcher: noopEventDispatcher,
        });

        // Initialize controller
        controller = new ExpressionDiagnosticsController({
          logger,
          expressionRegistry,
          gateAnalyzer,
          boundsCalculator,
          monteCarloSimulator,
          failureExplainer,
          expressionStatusService,
          pathSensitiveAnalyzer,
          reportGenerator,
          reportModal,
          prototypeFitRankingService,
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
