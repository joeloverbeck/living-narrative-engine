/**
 * @file DI registration for Expression Diagnostics services
 */

import { diagnosticsTokens } from '../tokens/tokens-diagnostics.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

import GateConstraintAnalyzer from '../../expressionDiagnostics/services/GateConstraintAnalyzer.js';
import IntensityBoundsCalculator from '../../expressionDiagnostics/services/IntensityBoundsCalculator.js';
import MonteCarloSimulator from '../../expressionDiagnostics/services/MonteCarloSimulator.js';
import FailureExplainer from '../../expressionDiagnostics/services/FailureExplainer.js';
import ExpressionStatusService from '../../expressionDiagnostics/services/ExpressionStatusService.js';
import WitnessStateFinder from '../../expressionDiagnostics/services/WitnessStateFinder.js';
import PathSensitiveAnalyzer from '../../expressionDiagnostics/services/PathSensitiveAnalyzer.js';

/**
 * Register Expression Diagnostics services with the DI container
 *
 * @param {object} container - AppContainer instance
 */
export function registerExpressionDiagnosticsServices(container) {
  const registrar = new Registrar(container);

  // Try to get logger for safe debug output
  let logger;
  try {
    logger = container.resolve(tokens.ILogger);
    logger.debug('Expression Diagnostics Registration: starting...');
  } catch {
    logger = null;
  }

  const safeDebug = (message) => {
    if (logger) {
      logger.debug(message);
    }
  };

  // Phase 1 - Static Analysis Services
  registrar.singletonFactory(
    diagnosticsTokens.IGateConstraintAnalyzer,
    (c) =>
      new GateConstraintAnalyzer({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IGateConstraintAnalyzer}`);

  registrar.singletonFactory(
    diagnosticsTokens.IIntensityBoundsCalculator,
    (c) =>
      new IntensityBoundsCalculator({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IIntensityBoundsCalculator}`);

  // Phase 2 - Monte Carlo
  registrar.singletonFactory(
    diagnosticsTokens.IMonteCarloSimulator,
    (c) =>
      new MonteCarloSimulator({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IMonteCarloSimulator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IFailureExplainer,
    (c) =>
      new FailureExplainer({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IFailureExplainer}`);

  // Status Persistence Service
  registrar.singletonFactory(
    diagnosticsTokens.IExpressionStatusService,
    (c) =>
      new ExpressionStatusService({
        logger: c.resolve(tokens.ILogger),
        // baseUrl defaults to http://localhost:3001 in the service
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IExpressionStatusService}`);

  // Phase 3 - Witness Finding
  registrar.singletonFactory(
    diagnosticsTokens.IWitnessStateFinder,
    (c) =>
      new WitnessStateFinder({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IWitnessStateFinder}`);

  // Path-Sensitive Analysis (EXPDIAPATSENANA series)
  registrar.singletonFactory(
    diagnosticsTokens.IPathSensitiveAnalyzer,
    (c) =>
      new PathSensitiveAnalyzer({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        gateConstraintAnalyzer: c.resolve(diagnosticsTokens.IGateConstraintAnalyzer),
        intensityBoundsCalculator: c.resolve(
          diagnosticsTokens.IIntensityBoundsCalculator
        ),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPathSensitiveAnalyzer}`);

  // Note: Additional services will be registered as they're implemented
  // - ISmtSolver (EXPDIA-013)
  // - IThresholdSuggester (EXPDIA-015)

  safeDebug('Expression Diagnostics Registration: completed.');
}

/**
 * Check if all required diagnostics services are available
 *
 * @param {object} container - AppContainer instance
 * @returns {boolean} True if all Phase 1 diagnostics services are registered
 */
export function isDiagnosticsAvailable(container) {
  try {
    container.resolve(diagnosticsTokens.IGateConstraintAnalyzer);
    container.resolve(diagnosticsTokens.IIntensityBoundsCalculator);
    return true;
  } catch {
    return false;
  }
}

export default registerExpressionDiagnosticsServices;
