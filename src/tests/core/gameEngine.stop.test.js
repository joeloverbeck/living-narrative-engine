/*
 * @jest-environment node
 */
// src/tests/core/gameEngine.stop.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for mock structure reference
import {tokens} from '../../core/config/tokens.js'; // <<< ADDED: Import tokens

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */ // Kept for reference if needed elsewhere
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/interfaces/ITurnManager.js').ITurnManager} ITurnManager */ // <<< ADDED: TurnManager type

// --- Test Suite ---
describe('GameEngine stop()', () => {

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop; // Only needed if InitializationService returns it explicitly
    /** @type {jest.Mocked<ShutdownService>} */
    let mockShutdownService;
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockValidatedEventDispatcher;
    /** @type {jest.Mocked<ITurnManager>} */ // <<< ADDED
    let mockTurnManager;
    /** @type {GameEngine} */
    let gameEngineInstance;
    /** @type {jest.SpyInstance} */
    let consoleLogSpy;


    beforeEach(async () => { // Make beforeEach async
        // Clear mocks and spies before each test for isolation
        jest.clearAllMocks();
        if (consoleLogSpy) consoleLogSpy.mockRestore(); // Restore console spy

        // 1. Mock ILogger
        mockLogger = {
            info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
        };

        // 2. Mock GameLoop (Potentially not strictly needed if TurnManager handles loop)
        mockGameLoop = {
            start: jest.fn(),
            stop: jest.fn(),
            processSubmittedCommand: jest.fn(),
            get isRunning() {
                return true;
            },
        };

        // 3. Mock ShutdownService
        mockShutdownService = {
            runShutdownSequence: jest.fn().mockResolvedValue(undefined),
        };

        // 4. Mock InitializationService
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue({
                success: true,
                // gameLoop: mockGameLoop, // Removed: GameEngine doesn't store gameLoop directly
                error: null,
            }),
        };

        // 5. Mock ValidatedEventDispatcher
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined),
            registerSchema: jest.fn(),
            registerHandler: jest.fn(),
        };

        // 6. Mock TurnManager <<< ADDED
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            // Add other methods if needed by GameEngine or other services
        };

        // 7. Mock AppContainer
        mockAppContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };

        // 8. Configure Mock AppContainer.resolve (DEFAULT implementation using tokens)
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.ShutdownService) return mockShutdownService;
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            if (key === tokens.ITurnManager) return mockTurnManager; // <<< ADDED: Resolve TurnManager
            if (key === tokens.GameLoop) return mockGameLoop; // Keep if GameLoop is still resolved directly somewhere
            // console.warn(`WARN: Unhandled resolution for key: ${String(key)} in default mock`); // Optional
            return undefined;
        });

        // 9. Instantiate GameEngine (Using the DEFAULT mockAppContainer setup)
        gameEngineInstance = new GameEngine({container: mockAppContainer});

        // 10. Spy on console.log (before start call)
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });

        // 11. Use start() to initialize state (Should now succeed)
        try {
            await gameEngineInstance.start('defaultWorld'); // Use a dummy world name
        } catch (error) {
            // This catch should ideally NOT be hit now, but good to keep for debugging
            console.error(">>> UNEXPECTED Error during test setup start() call:", error);
            // We might want to fail the test explicitly if start fails in setup
            // throw new Error(`Setup failed: gameEngineInstance.start threw an error: ${error.message}`);
        }

        // 12. --- Clear setup related calls ---
        // Clear calls made during the successful start()
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockAppContainer.resolve.mockClear(); // Clear resolve calls from start()
        mockInitializationService.runInitializationSequence.mockClear();
        mockValidatedEventDispatcher.dispatchValidated.mockClear();
        mockTurnManager.start.mockClear(); // <<< ADDED: Clear TurnManager start call
        consoleLogSpy.mockClear();
        // mockGameLoop.start.mockClear(); // GameLoop start is not called directly by GameEngine
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

        it('should log info and NOT call ShutdownService when engine was never initialized', async () => {
            // --- Arrange ---
            const localMockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
            const localMockContainer = {
                resolve: jest.fn((key) => {
                    // Use token for Logger resolution here too
                    if (key === tokens.ILogger) return localMockLogger;
                    return undefined;
                }),
                register: jest.fn(), reset: jest.fn(), disposeSingletons: jest.fn(),
            };
            const uninitializedEngine = new GameEngine({container: localMockContainer});
            localMockLogger.info.mockClear(); // Clear constructor log

            // --- Act ---
            await uninitializedEngine.stop();

            // --- Assert ---
            expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            // <<< UPDATED Expected Log Message >>>
            expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            // Check resolve was NOT called for ShutdownService
            expect(localMockContainer.resolve).not.toHaveBeenCalledWith(tokens.ShutdownService);
            // Ensure the globally mocked ShutdownService's method was not called
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled(); // console.log shouldn't be hit
        });

        it('should log info and NOT call ShutdownService when engine was stopped (state reset manually)', async () => {
            // --- Arrange ---
            // Call stop() once (using instance from beforeEach which was started and is now expected to be initialized)
            await gameEngineInstance.stop();

            // Clear mocks from the *first* stop() call
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockAppContainer.resolve.mockClear();
            mockShutdownService.runShutdownSequence.mockClear();
            mockAppContainer.disposeSingletons.mockClear(); // Clear if called by fallback in first stop
            mockTurnManager.stop.mockClear(); // <<< ADDED: Clear TurnManager stop if called by fallback
            consoleLogSpy.mockClear();


            // --- Act ---
            await gameEngineInstance.stop(); // Second call

            // --- Assert ---
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            // <<< UPDATED Expected Log Message >>>
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled(); // console.log shouldn't be hit on second stop
        });
    });


    // --- Sub-Ticket 20.6: ShutdownService Delegation ---
    describe('Shutdown Service Delegation (Sub-Ticket 20.6)', () => {

        // Test Case 1: ShutdownService Success (20.6.1)
        it('should delegate to ShutdownService and log success when runShutdownSequence resolves', async () => {
            // --- Arrange ---
            // Ensure the mock resolves (default behavior in beforeEach, but explicit here is fine)
            mockShutdownService.runShutdownSequence.mockResolvedValue(undefined);

            // --- Act ---
            await gameEngineInstance.stop();

            // --- Assert ---
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            // <<< Use Token >>>
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Executing shutdown sequence via ShutdownService...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Shutdown sequence completed successfully via ShutdownService.');
            expect(mockLogger.error).not.toHaveBeenCalled();
            // Check final state reset logs
            expect(consoleLogSpy).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');

            // Verify internal state reset using getters
            expect(gameEngineInstance.isInitialized).toBe(false);
            // Accessing gameLoop getter might try to resolve it again, maybe just check isInitialized
            // expect(gameEngineInstance.gameLoop).toBeNull(); // Avoid if possible, rely on isInitialized
        });

        // Test Case 2: ShutdownService Failure (Rejection) (20.6.2)
        it('should call ShutdownService, log error, and attempt fallback when runShutdownSequence rejects', async () => {
            // --- Arrange ---
            const shutdownError = new Error('Shutdown Service Failed');
            mockShutdownService.runShutdownSequence.mockRejectedValue(shutdownError);

            // --- Act ---
            // stop() should handle the rejection internally and resolve
            await expect(gameEngineInstance.stop()).resolves.toBeUndefined();

            // --- Assert ---
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            // <<< Use Token >>>
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).toHaveBeenCalledTimes(1);
            // Check error logging
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'GameEngine: Error resolving or running ShutdownService.',
                shutdownError
            );
            // Check fallback logging and actions
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
            // <<< Check Fallback uses TurnManager >>>
            // Ensure resolve was called again for TurnManager during fallback
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            // Check final state reset logs
            expect(consoleLogSpy).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');

            // Verify internal state reset using getters
            expect(gameEngineInstance.isInitialized).toBe(false);
        });
    });

    // --- Sub-Ticket 20.7: ShutdownService Resolution Failure & Fallback ---
    describe('Shutdown Service Resolution Failure (Sub-Ticket 20.7)', () => {

        it('should log error and attempt fallback cleanup when resolving ShutdownService fails', async () => {
            // --- Arrange ---
            const resolveError = new Error('Cannot resolve ShutdownService');

            // Reconfigure resolve AFTER beforeEach setup but BEFORE stop()
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.ShutdownService) throw resolveError; // Fail resolution
                // <<< Ensure TurnManager can still be resolved for fallback >>>
                if (key === tokens.ITurnManager) return mockTurnManager;
                // Provide others if needed by fallback (disposeSingletons is direct call, not resolved)
                return undefined; // Or return other mocks if needed
            });

            // Clear mocks AGAIN after reconfiguring resolve, before the Act phase
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockAppContainer.resolve.mockClear(); // Clear calls during reconfig
            mockShutdownService.runShutdownSequence.mockClear();
            mockTurnManager.stop.mockClear(); // <<< Use TurnManager mock >>>
            mockAppContainer.disposeSingletons.mockClear();
            consoleLogSpy.mockClear();

            // --- Act ---
            // stop() should handle the resolution error internally and resolve
            await expect(gameEngineInstance.stop()).resolves.toBeUndefined();

            // --- Assert ---
            // Check ShutdownService resolution attempt
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled(); // Should fail before calling
            // Check error logging
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'GameEngine: Error resolving or running ShutdownService.', // Message from stop()
                resolveError
            );
            // Check fallback logging and actions
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'GameEngine: Attempting minimal fallback cleanup after ShutdownService error...'
            );
            // <<< Check Fallback uses TurnManager >>>
            // Ensure resolve was called again for TurnManager during fallback
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            // Check final state reset logs
            expect(consoleLogSpy).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset.');

            // Verify internal state reset using getters
            expect(gameEngineInstance.isInitialized).toBe(false);
        });
    });

}); // End describe block