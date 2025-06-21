// tests/initializers/services/initializationService.runInitializationSequence.test.js
// ****** CORRECTED FILE ******

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
let mockSchemaValidator;
let mockConfiguration;

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

    mockContainer = {
      resolve: jest.fn((token) => {
        // jest.fn().mock.calls will store calls automatically.
        // No need for custom 'recordedCalls' property.
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

    beforeEach(() => {
      // mockContainer.resolve is a jest.fn(), it's reset by jest.clearAllMocks() in afterEach.
      // Reset specific adapter mocks for each run test
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

    test.each([[null], [undefined], [''], ['   ']])(
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

        // Use mock.calls from the Jest mock function
        const resolveCallArgs = mockContainer.resolve.mock.calls;
        // Filter out ILogger calls that might happen in the constructor if the passed logger is invalid
        // (though in this test, a valid mockLogger is passed to constructor).
        const relevantResolveCalls = resolveCallArgs
          .map((call) => call[0])
          .filter((token) => token !== tokens.ILogger);
        expect(relevantResolveCalls.length).toBe(0); // No other services should be resolved.
        expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
      }
    );

    it('should run the full initialization sequence successfully', async () => {
      const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

      const resolveCallArgs = mockContainer.resolve.mock.calls;
      const resolveOrder = resolveCallArgs.map((call) => call[0]);
      const serviceResolveOrder = resolveOrder.filter(
        (token) => token !== tokens.ILogger
      );

      expect(serviceResolveOrder).toEqual([
        tokens.ModsLoader,
        tokens.LLMAdapter,
        tokens.ISchemaValidator, // Resolved by LlmConfigLoader via container
        tokens.IConfiguration, // Resolved by LlmConfigLoader via container
        tokens.ISafeEventDispatcher,
        tokens.SystemInitializer,
        tokens.WorldInitializer,
        tokens.ISafeEventDispatcher,
        tokens.IEntityManager,
        tokens.DomUiFacade,
      ]);

      expect(mockModsLoader.loadMods).toHaveBeenCalledWith(MOCK_WORLD_NAME);
      expect(mockLlmAdapter.init).toHaveBeenCalledTimes(1);
      expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
      expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();

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

    const testFailure = async (
      setupFailure,
      expectedError,
      options = { shouldCallAdapterInit: true }
    ) => {
      setupFailure();
      const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `CRITICAL ERROR during initialization sequence for world '${MOCK_WORLD_NAME}'`
        ),
        expectedError
      );
      // ... (rest of the testFailure helper remains largely the same) ...
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
      const failedEventResult = failedEventCall
        ? mockValidatedEventDispatcher.dispatch.mock.results[
            mockValidatedEventDispatcher.dispatch.mock.calls.indexOf(
              failedEventCall
            )
          ]
        : undefined;
      if (failedEventResult?.type !== 'throw') {
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "Dispatched 'initialization:initialization_service:failed' event"
          ),
          expect.objectContaining({ error: expectedError.message })
        );
      }

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'ui:show_fatal_error',
        expect.objectContaining({
          title: 'Fatal Initialization Error',
          message: expect.stringContaining(expectedError.message),
        })
      );
      const fatalErrorCall =
        mockValidatedEventDispatcher.dispatch.mock.calls.find(
          (call) => call[0] === 'ui:show_fatal_error'
        );
      const fatalErrorResult = fatalErrorCall
        ? mockValidatedEventDispatcher.dispatch.mock.results[
            mockValidatedEventDispatcher.dispatch.mock.calls.indexOf(
              fatalErrorCall
            )
          ]
        : undefined;

      if (fatalErrorResult?.type !== 'throw') {
        expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
          'core:disable_input',
          {
            message: 'Fatal error during initialization. Cannot continue.',
          }
        );
      }

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe(expectedError.message);

      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        'initialization:initialization_service:completed',
        expect.anything(),
        expect.anything()
      );

      if (options.shouldCallAdapterInit === false) {
        expect(mockLlmAdapter.init).not.toHaveBeenCalled();
      }
    };

    it('should handle failure when ModsLoader resolve fails', async () => {
      const error = new Error('Failed to resolve ModsLoader');
      const originalResolve = mockContainer.resolve; // Keep a reference to the original mock function
      await testFailure(
        () => {
          // Temporarily override the mock for this specific test case
          mockContainer.resolve = jest.fn((token) => {
            if (token === tokens.ModsLoader) throw error;
            if (token === tokens.ILogger) return mockLogger;
            return undefined;
          });
        },
        error,
        { shouldCallAdapterInit: false }
      );
      expect(mockModsLoader.loadMods).not.toHaveBeenCalled();
      mockContainer.resolve = originalResolve; // Restore original mock
    });

    it('should handle failure when modsLoader.loadMods rejects', async () => {
      const error = new Error('World loading failed');
      await testFailure(
        () => mockModsLoader.loadMods.mockRejectedValue(error),
        error,
        { shouldCallAdapterInit: false }
      );
      expect(mockLlmAdapter.init).not.toHaveBeenCalled();
      expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
    });

    it('should handle failure when SystemInitializer resolve fails', async () => {
      const error = new Error('Failed to resolve SystemInitializer');
      const originalResolve = mockContainer.resolve;
      await testFailure(() => {
        mockContainer.resolve = jest.fn((token) => {
          if (token === tokens.ILogger) return mockLogger;
          if (token === tokens.ModsLoader) return mockModsLoader;
          if (token === tokens.LLMAdapter) return mockLlmAdapter;
          if (token === tokens.ISchemaValidator) return mockSchemaValidator;
          if (token === tokens.IConfiguration) return mockConfiguration;
          if (token === tokens.ISafeEventDispatcher)
            return {
              dispatch: jest.fn(),
              subscribe: jest.fn(),
              unsubscribe: jest.fn(),
            };
          if (token === tokens.SystemInitializer) throw error;
          return undefined;
        });
      }, error); // Default shouldCallAdapterInit is true, which is correct here
      expect(mockModsLoader.loadMods).toHaveBeenCalled();
      expect(mockLlmAdapter.init).toHaveBeenCalled();
      expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
      mockContainer.resolve = originalResolve;
    });

    it('should handle failure when systemInitializer.initializeAll rejects', async () => {
      const error = new Error('System init failed');
      await testFailure(
        () => mockSystemInitializer.initializeAll.mockRejectedValue(error),
        error
      );
      expect(mockModsLoader.loadMods).toHaveBeenCalledWith(MOCK_WORLD_NAME);
      expect(mockLlmAdapter.init).toHaveBeenCalled();
      expect(
        mockWorldInitializer.initializeWorldEntities
      ).not.toHaveBeenCalled();
    });

    it('should handle failure when WorldInitializer resolve fails', async () => {
      const error = new Error('Failed to resolve WorldInitializer');
      const originalResolve = mockContainer.resolve;
      await testFailure(() => {
        mockContainer.resolve = jest.fn((token) => {
          if (token === tokens.ILogger) return mockLogger;
          if (token === tokens.ModsLoader) return mockModsLoader;
          if (token === tokens.LLMAdapter) return mockLlmAdapter;
          if (token === tokens.ISchemaValidator) return mockSchemaValidator;
          if (token === tokens.IConfiguration) return mockConfiguration;
          if (token === tokens.ISafeEventDispatcher)
            return {
              dispatch: jest.fn(),
              subscribe: jest.fn(),
              unsubscribe: jest.fn(),
            };
          if (token === tokens.SystemInitializer) return mockSystemInitializer;
          if (token === tokens.WorldInitializer) throw error;
          return undefined;
        });
      }, error);
      expect(mockModsLoader.loadMods).toHaveBeenCalled();
      expect(mockLlmAdapter.init).toHaveBeenCalled();
      expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
      expect(
        mockWorldInitializer.initializeWorldEntities
      ).not.toHaveBeenCalled();
      mockContainer.resolve = originalResolve;
    });

    it('should handle failure when worldInitializer.initializeWorldEntities returns false', async () => {
      const expectedError = new Error(
        'World initialization failed via WorldInitializer.'
      );
      await testFailure(() => {
        mockWorldInitializer.initializeWorldEntities.mockReturnValue(false);
      }, expectedError);
      expect(mockModsLoader.loadMods).toHaveBeenCalled();
      expect(mockLlmAdapter.init).toHaveBeenCalled();
      expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
    });

    it('should handle failure when worldInitializer.initializeWorldEntities throws', async () => {
      const error = new Error('World entity init critical failure');
      await testFailure(() => {
        mockWorldInitializer.initializeWorldEntities.mockImplementation(() => {
          throw error;
        });
      }, error);
      expect(mockModsLoader.loadMods).toHaveBeenCalled();
      expect(mockLlmAdapter.init).toHaveBeenCalled();
      expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
    });

    it('should log an error if dispatching UI error events fails during main error handling', async () => {
      const mainError = new Error('World loading failed');
      const dispatchError = new Error('Failed to dispatch UI event');

      mockModsLoader.loadMods.mockRejectedValue(mainError);
      let dispatchCallCount = 0;
      mockValidatedEventDispatcher.dispatch.mockImplementation(
        async (eventName) => {
          dispatchCallCount++;
          if (eventName === 'initialization:initialization_service:failed') {
            return Promise.resolve();
          }
          // Fail on the second relevant dispatch (ui:show_fatal_error or core:disable_input)
          if (
            dispatchCallCount >= 2 &&
            (eventName === 'ui:show_fatal_error' ||
              eventName === 'core:disable_input')
          ) {
            throw dispatchError;
          }
          return Promise.resolve();
        }
      );

      const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(mainError.message);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `CRITICAL ERROR during initialization sequence for world '${MOCK_WORLD_NAME}'`
        ),
        mainError
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `InitializationService: Failed to dispatch UI error events after initialization failure:`,
        dispatchError
      );
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'initialization:initialization_service:failed',
        expect.anything(),
        expect.anything()
      );
      const uiDispatchAttempted =
        mockValidatedEventDispatcher.dispatch.mock.calls.some(
          (call) =>
            call[0] === 'ui:show_fatal_error' ||
            call[0] === 'core:disable_input'
        );
      expect(uiDispatchAttempted).toBe(true);
    });
  });
});
