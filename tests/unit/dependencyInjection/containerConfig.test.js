/**
 * @file Integration test for the DI container configuration process.
 * @description This test verifies that the configureContainer function can execute
 * without throwing errors due to incorrect service resolution order, specifically
 * targeting issues with asynchronous operations.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';

// --- Mock all registration bundles ---
// We mock these to isolate the test to the logic within containerConfig.js itself.
jest.mock(
  '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/commandAndActionRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/interpreterRegistrations.js'
);
jest.mock('../../../src/dependencyInjection/registrations/aiRegistrations.js');
jest.mock(
  '../../../src/dependencyInjection/registrations/turnLifecycleRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/eventBusAdapterRegistrations.js'
);
jest.mock('../../../src/dependencyInjection/registrations/uiRegistrations.js');
jest.mock(
  '../../../src/dependencyInjection/registrations/initializerRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/runtimeRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/orchestrationRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/actionTracingRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/pipelineServiceRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/actionCategorizationRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/characterBuilderRegistrations.js'
);

jest.mock('../../../src/dependencyInjection/baseContainerConfig.js', () => {
  const actualModule = jest.requireActual(
    '../../../src/dependencyInjection/baseContainerConfig.js'
  );

  return {
    ...actualModule,
    configureBaseContainer: jest.fn(actualModule.configureBaseContainer),
  };
});

// We need the real LoggerConfigLoader to be instantiated.
// We will mock the 'fetch' call it makes instead.
jest.mock('../../../src/configuration/loggerConfigLoader.js', () => {
  const originalModule = jest.requireActual(
    '../../../src/configuration/loggerConfigLoader.js'
  );
  return {
    ...originalModule,
    // Add a spy to the constructor if needed, but for now, let's use the real one.
  };
});

// Import the mocked modules so we can control their behavior
import { registerLoaders } from '../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import { registerInfrastructure } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import { registerActionTracing } from '../../../src/dependencyInjection/registrations/actionTracingRegistrations.js';
import { registerWorldAndEntity } from '../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js';
import { registerPipelineServices } from '../../../src/dependencyInjection/registrations/pipelineServiceRegistrations.js';
import { registerCommandAndAction } from '../../../src/dependencyInjection/registrations/commandAndActionRegistrations.js';
import { registerInterpreters } from '../../../src/dependencyInjection/registrations/interpreterRegistrations.js';
import { registerActionCategorization } from '../../../src/dependencyInjection/registrations/actionCategorizationRegistrations.js';
import { registerAI } from '../../../src/dependencyInjection/registrations/aiRegistrations.js';
import { registerTurnLifecycle } from '../../../src/dependencyInjection/registrations/turnLifecycleRegistrations.js';
import { registerEventBusAdapters } from '../../../src/dependencyInjection/registrations/eventBusAdapterRegistrations.js';
import { registerUI } from '../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { registerInitializers } from '../../../src/dependencyInjection/registrations/initializerRegistrations.js';
import { registerRuntime } from '../../../src/dependencyInjection/registrations/runtimeRegistrations.js';
import { registerOrchestration } from '../../../src/dependencyInjection/registrations/orchestrationRegistrations.js';

describe('configureContainer', () => {
  let container;
  let mockUiElements;
  let consoleErrorSpy;
  const actualConfigureBaseContainer = jest.requireActual(
    '../../../src/dependencyInjection/baseContainerConfig.js'
  ).configureBaseContainer;

  beforeEach(() => {
    // Set up a fresh container and mocks for each test
    container = new AppContainer();
    mockUiElements = {
      outputDiv: {},
      inputElement: {},
      titleElement: {},
      document: {},
    };

    // Spy on console.error to catch errors logged by unhandled promise rejections
    // from the fire-and-forget async block in configureContainer.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock the global fetch API used by LoggerConfigLoader
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ logLevel: 'DEBUG' }),
      })
    );

    // Reset the mocked base container configuration to use the real implementation
    configureBaseContainer.mockReset();
    configureBaseContainer.mockImplementation(actualConfigureBaseContainer);

    // Mock all registration functions to be no-ops or minimal implementations
    // This isolates the test to just the configureContainer logic
    // However, we need to register the critical services that configureContainer validates
    registerLoaders.mockImplementation((c) => {
      // Register ISchemaValidator that configureContainer validates
      const mockValidator = { validate: jest.fn(() => ({ valid: true })) };
      c.register(tokens.ISchemaValidator, mockValidator, {
        lifecycle: 'singleton',
      });
      // Register IDataRegistry that configureContainer validates
      const mockRegistry = { get: jest.fn(), has: jest.fn(() => true) };
      c.register(tokens.IDataRegistry, mockRegistry, {
        lifecycle: 'singleton',
      });
    });

    registerActionTracing.mockImplementation(() => {});

    registerWorldAndEntity.mockImplementation((c) => {
      // Register IEntityManager that configureContainer validates
      const mockEntityManager = {
        createEntity: jest.fn(),
        getEntity: jest.fn(),
        hasEntity: jest.fn(() => true),
      };
      c.register(tokens.IEntityManager, mockEntityManager, {
        lifecycle: 'singleton',
      });
    });

    registerPipelineServices.mockImplementation(() => {});
    registerCommandAndAction.mockImplementation(() => {});
    registerInterpreters.mockImplementation(() => {});
    registerActionCategorization.mockImplementation(() => {});
    registerAI.mockImplementation(() => {});
    registerTurnLifecycle.mockImplementation(() => {});
    registerEventBusAdapters.mockImplementation(() => {});
    registerUI.mockImplementation(() => {});
    registerInitializers.mockImplementation(() => {});
    registerRuntime.mockImplementation(() => {});
    registerOrchestration.mockImplementation(() => {});

    // Since configureContainer already registers the logger before calling
    // registerInfrastructure, we need to ensure our mock doesn't break the flow.
    // The mock should preserve the ability to resolve ILogger.
    registerInfrastructure.mockImplementation((c) => {
      // The real registerInfrastructure expects ILogger to already be registered
      const logger = c.resolve(tokens.ILogger);

      // Register a minimal SafeEventDispatcher for testing
      const mockDispatcher = { dispatch: jest.fn() };
      c.register(tokens.ISafeEventDispatcher, mockDispatcher, {
        lifecycle: 'singleton',
      });

      // Register other critical services that might be needed
      c.register(tokens.IValidatedEventDispatcher, mockDispatcher, {
        lifecycle: 'singleton',
      });
    });
  });

  afterEach(() => {
    // Restore all mocks to their original state
    jest.restoreAllMocks();
  });

  it('should configure the container without logging critical async errors', async () => {
    // Act: Execute the function we are testing.
    // configureContainer is now async, so we need to await it
    await configureContainer(container, mockUiElements);

    // Assert: Check for the specific error that was occurring.
    // We give the event loop a chance to run any remaining async operations.
    await new Promise(process.nextTick);

    // The test passes if the specific critical error was NOT logged.
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'CRITICAL ERROR during asynchronous logger configuration loading'
      ),
      expect.anything()
    );
  });

  it('should allow ISafeEventDispatcher to be resolved after configuration', async () => {
    // Act
    // configureContainer is now async, so we need to await it
    await configureContainer(container, mockUiElements);
    await new Promise(process.nextTick); // Let any remaining async operations settle

    // Assert
    let dispatcher;
    // This should not throw an error in the fixed code.
    expect(() => {
      dispatcher = container.resolve(tokens.ISafeEventDispatcher);
    }).not.toThrow();

    // Verify we got a valid object back.
    expect(dispatcher).toBeDefined();
    expect(typeof dispatcher.dispatch).toBe('function');
  });

  it('should still register the ILogger service correctly', async () => {
    // Act
    // configureContainer is now async, so we need to await it
    await configureContainer(container, mockUiElements);

    // Assert
    const logger = container.resolve(tokens.ILogger);
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('logs and rethrows when base container configuration fails', async () => {
    const failure = new Error('base container failure');
    configureBaseContainer.mockImplementationOnce(async () => {
      throw failure;
    });

    await expect(configureContainer(container, mockUiElements)).rejects.toBe(
      failure
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[ContainerConfig] Base container configuration failed:'
      ),
      failure
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[ContainerConfig] Container configuration failed:'
      ),
      failure
    );
  });

  it('throws a descriptive error when a critical service is missing', async () => {
    const missingService = String(tokens.IEntityManager);
    registerWorldAndEntity.mockImplementationOnce(() => {});

    await expect(configureContainer(container, mockUiElements)).rejects.toThrow(
      `[ContainerConfig] Critical service ${missingService} was not registered`
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[ContainerConfig] Container configuration failed:'
      ),
      expect.any(Error)
    );
  });
});
