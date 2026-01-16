/**
 * @file DI registration for Expression Diagnostics services
 */

import { diagnosticsTokens } from '../tokens/tokens-diagnostics.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

import GateConstraintAnalyzer from '../../expressionDiagnostics/services/GateConstraintAnalyzer.js';
import IntensityBoundsCalculator from '../../expressionDiagnostics/services/IntensityBoundsCalculator.js';
import MonteCarloSimulator from '../../expressionDiagnostics/services/MonteCarloSimulator.js';
import RandomStateGenerator from '../../expressionDiagnostics/services/RandomStateGenerator.js';
import ContextBuilder from '../../expressionDiagnostics/services/simulatorCore/ContextBuilder.js';
import ExpressionEvaluator from '../../expressionDiagnostics/services/simulatorCore/ExpressionEvaluator.js';
import GateEvaluator from '../../expressionDiagnostics/services/simulatorCore/GateEvaluator.js';
import PrototypeEvaluator from '../../expressionDiagnostics/services/simulatorCore/PrototypeEvaluator.js';
import ViolationEstimator from '../../expressionDiagnostics/services/simulatorCore/ViolationEstimator.js';
import VariablePathValidator from '../../expressionDiagnostics/services/simulatorCore/VariablePathValidator.js';
import FailureExplainer from '../../expressionDiagnostics/services/FailureExplainer.js';
import ExpressionStatusService from '../../expressionDiagnostics/services/ExpressionStatusService.js';
import PathSensitiveAnalyzer from '../../expressionDiagnostics/services/PathSensitiveAnalyzer.js';
import PrototypeConstraintAnalyzer from '../../expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';
import PrototypeFitRankingService from '../../expressionDiagnostics/services/PrototypeFitRankingService.js';
import ContextAxisNormalizer from '../../expressionDiagnostics/services/ContextAxisNormalizer.js';
import PrototypeGateChecker from '../../expressionDiagnostics/services/PrototypeGateChecker.js';
import PrototypeIntensityCalculator from '../../expressionDiagnostics/services/PrototypeIntensityCalculator.js';
import PrototypeRegistryService from '../../expressionDiagnostics/services/PrototypeRegistryService.js';
import PrototypeSimilarityMetrics from '../../expressionDiagnostics/services/PrototypeSimilarityMetrics.js';
import PrototypeGapAnalyzer from '../../expressionDiagnostics/services/PrototypeGapAnalyzer.js';
import PrototypeTypeDetector from '../../expressionDiagnostics/services/PrototypeTypeDetector.js';
import EmotionCalculatorAdapter from '../../expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import SensitivityAnalyzer from '../../expressionDiagnostics/services/SensitivityAnalyzer.js';
import PrototypeSynthesisService from '../../expressionDiagnostics/services/PrototypeSynthesisService.js';

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
    diagnosticsTokens.IRandomStateGenerator,
    (c) =>
      new RandomStateGenerator({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IRandomStateGenerator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IMonteCarloContextBuilder,
    (c) =>
      new ContextBuilder({
        logger: c.resolve(tokens.ILogger),
        dataRegistry: c.resolve(tokens.IDataRegistry),
        emotionCalculatorAdapter: c.resolve(
          diagnosticsTokens.IEmotionCalculatorAdapter
        ),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IMonteCarloContextBuilder}`);

  registrar.singletonFactory(
    diagnosticsTokens.IMonteCarloExpressionEvaluator,
    () => new ExpressionEvaluator()
  );
  safeDebug(`Registered ${diagnosticsTokens.IMonteCarloExpressionEvaluator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IMonteCarloGateEvaluator,
    (c) =>
      new GateEvaluator({
        logger: c.resolve(tokens.ILogger),
        dataRegistry: c.resolve(tokens.IDataRegistry),
        contextBuilder: c.resolve(diagnosticsTokens.IMonteCarloContextBuilder),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IMonteCarloGateEvaluator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IMonteCarloPrototypeEvaluator,
    (c) =>
      new PrototypeEvaluator({
        logger: c.resolve(tokens.ILogger),
        dataRegistry: c.resolve(tokens.IDataRegistry),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IMonteCarloPrototypeEvaluator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IMonteCarloViolationEstimator,
    () => new ViolationEstimator()
  );
  safeDebug(`Registered ${diagnosticsTokens.IMonteCarloViolationEstimator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IMonteCarloVariablePathValidator,
    () => new VariablePathValidator()
  );
  safeDebug(`Registered ${diagnosticsTokens.IMonteCarloVariablePathValidator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IMonteCarloSimulator,
    (c) =>
      new MonteCarloSimulator({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
        emotionCalculatorAdapter: c.resolve(
          diagnosticsTokens.IEmotionCalculatorAdapter
        ),
        randomStateGenerator: c.resolve(
          diagnosticsTokens.IRandomStateGenerator
        ),
        contextBuilder: c.resolve(diagnosticsTokens.IMonteCarloContextBuilder),
        expressionEvaluator: c.resolve(
          diagnosticsTokens.IMonteCarloExpressionEvaluator
        ),
        gateEvaluator: c.resolve(diagnosticsTokens.IMonteCarloGateEvaluator),
        prototypeEvaluator: c.resolve(
          diagnosticsTokens.IMonteCarloPrototypeEvaluator
        ),
        violationEstimator: c.resolve(
          diagnosticsTokens.IMonteCarloViolationEstimator
        ),
        variablePathValidator: c.resolve(
          diagnosticsTokens.IMonteCarloVariablePathValidator
        ),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IMonteCarloSimulator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IEmotionCalculatorAdapter,
    (c) =>
      new EmotionCalculatorAdapter({
        emotionCalculatorService: c.resolve(tokens.IEmotionCalculatorService),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IEmotionCalculatorAdapter}`);

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

  // Prototype Constraint Analysis (Monte Carlo report enhancement)
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeConstraintAnalyzer,
    (c) =>
      new PrototypeConstraintAnalyzer({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeConstraintAnalyzer}`);

  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeRegistryService,
    (c) =>
      new PrototypeRegistryService({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeRegistryService}`);

  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeTypeDetector,
    (c) =>
      new PrototypeTypeDetector({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeTypeDetector}`);

  registrar.singletonFactory(
    diagnosticsTokens.IContextAxisNormalizer,
    (c) =>
      new ContextAxisNormalizer({
        logger: c.resolve(tokens.ILogger),
        prototypeConstraintAnalyzer: c.resolve(
          diagnosticsTokens.IPrototypeConstraintAnalyzer
        ),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IContextAxisNormalizer}`);

  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeGateChecker,
    (c) =>
      new PrototypeGateChecker({
        logger: c.resolve(tokens.ILogger),
        contextAxisNormalizer: c.resolve(diagnosticsTokens.IContextAxisNormalizer),
        prototypeConstraintAnalyzer: c.resolve(
          diagnosticsTokens.IPrototypeConstraintAnalyzer
        ),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeGateChecker}`);

  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeIntensityCalculator,
    (c) =>
      new PrototypeIntensityCalculator({
        logger: c.resolve(tokens.ILogger),
        contextAxisNormalizer: c.resolve(diagnosticsTokens.IContextAxisNormalizer),
        prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeIntensityCalculator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeSimilarityMetrics,
    (c) =>
      new PrototypeSimilarityMetrics({
        logger: c.resolve(tokens.ILogger),
        prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeSimilarityMetrics}`);

  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeGapAnalyzer,
    (c) =>
      new PrototypeGapAnalyzer({
        logger: c.resolve(tokens.ILogger),
        prototypeSimilarityMetrics: c.resolve(
          diagnosticsTokens.IPrototypeSimilarityMetrics
        ),
        prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
        prototypeRegistryService: c.resolve(
          diagnosticsTokens.IPrototypeRegistryService
        ),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeGapAnalyzer}`);

  // Prototype Fit Ranking Service (Monte Carlo prototype fit analysis)
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeFitRankingService,
    (c) =>
      new PrototypeFitRankingService({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
        prototypeConstraintAnalyzer: c.resolve(
          diagnosticsTokens.IPrototypeConstraintAnalyzer
        ),
        prototypeRegistryService: c.resolve(
          diagnosticsTokens.IPrototypeRegistryService
        ),
        prototypeTypeDetector: c.resolve(
          diagnosticsTokens.IPrototypeTypeDetector
        ),
        contextAxisNormalizer: c.resolve(
          diagnosticsTokens.IContextAxisNormalizer
        ),
        prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
        prototypeIntensityCalculator: c.resolve(
          diagnosticsTokens.IPrototypeIntensityCalculator
        ),
        prototypeSimilarityMetrics: c.resolve(
          diagnosticsTokens.IPrototypeSimilarityMetrics
        ),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeFitRankingService}`);

  // Prototype Synthesis Service (PROCRESUGREC-002)
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeSynthesisService,
    (c) =>
      new PrototypeSynthesisService({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeSynthesisService}`);

  registrar.singletonFactory(
    diagnosticsTokens.ISensitivityAnalyzer,
    (c) =>
      new SensitivityAnalyzer({
        logger: c.resolve(tokens.ILogger),
        monteCarloSimulator: c.resolve(diagnosticsTokens.IMonteCarloSimulator),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.ISensitivityAnalyzer}`);

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
