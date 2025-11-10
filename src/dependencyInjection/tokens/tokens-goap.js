import { freeze } from '../../utils/cloneUtils.js';

/**
 * @file Dependency injection tokens for GOAP system
 * @typedef {string} DiToken
 */

/**
 * Tokens used by the GOAP planning system.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const goapTokens = freeze({
  // Analysis
  IEffectsAnalyzer: 'IEffectsAnalyzer',
  IEffectsGenerator: 'IEffectsGenerator',
  IEffectsValidator: 'IEffectsValidator',

  // Goals
  IGoalManager: 'IGoalManager',
  IGoalStateEvaluator: 'IGoalStateEvaluator',

  // Selection
  IActionSelector: 'IActionSelector',

  // Planning
  ISimplePlanner: 'ISimplePlanner',
  IPlanCache: 'IPlanCache',
});
