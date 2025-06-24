// tests/unit/initializers/services/initializationService.llmAdapterInitRejection.test.js
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
        // Default successful init for most tests
        mockLlmAdapter.isInitialized.mockReturnValue(true);
        mockLlmAdapter.isOperational.mockReturnValue(true);
        return undefined;
      }),
      isInitialized: jest.fn().mockReturnValue(false), // Start as not initialized
      isOperational: jest.fn().mockReturnValue(false), // Start as not operational
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

    // General mockContainer setup - specific tests can override resolve if needed
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
            return { getEntityInstance: jest.fn(), getEntities: jest.fn() };
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

  describe('runInitializationSequence - LLM Adapter Init Rejection', () => {
    let service;

    beforeEach(() => {
      // For this specific test, we ensure the service is created,
      // and then the LLMAdapter specific mock behavior is set up within the test itself.
      service = new InitializationService({
        container: mockContainer,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    it('should handle LLMAdapter.init rejection gracefully by logging and continuing', async () => {
      const rejectionObject = {
        message: 'LLMAdapter init failed via plain object',
        name: 'PlainObjectErrorTest',
      };
      mockLlmAdapter.init.mockRejectedValueOnce(rejectionObject);
      mockLlmAdapter.isInitialized.mockReturnValue(false); // Ensure init path is taken

      // Dedicated mock resolve for this test to ensure full control and that subsequent operations get valid mocks
      mockContainer.resolve.mockImplementation((token) => {
        switch (token) {
          case tokens.ILogger:
            return mockLogger;
          case tokens.LLMAdapter:
            return mockLlmAdapter;
          case tokens.LlmConfigLoader:
            return { loadConfigs: jest.fn() }; // For LlmConfigLoader
          case tokens.ISafeEventDispatcher:
            return {
              subscribe: jest.fn(),
              unsubscribe: jest.fn(),
              dispatch: jest.fn(),
            }; // For LlmConfigLoader & AI Listeners
          // Mocks for services resolved *after* LLM init attempt
          case tokens.ModsLoader:
            return mockModsLoader;
          case tokens.SystemInitializer:
            return mockSystemInitializer;
          case tokens.WorldInitializer:
            return mockWorldInitializer;
          case tokens.DomUiFacade:
            return mockDomUiFacade;
          case tokens.IEntityManager:
            return { getEntityInstance: jest.fn(), getEntities: jest.fn() }; // For AI Listeners
          case tokens.IDataRegistry:
            return mockDataRegistry; // For ScopeRegistry
          case tokens.IScopeRegistry:
            return mockScopeRegistry;
          default:
            return undefined;
        }
      });

      // Ensure dataRegistry.get('scopes') returns something if scopeRegistry.initialize is reached post-LLM failure
      mockDataRegistry.get.mockImplementation((key) => {
        if (key === 'scopes')
          return {
            /* some mock scope data */
          };
        return {};
      });

      const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

      // Check for the specific LLM init error log
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `InitializationService: CRITICAL error during ConfigurableLLMAdapter.init(): ${rejectionObject.message}`
        ),
        expect.objectContaining({
          errorName: rejectionObject.name, // Based on restored detailed logging in InitializationService
          errorObj: rejectionObject,
        })
      );

      // Check that the sequence continued and other initializers were called
      expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
      expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalledWith(
        MOCK_WORLD_NAME
      );

      // The overall sequence should still be considered successful by the service itself,
      // as the LLM init error is handled internally.
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Ensure the generic "CRITICAL ERROR during initialization sequence" was NOT logged for this specific case
      const genericFailureLog = mockLogger.error.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].startsWith(
            'CRITICAL ERROR during initialization sequence for world'
          ) &&
          call[1]?.message === rejectionObject.message
      );
      expect(genericFailureLog).toBeUndefined();
    });
  });
});
