/* eslint-env jest */
/**
 * @file Unit tests for expression system DI registrations.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import ExpressionRegistry from '../../../../src/expressions/expressionRegistry.js';
import ExpressionContextBuilder from '../../../../src/expressions/expressionContextBuilder.js';
import ExpressionEvaluatorService from '../../../../src/expressions/expressionEvaluatorService.js';
import ExpressionDispatcher from '../../../../src/expressions/expressionDispatcher.js';
import ExpressionPersistenceListener from '../../../../src/expressions/expressionPersistenceListener.js';
import { expectSingleton } from '../../../common/containerAssertions.js';

describe('registerExpressionServices', () => {
  /** @type {AppContainer} */
  let container;
  let mockLogger;
  let mockDataRegistry;
  let mockEmotionCalculatorService;
  let mockEntityManager;
  let mockJsonLogicEvaluationService;
  let mockGameDataRepository;
  let mockEventBus;

  beforeEach(() => {
    container = new AppContainer();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockDataRegistry = { getAll: jest.fn().mockReturnValue([]) };
    mockEmotionCalculatorService = {
      calculateSexualArousal: jest.fn().mockReturnValue(0),
      calculateEmotions: jest.fn().mockReturnValue(new Map()),
      calculateSexualStates: jest.fn().mockReturnValue(new Map()),
    };
    mockEntityManager = {
      getComponentData: jest.fn(),
      getAllComponentTypesForEntity: jest.fn().mockReturnValue([]),
      hasComponent: jest.fn().mockReturnValue(false),
    };
    mockJsonLogicEvaluationService = { evaluate: jest.fn().mockReturnValue(false) };
    mockGameDataRepository = { getConditionDefinition: jest.fn() };
    mockEventBus = { dispatch: jest.fn() };

    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IDataRegistry, () => mockDataRegistry);
    container.register(tokens.IEmotionCalculatorService, () => mockEmotionCalculatorService);
    container.register(tokens.IEntityManager, () => mockEntityManager);
    container.register(tokens.JsonLogicEvaluationService, () => mockJsonLogicEvaluationService);
    container.register(tokens.IGameDataRepository, () => mockGameDataRepository);
    container.register(tokens.IEventBus, () => mockEventBus);
  });

  it('registers ExpressionRegistry with correct dependencies', () => {
    registerExpressionServices(container);

    expectSingleton(container, tokens.IExpressionRegistry, ExpressionRegistry);
  });

  it('registers ExpressionContextBuilder with correct dependencies', () => {
    registerExpressionServices(container);

    expectSingleton(
      container,
      tokens.IExpressionContextBuilder,
      ExpressionContextBuilder
    );
  });

  it('registers ExpressionEvaluatorService with correct dependencies', () => {
    registerExpressionServices(container);

    expectSingleton(
      container,
      tokens.IExpressionEvaluatorService,
      ExpressionEvaluatorService
    );
  });

  it('registers ExpressionDispatcher with correct dependencies', () => {
    registerExpressionServices(container);

    expectSingleton(container, tokens.IExpressionDispatcher, ExpressionDispatcher);
  });

  it('registers ExpressionPersistenceListener with correct dependencies', () => {
    registerExpressionServices(container);

    expectSingleton(
      container,
      tokens.IExpressionPersistenceListener,
      ExpressionPersistenceListener
    );
  });

  it('resolves all expression services without circular dependencies', () => {
    registerExpressionServices(container);

    expect(() => container.resolve(tokens.IExpressionRegistry)).not.toThrow();
    expect(() => container.resolve(tokens.IExpressionContextBuilder)).not.toThrow();
    expect(() => container.resolve(tokens.IExpressionEvaluatorService)).not.toThrow();
    expect(() => container.resolve(tokens.IExpressionDispatcher)).not.toThrow();
    expect(() => container.resolve(tokens.IExpressionPersistenceListener)).not.toThrow();
  });
});
