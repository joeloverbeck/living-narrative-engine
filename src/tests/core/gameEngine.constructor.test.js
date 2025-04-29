// src/tests/core/gameEngine.constructor.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */

// --- Test Suite ---
describe('GameEngine Constructor', () => {

  /** @type {jest.Mocked<AppContainer>} */
  let mockAppContainer;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;

  beforeEach(() => {
    // Clear mocks before each test for isolation
    jest.clearAllMocks();

    // 1. Create Mock ILogger
    // We only need the methods the constructor uses directly or in its fallback
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // 2. Create Mock AppContainer
    // We need a mock 'resolve' method.
    mockAppContainer = {
      // Mock other AppContainer methods if needed by other tests, but constructor only needs resolve
      resolve: jest.fn(),
      // Add dummy implementations or mocks for other methods if GameEngine constructor were to use them
      register: jest.fn(),
      disposeSingletons: jest.fn(),
      reset: jest.fn(),
    };

    // 3. Configure Mock AppContainer.resolve
    // By default, configure it to resolve the mock logger successfully for most tests
    mockAppContainer.resolve.mockImplementation((key) => {
      if (key === 'ILogger') {
        return mockLogger; // Return our mock logger when requested
      }
      // Optional: Throw an error or return undefined for unexpected resolutions in this test context
      // Adjust this default behavior as needed for specific tests (like the fallback test)
      throw new Error(`MockAppContainer: Default behavior - Unexpected resolution attempt for key "${key}".`);
    });
  });

  // --- Test Case: TEST-ENG-001 ---
  it('[TEST-ENG-001] should successfully instantiate and resolve ILogger', () => {
    // --- Arrange (Given) ---
    // Mocks are set up in beforeEach
    // mockAppContainer is configured by default to resolve 'ILogger' to mockLogger

    // --- Act (When) ---
    const gameEngineInstance = new GameEngine({ container: mockAppContainer });

    // --- Assert (Then) ---
    // 1. Then the result is an instance of GameEngine.
    expect(gameEngineInstance).toBeDefined();
    expect(gameEngineInstance).toBeInstanceOf(GameEngine);

    // 2. Then mockAppContainer.resolve was called with 'ILogger'.
    expect(mockAppContainer.resolve).toHaveBeenCalledTimes(1); // Ensure resolve was called
    expect(mockAppContainer.resolve).toHaveBeenCalledWith('ILogger'); // Ensure it was called specifically for ILogger

    // 3. Then the resolved mockLogger.info method was called with the expected message.
    expect(mockLogger.info).toHaveBeenCalledTimes(1); // Ensure logger.info was called
    expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Instance created with AppContainer. Ready to initialize.'); // Ensure the correct message was logged
  });

  // --- Test Case: TEST-ENG-003 ---
  // [X] Given a mock AppContainer configured to throw an error when resolving 'ILogger'.
  // [X] Given spies are attached to console.warn and console.info.
  // [X] When new GameEngine({ container: mockAppContainer }) is called.
  // [X] Then the constructor does not throw an error.
  // [X] Then console.warn was called with a message indicating failure to resolve ILogger and fallback.
  // [X] Then console.info was called with a message indicating successful instance creation (using the fallback logger).
  // [X] Remember to restore console spies after the test.
  it('[TEST-ENG-003] should fall back to console logging if ILogger cannot be resolved', () => {
    // --- Arrange (Given) ---
    // 1. Configure mockAppContainer to throw an error when resolving 'ILogger'
    const resolutionError = new Error('Simulated ILogger resolution failure.');
    mockAppContainer.resolve.mockImplementation((key) => {
      if (key === 'ILogger') {
        throw resolutionError;
      }
      // Allow other resolutions if needed, or keep throwing for unexpected ones
      throw new Error(`MockAppContainer: TEST-ENG-003 - Unexpected resolution attempt for key "${key}".`);
    });

    // 2. Spy on console.warn and console.info to verify fallback behavior
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress actual console output during test
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {}); // Suppress actual console output during test

    let gameEngineInstance;
    let constructorError = null;

    // --- Act (When) ---
    try {
      gameEngineInstance = new GameEngine({ container: mockAppContainer });
    } catch (error) {
      constructorError = error; // Catch potential errors during construction
    }


    // --- Assert (Then) ---
    // 1. Then the constructor does not throw an error.
    expect(constructorError).toBeNull(); // Ensure no error was thrown
    expect(gameEngineInstance).toBeDefined();
    expect(gameEngineInstance).toBeInstanceOf(GameEngine); // Check instance creation still happens

    // 2. Check resolve was called
    expect(mockAppContainer.resolve).toHaveBeenCalledTimes(1);
    expect(mockAppContainer.resolve).toHaveBeenCalledWith('ILogger');

    // 3. Then console.warn was called with the expected message and error
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console for logging.',
      resolutionError // Check that the original error was passed to the warning
    );

    // 4. Then console.info was called *by the fallback logger* with the standard creation message
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith('GameEngine: Instance created with AppContainer. Ready to initialize.');

    // 5. Check the actual mockLogger (which wasn't returned) was NOT called
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();

    // Cleanup: Restore console spies
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  // --- Test Case: TEST-ENG-002 ---
  // [ ] Given container is null.
  // [ ] When new GameEngine({ container: null }) is called.
  // [ ] Then an Error is thrown with a message indicating the AppContainer is required.
  it('[TEST-ENG-002] should throw an error if container option is null', () => {
    // --- Arrange (Given) ---
    const options = { container: null };
    const expectedErrorMessage = 'GameEngine requires a valid AppContainer instance.';

    // --- Act & Assert (When & Then) ---
    // Verify that calling the constructor with null container throws the specific error
    expect(() => {
      new GameEngine(options);
    }).toThrow(new Error(expectedErrorMessage));
  });

  // --- Test Case: TEST-ENG-002 ---
  // [ ] Given container is undefined.
  // [ ] When new GameEngine({}) is called.
  // [ ] Then an Error is thrown with a message indicating the AppContainer is required.
  it('[TEST-ENG-002] should throw an error if container option is missing or undefined', () => {
    // --- Arrange (Given) ---
    const optionsMissing = {}; // container property is missing
    const optionsUndefined = { container: undefined }; // container property is explicitly undefined
    const expectedErrorMessage = 'GameEngine requires a valid AppContainer instance.';

    // --- Act & Assert (When & Then) ---
    // Verify that calling the constructor with a missing container property throws the specific error
    expect(() => {
      new GameEngine(optionsMissing);
    }).toThrow(new Error(expectedErrorMessage));

    // Verify that calling the constructor with an undefined container property throws the specific error
    expect(() => {
      new GameEngine(optionsUndefined);
    }).toThrow(new Error(expectedErrorMessage));
  });

}); // End describe block