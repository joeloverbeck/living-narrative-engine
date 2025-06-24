// tests/unit/initializers/services/initializationService.failureScenarios.test.js
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
      get: jest.fn().mockReturnValue({}),
      getAll: jest.fn().mockReturnValue([]), // Return empty array for scopes
    };
    mockScopeRegistry = {
      initialize: jest.fn(),
      getScope: jest.fn(),
      getStats: jest.fn(() => ({ size: 0, initialized: true, scopeNames: [] })),
    };

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
            return { loadConfigs: jest.fn() };
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
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runInitializationSequence - Failure Scenarios', () => {
    let service;
    // resolveOrder is not typically asserted in failure tests but setup for consistency
    let resolveOrder;

    beforeEach(() => {
      resolveOrder = [];
      // Set up a comprehensive default mock for container.resolve
      // Individual tests in it.each will override this mockImplementation for specific failure setups.
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
            return { loadConfigs: jest.fn() };
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

      // Ensure dataRegistry.get('scopes') returns something for scopeRegistry.initialize if it's reached
      mockDataRegistry.get.mockImplementation((key) => {
        if (key === 'scopes')
          return {
            /* some mock scope data */
          };
        return {};
      });

      service = new InitializationService({
        container: mockContainer,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    // Helper for testing failure scenarios
    const testFailure = async (
      setupFailure,
      expectedError,
      options = { shouldCallAdapterInit: true }
    ) => {
      setupFailure(); // This function should set up the mock to cause the specific failure
      const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `CRITICAL ERROR during initialization sequence for world '${MOCK_WORLD_NAME}'`
        ),
        expect.objectContaining({
          errorMessage: expectedError.message,
          errorName: expectedError.name,
          errorStack: expect.any(String),
        })
      );
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(expectedError.message);

      if (options.shouldCallAdapterInit) {
        expect(mockLlmAdapter.init).toHaveBeenCalledTimes(1);
      } else {
        expect(mockLlmAdapter.init).not.toHaveBeenCalled();
      }

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'initialization:initialization_service:failed',
        expect.objectContaining({
          worldName: MOCK_WORLD_NAME,
          error: expectedError.message,
        }),
        { allowSchemaNotFound: true }
      );
      const failedEventCall =
        mockValidatedEventDispatcher.dispatch.mock.calls.find(
          (call) => call[0] === 'initialization:initialization_service:failed'
        );
      expect(failedEventCall).toBeDefined();
      if (failedEventCall) {
        expect(failedEventCall[1].error).toBe(expectedError.message);
      }
    };

    // --- Individual Tests for Failure Scenarios ---
    it('should handle failure when ModsLoader resolve fails', async () => {
      const setupFailure = () => {
        const error = new Error('Failed to resolve ModsLoader');
        mockContainer.resolve.mockImplementation((token) => {
          if (token === tokens.ModsLoader) throw error;
          if (token === tokens.ILogger) return mockLogger; // Logger might be resolved by constructor or early error paths
          return undefined;
        });
        return error;
      };
      const expectedError = new Error('Failed to resolve ModsLoader');
      const options = { shouldCallAdapterInit: false };

      await testFailure(setupFailure, expectedError, options);
    });

    it('should handle failure when ModsLoader.loadMods rejects', async () => {
      const setupFailure = () => {
        const error = new Error('loadMods failed');
        mockModsLoader.loadMods.mockRejectedValue(error);
        return error;
      };
      const expectedError = new Error('loadMods failed');
      const options = { shouldCallAdapterInit: false };

      await testFailure(setupFailure, expectedError, options);
    });

    it('should handle failure when ScopeRegistry.initialize throws', async () => {
      const setupFailure = () => {
        const error = new Error('ScopeRegistry init failed');
        mockScopeRegistry.initialize.mockImplementation(() => {
          throw error;
        });
        // For this test, ensure only necessary preceding mocks are in place for container.resolve
        mockContainer.resolve.mockImplementation((token) => {
          // resolveOrder.push(token); // Not strictly needed to track for this failure test
          switch (token) {
            case tokens.ModsLoader:
              return mockModsLoader;
            case tokens.IScopeRegistry:
              return mockScopeRegistry;
            case tokens.IDataRegistry:
              return mockDataRegistry;
            case tokens.ILogger:
              return mockLogger;
            default:
              return undefined;
          }
        });
        return error;
      };
      const expectedError = new Error('ScopeRegistry init failed');
      const options = { shouldCallAdapterInit: false }; // LLM init is after ScopeRegistry

      await testFailure(setupFailure, expectedError, options);
    });

    it('should handle failure when SystemInitializer resolve fails', async () => {
      const setupFailure = () => {
        const error = new Error('Failed to resolve SystemInitializer');
        mockContainer.resolve.mockImplementation((token) => {
          switch (token) {
            case tokens.ModsLoader:
              return mockModsLoader;
            case tokens.IScopeRegistry:
              return mockScopeRegistry;
            case tokens.IDataRegistry:
              return mockDataRegistry;
            case tokens.LLMAdapter:
              return mockLlmAdapter;
            case tokens.LlmConfigLoader:
              return { loadConfigs: jest.fn() };
            case tokens.ISafeEventDispatcher:
              return {
                subscribe: jest.fn(),
                unsubscribe: jest.fn(),
                dispatch: jest.fn(),
              };
            case tokens.SystemInitializer:
              throw error;
            case tokens.WorldInitializer:
              return mockWorldInitializer;
            case tokens.DomUiFacade:
              return mockDomUiFacade;
            case tokens.ILogger:
              return mockLogger;
            case tokens.IEntityManager:
              return { getEntityInstance: jest.fn() };
            default:
              return undefined;
          }
        });
        return error;
      };
      const expectedError = new Error('Failed to resolve SystemInitializer');
      // shouldCallAdapterInit is true by default because LLM init precedes SystemInitializer resolve
      const options = { shouldCallAdapterInit: true };

      await testFailure(setupFailure, expectedError, options);
    });

    it('should handle failure when SystemInitializer.initializeAll rejects', async () => {
      const setupFailure = () => {
        const error = new Error('initializeAll failed');
        mockSystemInitializer.initializeAll.mockRejectedValue(error);
        return error;
      };
      const expectedError = new Error('initializeAll failed');
      const options = { shouldCallAdapterInit: true };

      await testFailure(setupFailure, expectedError, options);
    });

    it('should handle failure when WorldInitializer resolve fails', async () => {
      const setupFailure = () => {
        const error = new Error('Failed to resolve WorldInitializer');
        mockContainer.resolve.mockImplementation((token) => {
          switch (token) {
            case tokens.ModsLoader:
              return mockModsLoader;
            case tokens.IScopeRegistry:
              return mockScopeRegistry;
            case tokens.IDataRegistry:
              return mockDataRegistry;
            case tokens.LLMAdapter:
              return mockLlmAdapter;
            case tokens.LlmConfigLoader:
              return { loadConfigs: jest.fn() };
            case tokens.ISafeEventDispatcher:
              return {
                subscribe: jest.fn(),
                unsubscribe: jest.fn(),
                dispatch: jest.fn(),
              };
            case tokens.SystemInitializer:
              return mockSystemInitializer;
            case tokens.WorldInitializer:
              throw error;
            case tokens.DomUiFacade:
              return mockDomUiFacade;
            case tokens.ILogger:
              return mockLogger;
            case tokens.IEntityManager:
              return { getEntityInstance: jest.fn() };
            default:
              return undefined;
          }
        });
        return error;
      };
      const expectedError = new Error('Failed to resolve WorldInitializer');
      const options = { shouldCallAdapterInit: true };

      await testFailure(setupFailure, expectedError, options);
    });

    it('should handle failure when WorldInitializer.initializeWorldEntities returns false', async () => {
      const setupFailure = () => {
        const error = new Error(
          'World initialization failed via WorldInitializer.'
        );
        mockWorldInitializer.initializeWorldEntities.mockReturnValue(false);
        return error;
      };
      const expectedError = new Error(
        'World initialization failed via WorldInitializer.'
      );
      const options = { shouldCallAdapterInit: true };

      await testFailure(setupFailure, expectedError, options);
    });

    it('should handle failure when DomUiFacade resolve fails', async () => {
      const setupFailure = () => {
        const error = new Error('Failed to resolve DomUiFacade');
        mockContainer.resolve.mockImplementation((token) => {
          switch (token) {
            case tokens.ModsLoader:
              return mockModsLoader;
            case tokens.IScopeRegistry:
              return mockScopeRegistry;
            case tokens.IDataRegistry:
              return mockDataRegistry;
            case tokens.LLMAdapter:
              return mockLlmAdapter;
            case tokens.LlmConfigLoader:
              return { loadConfigs: jest.fn() };
            case tokens.ISafeEventDispatcher:
              return {
                subscribe: jest.fn(),
                unsubscribe: jest.fn(),
                dispatch: jest.fn(),
              };
            case tokens.SystemInitializer:
              return mockSystemInitializer;
            case tokens.WorldInitializer:
              return mockWorldInitializer;
            case tokens.DomUiFacade:
              throw error;
            case tokens.ILogger:
              return mockLogger;
            case tokens.IEntityManager:
              return { getEntityInstance: jest.fn() };
            default:
              return undefined;
          }
        });
        return error;
      };
      const expectedError = new Error('Failed to resolve DomUiFacade');
      const options = { shouldCallAdapterInit: true };

      await testFailure(setupFailure, expectedError, options);
    });
  });
});
