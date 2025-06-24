import InitializationService from '../../../../src/initializers/services/initializationService.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
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
let mockSchemaValidator;
let mockConfiguration;
let mockDataRegistry;
let mockScopeRegistry;

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
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
      addSchema: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      getValidator: jest.fn(),
    };
    mockConfiguration = {
      getContentTypeSchemaId: jest.fn((registryKey) => {
        if (registryKey === 'llm-configs') {
          return 'http://example.com/schemas/llm-configs.schema.json';
        }
        return `http://example.com/schemas/${registryKey}.schema.json`;
      }),
    };
    mockDataRegistry = {
      get: jest.fn().mockReturnValue({}),
    };
    mockScopeRegistry = {
      initialize: jest.fn(),
      getScope: jest.fn(),
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
          case tokens.ISchemaValidator:
            return mockSchemaValidator;
          case tokens.IConfiguration:
            return mockConfiguration;
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

  describe('runInitializationSequence', () => {
    let service;
    // resolveOrder is not strictly needed for this specific test file, but kept for consistency with original structure
    let resolveOrder;

    beforeEach(() => {
      resolveOrder = [];
      // This specific mockContainer.resolve is simplified as this test group doesn't hit the full sequence.
      // The outer beforeEach's mockContainer.resolve is sufficient for what might be called (e.g. ILogger).
      // However, to ensure `service` is created correctly and consistently:
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
          case tokens.ISchemaValidator:
            return mockSchemaValidator;
          case tokens.IConfiguration:
            return mockConfiguration;
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
            // For this test, if a token not listed above is resolved before the error,
            // it likely means the test logic or service logic has changed.
            // console.warn(`InvalidWorldName Test: Unhandled token ${String(token)}`);
            return undefined;
        }
      });

      // Ensure LLM adapter mocks are consistent if service constructor relies on them
      mockLlmAdapter.init.mockImplementation(async () => {
        mockLlmAdapter.isInitialized.mockReturnValue(true);
        mockLlmAdapter.isOperational.mockReturnValue(true);
        return undefined;
      });
      mockLlmAdapter.isInitialized.mockReturnValue(false);
      mockLlmAdapter.isOperational.mockReturnValue(false);

      service = new InitializationService({
        container: mockContainer,
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    test.each([[null], [undefined], ['']])(
      'should return failure and log error for invalid worldName: %p',
      async (invalidWorldName) => {
        const result =
          await service.runInitializationSequence(invalidWorldName);
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(TypeError);
        expect(result.error.message).toBe(
          'InitializationService requires a valid non-empty worldName.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'InitializationService requires a valid non-empty worldName.'
        );

        const resolveCallArgs = mockContainer.resolve.mock.calls;
        const relevantResolveCalls = resolveCallArgs
          .map((call) => call[0])
          // Filter out ILogger as it's called by the service constructor and then potentially again for the error.
          // We are interested if any *other* service resolution was attempted before the worldName check.
          .filter((token) => token !== tokens.ILogger);
        expect(relevantResolveCalls.length).toBe(0); // Should be 0 if error is caught early
        expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
      }
    );
  });
});
