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

    beforeEach(async () => {
        jest.clearAllMocks();
        if (consoleInfoSpy) consoleInfoSpy.mockRestore();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), isRunning: true}; // Mock for init result
        mockShutdownService = {runShutdownSequence: jest.fn().mockResolvedValue(undefined)};
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue({
                success: true, gameLoop: mockGameLoop, error: null,
            }),
        };
        mockValidatedEventDispatcher = {dispatchValidated: jest.fn()};
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            setCurrentTurn: jest.fn()
        };
        mockPlaytimeTracker = {getTotalPlaytime: jest.fn(), reset: jest.fn(), start: jest.fn(), stop: jest.fn()};
        mockGamePersistenceService = {saveGame: jest.fn()};
        mockDataRegistry = {getLoadedModManifests: jest.fn(), getModDefinition: jest.fn()};
        mockEntityManager = {
            clearAll: jest.fn(),
            activeEntities: new Map(),
            addComponent: jest.fn(),
            getEntityDefinition: jest.fn()
        };

        mockAppContainer = {
            resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn(),
        };

        mockAppContainer.resolve.mockImplementation((key) => {
            // Constructor dependencies
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            if (key === tokens.EntityManager) return mockEntityManager;
            // startNewGame dependencies
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.ITurnManager) return mockTurnManager;
            // stop dependencies
            if (key === tokens.ShutdownService) return mockShutdownService;
            // Other potential resolutions (though GameLoop isn't directly resolved by GameEngine)
            if (key === tokens.GameLoop) return mockGameLoop;
            if (key === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;

            console.warn(`STOP_TEST_WARN: Unhandled resolution for key: ${String(key)}`);
            return undefined;
        });

        gameEngineInstance = new GameEngine({container: mockAppContainer});
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
        }); // Spy on console.info

        // Initialize the engine for tests that require an active state
        try {
            // Crucially, clear mocks that were called by the constructor before startNewGame
            mockAppContainer.resolve.mockClear();
            mockLogger.info.mockClear(); // Clear constructor logs like "GamePersistenceService resolved..."
            mockEntityManager.clearAll.mockClear();

            await gameEngineInstance.startNewGame('defaultWorld'); // <<< CORRECTED METHOD NAME
        } catch (error) {
            // This catch should ideally NOT be hit if constructor and startNewGame mocks are correct
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
        mockEntityManager.clearAll.mockClear(); // It's called again by startNewGame
        if (consoleInfoSpy) consoleInfoSpy.mockClear();
    });

    afterEach(() => {
        if (consoleInfoSpy) consoleInfoSpy.mockRestore();
        jest.clearAllMocks();
    });

    describe('Initial State Check (Sub-Ticket 20.5)', () => {
        it('should log info and NOT call ShutdownService when engine was never initialized', async () => {
            const localMockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
            const localMockPlaytimeTracker = {
                start: jest.fn(),
                stop: jest.fn(),
                getTotalPlaytime: jest.fn(),
                reset: jest.fn()
            };
            const localMockGamePersistenceService = {saveGame: jest.fn()};
            const localDataRegistry = {getLoadedModManifests: jest.fn()};
            const localEntityManager = {clearAll: jest.fn()};

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
            localMockLogger.info.mockClear();

            await uninitializedEngine.stop();

            expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(localMockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            expect(localMockContainer.resolve).not.toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled(); // Global mock
        });

        it('should log info and NOT call ShutdownService when engine was stopped (state reset manually)', async () => {
            await gameEngineInstance.stop(); // First stop (engine should be initialized from beforeEach)

            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockAppContainer.resolve.mockClear();
            mockShutdownService.runShutdownSequence.mockClear();
            mockAppContainer.disposeSingletons.mockClear();
            mockTurnManager.stop.mockClear();
            if (consoleInfoSpy) consoleInfoSpy.mockClear();

            await gameEngineInstance.stop(); // Second call

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.ShutdownService);
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
        });
    });

    describe('Shutdown Service Delegation (Sub-Ticket 20.6)', () => {
        it('should delegate to ShutdownService and log success when runShutdownSequence resolves', async () => {
            mockShutdownService.runShutdownSequence.mockResolvedValue(undefined);
            // This gameEngineInstance is initialized from beforeEach
            await gameEngineInstance.stop();

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stop requested.');
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
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService); // Attempted to resolve ShutdownService
            expect(mockShutdownService.runShutdownSequence).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Error resolving or running ShutdownService.', shutdownError);
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager); // For fallback
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
            expect(gameEngineInstance.isInitialized).toBe(false);
        });
    });

    describe('Shutdown Service Resolution Failure (Sub-Ticket 20.7)', () => {
        it('should log error and attempt fallback cleanup when resolving ShutdownService fails', async () => {
            const resolveError = new Error('Cannot resolve ShutdownService');

            // Reconfigure resolve AFTER gameEngineInstance is created and initialized
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger; // Logger is already set in gameEngineInstance
                if (key === tokens.ShutdownService) throw resolveError;
                if (key === tokens.ITurnManager) return mockTurnManager; // For fallback
                // Provide other mocks if needed by other parts of gameEngineInstance for this test
                if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
                if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
                if (key === tokens.IDataRegistry) return mockDataRegistry;
                if (key === tokens.EntityManager) return mockEntityManager;
                return undefined;
            });
            // Important: Clear any calls made to resolve during this mock re-configuration itself, if any.
            mockAppContainer.resolve.mockClear();


            await expect(gameEngineInstance.stop()).resolves.toBeUndefined();

            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ShutdownService); // Attempted
            expect(mockShutdownService.runShutdownSequence).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Error resolving or running ShutdownService.', resolveError);
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager); // For fallback
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
            expect(gameEngineInstance.isInitialized).toBe(false);
        });
    });
});