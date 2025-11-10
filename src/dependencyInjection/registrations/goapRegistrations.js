/**
 * @file Dependency injection registrations for GOAP system
 */

import { goapTokens } from '../tokens/tokens-goap.js';
import { coreTokens } from '../tokens/tokens-core.js';
import EffectsAnalyzer from '../../goap/analysis/effectsAnalyzer.js';
import EffectsGenerator from '../../goap/generation/effectsGenerator.js';

/**
 * Registers GOAP services in the DI container
 *
 * @param {object} container - DI container
 */
export function registerGoapServices(container) {
  // Analysis
  container.register(goapTokens.IEffectsAnalyzer, EffectsAnalyzer, {
    dependencies: {
      logger: coreTokens.ILogger,
      dataRegistry: coreTokens.IDataRegistry
    }
  });

  container.register(goapTokens.IEffectsGenerator, EffectsGenerator, {
    dependencies: {
      logger: coreTokens.ILogger,
      effectsAnalyzer: goapTokens.IEffectsAnalyzer,
      dataRegistry: coreTokens.IDataRegistry,
      schemaValidator: coreTokens.IAjvSchemaValidator
    }
  });

  // Effects Validator (to be implemented in later tickets)
  // container.register(goapTokens.IEffectsValidator, EffectsValidator);

  // Goals (to be implemented in later tickets)
  // container.register(goapTokens.IGoalManager, GoalManager);
  // container.register(goapTokens.IGoalStateEvaluator, GoalStateEvaluator);

  // Selection (to be implemented in later tickets)
  // container.register(goapTokens.IActionSelector, ActionSelector);

  // Planning (to be implemented in later tickets)
  // container.register(goapTokens.ISimplePlanner, SimplePlanner);
  // container.register(goapTokens.IPlanCache, PlanCache);
}
