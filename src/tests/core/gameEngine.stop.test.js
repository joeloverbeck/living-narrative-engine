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
// Updated to use IEntityManager for the type hint of the mock
/** @typedef {import('../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
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
    /** @type {jest.Mocked<IEntityManager>} */ // Updated mock type
    let mockEntityManager;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {GameEngine} */
    let gameEngineInstance;
    /** @type {jest.SpyInstance} */
    let consoleInfoSpy;
    /** @type {jest.SpyInstance} */
    let consoleErrorSpy;

    beforeEach(async () => {
        jest.clearAllMocks();
        if (consoleInfoSpy) consoleInfoSpy.mockRestore();
        if (consoleErrorSpy) consoleErrorSpy.mockRestore();


        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), isRunning: true};
        mockShutdownService = {runShutdownSequence: jest.fn().mockResolvedValue(undefined)};
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue({
                success: true,
                error: null,
            }),
        };
        mockValidatedEventDispatcher = {dispatchValidated: jest.fn()};
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            setCurrentTurn: jest.fn()
        };
        mockPlaytimeTracker = {
            getTotalPlaytime: jest.fn().mockReturnValue(0),
            reset: jest.fn(),
            startSession: jest.fn(),
            endSessionAndAccumulate: jest.fn(),
            setAccumulatedPlaytime: jest.fn()
        };
        mockGamePersistenceService = {
            saveGame: jest.fn(),
            loadAndRestoreGame: jest.fn()
        };
        mockDataRegistry = {
            getLoadedModManifests: jest.fn().mockReturnValue([]),
            getModDefinition: jest.fn(),
            getEntityDefinition: jest.fn()
        };
        mockEntityManager = { // This mock will be returned for IEntityManager
            clearAll: jest.fn(),
            activeEntities: new Map(),
            addComponent: jest.fn(),
            getEntityDefinition: jest.fn() // Though not directly used by constructor, good to have
        };

        mockAppContainer = {
            resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn(),
        };

        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            // VVVVVV MODIFIED VVVVVV
            if (key === tokens.IEntityManager) return mockEntityManager; // GameEngine constructor now asks for IEntityManager
            // ^^^^^^ MODIFIED ^^^^^^
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.ITurnManager) return mockTurnManager;
            if (key === tokens.ShutdownService) return mockShutdownService;
            if (key === tokens.GameLoop) return mockGameLoop; // Though GameLoop might be obsolete as direct dep
            if (key === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;

            console.warn(`STOP_TEST_WARN: Unhandled resolution for key: ${String(key)}`);
            return undefined;
        });

        // This instantiation might throw if critical dependencies (like ILogger, IEntityManager) are not mocked above correctly
        gameEngineInstance = new GameEngine({container: mockAppContainer});

        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
        });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });


        // --- Initialize and Start the Engine for tests that need an active engine ---
        // Clear mocks from constructor before calling startNewGame
        mockAppContainer.resolve.mockClear(); // Clear calls like ILogger, IEntityManager from constructor
        mockLogger.info.mockClear();
        // mockEntityManager.clearAll() // Not called by constructor directly
        // mockPlaytimeTracker.reset() // Not called by constructor directly

        try {
            await gameEngineInstance.startNewGame('defaultWorld');
        } catch (error) {
            console.error(">>> UNEXPECTED Error during test setup startNewGame() call:", error);
            throw error;
        }

        // Clear mocks called during startNewGame to isolate tests for stop()
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockAppContainer.resolve.mockClear(); // Clear calls from startNewGame (like InitializationService, ITurnManager)
        mockInitializationService.runInitializationSequence.mockClear();
        if (mockValidatedEventDispatcher && mockValidatedEventDispatcher.dispatchValidated) { // Ensure it's defined
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
        }
        mockTurnManager.start.mockClear();
        mockEntityManager.clearAll.mockClear(); // Specifically clear this after startNewGame
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
            const localEntityManager = {clearAll: jest.fn(), getEntityDefinition: jest.fn()}; // Mock for IEntityManager

            const localMockContainer = {
                resolve: jest.fn((key) => {
                    if (key === tokens.ILogger) return localMockLogger;
                    if (key === tokens.PlaytimeTracker) return localMockPlaytimeTracker;
                    if (key === tokens.GamePersistenceService) return localMockGamePersistenceService;
                    // if (key === tokens.IDataRegistry) return localDataRegistry; // Not strictly needed for constructor
                    if (key === tokens.IEntityManager) return localEntityManager; // Provide for IEntityManager
                    // console.warn(`LOCAL_MOCK_WARN: Unhandled resolution for key: ${String(key)}`);
                    return undefined;
                }),
                register: jest.fn(), reset: jest.fn(), disposeSingletons: jest.fn(),
            };
            const uninitializedEngine = new GameEngine({container: localMockContainer});
            localMockLogger.info.mockClear();

            await uninitializedEngine.stop();

            expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            const shutdownServiceCall = localMockContainer.resolve.mock.calls.find(call => call[0] === tokens.ShutdownService);
            expect(shutdownServiceCall).toBeUndefined();
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled(); // Global mock
        });

        it('should log info and NOT call ShutdownService when engine was stopped (state reset manually)', async () => {
            await gameEngineInstance.stop();

            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockLogger.debug.mockClear();
            mockAppContainer.resolve.mockClear();
            mockShutdownService.runShutdownSequence.mockClear();
            mockTurnManager.stop.mockClear();
            if (mockAppContainer.disposeSingletons) mockAppContainer.disposeSingletons.mockClear();
            mockPlaytimeTracker.endSessionAndAccumulate.mockClear();


            await gameEngineInstance.stop();

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is not initialized. No action needed.');

            const shutdownServiceCall = mockAppContainer.resolve.mock.calls.find(call => call[0] === tokens.ShutdownService);
            expect(shutdownServiceCall).toBeUndefined();
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
        });
    });

    describe('Shutdown Service Delegation (Sub-Ticket 20.6)', () => {
        it('should delegate to ShutdownService and log success when runShutdownSequence resolves', async () => {
            mockShutdownService.runShutdownSequence.mockResolvedValue(undefined);
            await gameEngineInstance.stop();

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
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

            await expect(gameEngineInstance.stop()).resolves.toBeUndefined();

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Error resolving or running ShutdownService.', shutdownError);
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1); // From fallback (already called once in setup's stop if not cleared)
            if (mockAppContainer.disposeSingletons) expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
            expect(gameEngineInstance.isInitialized).toBe(false);
        });
    });

    describe('Shutdown Service Resolution Failure (Sub-Ticket 20.7)', () => {
        it('should log error and attempt fallback cleanup when resolving ShutdownService fails', async () => {
            const resolveError = new Error('Cannot resolve ShutdownService');

            // Save the original mock implementation from beforeEach
            const originalGlobalResolve = mockAppContainer.resolve.getMockImplementation();

            mockAppContainer.resolve = jest.fn((key) => {
                if (key === tokens.ShutdownService) throw resolveError;
                // Delegate to the original for other necessary resolutions by stop() or its fallbacks
                // e.g., ITurnManager for fallback, or ILogger if it were re-resolved (it's not).
                // The global mock already handles ILogger, PlaytimeTracker, IEntityManager for constructor.
                if (originalGlobalResolve) {
                    return originalGlobalResolve(key);
                }
                // Fallback if originalGlobalResolve is somehow undefined (should not happen)
                if (key === tokens.ITurnManager) return mockTurnManager;
                if (key === tokens.ILogger) return mockLogger;
                return undefined;
            });


            await expect(gameEngineInstance.stop()).resolves.toBeUndefined();

            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Error resolving or running ShutdownService.', resolveError);
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');

            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            if (mockAppContainer.disposeSingletons) expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
            expect(gameEngineInstance.isInitialized).toBe(false);

            // Restore the original resolve mock if it was saved
            if (originalGlobalResolve) {
                mockAppContainer.resolve.mockImplementation(originalGlobalResolve);
            }
        });
    });
});