/**
 * @file DI registration for Expression Diagnostics services
 */

import { diagnosticsTokens } from '../tokens/tokens-diagnostics.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

import GateConstraintAnalyzer from '../../expressionDiagnostics/services/GateConstraintAnalyzer.js';
import IntensityBoundsCalculator from '../../expressionDiagnostics/services/IntensityBoundsCalculator.js';

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

  // Note: Additional services will be registered as they're implemented
  // - IMonteCarloSimulator (EXPDIA-007)
  // - IFailureExplainer (EXPDIA-008)
  // - IWitnessStateFinder (EXPDIA-011)
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
