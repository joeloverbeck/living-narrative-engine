/*
 * @jest-environment node
 */
// src/tests/core/gameEngine.stop.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for mock structure reference
import {tokens} from '../../core/config/tokens.js';

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
// Additional types for constructor mocks
/** @typedef {import('../../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */


// --- Test Suite ---
describe('GameEngine stop()', () => {

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<ShutdownService>} */
    let mockShutdownService;
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockValidatedEventDispatcher;
    /** @type {jest.Mocked<ITurnManager>} */
    let mockTurnManager;
    /** @type {jest.Mocked<PlaytimeTracker>} */
    let mockPlaytimeTracker;
    /** @type {jest.Mocked<GamePersistenceService>} */
    let mockGamePersistenceService;
    /** @type {jest.Mocked<IDataRegistry>} */
    let mockDataRegistry;
    /** @type {jest.Mocked<EntityManager>} */
    let mockEntityManager;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {GameEngine} */
    let gameEngineInstance;
    /** @type {jest.SpyInstance} */
    let consoleInfoSpy; // To spy on console.info for specific final log messages
    /** @type {jest.SpyInstance} */
    let consoleErrorSpy;

    beforeEach(async () => {
        jest.clearAllMocks();
        if (consoleInfoSpy) consoleInfoSpy.mockRestore();
        if (consoleErrorSpy) consoleErrorSpy.mockRestore();


        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), isRunning: true}; // Mock for init result
        mockShutdownService = {runShutdownSequence: jest.fn().mockResolvedValue(undefined)};
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue({
                success: true,
                // gameLoop: mockGameLoop, // GameLoop is no longer returned by init service
                error: null,
            }),
        };
        mockValidatedEventDispatcher = {dispatchValidated: jest.fn()};
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            setCurrentTurn: jest.fn()
        };
        // Corrected PlaytimeTracker mock
        mockPlaytimeTracker = {
            getTotalPlaytime: jest.fn().mockReturnValue(0),
            reset: jest.fn(),
            startSession: jest.fn(), // Corrected: was 'start'
            endSessionAndAccumulate: jest.fn(), // Added: GameEngine.stop() calls this
            setAccumulatedPlaytime: jest.fn() // Added: for completeness
        };
        mockGamePersistenceService = {
            saveGame: jest.fn(),
            loadAndRestoreGame: jest.fn() // Added for completeness
        };
        mockDataRegistry = {
            getLoadedModManifests: jest.fn().mockReturnValue([]),
            getModDefinition: jest.fn(),
            getEntityDefinition: jest.fn() // Added for completeness (GameEngine.restoreState calls EntityManager.addComponent)
        };
        mockEntityManager = {
            clearAll: jest.fn(),
            activeEntities: new Map(),
            addComponent: jest.fn(), // Called by deprecated restoreState
            getEntityDefinition: jest.fn() // Called by GameEngine constructor indirectly
        };

        mockAppContainer = {
            resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn(),
        };

        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            if (key === tokens.EntityManager) return mockEntityManager;
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.ITurnManager) return mockTurnManager;
            if (key === tokens.ShutdownService) return mockShutdownService;
            if (key === tokens.GameLoop) return mockGameLoop;
            if (key === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;

            console.warn(`STOP_TEST_WARN: Unhandled resolution for key: ${String(key)}`);
            return undefined;
        });

        gameEngineInstance = new GameEngine({container: mockAppContainer});
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
        });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });


        try {
            mockAppContainer.resolve.mockClear(); // Clear calls from GameEngine constructor
            mockLogger.info.mockClear();
            mockEntityManager.clearAll.mockClear(); // constructor might not call this, but to be safe for startNewGame
            mockPlaytimeTracker.reset.mockClear(); // Clear calls from GameEngine constructor related logic if any (none currently)


            await gameEngineInstance.startNewGame('defaultWorld');
        } catch (error) {
            // This catch should ideally NOT be hit if constructor and startNewGame mocks are correct
            // Use the spied console.error for test visibility
            console.error(">>> UNEXPECTED Error during test setup startNewGame() call:", error);
            throw error; // Re-throw to fail the test if setup fails
        }

        // Clear mocks called during startNewGame to isolate tests for stop()
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockAppContainer.resolve.mockClear();
        mockInitializationService.runInitializationSequence.mockClear();
        mockValidatedEventDispatcher.dispatchValidated.mockClear();
        mockTurnManager.start.mockClear();
        mockEntityManager.clearAll.mockClear();
        mockPlaytimeTracker.reset.mockClear();
        mockPlaytimeTracker.startSession.mockClear();
        if (consoleInfoSpy) consoleInfoSpy.mockClear();
        if (consoleErrorSpy) consoleErrorSpy.mockClear();
    });

    afterEach(() => {
        if (consoleInfoSpy) consoleInfoSpy.mockRestore();
        if (consoleErrorSpy) consoleErrorSpy.mockRestore();
        jest.clearAllMocks();
    });

    describe('Initial State Check (Sub-Ticket 20.5)', () => {
        it('should log info and NOT call ShutdownService when engine was never initialized', async () => {
            const localMockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
            // Corrected local PlaytimeTracker mock
            const localMockPlaytimeTracker = {
                getTotalPlaytime: jest.fn().mockReturnValue(0),
                reset: jest.fn(),
                startSession: jest.fn(),
                endSessionAndAccumulate: jest.fn(),
                setAccumulatedPlaytime: jest.fn()
            };
            const localMockGamePersistenceService = {saveGame: jest.fn(), loadAndRestoreGame: jest.fn()};
            const localDataRegistry = {
                getLoadedModManifests: jest.fn().mockReturnValue([]),
                getEntityDefinition: jest.fn()
            };
            const localEntityManager = {clearAll: jest.fn(), getEntityDefinition: jest.fn()};

            const localMockContainer = {
                resolve: jest.fn((key) => {
                    if (key === tokens.ILogger) return localMockLogger;
                    if (key === tokens.PlaytimeTracker) return localMockPlaytimeTracker;
                    if (key === tokens.GamePersistenceService) return localMockGamePersistenceService;
                    if (key === tokens.IDataRegistry) return localDataRegistry;
                    if (key === tokens.EntityManager) return localEntityManager;
                    return undefined;
                }),
                register: jest.fn(), reset: jest.fn(), disposeSingletons: jest.fn(),
            };
            const uninitializedEngine = new GameEngine({container: localMockContainer});
            localMockLogger.info.mockClear(); // Clear constructor logs

            await uninitializedEngine.stop();

            expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            // Check that resolve was called for constructor deps but not for ShutdownService
            const shutdownServiceCall = localMockContainer.resolve.mock.calls.find(call => call[0] === tokens.ShutdownService);
            expect(shutdownServiceCall).toBeUndefined();
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled(); // Global mock
        });

        it('should log info and NOT call ShutdownService when engine was stopped (state reset manually)', async () => {
            // gameEngineInstance is initialized and started in beforeEach
            await gameEngineInstance.stop(); // First stop

            // Clear mocks from the first stop() call
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();
            mockAppContainer.resolve.mockClear(); // Crucial: clear resolve calls
            mockShutdownService.runShutdownSequence.mockClear();
            mockTurnManager.stop.mockClear();
            mockAppContainer.disposeSingletons.mockClear();
            mockPlaytimeTracker.endSessionAndAccumulate.mockClear();


            await gameEngineInstance.stop(); // Second call to stop()

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is not initialized. No action needed.');

            // Ensure ShutdownService was not resolved on the second call
            const shutdownServiceCall = mockAppContainer.resolve.mock.calls.find(call => call[0] === tokens.ShutdownService);
            expect(shutdownServiceCall).toBeUndefined();
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
        });
    });

    describe('Shutdown Service Delegation (Sub-Ticket 20.6)', () => {
        it('should delegate to ShutdownService and log success when runShutdownSequence resolves', async () => {
            mockShutdownService.runShutdownSequence.mockResolvedValue(undefined);
            // gameEngineInstance is initialized and started in beforeEach
            await gameEngineInstance.stop();

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1); // Called when stopping initialized engine
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Executing shutdown sequence via ShutdownService...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Shutdown sequence completed successfully via ShutdownService.');
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
            expect(gameEngineInstance.isInitialized).toBe(false);
        });

        it('should call ShutdownService, log error, and attempt fallback when runShutdownSequence rejects', async () => {
            const shutdownError = new Error('Shutdown Service Failed');
            mockShutdownService.runShutdownSequence.mockRejectedValue(shutdownError);

            await expect(gameEngineInstance.stop()).resolves.toBeUndefined(); // stop() should not reject itself

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Error resolving or running ShutdownService.', shutdownError);
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
            // ITurnManager is resolved twice if ShutdownService fails: once by ShutdownService (mocked), once by fallback
            // However, our mockAppContainer.resolve for ShutdownService might not actually call resolve for ITurnManager
            // The fallback path in GameEngine.stop explicitly calls resolve for ITurnManager.
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager); // For fallback
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1); // Called by fallback
            expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1); // Called by fallback
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
            expect(gameEngineInstance.isInitialized).toBe(false);
        });
    });

    describe('Shutdown Service Resolution Failure (Sub-Ticket 20.7)', () => {
        it('should log error and attempt fallback cleanup when resolving ShutdownService fails', async () => {
            const resolveError = new Error('Cannot resolve ShutdownService');

            // Ensure gameEngineInstance is initialized (it is from beforeEach)
            // Now, make resolve fail for ShutdownService specifically for the stop() call
            const originalResolve = mockAppContainer.resolve; // Save original complex mock
            mockAppContainer.resolve = jest.fn((key) => {
                if (key === tokens.ShutdownService) throw resolveError;
                // Delegate to original mock for other resolutions needed by stop's fallback
                if (key === tokens.ITurnManager) return mockTurnManager;
                if (key === tokens.ILogger) return mockLogger; // Should already be set in instance
                // if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker; // Not directly resolved by stop's fallback
                return originalResolve(key); // Fallback to original for other deps if any (though less likely for stop)
            });


            await expect(gameEngineInstance.stop()).resolves.toBeUndefined(); // stop() should not reject

            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService); // Attempted
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled(); // Because resolution failed
            expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Error resolving or running ShutdownService.', resolveError);
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');

            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager); // For fallback
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1); // Called by fallback
            expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1); // Called by fallback
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
            expect(gameEngineInstance.isInitialized).toBe(false);

            mockAppContainer.resolve = originalResolve; // Restore original mockAppContainer.resolve
        });
    });
});