// src/tests/initializers/services/initializationService.integration.test.js

import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import InitializationService from '../../../../src/initializers/services/initializationService.js'; // Adjust path if needed
import { registerOrchestration } from '../../../../src/dependencyInjection/registrations/orchestrationRegistrations.js'; // Function under test (partially)
import { registerCommandAndAction } from '../../../../src/dependencyInjection/registrations/commandAndActionRegistrations.js';
import { registerWorldAndEntity } from '../../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js';
import { registerInfrastructure } from '../../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import { registerLoaders } from '../../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterEach,
} from '@jest/globals'; // Added afterEach

// --- Mocks ---
// Mock minimal ILogger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock minimal IValidatedEventDispatcher
const mockValidatedEventDispatcher = {
  dispatch: jest.fn().mockResolvedValue(undefined), // Mock the async method
};

// --- Test Suite ---
describe('InitializationService Integration with AppContainer', () => {
  let container;

  beforeEach(() => {
    // Create a fresh container for each test
    container = new AppContainer();

    // Reset mocks before each test (clears calls from previous tests)
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (container) {
      // Ensure container exists before trying to reset
      container.reset(); // Clean up container registrations and instances
    }
  });

  it('should resolve InitializationService without throwing "key undefined" error after fix', () => {
    // --- Arrange ---
    // Register basic dependencies first (needed by other registrations)
    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IConfiguration, () => ({}));
    
    // Register required dependencies
    registerLoaders(container);
    registerInfrastructure(container);
    registerWorldAndEntity(container);
    registerCommandAndAction(container);
    
    // Override specific services with mocks after registration
    container.register(tokens.IValidatedEventDispatcher, () => mockValidatedEventDispatcher);
    container.register(tokens.ModsLoader, () => ({
      loadMods: jest.fn().mockResolvedValue({}),
    }));
    container.register(tokens.IScopeRegistry, () => ({
      initialize: jest.fn(),
    }));
    container.register(tokens.LLMAdapter, () => ({
      init: jest.fn(),
      isInitialized: jest.fn(),
      isOperational: jest.fn(),
    }));
    container.register(tokens.LlmConfigLoader, () => ({
      loadConfigs: jest.fn(),
    }));
    container.register(tokens.SystemInitializer, () => ({
      initializeAll: jest.fn(),
    }));
    container.register(tokens.WorldInitializer, () => ({
      initializeWorldEntities: jest.fn().mockReturnValue(true),
    }));
    container.register(tokens.ISafeEventDispatcher, () => ({
      subscribe: jest.fn(),
    }));
    container.register(tokens.IEntityManager, () => ({}));
    container.register(tokens.DomUiFacade, () => ({}));
    
    // Run the registration function that defines the InitializationService factory.
    registerOrchestration(container);

    // --- Act & Assert ---
    // Attempt to resolve the service. THIS is the step that previously failed.
    let resolvedService = null;
    expect(() => {
      resolvedService = container.resolve(tokens.IInitializationService);
    }).not.toThrow(/AppContainer: No service registered for key "undefined"/); // Check it doesn't throw the SPECIFIC error

    // Further check: ensure we actually got an instance
    expect(resolvedService).toBeDefined();
    expect(resolvedService).toBeInstanceOf(InitializationService);
  });

  it('should inject and use the logger dependency during construction', () => {
    // --- Arrange ---
    // Register basic dependencies first (needed by other registrations)
    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IConfiguration, () => ({}));
    
    // Register required dependencies
    registerLoaders(container);
    registerInfrastructure(container);
    registerWorldAndEntity(container);
    registerCommandAndAction(container);
    
    // Override specific services with mocks after registration
    container.register(tokens.IValidatedEventDispatcher, () => mockValidatedEventDispatcher);
    container.register(tokens.ModsLoader, () => ({
      loadMods: jest.fn().mockResolvedValue({}),
    }));
    container.register(tokens.IScopeRegistry, () => ({
      initialize: jest.fn(),
    }));
    container.register(tokens.LLMAdapter, () => ({
      init: jest.fn(),
      isInitialized: jest.fn(),
      isOperational: jest.fn(),
    }));
    container.register(tokens.LlmConfigLoader, () => ({
      loadConfigs: jest.fn(),
    }));
    container.register(tokens.SystemInitializer, () => ({
      initializeAll: jest.fn(),
    }));
    container.register(tokens.WorldInitializer, () => ({
      initializeWorldEntities: jest.fn().mockReturnValue(true),
    }));
    container.register(tokens.ISafeEventDispatcher, () => ({
      subscribe: jest.fn(),
    }));
    container.register(tokens.IEntityManager, () => ({}));
    container.register(tokens.DomUiFacade, () => ({}));
    
    // Register the service using the orchestration logic. This will cause some logs.
    registerOrchestration(container);

    // <<< --- ADDED: Clear mock history after arrangement --- >>>
    // Clear any calls made to the logger during registration setup.
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    // You could also clear other mockLogger methods if needed:
    // mockLogger.info.mockClear();
    // mockLogger.warn.mockClear();
    // mockLogger.error.mockClear();

    // --- Act ---
    // Resolve the service. This triggers the constructor, which should log.
    const resolvedService = container.resolve(tokens.IInitializationService);

    // --- Assert ---
    // Verify the service is created
    expect(resolvedService).toBeInstanceOf(InitializationService);

    // Verify that the constructor used the injected logger including our expected call
    // Based on: this.#logger.debug('InitializationService: Instance created successfully with dependencies.');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'InitializationService: Instance created successfully with dependencies.'
    );
    // The integration test may have multiple debug calls from the full registration chain,
    // so we just verify our specific call was made rather than counting total calls

    // Note: Directly testing the injection of #validatedEventDispatcher and #container
    // via the constructor is not straightforward without accessing private fields.
    // To test them, you would typically call a method on `resolvedService`
    // (e.g., `runInitializationSequence`) that *uses* those dependencies,
    // and then assert that the corresponding mock methods were called
    // (e.g., `mockValidatedEventDispatcher.dispatch`).
  });
});
