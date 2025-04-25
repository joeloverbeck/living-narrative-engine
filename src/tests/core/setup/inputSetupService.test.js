// src/core/setup/inputSetupService.test.js

import InputSetupService from '../../../core/setup/inputSetupService';
import {beforeEach, describe, expect, it, jest} from '@jest/globals'; // Adjust path as necessary
// --- Mock Imports ---
// We'll create mocks directly using jest.fn() or jest.mock() inline below

// --- Type Imports for Mocks (Optional but good practice) ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../gameLoop.js').default} GameLoop */
/** @typedef {import('../inputHandler.js').default} InputHandler */

describe('InputSetupService', () => {
  /** @type {AppContainer} */ let mockContainer;
  /** @type {ILogger} */ let mockLogger;
  /** @type {ValidatedEventDispatcher} */ let mockValidatedDispatcher;
  /** @type {GameLoop} */ let mockGameLoop;
  /** @type {InputHandler} */ let mockInputHandler;
  /** @type {Function | null} */ let capturedCallback = null; // To capture the function passed to setCommandCallback

  beforeEach(() => {
    // Reset mocks and captured callback before each test
    capturedCallback = null;
    jest.clearAllMocks(); // Clears call counts and recorded args for all mocks

    // --- Create Mocks ---
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockValidatedDispatcher = {
      dispatchValidated: jest.fn().mockResolvedValue(true), // Default to resolving successfully
    };

    mockGameLoop = {
      isRunning: false, // Default state
      processSubmittedCommand: jest.fn(),
    };

    // Mock InputHandler specifically
    mockInputHandler = {
      setCommandCallback: jest.fn((callback) => {
        capturedCallback = callback; // Capture the passed function
      }),
      // Add other methods like enable/disable if needed by other tests, though not directly by InputSetupService
      enable: jest.fn(),
      disable: jest.fn(),
    };

    // Mock AppContainer and its resolve method
    mockContainer = {
      resolve: jest.fn((key) => {
        if (key === 'InputHandler') {
          return mockInputHandler;
        }
        // Return undefined or throw for other keys if necessary for specific tests
        // For these tests, we only care about resolving InputHandler
        // throw new Error(`Mock AppContainer cannot resolve key: ${key}`);
        return undefined;
      }),
      // Add other AppContainer methods if needed
      register: jest.fn(),
      disposeSingletons: jest.fn(),
      reset: jest.fn(),
    };
  });

  // --- Test Suite 1: Constructor ---
  describe('Constructor', () => {
    it('should create an instance successfully with valid mocks', () => {
      const service = new InputSetupService({
        container: mockContainer,
        logger: mockLogger,
        validatedDispatcher: mockValidatedDispatcher,
        gameLoop: mockGameLoop,
      });
      expect(service).toBeInstanceOf(InputSetupService);
      // Check if logger was called during construction (as per implementation)
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Instance created successfully'));
    });

    it('should throw an error if container is missing', () => {
      expect(() => {
        new InputSetupService({
          // container: undefined, // or null
          logger: mockLogger,
          validatedDispatcher: mockValidatedDispatcher,
          gameLoop: mockGameLoop,
        });
      }).toThrow("InputSetupService: Missing required dependency 'container'.");
    });

    it('should throw an error if logger is missing', () => {
      // We expect console.error to be called before the throw
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        new InputSetupService({
          container: mockContainer,
          // logger: undefined, // or null
          validatedDispatcher: mockValidatedDispatcher,
          gameLoop: mockGameLoop,
        });
      }).toThrow("InputSetupService: Missing required dependency 'logger'.");
      expect(consoleErrorSpy).toHaveBeenCalledWith("InputSetupService: Missing required dependency 'logger'.");
      consoleErrorSpy.mockRestore(); // Clean up spy
    });

    it('should throw an error if validatedDispatcher is missing', () => {
      expect(() => {
        new InputSetupService({
          container: mockContainer,
          logger: mockLogger,
          // validatedDispatcher: undefined, // or null
          gameLoop: mockGameLoop,
        });
      }).toThrow("InputSetupService: Missing required dependency 'validatedDispatcher'.");
      // Check logger was used to report the missing dependency *before* throwing
      expect(mockLogger.error).toHaveBeenCalledWith("InputSetupService: Missing required dependency 'validatedDispatcher'.");
    });

    it('should throw an error if gameLoop is missing', () => {
      expect(() => {
        new InputSetupService({
          container: mockContainer,
          logger: mockLogger,
          validatedDispatcher: mockValidatedDispatcher,
          // gameLoop: undefined, // or null
        });
      }).toThrow("InputSetupService: Missing required dependency 'gameLoop'.");
      // Check logger was used to report the missing dependency *before* throwing
      expect(mockLogger.error).toHaveBeenCalledWith("InputSetupService: Missing required dependency 'gameLoop'.");
    });
  });

  // --- Test Suite 2: configureInputHandler Method ---
  describe('configureInputHandler Method', () => {
    /** @type {InputSetupService} */ let service;

    beforeEach(() => {
      // Instantiate the service for method tests
      service = new InputSetupService({
        container: mockContainer,
        logger: mockLogger,
        validatedDispatcher: mockValidatedDispatcher,
        gameLoop: mockGameLoop,
      });
    });

    it("should call container.resolve('InputHandler') exactly once", () => {
      service.configureInputHandler();
      expect(mockContainer.resolve).toHaveBeenCalledTimes(1);
      expect(mockContainer.resolve).toHaveBeenCalledWith('InputHandler');
    });

    it('should call inputHandler.setCommandCallback exactly once with a function argument', () => {
      service.configureInputHandler();
      expect(mockInputHandler.setCommandCallback).toHaveBeenCalledTimes(1);
      expect(mockInputHandler.setCommandCallback).toHaveBeenCalledWith(expect.any(Function));
      expect(capturedCallback).toBeInstanceOf(Function); // Verify the captured value is a function
    });

    it('should call logger.info with the correct configuration message', () => {
      service.configureInputHandler();
      expect(mockLogger.info).toHaveBeenCalledWith('InputSetupService: InputHandler resolved and command callback configured.');
      // Optionally check debug log as well
      expect(mockLogger.debug).toHaveBeenCalledWith('InputSetupService: Attempting to configure InputHandler...');
    });

    it('should throw an error if InputHandler cannot be resolved', () => {
      // Override the mock resolve for this specific test
      mockContainer.resolve.mockImplementation((key) => {
        if (key === 'InputHandler') {
          throw new Error('Test: Could not resolve InputHandler');
        }
        return undefined;
      });

      expect(() => {
        service.configureInputHandler();
      }).toThrow('InputSetupService configuration failed: Test: Could not resolve InputHandler');
      // Check logger was called with the error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'InputSetupService: Failed to resolve or configure InputHandler.',
        expect.any(Error) // Check that an error object was passed
      );
    });
  });

  // --- Test Suite 3: Callback Logic (GameLoop Running) ---
  describe('Callback Logic (GameLoop Running)', () => {
    /** @type {InputSetupService} */ let service;
    const testCommand = 'test command';

    beforeEach(() => {
      service = new InputSetupService({
        container: mockContainer,
        logger: mockLogger,
        validatedDispatcher: mockValidatedDispatcher,
        gameLoop: mockGameLoop,
      });
      service.configureInputHandler(); // Set up the callback
      mockGameLoop.isRunning = true; // Set GameLoop state for this suite
      // Ensure capturedCallback is set before tests run
      if (!capturedCallback) {
        throw new Error('Test setup failed: Callback was not captured.');
      }
    });

    it('should call validatedDispatcher.dispatchValidated with ui:command_echo', async () => {
      await capturedCallback(testCommand);
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
        'ui:command_echo',
        { command: testCommand }
      );
    });

    it('should call gameLoop.processSubmittedCommand with the command', async () => {
      await capturedCallback(testCommand);
      expect(mockGameLoop.processSubmittedCommand).toHaveBeenCalledTimes(1);
      expect(mockGameLoop.processSubmittedCommand).toHaveBeenCalledWith(testCommand);
    });

    it("should NOT call validatedDispatcher.dispatchValidated with 'ui:disable_input'", async () => {
      await capturedCallback(testCommand);
      // Check all calls to dispatchValidated
      const dispatchCalls = mockValidatedDispatcher.dispatchValidated.mock.calls;
      // Filter calls to see if 'ui:disable_input' was ever the first argument
      const disableInputCalls = dispatchCalls.filter(call => call[0] === 'ui:disable_input');
      expect(disableInputCalls.length).toBe(0);
      // Or more simply:
      expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
        'ui:disable_input',
        expect.anything() // We don't care about the payload here
      );
    });

    it('should call ui:command_echo before processSubmittedCommand', async () => {
      await capturedCallback(testCommand);

      // Find the index of the 'ui:command_echo' call within dispatchValidated's calls
      const echoCallIndex = mockValidatedDispatcher.dispatchValidated.mock.calls.findIndex(
        call => call && call[0] === 'ui:command_echo'
      );

      // Ensure the call happened
      expect(echoCallIndex).toBeGreaterThanOrEqual(0);

      // Get the global invocation order for that specific call
      const echoGlobalOrder = mockValidatedDispatcher.dispatchValidated.mock.invocationCallOrder[echoCallIndex];

      // Get the global invocation order for the processSubmittedCommand call (assuming it's called once)
      const processGlobalOrder = mockGameLoop.processSubmittedCommand.mock.invocationCallOrder[0];

      // Ensure both orders are defined before comparing
      expect(echoGlobalOrder).toBeDefined();
      expect(processGlobalOrder).toBeDefined();

      // Assert the order
      expect(echoGlobalOrder).toBeLessThan(processGlobalOrder);
    });
  });

  // --- Test Suite 4: Callback Logic (GameLoop Not Running) ---
  describe('Callback Logic (GameLoop Not Running)', () => {
    /** @type {InputSetupService} */ let service;
    const testCommand = 'another command';

    beforeEach(() => {
      service = new InputSetupService({
        container: mockContainer,
        logger: mockLogger,
        validatedDispatcher: mockValidatedDispatcher,
        gameLoop: mockGameLoop,
      });
      service.configureInputHandler(); // Set up the callback
      mockGameLoop.isRunning = false; // Set GameLoop state for this suite
      // Ensure capturedCallback is set before tests run
      if (!capturedCallback) {
        throw new Error('Test setup failed: Callback was not captured.');
      }
    });

    it('should call validatedDispatcher.dispatchValidated with ui:command_echo', async () => {
      await capturedCallback(testCommand);
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
        'ui:command_echo',
        { command: testCommand }
      );
    });

    it("should call validatedDispatcher.dispatchValidated with 'ui:disable_input' and message", async () => {
      await capturedCallback(testCommand);
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
        'ui:disable_input',
        { message: 'Game not running.' }
      );
    });

    it('should NOT call gameLoop.processSubmittedCommand', async () => {
      await capturedCallback(testCommand);
      expect(mockGameLoop.processSubmittedCommand).not.toHaveBeenCalled();
    });

    it("should call logger.warn with 'GameLoop is not ready/running'", async () => {
      await capturedCallback(testCommand);
      expect(mockLogger.warn).toHaveBeenCalledWith('InputSetupService: Input received, but GameLoop is not ready/running.');
    });

    it('should call ui:command_echo before ui:disable_input', async () => {
      await capturedCallback(testCommand);

      // Find the index of the 'ui:command_echo' call within dispatchValidated's calls
      const echoCallIndex = mockValidatedDispatcher.dispatchValidated.mock.calls.findIndex(
        call => call && call[0] === 'ui:command_echo'
      );
      // Find the index of the 'ui:disable_input' call within dispatchValidated's calls
      const disableCallIndex = mockValidatedDispatcher.dispatchValidated.mock.calls.findIndex(
        call => call && call[0] === 'ui:disable_input'
      );

      // Ensure both calls happened
      expect(echoCallIndex).toBeGreaterThanOrEqual(0);
      expect(disableCallIndex).toBeGreaterThanOrEqual(0);

      // Get the global invocation order for each specific call
      const echoGlobalOrder = mockValidatedDispatcher.dispatchValidated.mock.invocationCallOrder[echoCallIndex];
      const disableGlobalOrder = mockValidatedDispatcher.dispatchValidated.mock.invocationCallOrder[disableCallIndex];

      // Ensure both orders are defined before comparing
      expect(echoGlobalOrder).toBeDefined();
      expect(disableGlobalOrder).toBeDefined();

      // Assert the order
      expect(echoGlobalOrder).toBeLessThan(disableGlobalOrder);
    });
  });
});