// tests/unit/initializers/services/initializationService.success.test.js
import InitializationService from '../../../../src/initializers/services/initializationService.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  test,
} from '@jest/globals';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// --- Mocks ---
let mockContainer;
let mockLogger;
let mockValidatedEventDispatcher;
let mockModsLoader;
let mockSystemInitializer;
let mockWorldInitializer;
let mockDomUiFacade;
let mockLlmAdapter;
let mockDataRegistry;
let mockScopeRegistry;

const MOCK_WORLD_NAME = 'testWorld';

describe('InitializationService', () => {
  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };
    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    mockModsLoader = {
      loadMods: jest.fn().mockResolvedValue({
        finalModOrder: [],
        totals: {},
        incompatibilities: 0,
      }),
    };
    mockSystemInitializer = {
      initializeAll: jest.fn().mockResolvedValue(undefined),
    };
    mockWorldInitializer = {
      initializeWorldEntities: jest.fn().mockReturnValue(true),
    };
    mockDomUiFacade = {
      /* Simple mock object */
    };
    mockLlmAdapter = {
      init: jest.fn().mockImplementation(async () => {
        mockLlmAdapter.isInitialized.mockReturnValue(true);
        mockLlmAdapter.isOperational.mockReturnValue(true);
        return undefined;
      }),
      isInitialized: jest.fn().mockReturnValue(false),
      isOperational: jest.fn().mockReturnValue(false),
    };
    mockDataRegistry = {
      get: jest.fn().mockReturnValue({}), // Default to empty object, specific tests can override
      getAll: jest.fn().mockReturnValue([]), // Return empty array for scopes
    };
    mockScopeRegistry = {
      initialize: jest.fn(),
      getScope: jest.fn(),
      getStats: jest.fn(() => ({ size: 0, initialized: true, scopeNames: [] })),
    };

    // General mockContainer setup for most tests, specific tests might override parts
    mockContainer = {
      resolve: jest.fn((token) => {
        switch (token) {
          case tokens.ModsLoader:
            return mockModsLoader;
          case tokens.SystemInitializer:
            return mockSystemInitializer;
          case tokens.WorldInitializer:
            return mockWorldInitializer;
          case tokens.DomUiFacade:
            return mockDomUiFacade;
          case tokens.ILogger:
            return mockLogger;
          case tokens.LLMAdapter:
            return mockLlmAdapter;
          case tokens.LlmConfigLoader:
            return {
              loadConfigs: jest.fn(),
            };
          case tokens.IEntityManager:
            return { getEntityInstance: jest.fn() };
          case tokens.IDataRegistry:
            return mockDataRegistry;
          case tokens.IScopeRegistry:
            return mockScopeRegistry;
          default:
            return undefined;
        }
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runInitializationSequence - Success', () => {
    let service;
    let resolveOrder;

    beforeEach(() => {
      resolveOrder = [];

      // Set up the comprehensive mock for container.resolve for the success path
      mockContainer.resolve.mockImplementation((token) => {
        resolveOrder.push(token);
        switch (token) {
          case tokens.ModsLoader:
            return mockModsLoader;
          case tokens.SystemInitializer:
            return mockSystemInitializer;
          case tokens.WorldInitializer:
            return mockWorldInitializer;
          case tokens.DomUiFacade:
            return mockDomUiFacade;
          case tokens.ILogger:
            return mockLogger;
          case tokens.LLMAdapter:
            return mockLlmAdapter;
          case tokens.LlmConfigLoader:
            return {
              loadConfigs: jest.fn(),
            };
          case tokens.ISafeEventDispatcher:
            return {
              subscribe: jest.fn(),
              unsubscribe: jest.fn(),
              dispatch: jest.fn(),
            };
          case tokens.IEntityManager:
            return { getEntityInstance: jest.fn() };
          case tokens.IDataRegistry:
            return mockDataRegistry;
          case tokens.IScopeRegistry:
            return mockScopeRegistry;
          default:
            return undefined;
        }
      });

      // Reset specific adapter mocks for each run test
      mockLlmAdapter.init.mockImplementation(async () => {
        mockLlmAdapter.isInitialized.mockReturnValue(true);
        mockLlmAdapter.isOperational.mockReturnValue(true);
        return undefined;
      });
      mockLlmAdapter.isInitialized.mockReturnValue(false);
      mockLlmAdapter.isOperational.mockReturnValue(false);

      // Ensure dataRegistry.getAll('scopes') returns something for scopeRegistry.initialize
      mockDataRegistry.getAll.mockImplementation((key) => {
        if (key === 'scopes') return []; // Return empty array of scopes
        return [];
      });

      service = new InitializationService({
        container: mockContainer,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    test('should run the full initialization sequence successfully', async () => {
      const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

      const filteredResolveOrder = resolveOrder.filter(
        (token) => token !== tokens.ILogger
      );

      expect(filteredResolveOrder).toEqual([
        tokens.ModsLoader,
        tokens.IScopeRegistry,
        tokens.IDataRegistry, // For ScopeRegistry
        tokens.LLMAdapter,
        tokens.LlmConfigLoader,
        tokens.SystemInitializer,
        tokens.WorldInitializer,
        tokens.ISafeEventDispatcher, // for AI Listeners
        tokens.IEntityManager, // for AI Listeners
        tokens.DomUiFacade,
      ]);

      expect(mockModsLoader.loadMods).toHaveBeenCalledWith(MOCK_WORLD_NAME);
      expect(mockLlmAdapter.init).toHaveBeenCalledTimes(1);
      expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
      expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalledWith(
        MOCK_WORLD_NAME
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const criticalErrorCalls = mockLogger.error.mock.calls.filter((call) =>
        call[0].includes('CRITICAL ERROR during initialization sequence')
      );
      expect(criticalErrorCalls.length).toBe(0);
      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        'initialization:initialization_service:failed',
        expect.anything(),
        expect.anything()
      );
    });
  });
});
