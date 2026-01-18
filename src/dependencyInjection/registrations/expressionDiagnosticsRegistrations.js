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
import AxisSignConflictExplainer from '../../expressionDiagnostics/services/AxisSignConflictExplainer.js';
import ExpressionStatusService from '../../expressionDiagnostics/services/ExpressionStatusService.js';
import PathSensitiveAnalyzer from '../../expressionDiagnostics/services/PathSensitiveAnalyzer.js';
import PrototypeConstraintAnalyzer from '../../expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';
import PrototypeGateAlignmentAnalyzer from '../../expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js';
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
import NonAxisClauseExtractor from '../../expressionDiagnostics/services/NonAxisClauseExtractor.js';
import NonAxisFeasibilityAnalyzer from '../../expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js';
import FitFeasibilityConflictDetector from '../../expressionDiagnostics/services/FitFeasibilityConflictDetector.js';
import NonAxisFeasibilitySectionGenerator from '../../expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js';
import ConflictWarningSectionGenerator from '../../expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js';
import BlockerSectionGenerator from '../../expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js';
import ReportFormattingService from '../../expressionDiagnostics/services/ReportFormattingService.js';
import MinimalBlockerSetCalculator from '../../expressionDiagnostics/services/MinimalBlockerSetCalculator.js';
import OrBlockAnalyzer from '../../expressionDiagnostics/services/OrBlockAnalyzer.js';
import ConstructiveWitnessSearcher from '../../expressionDiagnostics/services/ConstructiveWitnessSearcher.js';
import ImportanceSamplingValidator from '../../expressionDiagnostics/services/ImportanceSamplingValidator.js';
import EditSetGenerator from '../../expressionDiagnostics/services/EditSetGenerator.js';
import ActionabilitySectionGenerator from '../../expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js';

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
    (c) =>
      new ExpressionEvaluator({
        jsonLogicService: c.resolve(tokens.JsonLogicEvaluationService),
      })
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

  registrar.singletonFactory(
    diagnosticsTokens.IAxisSignConflictExplainer,
    (c) =>
      new AxisSignConflictExplainer({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IAxisSignConflictExplainer}`);

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

  // Prototype Gate Alignment Analysis (PROREGGATALI series)
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeGateAlignmentAnalyzer,
    (c) =>
      new PrototypeGateAlignmentAnalyzer({
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IPrototypeGateAlignmentAnalyzer}`);

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

  // Non-Axis Clause Extractor (PROFITBLOSCODIS-003)
  registrar.singletonFactory(
    diagnosticsTokens.INonAxisClauseExtractor,
    (c) =>
      new NonAxisClauseExtractor({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.INonAxisClauseExtractor}`);

  // Non-Axis Feasibility Analyzer (PROFITBLOSCODIS-004)
  // Note: Must be registered AFTER NonAxisClauseExtractor (dependency)
  registrar.singletonFactory(
    diagnosticsTokens.INonAxisFeasibilityAnalyzer,
    (c) =>
      new NonAxisFeasibilityAnalyzer({
        logger: c.resolve(tokens.ILogger),
        clauseExtractor: c.resolve(diagnosticsTokens.INonAxisClauseExtractor),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.INonAxisFeasibilityAnalyzer}`);

  // Fit Feasibility Conflict Detector (PROFITBLOSCODIS-005)
  registrar.singletonFactory(
    diagnosticsTokens.IFitFeasibilityConflictDetector,
    (c) =>
      new FitFeasibilityConflictDetector({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IFitFeasibilityConflictDetector}`);

  // Non-Axis Feasibility Section Generator (PROFITBLOSCODIS-009)
  registrar.singletonFactory(
    diagnosticsTokens.INonAxisFeasibilitySectionGenerator,
    (c) =>
      new NonAxisFeasibilitySectionGenerator({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.INonAxisFeasibilitySectionGenerator}`);

  // Conflict Warning Section Generator (PROFITBLOSCODIS-008)
  registrar.singletonFactory(
    diagnosticsTokens.IConflictWarningSectionGenerator,
    (c) =>
      new ConflictWarningSectionGenerator({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IConflictWarningSectionGenerator}`);

  // Actionability Services (MONCARACTIMP series)
  registrar.singletonFactory(
    diagnosticsTokens.IMinimalBlockerSetCalculator,
    (c) =>
      new MinimalBlockerSetCalculator({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IMinimalBlockerSetCalculator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IOrBlockAnalyzer,
    (c) =>
      new OrBlockAnalyzer({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IOrBlockAnalyzer}`);

  registrar.singletonFactory(
    diagnosticsTokens.IConstructiveWitnessSearcher,
    (c) =>
      new ConstructiveWitnessSearcher({
        logger: c.resolve(tokens.ILogger),
        stateGenerator: c.resolve(diagnosticsTokens.IRandomStateGenerator),
        expressionEvaluator: c.resolve(
          diagnosticsTokens.IMonteCarloExpressionEvaluator
        ),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IConstructiveWitnessSearcher}`);

  registrar.singletonFactory(
    diagnosticsTokens.IImportanceSamplingValidator,
    (c) =>
      new ImportanceSamplingValidator({
        logger: c.resolve(tokens.ILogger),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IImportanceSamplingValidator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IEditSetGenerator,
    (c) =>
      new EditSetGenerator({
        logger: c.resolve(tokens.ILogger),
        blockerCalculator: c.resolve(diagnosticsTokens.IMinimalBlockerSetCalculator),
        orBlockAnalyzer: c.resolve(diagnosticsTokens.IOrBlockAnalyzer),
        validator: c.resolve(diagnosticsTokens.IImportanceSamplingValidator),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IEditSetGenerator}`);

  registrar.singletonFactory(
    diagnosticsTokens.IActionabilitySectionGenerator,
    (c) =>
      new ActionabilitySectionGenerator({
        logger: c.resolve(tokens.ILogger),
        orBlockAnalyzer: c.resolve(diagnosticsTokens.IOrBlockAnalyzer),
        witnessSearcher: c.resolve(diagnosticsTokens.IConstructiveWitnessSearcher),
        editSetGenerator: c.resolve(diagnosticsTokens.IEditSetGenerator),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IActionabilitySectionGenerator}`);

  // Section Generators
  registrar.singletonFactory(
    diagnosticsTokens.IBlockerSectionGenerator,
    (c) =>
      new BlockerSectionGenerator({
        formattingService: new ReportFormattingService(),
        blockerCalculator: c.resolve(diagnosticsTokens.IMinimalBlockerSetCalculator),
      })
  );
  safeDebug(`Registered ${diagnosticsTokens.IBlockerSectionGenerator}`);

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
