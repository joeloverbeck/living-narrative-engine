/*
 * @jest-environment node
 */
// src/tests/core/gameEngine.stop.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for mock structure reference

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
// --- New / Updated Mock Types ---
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */ // <<< ADDED for start() setup
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // <<< ADDED for start() setup

// --- Test Suite ---
describe('GameEngine stop()', () => {

  // --- Mocks ---
  /** @type {jest.Mocked<AppContainer>} */
  let mockAppContainer;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<GameLoop>} */
  let mockGameLoop;
  /** @type {jest.Mocked<ShutdownService>} */
  let mockShutdownService;
  /** @type {jest.Mocked<InitializationService>} */ // <<< ADDED
  let mockInitializationService;
  /** @type {jest.Mocked<ValidatedEventDispatcher>} */ // <<< ADDED
  let mockValidatedEventDispatcher;
  /** @type {GameEngine} */
  let gameEngineInstance;
  /** @type {jest.SpyInstance} */
  let consoleLogSpy;


  beforeEach(async () => { // <<< Make beforeEach async
    // Clear mocks and spies before each test for isolation
    jest.clearAllMocks();
    if (consoleLogSpy) consoleLogSpy.mockRestore(); // Restore console spy

    // 1. Mock ILogger
    mockLogger = {
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    };

    // 2. Mock GameLoop
    mockGameLoop = {
      start: jest.fn(),
      stop: jest.fn(),
      processSubmittedCommand: jest.fn(),
      // Keep the getter for isRunning on the mock if needed by fallback logic check
      get isRunning() { return true; },
    };

    // 3. Mock ShutdownService
    mockShutdownService = {
      runShutdownSequence: jest.fn().mockResolvedValue(undefined),
    };

    // 4. Mock InitializationService <<< ADDED
    mockInitializationService = {
      runInitializationSequence: jest.fn().mockResolvedValue({
        success: true,
        gameLoop: mockGameLoop, // Return the mock game loop on success
        error: null,
      }),
    };

    // 5. Mock ValidatedEventDispatcher <<< ADDED (needed by start())
    mockValidatedEventDispatcher = {
      dispatchValidated: jest.fn().mockResolvedValue(undefined),
      registerSchema: jest.fn(), // Add other methods if needed by engine
      registerHandler: jest.fn(),
    };

    // 6. Mock AppContainer
    mockAppContainer = {
      resolve: jest.fn(),
      register: jest.fn(),
      disposeSingletons: jest.fn(),
      reset: jest.fn(),
    };

    // 7. Configure Mock AppContainer.resolve (DEFAULT implementation)
    mockAppContainer.resolve.mockImplementation((key) => {
      if (key === 'ILogger') return mockLogger;
      if (key === 'ShutdownService') return mockShutdownService;
      if (key === 'InitializationService') return mockInitializationService; // <<< ADDED
      if (key === 'ValidatedEventDispatcher') return mockValidatedEventDispatcher; // <<< ADDED
      // console.warn(`WARN: Unhandled resolution for key: ${key} in default mock`); // Optional: Keep or remove
      return undefined;
    });

    // 8. Instantiate GameEngine (Using the DEFAULT mockAppContainer setup)
    gameEngineInstance = new GameEngine({ container: mockAppContainer });

    // 9. Spy on console.log (before start call)
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // 10. <<< MODIFIED: Use start() to initialize state >>>
    try {
      await gameEngineInstance.start('defaultWorld'); // Use a dummy world name
    } catch (error) {
      console.error("Error during test setup start() call:", error);
    }

    // 11. --- Clear setup related calls ---
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
    mockAppContainer.resolve.mockClear();
    mockInitializationService.runInitializationSequence.mockClear();
    mockValidatedEventDispatcher.dispatchValidated.mockClear();
    mockGameLoop.start.mockClear();
    consoleLogSpy.mockClear();
  });

  afterEach(() => {
    if (consoleLogSpy) consoleLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  // =========================================== //
  // === Test Cases === //
  // =========================================== //

  // --- Sub-Ticket 20.5: Initial State Check ---
  describe('Initial State Check (Sub-Ticket 20.5)', () => {

    // These tests remain unchanged as they test uninitialized/stopped states correctly

    it('should log info and NOT call ShutdownService when engine was never initialized', async () => {
      // --- Arrange ---
      const localMockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const localMockContainer = {
        resolve: jest.fn((key) => {
          if (key === 'ILogger') return localMockLogger;
          return undefined;
        }),
        register: jest.fn(), reset: jest.fn(), disposeSingletons: jest.fn(),
      };
      const uninitializedEngine = new GameEngine({ container: localMockContainer });
      localMockLogger.info.mockClear();

      // --- Act ---
      await uninitializedEngine.stop();

      // --- Assert ---
      expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
      expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is already stopped or was never initialized. No action needed.');
      expect(localMockContainer.resolve).not.toHaveBeenCalledWith('ShutdownService');
      expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
      // Use consoleLogSpy from outer scope, ensure it wasn't called
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('internal state reset'));
    });

    it('should log info and NOT call ShutdownService when engine was stopped (state reset manually)', async () => {
      // --- Arrange ---
      // Call stop() once (using instance from beforeEach which was started)
      await gameEngineInstance.stop();

      // Clear mocks from the *first* stop() call
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockAppContainer.resolve.mockClear();
      mockShutdownService.runShutdownSequence.mockClear();
      mockAppContainer.disposeSingletons.mockClear();
      consoleLogSpy.mockClear();
      mockGameLoop.stop.mockClear(); // Also clear game loop mock calls from first stop (fallback or direct)

      // --- Act ---
      await gameEngineInstance.stop(); // Second call

      // --- Assert ---
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is already stopped or was never initialized. No action needed.');
      expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('ShutdownService');
      expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('internal state reset'));
    });
  });


  // --- Sub-Ticket 20.6: ShutdownService Delegation ---
  describe('Shutdown Service Delegation (Sub-Ticket 20.6)', () => {

    // Test Case 1: ShutdownService Success (20.6.1)
    it('should delegate to ShutdownService and log success when runShutdownSequence resolves', async () => {
      // --- Arrange ---
      mockShutdownService.runShutdownSequence.mockResolvedValue(undefined);

      // --- Act ---
      await gameEngineInstance.stop();

      // --- Assert ---
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
      expect(mockAppContainer.resolve).toHaveBeenCalledWith('ShutdownService');
      expect(mockShutdownService.runShutdownSequence).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Executing shutdown sequence via ShutdownService...');
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Shutdown sequence completed successfully via ShutdownService.');
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');

      // --- MODIFIED ASSERTIONS ---
      // Verify internal state reset using getters
      expect(gameEngineInstance.isInitialized).toBe(false); // <<< USE GETTER
      expect(gameEngineInstance.gameLoop).toBeNull();     // <<< USE GETTER
    });

    // Test Case 2: ShutdownService Failure (Rejection) (20.6.2)
    it('should call ShutdownService, log error, and attempt fallback when runShutdownSequence rejects', async () => {
      // --- Arrange ---
      const shutdownError = new Error('Shutdown Service Failed');
      mockShutdownService.runShutdownSequence.mockRejectedValue(shutdownError);

      // --- Act ---
      await expect(gameEngineInstance.stop()).resolves.toBeUndefined();

      // --- Assert ---
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
      expect(mockAppContainer.resolve).toHaveBeenCalledWith('ShutdownService');
      expect(mockShutdownService.runShutdownSequence).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
          'GameEngine: Error resolving or running ShutdownService.',
          shutdownError
      );
      expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
      expect(mockGameLoop.stop).toHaveBeenCalledTimes(1);
      expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');

      // --- MODIFIED ASSERTIONS ---
      // Verify internal state reset using getters
      expect(gameEngineInstance.isInitialized).toBe(false); // <<< USE GETTER
      expect(gameEngineInstance.gameLoop).toBeNull();     // <<< USE GETTER
    });
  });

  // --- Sub-Ticket 20.7: ShutdownService Resolution Failure & Fallback ---
  describe('Shutdown Service Resolution Failure (Sub-Ticket 20.7)', () => {

    it('should log error and attempt fallback cleanup when resolving ShutdownService fails', async () => {
      // --- Arrange ---
      const resolveError = new Error('Cannot resolve ShutdownService');

      // Reconfigure resolve AFTER beforeEach setup but BEFORE stop()
      mockAppContainer.resolve.mockImplementation((key) => {
        if (key === 'ILogger') return mockLogger;
        if (key === 'ShutdownService') throw resolveError;
        // Provide others needed by start (which already ran) or stop (none needed)
        if (key === 'InitializationService') return mockInitializationService;
        if (key === 'ValidatedEventDispatcher') return mockValidatedEventDispatcher;
        return undefined;
      });

      // Clear mocks AGAIN after reconfiguring resolve, before the Act phase
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockAppContainer.resolve.mockClear(); // Clear calls during reconfig (none expected)
      mockShutdownService.runShutdownSequence.mockClear();
      mockGameLoop.stop.mockClear();
      mockAppContainer.disposeSingletons.mockClear();
      consoleLogSpy.mockClear();

      // --- Act ---
      await expect(gameEngineInstance.stop()).resolves.toBeUndefined();

      // --- Assert ---
      expect(mockAppContainer.resolve).toHaveBeenCalledWith('ShutdownService');
      expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error resolving or running ShutdownService'),
          resolveError
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Attempting minimal fallback cleanup')
      );
      expect(mockGameLoop.stop).toHaveBeenCalledTimes(1);
      expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');
      expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');

      // --- MODIFIED ASSERTIONS ---
      // Verify internal state reset using getters
      expect(gameEngineInstance.isInitialized).toBe(false); // <<< USE GETTER
      expect(gameEngineInstance.gameLoop).toBeNull();     // <<< USE GETTER
    });
  });

}); // End describe block