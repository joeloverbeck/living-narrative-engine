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
  IAxisSignConflictExplainer: 'IAxisSignConflictExplainer',
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

  // Emotion Similarity (Overconstrained conjunction detection)
  IEmotionSimilarityService: 'IEmotionSimilarityService',

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

  // Section Generators
  IBlockerSectionGenerator: 'IBlockerSectionGenerator',

  // Actionability Services (MONCARACTIMP series)
  IMinimalBlockerSetCalculator: 'IMinimalBlockerSetCalculator',
  IConstructiveWitnessSearcher: 'IConstructiveWitnessSearcher',
  IOrBlockAnalyzer: 'IOrBlockAnalyzer',
  IEditSetGenerator: 'IEditSetGenerator',
  IImportanceSamplingValidator: 'IImportanceSamplingValidator',
  IActionabilitySectionGenerator: 'IActionabilitySectionGenerator',

  // Recommendation Builders (RECENGREFANA series)
  IPrototypeCreateSuggestionBuilder: 'IPrototypeCreateSuggestionBuilder',
  IGateClampRecommendationBuilder: 'IGateClampRecommendationBuilder',
  IAxisConflictAnalyzer: 'IAxisConflictAnalyzer',
  IOverconstrainedConjunctionBuilder: 'IOverconstrainedConjunctionBuilder',
  ISoleBlockerRecommendationBuilder: 'ISoleBlockerRecommendationBuilder',

  // Prototype Overlap Analysis (PROOVEANA series)
  ICandidatePairFilter: 'ICandidatePairFilter',
  IBehavioralOverlapEvaluator: 'IBehavioralOverlapEvaluator',
  IOverlapClassifier: 'IOverlapClassifier',
  IOverlapRecommendationBuilder: 'IOverlapRecommendationBuilder',
  IPrototypeOverlapAnalyzer: 'IPrototypeOverlapAnalyzer',
  IPrototypeAnalysisController: 'IPrototypeAnalysisController',
});

export default diagnosticsTokens;
