import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { registerGoapServices } from '../../../../src/dependencyInjection/registrations/goapRegistrations.js';
import { goapTokens } from '../../../../src/dependencyInjection/tokens/tokens-goap.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import EffectsAnalyzer from '../../../../src/goap/analysis/effectsAnalyzer.js';
import EffectsGenerator from '../../../../src/goap/generation/effectsGenerator.js';
import EffectsValidator from '../../../../src/goap/validation/effectsValidator.js';
import GoalManager from '../../../../src/goap/goals/goalManager.js';
import GoalStateEvaluator from '../../../../src/goap/goals/goalStateEvaluator.js';
import ActionSelector from '../../../../src/goap/selection/actionSelector.js';
import AbstractPreconditionSimulator from '../../../../src/goap/simulation/abstractPreconditionSimulator.js';
import SimplePlanner from '../../../../src/goap/planning/simplePlanner.js';
import PlanCache from '../../../../src/goap/planning/planCache.js';

jest.mock('../../../../src/goap/analysis/effectsAnalyzer.js', () => {
  const mock = jest.fn(function MockEffectsAnalyzer(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/goap/generation/effectsGenerator.js', () => {
  const mock = jest.fn(function MockEffectsGenerator(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/goap/validation/effectsValidator.js', () => {
  const mock = jest.fn(function MockEffectsValidator(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/goap/goals/goalManager.js', () => {
  const mock = jest.fn(function MockGoalManager(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/goap/goals/goalStateEvaluator.js', () => {
  const mock = jest.fn(function MockGoalStateEvaluator(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/goap/selection/actionSelector.js', () => {
  const mock = jest.fn(function MockActionSelector(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/goap/simulation/abstractPreconditionSimulator.js', () => {
  const mock = jest.fn(function MockAbstractPreconditionSimulator(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/goap/planning/simplePlanner.js', () => {
  const mock = jest.fn(function MockSimplePlanner(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

jest.mock('../../../../src/goap/planning/planCache.js', () => {
  const mock = jest.fn(function MockPlanCache(config) {
    this.config = config;
  });

  return { __esModule: true, default: mock };
});

describe('registerGoapServices', () => {
  const expectedOrder = [
    goapTokens.IEffectsAnalyzer,
    goapTokens.IEffectsGenerator,
    goapTokens.IEffectsValidator,
    goapTokens.IGoalStateEvaluator,
    goapTokens.IGoalManager,
    goapTokens.IAbstractPreconditionSimulator,
    goapTokens.IActionSelector,
    goapTokens.ISimplePlanner,
    goapTokens.IPlanCache,
  ];

  /**
   * Builds a resolver mock that returns predefined dependencies.
   *
   * @param {Map<string, any>} dependencyMap
   * @returns {jest.Mock}
   */
  function buildResolver(dependencyMap) {
    return jest.fn((token) => {
      if (!dependencyMap.has(token)) {
        throw new Error(`Unexpected token resolution request: ${String(token)}`);
      }
      return dependencyMap.get(token);
    });
  }

  let container;

  beforeEach(() => {
    jest.clearAllMocks();
    container = {
      register: jest.fn(),
    };
  });

  function getRegistrations() {
    registerGoapServices(container);
    return new Map(
      container.register.mock.calls.map(([token, factory, options]) => [
        token,
        { factory, options },
      ]),
    );
  }

  test('registers every GOAP service as a singleton factory', () => {
    const registrations = getRegistrations();

    expect(container.register).toHaveBeenCalledTimes(expectedOrder.length);
    expect([...registrations.keys()]).toEqual(expectedOrder);

    for (const { options } of registrations.values()) {
      expect(options).toEqual({ lifecycle: 'singletonFactory' });
    }
  });

  test('factories resolve their dependencies and construct services', () => {
    const registrations = getRegistrations();

    const logger = { id: 'logger' };
    const dataRegistry = { id: 'dataRegistry' };
    const schemaValidator = { id: 'schemaValidator' };
    const jsonLogicEvaluator = { id: 'jsonLogicEvaluator' };
    const entityManager = { id: 'entityManager' };
    const gameDataRepository = { id: 'gameDataRepository' };
    const effectsAnalyzerInstance = { id: 'effectsAnalyzerInstance' };
    const goalStateEvaluatorInstance = { id: 'goalStateEvaluatorInstance' };
    const abstractPreconditionSimulatorInstance = {
      id: 'abstractPreconditionSimulatorInstance',
    };
    const actionSelectorInstance = { id: 'actionSelectorInstance' };
    const goalManagerInstance = { id: 'goalManagerInstance' };

    const analyzerFactory = registrations.get(goapTokens.IEffectsAnalyzer).factory;
    const analyzerResolve = buildResolver(
      new Map([
        [tokens.ILogger, logger],
        [tokens.IDataRegistry, dataRegistry],
      ]),
    );
    const analyzer = analyzerFactory({ resolve: analyzerResolve });
    expect(analyzerResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(analyzerResolve).toHaveBeenCalledWith(tokens.IDataRegistry);
    expect(EffectsAnalyzer).toHaveBeenCalledWith({
      logger,
      dataRegistry,
    });
    expect(analyzer.config).toEqual({ logger, dataRegistry });

    const generatorFactory = registrations.get(goapTokens.IEffectsGenerator).factory;
    const generatorResolve = buildResolver(
      new Map([
        [tokens.ILogger, logger],
        [goapTokens.IEffectsAnalyzer, effectsAnalyzerInstance],
        [tokens.IDataRegistry, dataRegistry],
        [tokens.ISchemaValidator, schemaValidator],
      ]),
    );
    const generator = generatorFactory({ resolve: generatorResolve });
    expect(generatorResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(generatorResolve).toHaveBeenCalledWith(goapTokens.IEffectsAnalyzer);
    expect(generatorResolve).toHaveBeenCalledWith(tokens.IDataRegistry);
    expect(generatorResolve).toHaveBeenCalledWith(tokens.ISchemaValidator);
    expect(EffectsGenerator).toHaveBeenCalledWith({
      logger,
      effectsAnalyzer: effectsAnalyzerInstance,
      dataRegistry,
      schemaValidator,
    });
    expect(generator.config).toEqual({
      logger,
      effectsAnalyzer: effectsAnalyzerInstance,
      dataRegistry,
      schemaValidator,
    });

    const validatorFactory = registrations.get(goapTokens.IEffectsValidator).factory;
    const validatorResolve = buildResolver(
      new Map([
        [tokens.ILogger, logger],
        [goapTokens.IEffectsAnalyzer, effectsAnalyzerInstance],
        [tokens.IDataRegistry, dataRegistry],
      ]),
    );
    const validator = validatorFactory({ resolve: validatorResolve });
    expect(validatorResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(validatorResolve).toHaveBeenCalledWith(goapTokens.IEffectsAnalyzer);
    expect(validatorResolve).toHaveBeenCalledWith(tokens.IDataRegistry);
    expect(EffectsValidator).toHaveBeenCalledWith({
      logger,
      effectsAnalyzer: effectsAnalyzerInstance,
      dataRegistry,
    });
    expect(validator.config).toEqual({
      logger,
      effectsAnalyzer: effectsAnalyzerInstance,
      dataRegistry,
    });

    const goalStateEvaluatorFactory = registrations.get(
      goapTokens.IGoalStateEvaluator,
    ).factory;
    const goalStateEvaluatorResolve = buildResolver(
      new Map([
        [tokens.ILogger, logger],
        [tokens.JsonLogicEvaluationService, jsonLogicEvaluator],
        [tokens.IEntityManager, entityManager],
      ]),
    );
    const goalStateEvaluator = goalStateEvaluatorFactory({
      resolve: goalStateEvaluatorResolve,
    });
    expect(goalStateEvaluatorResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(goalStateEvaluatorResolve).toHaveBeenCalledWith(
      tokens.JsonLogicEvaluationService,
    );
    expect(goalStateEvaluatorResolve).toHaveBeenCalledWith(tokens.IEntityManager);
    expect(GoalStateEvaluator).toHaveBeenCalledWith({
      logger,
      jsonLogicEvaluator,
      entityManager,
    });
    expect(goalStateEvaluator.config).toEqual({
      logger,
      jsonLogicEvaluator,
      entityManager,
    });

    const goalManagerFactory = registrations.get(goapTokens.IGoalManager).factory;
    const goalManagerResolve = buildResolver(
      new Map([
        [tokens.ILogger, logger],
        [tokens.IGameDataRepository, gameDataRepository],
        [goapTokens.IGoalStateEvaluator, goalStateEvaluatorInstance],
        [tokens.JsonLogicEvaluationService, jsonLogicEvaluator],
        [tokens.IEntityManager, entityManager],
      ]),
    );
    const goalManager = goalManagerFactory({ resolve: goalManagerResolve });
    expect(goalManagerResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(goalManagerResolve).toHaveBeenCalledWith(tokens.IGameDataRepository);
    expect(goalManagerResolve).toHaveBeenCalledWith(goapTokens.IGoalStateEvaluator);
    expect(goalManagerResolve).toHaveBeenCalledWith(tokens.JsonLogicEvaluationService);
    expect(goalManagerResolve).toHaveBeenCalledWith(tokens.IEntityManager);
    expect(GoalManager).toHaveBeenCalledWith({
      logger,
      gameDataRepository,
      goalStateEvaluator: goalStateEvaluatorInstance,
      jsonLogicEvaluator,
      entityManager,
    });
    expect(goalManager.config).toEqual({
      logger,
      gameDataRepository,
      goalStateEvaluator: goalStateEvaluatorInstance,
      jsonLogicEvaluator,
      entityManager,
    });

    const preconditionSimulatorFactory = registrations.get(
      goapTokens.IAbstractPreconditionSimulator,
    ).factory;
    const preconditionSimulatorResolve = buildResolver(
      new Map([[tokens.ILogger, logger]]),
    );
    const preconditionSimulator = preconditionSimulatorFactory({
      resolve: preconditionSimulatorResolve,
    });
    expect(preconditionSimulatorResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(AbstractPreconditionSimulator).toHaveBeenCalledWith({ logger });
    expect(preconditionSimulator.config).toEqual({ logger });

    const actionSelectorFactory = registrations.get(goapTokens.IActionSelector).factory;
    const actionSelectorResolve = buildResolver(
      new Map([
        [tokens.ILogger, logger],
        [goapTokens.IGoalStateEvaluator, goalStateEvaluatorInstance],
        [tokens.IEntityManager, entityManager],
        [goapTokens.IAbstractPreconditionSimulator, abstractPreconditionSimulatorInstance],
      ]),
    );
    const actionSelector = actionSelectorFactory({ resolve: actionSelectorResolve });
    expect(actionSelectorResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(actionSelectorResolve).toHaveBeenCalledWith(goapTokens.IGoalStateEvaluator);
    expect(actionSelectorResolve).toHaveBeenCalledWith(tokens.IEntityManager);
    expect(actionSelectorResolve).toHaveBeenCalledWith(
      goapTokens.IAbstractPreconditionSimulator,
    );
    expect(ActionSelector).toHaveBeenCalledWith({
      logger,
      goalStateEvaluator: goalStateEvaluatorInstance,
      entityManager,
      abstractPreconditionSimulator: abstractPreconditionSimulatorInstance,
    });
    expect(actionSelector.config).toEqual({
      logger,
      goalStateEvaluator: goalStateEvaluatorInstance,
      entityManager,
      abstractPreconditionSimulator: abstractPreconditionSimulatorInstance,
    });

    const simplePlannerFactory = registrations.get(goapTokens.ISimplePlanner).factory;
    const simplePlannerResolve = buildResolver(
      new Map([
        [tokens.ILogger, logger],
        [goapTokens.IActionSelector, actionSelectorInstance],
        [goapTokens.IGoalManager, goalManagerInstance],
      ]),
    );
    const simplePlanner = simplePlannerFactory({ resolve: simplePlannerResolve });
    expect(simplePlannerResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(simplePlannerResolve).toHaveBeenCalledWith(goapTokens.IActionSelector);
    expect(simplePlannerResolve).toHaveBeenCalledWith(goapTokens.IGoalManager);
    expect(SimplePlanner).toHaveBeenCalledWith({
      logger,
      actionSelector: actionSelectorInstance,
      goalManager: goalManagerInstance,
    });
    expect(simplePlanner.config).toEqual({
      logger,
      actionSelector: actionSelectorInstance,
      goalManager: goalManagerInstance,
    });

    const planCacheFactory = registrations.get(goapTokens.IPlanCache).factory;
    const planCacheResolve = buildResolver(new Map([[tokens.ILogger, logger]]));
    const planCache = planCacheFactory({ resolve: planCacheResolve });
    expect(planCacheResolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(PlanCache).toHaveBeenCalledWith({ logger });
    expect(planCache.config).toEqual({ logger });
  });
});
