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

// --- Mock all registration bundles ---
// We mock these to isolate the test to the logic within containerConfig.js itself.
jest.mock(
  '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/persistenceRegistrations.js'
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
import { registerInfrastructure } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';

describe('configureContainer', () => {
  let container;
  let mockUiElements;
  let consoleErrorSpy;

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

    // Provide a mock implementation for the function that registers the service
    // which was previously failing to resolve (ISafeEventDispatcher).
    registerInfrastructure.mockImplementation((c) => {
      const mockDispatcher = { dispatch: jest.fn() };
      c.register(tokens.ISafeEventDispatcher, mockDispatcher, {
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
    configureContainer(container, mockUiElements);

    // Assert: Check for the specific error that was occurring.
    // We give the event loop a chance to run the async block.
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
    configureContainer(container, mockUiElements);
    await new Promise(process.nextTick); // Let async operations settle

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

  it('should still register the ILogger service correctly', () => {
    // Act
    configureContainer(container, mockUiElements);

    // Assert
    const logger = container.resolve(tokens.ILogger);
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });
});
