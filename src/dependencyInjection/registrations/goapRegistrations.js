/**
 * @file Dependency injection registrations for GOAP system
 */

import { goapTokens } from '../tokens/tokens-goap.js';
import { coreTokens } from '../tokens/tokens-core.js';
import EffectsAnalyzer from '../../goap/analysis/effectsAnalyzer.js';
import EffectsGenerator from '../../goap/generation/effectsGenerator.js';
import EffectsValidator from '../../goap/validation/effectsValidator.js';
import GoalManager from '../../goap/goals/goalManager.js';
import GoalStateEvaluator from '../../goap/goals/goalStateEvaluator.js';
import ActionSelector from '../../goap/selection/actionSelector.js';
import AbstractPreconditionSimulator from '../../goap/simulation/abstractPreconditionSimulator.js';

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

  container.register(goapTokens.IEffectsValidator, EffectsValidator, {
    dependencies: {
      logger: coreTokens.ILogger,
      effectsAnalyzer: goapTokens.IEffectsAnalyzer,
      dataRegistry: coreTokens.IDataRegistry
    }
  });

  // Goals
  container.register(goapTokens.IGoalStateEvaluator, GoalStateEvaluator, {
    dependencies: {
      logger: coreTokens.ILogger,
      jsonLogicEvaluator: coreTokens.JsonLogicEvaluationService,
      entityManager: coreTokens.IEntityManager
    }
  });

  container.register(goapTokens.IGoalManager, GoalManager, {
    dependencies: {
      logger: coreTokens.ILogger,
      gameDataRepository: coreTokens.IGameDataRepository,
      goalStateEvaluator: goapTokens.IGoalStateEvaluator,
      jsonLogicEvaluator: coreTokens.JsonLogicEvaluationService,
      entityManager: coreTokens.IEntityManager
    }
  });

  // Simulation
  container.register(goapTokens.IAbstractPreconditionSimulator, AbstractPreconditionSimulator, {
    dependencies: {
      logger: coreTokens.ILogger
    }
  });

  // Selection
  container.register(goapTokens.IActionSelector, ActionSelector, {
    dependencies: {
      logger: coreTokens.ILogger,
      goalStateEvaluator: goapTokens.IGoalStateEvaluator,
      entityManager: coreTokens.IEntityManager,
      abstractPreconditionSimulator: goapTokens.IAbstractPreconditionSimulator
    }
  });

  // Planning (to be implemented in later tickets)
  // container.register(goapTokens.ISimplePlanner, SimplePlanner);
  // container.register(goapTokens.IPlanCache, PlanCache);
}
