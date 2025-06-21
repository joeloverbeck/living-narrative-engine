// src/tests/initializers/services/initializationService.constructor.test.js

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
import { tokens } from '../../../../src/dependencyInjection/tokens.js'; // Import tokens for DomUiFacade

// --- Mocks ---
let mockContainer;
let mockLogger;
let mockValidatedEventDispatcher;
let mockModsLoader;
let mockSystemInitializer;
// REMOVED: let mockGameStateInitializer;
let mockWorldInitializer;
let mockGameLoop; // Keep the mock object itself for potential use in other tests/layers
let mockDomUiFacade; // Added mock for DomUiFacade
// Variable to store the original container.resolve mock implementation
let originalContainerResolve;

const MOCK_WORLD_NAME = 'testWorld';

describe('InitializationService', () => {
  beforeEach(() => {
    // Reset mocks for each test
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined), // Default success
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
    // REMOVED: mockGameStateInitializer setup
    mockWorldInitializer = {
      initializeWorldEntities: jest.fn().mockReturnValue(true),
    };
    mockGameLoop = {
      // Properties if needed by other layers
    };
    mockDomUiFacade = {
      // Add methods if needed, but often just resolving it is enough
    };

    // Mock AppContainer resolve behavior
    mockContainer = {
      resolve: jest.fn((token) => {
        switch (token) {
          case 'ModsLoader':
            return mockModsLoader;
          case 'SystemInitializer':
            return mockSystemInitializer;
          // REMOVED: GameStateInitializer case
          case 'WorldInitializer':
            return mockWorldInitializer;
          case tokens.DomUiFacade: // Use imported token
            return mockDomUiFacade;
          // REMOVED: GameLoop case
          case 'ILogger': // For constructor fallback test
            return mockLogger;
          default:
            // Use originalContainerResolve if defined and has a test-specific implementation
            if (
              originalContainerResolve &&
              originalContainerResolve.getMockImplementation()
            ) {
              const testImplementation =
                originalContainerResolve.getMockImplementation();
              const result = testImplementation(token);
              // If the test implementation returns undefined explicitly, respect that.
              // Otherwise, potentially fallback to basic behavior if needed?
              // For now, just return what the test impl returns.
              return result;
            }
            // Fallback to basic default behavior if no test override
            return undefined; // Keep original default behavior
        }
      }),
    };
    // Store the original implementation BEFORE assigning the mock function
    // Ensure originalContainerResolve starts with the base behavior for fallback
    originalContainerResolve = jest.fn((token) => {
      switch (token) {
        case 'ModsLoader':
          return mockModsLoader;
        case 'SystemInitializer':
          return mockSystemInitializer;
        case 'WorldInitializer':
          return mockWorldInitializer;
        case tokens.DomUiFacade:
          return mockDomUiFacade;
        case 'ILogger':
          return mockLogger;
        default:
          return undefined;
      }
    });
    // Now set the main mockContainer.resolve to use the switch and the fallback mechanism
    mockContainer.resolve.mockImplementation((token) => {
      switch (token) {
        case 'ModsLoader':
          return mockModsLoader;
        case 'SystemInitializer':
          return mockSystemInitializer;
        case 'WorldInitializer':
          return mockWorldInitializer;
        case tokens.DomUiFacade:
          return mockDomUiFacade;
        case 'ILogger':
          return mockLogger;
        default:
          // If not handled by specific cases, call the stored original logic
          return originalContainerResolve(token); // Delegate to the fallback/test-specific logic
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Constructor Tests ---
  describe('Constructor', () => {
    it('should instantiate successfully with valid dependencies', () => {
      expect(
        () =>
          new InitializationService({
            container: mockContainer,
            logger: mockLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher,
          })
      ).not.toThrow();
    });

    it('should throw an error if container is missing', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(
        () =>
          new InitializationService({
            logger: mockLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher,
          })
      ).toThrow(
        "InitializationService: Missing required dependency 'container'."
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "InitializationService: Missing required dependency 'container'."
      );
      consoleErrorSpy.mockRestore();
    });

    it('should throw an error if logger is missing', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(
        () =>
          new InitializationService({
            container: mockContainer,
            validatedEventDispatcher: mockValidatedEventDispatcher,
          })
      ).toThrow(
        "InitializationService: Missing or invalid required dependency 'logger'."
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "InitializationService: Missing or invalid required dependency 'logger'."
      );
      consoleErrorSpy.mockRestore();
    });

    it('should throw an error if logger is invalid (missing methods)', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const invalidLogger = { info: jest.fn() }; // Missing error/debug
      expect(
        () =>
          new InitializationService({
            container: mockContainer,
            logger: invalidLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher,
          })
      ).toThrow(
        "InitializationService: Missing or invalid required dependency 'logger'."
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "InitializationService: Missing or invalid required dependency 'logger'."
      );
      consoleErrorSpy.mockRestore();
    });

    it('should throw an error if validatedEventDispatcher is missing', () => {
      expect(
        () =>
          new InitializationService({
            container: mockContainer,
            logger: mockLogger,
          })
      ).toThrow(
        "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
    });

    it('should throw an error if validatedEventDispatcher is invalid (missing dispatch)', () => {
      // FIX: Use an empty object for clarity. This mock is invalid because it lacks '.dispatch()'.
      const invalidDispatcher = {};
      expect(
        () =>
          new InitializationService({
            container: mockContainer,
            logger: mockLogger,
            validatedEventDispatcher: invalidDispatcher,
          })
      ).toThrow(
        "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
      );
    });
  });
});
