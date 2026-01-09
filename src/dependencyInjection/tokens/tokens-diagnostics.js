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

  // Status Persistence
  IExpressionStatusService: 'IExpressionStatusService',

  // Phase 3 - Witness Finding
  IWitnessStateFinder: 'IWitnessStateFinder',

  // Phase 4 - SMT Solver (to be added in EXPDIA-013)
  // ISmtSolver: 'ISmtSolver',

  // Phase 5 - Suggestions (to be added in EXPDIA-015)
  // IThresholdSuggester: 'IThresholdSuggester',
});

export default diagnosticsTokens;
