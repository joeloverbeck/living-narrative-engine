/**
 * @file Dependency injection registrations for GOAP system
 */

import { goapTokens } from '../tokens/tokens-goap.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import EffectsAnalyzer from '../../goap/analysis/effectsAnalyzer.js';
import EffectsGenerator from '../../goap/generation/effectsGenerator.js';
import EffectsValidator from '../../goap/validation/effectsValidator.js';
import GoalManager from '../../goap/goals/goalManager.js';
import GoalStateEvaluator from '../../goap/goals/goalStateEvaluator.js';
import ActionSelector from '../../goap/selection/actionSelector.js';
import AbstractPreconditionSimulator from '../../goap/simulation/abstractPreconditionSimulator.js';
import SimplePlanner from '../../goap/planning/simplePlanner.js';
import PlanCache from '../../goap/planning/planCache.js';

/**
 * Registers GOAP services in the DI container
 *
 * @param {object} container - DI container
 */
export function registerGoapServices(container) {
  const registrar = new Registrar(container);

  // Analysis
  registrar.singletonFactory(goapTokens.IEffectsAnalyzer, (c) => {
    return new EffectsAnalyzer({
      logger: c.resolve(tokens.ILogger),
      dataRegistry: c.resolve(tokens.IDataRegistry),
    });
  });

  registrar.singletonFactory(goapTokens.IEffectsGenerator, (c) => {
    return new EffectsGenerator({
      logger: c.resolve(tokens.ILogger),
      effectsAnalyzer: c.resolve(goapTokens.IEffectsAnalyzer),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });

  registrar.singletonFactory(goapTokens.IEffectsValidator, (c) => {
    return new EffectsValidator({
      logger: c.resolve(tokens.ILogger),
      effectsAnalyzer: c.resolve(goapTokens.IEffectsAnalyzer),
      dataRegistry: c.resolve(tokens.IDataRegistry),
    });
  });

  // Goals
  registrar.singletonFactory(goapTokens.IGoalStateEvaluator, (c) => {
    return new GoalStateEvaluator({
      logger: c.resolve(tokens.ILogger),
      jsonLogicEvaluator: c.resolve(tokens.JsonLogicEvaluationService),
      entityManager: c.resolve(tokens.IEntityManager),
    });
  });

  registrar.singletonFactory(goapTokens.IGoalManager, (c) => {
    return new GoalManager({
      logger: c.resolve(tokens.ILogger),
      gameDataRepository: c.resolve(tokens.IGameDataRepository),
      goalStateEvaluator: c.resolve(goapTokens.IGoalStateEvaluator),
      jsonLogicEvaluator: c.resolve(tokens.JsonLogicEvaluationService),
      entityManager: c.resolve(tokens.IEntityManager),
    });
  });

  // Simulation
  registrar.singletonFactory(goapTokens.IAbstractPreconditionSimulator, (c) => {
    return new AbstractPreconditionSimulator({
      logger: c.resolve(tokens.ILogger),
    });
  });

  // Selection
  registrar.singletonFactory(goapTokens.IActionSelector, (c) => {
    return new ActionSelector({
      logger: c.resolve(tokens.ILogger),
      goalStateEvaluator: c.resolve(goapTokens.IGoalStateEvaluator),
      entityManager: c.resolve(tokens.IEntityManager),
      abstractPreconditionSimulator: c.resolve(
        goapTokens.IAbstractPreconditionSimulator
      ),
    });
  });

  // Planning
  registrar.singletonFactory(goapTokens.ISimplePlanner, (c) => {
    return new SimplePlanner({
      logger: c.resolve(tokens.ILogger),
      actionSelector: c.resolve(goapTokens.IActionSelector),
      goalManager: c.resolve(goapTokens.IGoalManager),
    });
  });

  registrar.singletonFactory(goapTokens.IPlanCache, (c) => {
    return new PlanCache({
      logger: c.resolve(tokens.ILogger),
    });
  });
}
