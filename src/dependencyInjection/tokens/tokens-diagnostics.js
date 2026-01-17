/**
 * @file DI tokens for Expression Diagnostics services
 */

import { freeze } from '../../utils/cloneUtils.js';

/**
 * Expression Diagnostics service tokens for dependency injection
 *
 * @type {Readonly<Record<string, string>>}
 */
export const diagnosticsTokens = freeze({
  // Phase 1 - Static Analysis
  IGateConstraintAnalyzer: 'IGateConstraintAnalyzer',
  IIntensityBoundsCalculator: 'IIntensityBoundsCalculator',

  // Phase 2 - Monte Carlo
  IMonteCarloSimulator: 'IMonteCarloSimulator',
  IFailureExplainer: 'IFailureExplainer',
  IEmotionCalculatorAdapter: 'IEmotionCalculatorAdapter',
  IRandomStateGenerator: 'IRandomStateGenerator',
  IMonteCarloContextBuilder: 'IMonteCarloContextBuilder',
  IMonteCarloExpressionEvaluator: 'IMonteCarloExpressionEvaluator',
  IMonteCarloGateEvaluator: 'IMonteCarloGateEvaluator',
  IMonteCarloPrototypeEvaluator: 'IMonteCarloPrototypeEvaluator',
  IMonteCarloViolationEstimator: 'IMonteCarloViolationEstimator',
  IMonteCarloVariablePathValidator: 'IMonteCarloVariablePathValidator',

  // Status Persistence
  IExpressionStatusService: 'IExpressionStatusService',

  // Path-Sensitive Analysis (EXPDIAPATSENANA series)
  IPathSensitiveAnalyzer: 'IPathSensitiveAnalyzer',

  // Prototype Constraint Analysis (Monte Carlo report enhancement)
  IPrototypeConstraintAnalyzer: 'IPrototypeConstraintAnalyzer',
  // Prototype Gate Alignment Analysis (PROREGGATALI series)
  IPrototypeGateAlignmentAnalyzer: 'IPrototypeGateAlignmentAnalyzer',

  // Prototype Fit Ranking (Monte Carlo prototype fit analysis)
  IPrototypeRegistryService: 'IPrototypeRegistryService',
  IPrototypeTypeDetector: 'IPrototypeTypeDetector',
  IContextAxisNormalizer: 'IContextAxisNormalizer',
  IPrototypeGateChecker: 'IPrototypeGateChecker',
  IPrototypeIntensityCalculator: 'IPrototypeIntensityCalculator',
  IPrototypeSimilarityMetrics: 'IPrototypeSimilarityMetrics',
  IPrototypeGapAnalyzer: 'IPrototypeGapAnalyzer',
  IPrototypeFitRankingService: 'IPrototypeFitRankingService',

  // Prototype Synthesis (PROCRESUGREC-002)
  IPrototypeSynthesisService: 'IPrototypeSynthesisService',

  // Sensitivity Analysis (EXPDIAMONCARREFREP-008)
  ISensitivityAnalyzer: 'ISensitivityAnalyzer',

  // Non-Axis Feasibility Analysis (PROFITBLOSCODIS series)
  INonAxisClauseExtractor: 'INonAxisClauseExtractor',
  INonAxisFeasibilityAnalyzer: 'INonAxisFeasibilityAnalyzer',
  IFitFeasibilityConflictDetector: 'IFitFeasibilityConflictDetector',

  // Scope Disambiguation Section Generators (PROFITBLOSCODIS series)
  INonAxisFeasibilitySectionGenerator: 'INonAxisFeasibilitySectionGenerator',
  IConflictWarningSectionGenerator: 'IConflictWarningSectionGenerator',

  // Phase 4 - SMT Solver (to be added in EXPDIA-013)
  // ISmtSolver: 'ISmtSolver',

  // Phase 5 - Suggestions (to be added in EXPDIA-015)
  // IThresholdSuggester: 'IThresholdSuggester',
});

export default diagnosticsTokens;
