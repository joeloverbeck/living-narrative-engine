import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockBootstrap = jest.fn();
const mockDisplayFatalStartupError = jest.fn();
const mockRegisterExpressionServices = jest.fn();
const mockControllerInitialize = jest.fn();

const mockTokens = {
  IExpressionRegistry: 'IExpressionRegistry',
  IEmotionCalculatorService: 'IEmotionCalculatorService',
  IExpressionContextBuilder: 'IExpressionContextBuilder',
  IExpressionEvaluatorService: 'IExpressionEvaluatorService',
  IExpressionDispatcher: 'IExpressionDispatcher',
  IEventBus: 'IEventBus',
  IPerceptionEntryBuilder: 'IPerceptionEntryBuilder',
};

jest.mock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
  __esModule: true,
  CommonBootstrapper: jest.fn().mockImplementation(() => ({
    bootstrap: mockBootstrap,
    displayFatalStartupError: mockDisplayFatalStartupError,
  })),
}));

jest.mock(
  '../../src/dependencyInjection/registrations/expressionsRegistrations.js',
  () => ({
    __esModule: true,
    registerExpressionServices: mockRegisterExpressionServices,
  })
);

jest.mock(
  '../../src/domUI/expressions-simulator/ExpressionsSimulatorController.js',
  () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      initialize: mockControllerInitialize,
    })),
  })
);

jest.mock('../../src/utils/environmentUtils.js', () => ({
  shouldAutoInitializeDom: jest.fn(() => false),
}));

jest.mock('../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: mockTokens,
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockBootstrap.mockImplementation(() => {
    throw new Error('bootstrap mock not configured for this test');
  });
});

describe('expressions-simulator initialize', () => {
  it('bootstraps expression services and initializes the controller', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const dataRegistry = { id: 'registry' };
    const entityManager = { id: 'entityManager' };

    const resolvedServices = {
      [mockTokens.IExpressionRegistry]: { id: 'expressionRegistry' },
      [mockTokens.IEmotionCalculatorService]: { id: 'emotionCalculator' },
      [mockTokens.IExpressionContextBuilder]: { id: 'contextBuilder' },
      [mockTokens.IExpressionEvaluatorService]: { id: 'evaluator' },
      [mockTokens.IExpressionDispatcher]: { id: 'dispatcher' },
      [mockTokens.IEventBus]: { id: 'eventBus' },
      [mockTokens.IPerceptionEntryBuilder]: { id: 'perceptionEntryBuilder' },
    };

    const container = {
      isRegistered: jest.fn(() => false),
      resolve: jest.fn((token) => resolvedServices[token]),
    };

    mockBootstrap.mockImplementation(async ({ postInitHook, ...options }) => {
      expect(options).toEqual(
        expect.objectContaining({
          containerConfigType: 'minimal',
          worldName: 'default',
        })
      );

      await postInitHook({ logger, registry: dataRegistry, entityManager }, container);
      return { container, services: { logger } };
    });

    const { initialize } = await import('../../src/expressions-simulator.js');
    await initialize();

    const { default: MockController } = await import(
      '../../src/domUI/expressions-simulator/ExpressionsSimulatorController.js'
    );

    expect(container.isRegistered).toHaveBeenCalledWith(
      mockTokens.IExpressionRegistry
    );
    expect(mockRegisterExpressionServices).toHaveBeenCalledWith(container);
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IEmotionCalculatorService
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IExpressionRegistry
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IExpressionContextBuilder
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IExpressionEvaluatorService
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IExpressionDispatcher
    );
    expect(container.resolve).toHaveBeenCalledWith(mockTokens.IEventBus);
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.IPerceptionEntryBuilder
    );

    expect(MockController).toHaveBeenCalledWith({
      logger,
      dataRegistry,
      entityManager,
      emotionCalculatorService: resolvedServices[mockTokens.IEmotionCalculatorService],
      expressionRegistry: resolvedServices[mockTokens.IExpressionRegistry],
      expressionContextBuilder: resolvedServices[mockTokens.IExpressionContextBuilder],
      expressionEvaluatorService: resolvedServices[mockTokens.IExpressionEvaluatorService],
      expressionDispatcher: resolvedServices[mockTokens.IExpressionDispatcher],
      eventBus: resolvedServices[mockTokens.IEventBus],
      perceptionEntryBuilder: resolvedServices[mockTokens.IPerceptionEntryBuilder],
    });
    expect(mockControllerInitialize).toHaveBeenCalled();
  });

  it('reports a fatal error when bootstrap fails', async () => {
    const fatalError = new Error('Initialization failed');
    mockBootstrap.mockImplementation(() => {
      throw fatalError;
    });

    const { initialize } = await import('../../src/expressions-simulator.js');

    await expect(initialize()).resolves.toBeUndefined();
    expect(mockDisplayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize expressions simulator: Initialization failed',
      fatalError
    );
  });
});
