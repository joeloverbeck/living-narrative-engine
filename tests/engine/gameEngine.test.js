// tests/engine/gameEngine.test.js

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import GameEngine from '../../src/engine/gameEngine.js';
import {tokens} from '../../src/config/tokens.js';
import {
    GAME_LOADED_ID,
    GAME_SAVED_ID,
    NEW_GAME_STARTED_ID,
    LOADED_GAME_STARTED_ID,
    GAME_STOPPED_ID,
    // --- Import new UI Event IDs ---
    ENGINE_INITIALIZING_UI,
    ENGINE_READY_UI,
    ENGINE_OPERATION_IN_PROGRESS_UI,
    ENGINE_OPERATION_FAILED_UI,
    ENGINE_STOPPED_UI,
    ENGINE_MESSAGE_DISPLAY_REQUESTED,
    REQUEST_SHOW_SAVE_GAME_UI,
    REQUEST_SHOW_LOAD_GAME_UI,
    CANNOT_SAVE_GAME_INFO
} from "../../src/constants/eventIds.js";

// --- JSDoc Type Imports for Mocks ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */ // Corrected path
/** @typedef {import('../../src/config/appContainer.js').default} AppContainer */ // Corrected path
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */ // Corrected path
/** @typedef {import('../../src/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */ // Corrected path
/** @typedef {import('../../src/services/gamePersistenceService.js').default} GamePersistenceService */ // Corrected path
/** @typedef {import('../../src/services/playtimeTracker.js').default} PlaytimeTracker */ // Corrected path
/** @typedef {import('../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */ // Corrected path
/** @typedef {import('../../src/initializers/services/initializationService.js').default} InitializationService */ // Corrected path for consistency
/** @typedef {import('../../src/interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */ // Corrected path


describe('GameEngine', () => {
    let mockContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<EntityManager>} */
    let mockEntityManager;
    /** @type {jest.Mocked<ITurnManager>} */
    let mockTurnManager;
    /** @type {jest.Mocked<GamePersistenceService>} */
    let mockGamePersistenceService;
    /** @type {jest.Mocked<PlaytimeTracker>} */
    let mockPlaytimeTracker;
    /** @type {jest.Mocked<ISafeEventDispatcher>} */
    let mockSafeEventDispatcher;
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;

    let gameEngine; // Instance of GameEngine

    const MOCK_WORLD_NAME = 'TestWorld';

    const setupMockContainer = () => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
        };
        mockEntityManager = {clearAll: jest.fn(), getActiveEntities: jest.fn().mockReturnValue([])};
        mockTurnManager = {start: jest.fn(), stop: jest.fn(), nextTurn: jest.fn()};
        mockGamePersistenceService = {
            saveGame: jest.fn(),
            loadAndRestoreGame: jest.fn(),
            isSavingAllowed: jest.fn(),
        };
        mockPlaytimeTracker = {
            reset: jest.fn(),
            startSession: jest.fn(),
            endSessionAndAccumulate: jest.fn(),
            getAccumulatedPlaytime: jest.fn().mockReturnValue(0),
            setAccumulatedPlaytime: jest.fn(),
        };
        // Ensure dispatchSafely is always a Jest mock function
        mockSafeEventDispatcher = {dispatchSafely: jest.fn().mockResolvedValue(undefined)};
        mockInitializationService = {runInitializationSequence: jest.fn()};

        mockContainer = {
            resolve: jest.fn(token => {
                switch (token) {
                    case tokens.ILogger:
                        return mockLogger;
                    // DomUiFacade is no longer resolved by GameEngine
                    // case tokens.DomUiFacade:
                    //     return mockDomUiFacade;
                    // WorldLoader is no longer resolved by GameEngine
                    // case tokens.WorldLoader:
                    //     return mockWorldLoader;
                    case tokens.IEntityManager:
                        return mockEntityManager;
                    case tokens.ITurnManager:
                        return mockTurnManager;
                    case tokens.GamePersistenceService:
                        return mockGamePersistenceService;
                    case tokens.PlaytimeTracker:
                        return mockPlaytimeTracker;
                    case tokens.ISafeEventDispatcher:
                        return mockSafeEventDispatcher;
                    case tokens.IInitializationService:
                        return mockInitializationService;
                    default:
                        // Ensure this error message is helpful. Using token.description for symbol.
                        throw new Error(`GameEngine.test.js: Unmocked token: ${token?.toString()}`);
                }
            })
        };
    };

    beforeEach(() => {
        setupMockContainer();
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should instantiate and resolve all core services successfully', () => {
            new GameEngine({container: mockContainer});
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Constructor called.');
            // expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomUiFacade); // REMOVED
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.GamePersistenceService);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.PlaytimeTracker);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ISafeEventDispatcher);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Core services resolved.');
        });

        it('should throw an error if ILogger cannot be resolved', () => {
            // Make only ILogger fail, other mocks should still be available if needed by constructor before throw
            jest.spyOn(mockContainer, 'resolve').mockImplementation(token => {
                if (token === tokens.ILogger) throw new Error("Logger failed to resolve");
                // Fallback to the original broader mock if other services were to be resolved before logger
                // but GameEngine resolves logger first.
                throw new Error(`Unexpected token resolution attempt: ${token?.toString()}`);
            });

            expect(() => new GameEngine({container: mockContainer})).toThrow("GameEngine requires a logger.");
            expect(console.error).toHaveBeenCalledWith("GameEngine: CRITICAL - Logger not resolved.", expect.any(Error));
        });

        it('should throw an error and log if any other core service fails to resolve', () => {
            const resolutionError = new Error("EntityManager failed to resolve");
            // Ensure logger resolves, but another service fails
            jest.spyOn(mockContainer, 'resolve').mockImplementation(token => {
                if (token === tokens.ILogger) return mockLogger;
                if (token === tokens.IEntityManager) throw resolutionError;
                if (token === tokens.ITurnManager) return mockTurnManager;
                if (token === tokens.GamePersistenceService) return mockGamePersistenceService;
                if (token === tokens.PlaytimeTracker) return mockPlaytimeTracker;
                if (token === tokens.ISafeEventDispatcher) return mockSafeEventDispatcher;
                // Potentially other services could be added here if constructor resolves more things
                throw new Error(`GameEngine.test.js - Constructor Core Service: Unmocked token during specific failure test: ${token?.toString()}`);
            });

            expect(() => new GameEngine({container: mockContainer}))
                .toThrow(`GameEngine: Failed to resolve core services. ${resolutionError.message}`);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${resolutionError.message}`,
                resolutionError
            );
        });
    });

    describe('startNewGame', () => {
        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
        });

        it('should successfully start a new game', async () => {
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_INITIALIZING_UI, {worldName: MOCK_WORLD_NAME});
            expect(mockEntityManager.clearAll).toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).toHaveBeenCalled();
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IInitializationService);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(MOCK_WORLD_NAME);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(NEW_GAME_STARTED_ID, {worldName: MOCK_WORLD_NAME});
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_READY_UI, {
                activeWorld: MOCK_WORLD_NAME,
                message: 'Enter command...'
            });
            expect(mockTurnManager.start).toHaveBeenCalled();

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(true);
            expect(status.isLoopRunning).toBe(true);
            expect(status.activeWorld).toBe(MOCK_WORLD_NAME);
        });

        it('should stop an existing game if already initialized', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValueOnce({success: true});
            await gameEngine.startNewGame("InitialWorld");

            // Clear mocks related to the stop() call for the *next* phase of the test
            mockPlaytimeTracker.endSessionAndAccumulate.mockClear();
            mockTurnManager.stop.mockClear();
            // mockSafeEventDispatcher is tricky if we want to count specific event calls.
            // Let's count calls for GAME_STOPPED_ID and ENGINE_STOPPED_UI specifically.
            // For simplicity, we'll check they were called *after* the second startNewGame was invoked.

            mockInitializationService.runInitializationSequence.mockResolvedValueOnce({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine.startNewGame: Engine already initialized. Stopping existing game before starting new.');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_STOPPED_ID, {});
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_STOPPED_UI, {inputDisabledMessage: 'Game stopped.'});
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenLastCalledWith(ENGINE_READY_UI, {
                activeWorld: MOCK_WORLD_NAME,
                message: 'Enter command...'
            });
        });

        it('should handle InitializationService failure', async () => {
            const initError = new Error('Initialization failed via service');
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: false, error: initError});

            await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(initError);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_OPERATION_FAILED_UI, {
                errorMessage: `Initialization failed: ${initError.message}`,
                errorTitle: "Initialization Error"
            });
            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
        });

        it('should handle general errors during start-up and dispatch failure event', async () => {
            const startupError = new Error('TurnManager failed to start');
            mockTurnManager.start.mockRejectedValue(startupError);

            await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(startupError);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_OPERATION_FAILED_UI, {
                errorMessage: startupError.message,
                errorTitle: "Error Starting Game"
            });
            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
        });
    });

    describe('stop', () => {
        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
        });

        it('should successfully stop a running game', async () => {
            // Simulate running state
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            // Clear mocks from startNewGame for focused "stop" testing
            mockPlaytimeTracker.endSessionAndAccumulate.mockClear();
            mockTurnManager.stop.mockClear();
            mockSafeEventDispatcher.dispatchSafely.mockClear(); // Clear all previous dispatches
            mockLogger.info.mockClear();


            await gameEngine.stop();

            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_STOPPED_UI, {inputDisabledMessage: 'Game stopped.'});
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_STOPPED_ID, {});
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stopping...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stopped.');

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
            expect(status.activeWorld).toBeNull();
        });
    });

    describe('triggerManualSave', () => {
        const SAVE_NAME = 'MySaveFile';

        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
        });

        it('should successfully trigger a manual save and dispatch messages', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            const saveResult = {success: true, filePath: 'path/to/save.sav'};
            mockGamePersistenceService.saveGame.mockResolvedValue(saveResult);

            const result = await gameEngine.triggerManualSave(SAVE_NAME);

            expect(mockGamePersistenceService.saveGame).toHaveBeenCalledWith(SAVE_NAME, true);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_SAVED_ID, {
                saveName: SAVE_NAME,
                path: saveResult.filePath,
                type: 'manual'
            });
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: `Game "${SAVE_NAME}" saved successfully.`,
                type: 'info'
            });
            expect(result).toEqual(saveResult);
        });

        it('should dispatch error if engine is not initialized', async () => {
            const result = await gameEngine.triggerManualSave(SAVE_NAME);
            const expectedErrorMsg = 'Game engine is not initialized. Cannot save game.';

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: expectedErrorMsg,
                type: 'error'
            });
            expect(result).toEqual({success: false, error: expectedErrorMsg});
        });

        it('should dispatch error if gamePersistenceService.saveGame fails', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            const saveError = {success: false, error: 'Disk full'};
            mockGamePersistenceService.saveGame.mockResolvedValue(saveError);

            const result = await gameEngine.triggerManualSave(SAVE_NAME);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: `Manual save failed for "${SAVE_NAME}". Error: ${saveError.error}`,
                type: 'error'
            });
            expect(result).toEqual(saveError);
        });
    });

    describe('loadGame', () => {
        const SAVE_ID = 'savegame-001.sav';
        const mockSaveData = {metadata: {gameTitle: 'My Loaded Game Adventure'}};

        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
            // Spy on gameEngine.stop directly if it's complex, or ensure mocks are clean.
            // For this refactor, stop() itself dispatches events.
        });

        it('should successfully load a game and dispatch UI events', async () => {
            mockGamePersistenceService.loadAndRestoreGame.mockResolvedValue({success: true, data: mockSaveData});
            // Mock the stop method to simplify call counting for loadGame specific dispatches
            const stopSpy = jest.spyOn(gameEngine, 'stop').mockResolvedValue(undefined);


            const result = await gameEngine.loadGame(SAVE_ID);

            expect(stopSpy).toHaveBeenCalled();
            expect(mockEntityManager.clearAll).toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).toHaveBeenCalled();

            const shortSaveName = SAVE_ID.split(/[/\\]/).pop() || SAVE_ID;
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_OPERATION_IN_PROGRESS_UI, {
                titleMessage: `Loading ${shortSaveName}...`,
                inputDisabledMessage: `Loading ${shortSaveName}...`
            });

            expect(mockGamePersistenceService.loadAndRestoreGame).toHaveBeenCalledWith(SAVE_ID);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_LOADED_ID, {saveIdentifier: SAVE_ID});
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(LOADED_GAME_STARTED_ID, {
                saveIdentifier: SAVE_ID,
                worldName: mockSaveData.metadata.gameTitle
            });
            expect(mockTurnManager.start).toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_READY_UI, {
                activeWorld: mockSaveData.metadata.gameTitle,
                message: 'Enter command...'
            });
            expect(result).toEqual({success: true, data: mockSaveData});
            stopSpy.mockRestore();
        });

        it('should handle failure from gamePersistenceService.loadAndRestoreGame and dispatch UI event', async () => {
            const loadErrorMsg = 'Failed to read save file.';
            mockGamePersistenceService.loadAndRestoreGame.mockResolvedValue({
                success: false,
                error: loadErrorMsg,
                data: null
            });
            const stopSpy = jest.spyOn(gameEngine, 'stop').mockResolvedValue(undefined);


            const result = await gameEngine.loadGame(SAVE_ID);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_OPERATION_FAILED_UI, {
                errorMessage: expect.stringContaining(loadErrorMsg),
                errorTitle: "Load Failed"
            });
            expect(result.success).toBe(false);
            stopSpy.mockRestore();
        });
    });

    describe('showSaveGameUI', () => {
        beforeEach(() => {
            // Ensure a fresh GameEngine instance for each test in this describe block
            setupMockContainer(); // Re-setup mocks to ensure clean state for mockContainer.resolve
            gameEngine = new GameEngine({container: mockContainer});
        });

        it('should dispatch REQUEST_SHOW_SAVE_GAME_UI if saving is allowed', async () => {
            mockGamePersistenceService.isSavingAllowed.mockReturnValue(true);
            // Simulate initialized engine for isSavingAllowed check
            // gameEngine internal state #isEngineInitialized needs to be true.
            // Easiest way is to simulate a successful start.
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);
            // Clear dispatcher mock from startNewGame calls
            mockSafeEventDispatcher.dispatchSafely.mockClear();


            await gameEngine.showSaveGameUI();

            expect(mockGamePersistenceService.isSavingAllowed).toHaveBeenCalledWith(true);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(REQUEST_SHOW_SAVE_GAME_UI);
        });

        it('should dispatch CANNOT_SAVE_GAME_INFO if saving is not allowed', async () => {
            mockGamePersistenceService.isSavingAllowed.mockReturnValue(false);
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);
            mockSafeEventDispatcher.dispatchSafely.mockClear();

            await gameEngine.showSaveGameUI();

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(CANNOT_SAVE_GAME_INFO);
        });

        it('should dispatch message if GamePersistenceService is unavailable', async () => {
            // Create a specialized resolver for this test case
            const specializedResolve = jest.fn(token => {
                if (token === tokens.GamePersistenceService) return null; // Special case: GPS is unavailable
                // For all other tokens, delegate to the behavior of the default resolver from setupMockContainer
                // using the currently scoped mock objects (mockLogger, mockSafeEventDispatcher, etc.)
                switch (token) {
                    case tokens.ILogger:
                        return mockLogger;
                    case tokens.IEntityManager:
                        return mockEntityManager;
                    case tokens.ITurnManager:
                        return mockTurnManager;
                    case tokens.PlaytimeTracker:
                        return mockPlaytimeTracker;
                    case tokens.ISafeEventDispatcher:
                        return mockSafeEventDispatcher;
                    case tokens.IInitializationService:
                        return mockInitializationService;
                    default:
                        // This ensures that if GameEngine tries to resolve something unexpected, the test clearly fails.
                        throw new Error(`Specialized resolver for GPS unavailable test: Unmocked token: ${token?.toString()}`);
                }
            });

            // Assign the specialized resolver to the mockContainer for this test
            mockContainer.resolve = specializedResolve;

            // Re-instantiate gameEngine with this modified container
            gameEngine = new GameEngine({container: mockContainer});

            await gameEngine.showSaveGameUI();

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: "Cannot open save menu: persistence service error.",
                type: 'error'
            });
            // Logger error is for GameEngine internal logging, which should still happen
            expect(mockLogger.error).toHaveBeenCalledWith("GameEngine.showSaveGameUI: GamePersistenceService not available. Cannot determine if saving is allowed or show UI.");
        });
    });

    describe('showLoadGameUI', () => {
        beforeEach(() => {
            setupMockContainer(); // Re-setup mocks
            gameEngine = new GameEngine({container: mockContainer});
        });

        it('should dispatch REQUEST_SHOW_LOAD_GAME_UI if persistence service is available', async () => {
            // Assuming GamePersistenceService is available by default from setupMockContainer
            await gameEngine.showLoadGameUI();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(REQUEST_SHOW_LOAD_GAME_UI);
        });

        it('should dispatch message if GamePersistenceService is unavailable', async () => {
            // Create a specialized resolver for this test case
            const specializedResolve = jest.fn(token => {
                if (token === tokens.GamePersistenceService) return null; // Special case: GPS is unavailable
                switch (token) {
                    case tokens.ILogger:
                        return mockLogger;
                    case tokens.IEntityManager:
                        return mockEntityManager;
                    case tokens.ITurnManager:
                        return mockTurnManager;
                    case tokens.PlaytimeTracker:
                        return mockPlaytimeTracker;
                    case tokens.ISafeEventDispatcher:
                        return mockSafeEventDispatcher;
                    case tokens.IInitializationService:
                        return mockInitializationService;
                    default:
                        throw new Error(`Specialized resolver for GPS unavailable test: Unmocked token: ${token?.toString()}`);
                }
            });

            mockContainer.resolve = specializedResolve;
            gameEngine = new GameEngine({container: mockContainer});

            await gameEngine.showLoadGameUI();

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: "Cannot open load menu: persistence service error.",
                type: 'error'
            });
            expect(mockLogger.error).toHaveBeenCalledWith("GameEngine.showLoadGameUI: GamePersistenceService not available. Load Game UI might not function correctly.");
        });
    });

    describe('getEngineStatus', () => {
        // These tests should remain largely the same as they test internal state,
        // not UI interactions.
        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
        });

        it('should return initial status correctly', () => {
            const status = gameEngine.getEngineStatus();
            expect(status).toEqual({
                isInitialized: false,
                isLoopRunning: false,
                activeWorld: null,
            });
        });
    });
});