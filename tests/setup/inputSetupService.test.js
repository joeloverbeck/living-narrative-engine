// tests/setup/inputSetupService.test.js

import InputSetupService from '../../src/setup/inputSetupService.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { tokens } from '../../src/dependencyInjection/tokens.js';

// --- Mock Imports ---
// Mocks created inline using jest.fn()

// --- Type Imports for Mocks ---
/** @typedef {import('../../src/dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// GameLoop type import removed
/** @typedef {import('../../src/interfaces/IInputHandler.js').IInputHandler} IInputHandler */

describe('InputSetupService', () => {
  /** @type {AppContainer} */ let mockContainer;
  /** @type {ILogger} */ let mockLogger;
  /** @type {ValidatedEventDispatcher} */ let mockvalidatedEventDispatcher;
  // mockGameLoop removed
  /** @type {IInputHandler} */ let mockInputHandler;
  /** @type {Function | null} */ let capturedCallback = null;

  beforeEach(() => {
    capturedCallback = null;
    jest.clearAllMocks();

    // --- Create Mocks ---
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockvalidatedEventDispatcher = {
      dispatchValidated: jest.fn().mockResolvedValue(true),
      // Add subscribe/unsubscribe if needed by other tests using VED mock, though not directly by InputSetupService
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // mockGameLoop removed

    mockInputHandler = {
      setCommandCallback: jest.fn((callback) => {
        capturedCallback = callback;
      }),
      enable: jest.fn(),
      disable: jest.fn(),
    };

    mockContainer = {
      resolve: jest.fn((key) => {
        if (key === tokens.IInputHandler) {
          return mockInputHandler;
        }
        return undefined;
      }),
      register: jest.fn(),
      disposeSingletons: jest.fn(),
      reset: jest.fn(),
    };
  });

  // --- Test Suite 1: Constructor ---
  describe('Constructor', () => {
    it('should create an instance successfully with valid mocks', () => {
      const service = new InputSetupService({
        // gameLoop removed
        container: mockContainer,
        logger: mockLogger,
        validatedEventDispatcher: mockvalidatedEventDispatcher,
      });
      expect(service).toBeInstanceOf(InputSetupService);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'InputSetupService: Instance created.'
      );
    });

    it('should throw an error if container is missing', () => {
      expect(() => {
        new InputSetupService({
          // gameLoop removed
          // container: undefined,
          logger: mockLogger,
          validatedEventDispatcher: mockvalidatedEventDispatcher,
        });
      }).toThrow("InputSetupService: Missing 'container'.");
    });

    it('should throw an error if logger is missing', () => {
      expect(() => {
        new InputSetupService({
          // gameLoop removed
          container: mockContainer,
          // logger: undefined,
          validatedEventDispatcher: mockvalidatedEventDispatcher,
        });
      }).toThrow("InputSetupService: Missing 'logger'.");
    });

    it('should throw an error if validatedEventDispatcher is missing', () => {
      expect(() => {
        new InputSetupService({
          // gameLoop removed
          container: mockContainer,
          logger: mockLogger,
          // validatedEventDispatcher: undefined,
        });
      }).toThrow("InputSetupService: Missing 'validatedEventDispatcher'.");
    });

    // Test for missing gameLoop removed as it's no longer a dependency
  });

  // --- Test Suite 2: configureInputHandler Method ---
  describe('configureInputHandler Method', () => {
    /** @type {InputSetupService} */ let service;

    beforeEach(() => {
      service = new InputSetupService({
        // gameLoop removed
        container: mockContainer,
        logger: mockLogger,
        validatedEventDispatcher: mockvalidatedEventDispatcher,
      });
    });

    it(`should call container.resolve with tokens.IInputHandler exactly once`, () => {
      service.configureInputHandler();
      expect(mockContainer.resolve).toHaveBeenCalledTimes(1);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IInputHandler);
    });

    it('should call inputHandler.setCommandCallback exactly once with a function argument', () => {
      service.configureInputHandler();
      expect(mockInputHandler.setCommandCallback).toHaveBeenCalledTimes(1);
      expect(mockInputHandler.setCommandCallback).toHaveBeenCalledWith(
        expect.any(Function)
      );
      expect(capturedCallback).toBeInstanceOf(Function);
    });

    // --- UPDATED: Check for the new log message ---
    it('should call logger.info with the correct configuration message', () => {
      service.configureInputHandler();
      // Check the specific info message was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'InputSetupService: InputHandler resolved and command callback configured to dispatch core:submit_command events.'
      );
      // Optionally, check the debug message still occurs
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'InputSetupService: Attempting to configure InputHandler...'
      );
    });
    // --- END UPDATED ---

    it('should throw an error if IInputHandler cannot be resolved', () => {
      mockContainer.resolve.mockImplementation((key) => {
        if (key === tokens.IInputHandler) {
          throw new Error('Test: Could not resolve IInputHandler');
        }
        return undefined;
      });

      expect(() => {
        service.configureInputHandler();
      }).toThrow(
        'InputSetupService configuration failed: Test: Could not resolve IInputHandler'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'InputSetupService: Failed to resolve or configure InputHandler.',
        expect.any(Error)
      );
    });
  });

  // --- Test Suite 3: Callback Logic ---
  // Renamed suite - distinction between game loop running/not running is irrelevant here now
  describe('Callback Logic', () => {
    /** @type {InputSetupService} */ let service;
    const testCommand = 'test command';

    beforeEach(() => {
      service = new InputSetupService({
        // gameLoop removed
        container: mockContainer,
        logger: mockLogger,
        validatedEventDispatcher: mockvalidatedEventDispatcher,
      });
      service.configureInputHandler(); // Set up the callback
      // mockGameLoop.isRunning state setting removed
      if (!capturedCallback) {
        throw new Error('Test setup failed: Callback was not captured.');
      }
      // Clear mocks for VED dispatch calls specifically for this suite's tests
      // to ensure counts are isolated to the callback execution.
      mockvalidatedEventDispatcher.dispatchValidated.mockClear();
    });

    // REMOVED: Test for 'textUI:command_echo' as it's no longer dispatched by InputSetupService.

    // --- UPDATED: Check for 'core:submit_command' dispatch ---
    it('should call validatedEventDispatcher.dispatchValidated with core:submit_command', async () => {
      await capturedCallback(testCommand);
      expect(
        mockvalidatedEventDispatcher.dispatchValidated
      ).toHaveBeenCalledWith('core:submit_command', { command: testCommand });
      // Check it was called exactly once during the callback execution.
      expect(
        mockvalidatedEventDispatcher.dispatchValidated
      ).toHaveBeenCalledTimes(1); // CHANGED from 2
    });
    // --- END UPDATED ---

    // Test for calling gameLoop.processSubmittedCommand removed

    // Test for NOT calling textUI:disable_input removed (was specific to gameLoop running case)

    // REMOVED: Test for 'textUI:command_echo' before 'core:submit_command'
    // as 'textUI:command_echo' is no longer dispatched by InputSetupService.
  });

  // Test Suite 4: Callback Logic (GameLoop Not Running) REMOVED entirely
  // The callback behavior is no longer conditional on game loop state.
});
