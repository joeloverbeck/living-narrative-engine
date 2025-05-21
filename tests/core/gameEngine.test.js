// src/tests/core/gameEngine.test.js

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import GameEngine from '../../src/engine/gameEngine.js';
import {tokens} from '../../src/config/tokens.js'; // Assuming tokens are accessible for testing
import {
    GAME_LOADED_ID,
    GAME_SAVED_ID,
    NEW_GAME_STARTED_ID,
    LOADED_GAME_STARTED_ID,
    GAME_STOPPED_ID
} from "../../src/constants/eventIds.js";

// --- JSDoc Type Imports for Mocks ---
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./config/appContainer.js').default} AppContainer */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('./interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../domUI/domUiFacade.js').DomUiFacade} DomUiFacade */
/** @typedef {import('./initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('./loaders/worldLoader.js').default} WorldLoader */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */


describe('GameEngine', () => {
    let mockContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<DomUiFacade>} */
    let mockDomUiFacade;
    /** @type {jest.Mocked<WorldLoader>} */
    let mockWorldLoader;
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
        mockDomUiFacade = {
            title: {set: jest.fn()},
            input: {setEnabled: jest.fn()},
            messages: {render: jest.fn()},
            saveGame: {show: jest.fn()},
            loadGame: {show: jest.fn()},
        };

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
        };
        mockWorldLoader = {load: jest.fn()};
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
        mockSafeEventDispatcher = {dispatchSafely: jest.fn().mockResolvedValue(undefined)}; // Default to resolved
        mockInitializationService = {runInitializationSequence: jest.fn()};

        mockContainer = {
            resolve: jest.fn(token => {
                switch (token) {
                    case tokens.ILogger:
                        return mockLogger;
                    case tokens.DomUiFacade:
                        return mockDomUiFacade;
                    case tokens.WorldLoader:
                        return mockWorldLoader;
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
                    case tokens.InitializationService:
                        return mockInitializationService;
                    default:
                        throw new Error(`GameEngine.test.js: Unmocked token: ${token?.toString()}`);
                }
            })
        };
    };

    beforeEach(() => {
        setupMockContainer();
        // Spy on console.error for critical constructor failures
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
        // GameEngine is instantiated per test or group as needed, typically in describe/it blocks
        // to ensure clean state, or a helper function to initialize it.
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should instantiate and resolve all core services successfully', () => {
            new GameEngine({container: mockContainer}); // Instantiation
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Constructor called.');
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomUiFacade);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WorldLoader);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.GamePersistenceService);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.PlaytimeTracker);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ISafeEventDispatcher);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Core services resolved.');
        });

        it('should throw an error if ILogger cannot be resolved', () => {
            mockContainer.resolve.mockImplementation(token => {
                if (token === tokens.ILogger) throw new Error("Logger failed to resolve");
                return undefined;
            });
            expect(() => new GameEngine({container: mockContainer})).toThrow("GameEngine requires a logger.");
            expect(console.error).toHaveBeenCalledWith("GameEngine: CRITICAL - Logger not resolved.", expect.any(Error));
        });

        it('should throw an error and log if any other core service fails to resolve', () => {
            const resolutionError = new Error("DomUiFacade failed to resolve");
            mockContainer.resolve.mockImplementation(token => {
                if (token === tokens.ILogger) return mockLogger;
                if (token === tokens.DomUiFacade) throw resolutionError;
                return {}; // generic mock
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
            // Default successful initialization
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
        });

        it('should successfully start a new game', async () => {
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            expect(mockDomUiFacade.title.set).toHaveBeenCalledWith(`Initializing ${MOCK_WORLD_NAME}...`);
            expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(false, `Initializing ${MOCK_WORLD_NAME}...`);
            expect(mockEntityManager.clearAll).toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).toHaveBeenCalled();
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(MOCK_WORLD_NAME);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(NEW_GAME_STARTED_ID, {worldName: MOCK_WORLD_NAME});
            expect(mockDomUiFacade.title.set).toHaveBeenCalledWith(MOCK_WORLD_NAME);
            expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(true, 'Enter command...');
            expect(mockTurnManager.start).toHaveBeenCalled();

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(true);
            expect(status.isLoopRunning).toBe(true);
            expect(status.activeWorld).toBe(MOCK_WORLD_NAME);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Starting new game with world "TestWorld"...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Engine initialized and new game started (post-InitializationService).');
        });

        it('should stop an existing game if already initialized', async () => {
            // gameEngine is already instantiated in beforeEach of this describe block.
            // All mocks are fresh from the beforeEach setup.

            // Call 1 (to set state to initialized)
            mockInitializationService.runInitializationSequence.mockResolvedValueOnce({success: true});
            await gameEngine.startNewGame("InitialWorld");

            // Before the second call to startNewGame, ensure the mocks that stop() will call are clear
            // ONLY if their previous calls (e.g. from the first startNewGame) are not relevant to this specific assertion.
            // For instance, playtimeTracker.reset() is called by startNewGame directly, not stop().
            // We are interested in calls made by the *internal* stop() call.
            // Let's clear specific mocks that `stop` interacts with if they might have been called by the first `startNewGame`
            // in a way that would interfere with `toHaveBeenCalledTimes(1)` for the `stop` call.
            // However, `endSessionAndAccumulate` and `turnManager.stop` are primarily called by `stop()`.
            // So, their call count should be 0 before the relevant `stop()` is invoked.

            // To be absolutely sure, let's re-fetch the mocks that gameEngine holds,
            // though `setupMockContainer` already provides fresh mocks for each test via `beforeEach`.
            // The main thing is NOT to re-instantiate gameEngine.

            // Call 2 (the one under test for the 'already initialized' branch)
            mockInitializationService.runInitializationSequence.mockResolvedValueOnce({success: true}); // For the second call
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine.startNewGame: Engine already initialized. Stopping existing game before starting new.');

            // Check if stop's effects occurred (these are called by the stop() method)
            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_STOPPED_ID, {});

            // And then ensure the new game started correctly
            expect(mockInitializationService.runInitializationSequence).toHaveBeenLastCalledWith(MOCK_WORLD_NAME);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenLastCalledWith(NEW_GAME_STARTED_ID, {worldName: MOCK_WORLD_NAME});
            expect(gameEngine.getEngineStatus().activeWorld).toBe(MOCK_WORLD_NAME);
        });

        it('should handle InitializationService failure', async () => {
            const initError = new Error('Initialization failed via service');
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: false, error: initError});

            await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(initError);

            expect(mockLogger.error).toHaveBeenCalledWith(`GameEngine: InitializationService failed for world "${MOCK_WORLD_NAME}". Error: ${initError.message}`, initError);
            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith(`Initialization failed: ${initError.message}`, 'fatal');
            expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(false, 'Error initializing game.');
            expect(mockDomUiFacade.title.set).toHaveBeenCalledWith("Initialization Error");

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
        });

        it('should handle failure if InitializationService.runInitializationSequence returns success:false without an error object', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: false}); // No error object

            await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow('Unknown initialization failure from InitializationService.');

            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameEngine: InitializationService failed for world "${MOCK_WORLD_NAME}". Error: Unknown initialization failure from InitializationService.`,
                expect.any(Error) // The new Error created internally
            );
            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith('Initialization failed: Unknown initialization failure from InitializationService.', 'fatal');
        });


        it('should handle general errors during start-up and re-throw them', async () => {
            const startupError = new Error('TurnManager failed to start');
            mockTurnManager.start.mockRejectedValue(startupError); // Simulate error after successful initialization

            await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(startupError);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`GameEngine: Failed to start new game with world "${MOCK_WORLD_NAME}". Error: ${startupError.message}`),
                startupError
            );
            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith(
                expect.stringContaining(`GameEngine: Failed to start new game with world "${MOCK_WORLD_NAME}". Error: ${startupError.message}`), 'fatal'
            );
            expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(false, 'Error starting game.');
            expect(mockDomUiFacade.title.set).toHaveBeenCalledWith("Error Starting Game");

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
        });
    });

    describe('stop', () => {
        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
            // Simulate an initialized and running game state for stop() to act upon
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
        });

        it('should successfully stop a running game', async () => {
            await gameEngine.startNewGame(MOCK_WORLD_NAME); // Get to a running state
            // Clear mocks from startNewGame to focus on stop()
            jest.clearAllMocks();
            setupMockContainer(); // Re-initialize mocks with fresh jest.fn()
                                  // Note: gameEngine instance retains its state but uses new mock functions now.
                                  // This is a bit complex. Ideally, create a fresh gameEngine and set its state for 'stop'.
                                  // For simplicity, we assume the gameEngine's internal flags are set correctly by the previous startNewGame.
                                  // Or better: set the flags manually if we could. Since not, we call start, then stop.
                                  // Let's re-instance gameEngine for cleaner mock interactions.
            gameEngine = new GameEngine({container: mockContainer});
            // Manually set internal state to "running" for testing stop() in isolation, if possible.
            // Since #isEngineInitialized and #isGameLoopRunning are private, we call startNewGame.
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            // Now test stop
            await gameEngine.stop();

            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalled();
            expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(false, 'Game stopped.');
            expect(mockTurnManager.stop).toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_STOPPED_ID, {});
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stopping...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stopped.');

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false); // This is set first
            expect(status.activeWorld).toBeNull();
        });

        it('should log and return if already stopped', async () => {
            // Game engine is new, so it's not initialized/running
            gameEngine = new GameEngine({container: mockContainer});
            await gameEngine.stop();

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.stop: Engine not running or already stopped.');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).not.toHaveBeenCalled();
            expect(mockTurnManager.stop).not.toHaveBeenCalled();
        });

        it('should handle missing PlaytimeTracker.endSessionAndAccumulate gracefully', async () => {
            await gameEngine.startNewGame(MOCK_WORLD_NAME); // Get to a running state
            mockPlaytimeTracker.endSessionAndAccumulate = undefined; // Break it
            await gameEngine.stop();
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine.stop: PlaytimeTracker not available or endSessionAndAccumulate not a function.');
        });

        it('should handle missing DomUiFacade.input gracefully', async () => {
            await gameEngine.startNewGame(MOCK_WORLD_NAME); // Get to a running state
            mockDomUiFacade.input = undefined; // Break it
            await gameEngine.stop();
            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine.stop: DomUiFacade or input controller not available for disabling input.');
        });
    });

    describe('triggerManualSave', () => {
        const SAVE_NAME = 'MySaveFile';

        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
        });

        it('should successfully trigger a manual save if engine is initialized', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME); // Initialize engine

            const saveResult = {success: true, filePath: 'path/to/save.sav'};
            mockGamePersistenceService.saveGame.mockResolvedValue(saveResult);

            const result = await gameEngine.triggerManualSave(SAVE_NAME);

            expect(mockGamePersistenceService.saveGame).toHaveBeenCalledWith(SAVE_NAME, true); // true for isEngineInitialized
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_SAVED_ID, {
                saveName: SAVE_NAME,
                path: saveResult.filePath,
                type: 'manual'
            });
            expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Manual save successful. Name: "${SAVE_NAME}", Path: ${saveResult.filePath}`);
            expect(result).toEqual(saveResult);
        });

        it('should return error if engine is not initialized', async () => {
            const result = await gameEngine.triggerManualSave(SAVE_NAME);
            const expectedErrorMsg = 'Game engine is not initialized. Cannot save game.';

            expect(mockLogger.error).toHaveBeenCalledWith(`GameEngine.triggerManualSave: ${expectedErrorMsg}`);
            expect(result).toEqual({success: false, error: expectedErrorMsg});
            expect(mockGamePersistenceService.saveGame).not.toHaveBeenCalled();
        });

        it('should return error if GamePersistenceService is unavailable', async () => {
            // Set up mocks as usual
            setupMockContainer();

            // Override only the GamePersistenceService resolution for THIS test's GameEngine instance
            const originalResolver = mockContainer.resolve;
            mockContainer.resolve = jest.fn(token => {
                if (token === tokens.GamePersistenceService) {
                    return null; // Simulate service unavailable
                }
                return originalResolver(token); // Use existing resolver for all other tokens
            });

            gameEngine = new GameEngine({container: mockContainer}); // GameEngine is constructed with #gamePersistenceService = null

            // Make the engine "initialized" so it passes the first check in triggerManualSave.
            // We need to ensure startNewGame doesn't fail due to GPS being null (it shouldn't).
            // The mockInitializationService must be available via the container.
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            // Ensure InitializationService is resolved by startNewGame
            // This means the 'resolve' spy on mockContainer needs to be able to return it.
            // The easiest way: ensure the originalResolver used above can give mockInitializationService.
            // It should, because setupMockContainer() populates it.

            await gameEngine.startNewGame(MOCK_WORLD_NAME); // Initialize the engine state

            const result = await gameEngine.triggerManualSave(SAVE_NAME);
            const expectedErrorMsg = 'GamePersistenceService is not available. Cannot save game.';

            expect(mockLogger.error).toHaveBeenCalledWith(`GameEngine.triggerManualSave: ${expectedErrorMsg}`);
            expect(result).toEqual({success: false, error: expectedErrorMsg});
        });

        it('should return error if gamePersistenceService.saveGame fails', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME); // Initialize engine

            const saveError = {success: false, error: 'Disk full'};
            mockGamePersistenceService.saveGame.mockResolvedValue(saveError);

            const result = await gameEngine.triggerManualSave(SAVE_NAME);

            expect(mockLogger.error).toHaveBeenCalledWith(`GameEngine: Manual save failed. Name: "${SAVE_NAME}". Error: ${saveError.error}`);
            expect(result).toEqual(saveError);
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(GAME_SAVED_ID, expect.anything());
        });
    });

    describe('loadGame', () => {
        const SAVE_ID = 'savegame-001.sav';
        const mockSaveData = {
            metadata: {gameTitle: 'My Loaded Game Adventure'},
            // ... other save data fields
        };

        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
            // Mock stop to avoid its side effects unless specifically testing stop integration
            jest.spyOn(gameEngine, 'stop').mockResolvedValue(undefined);
        });

        it('should successfully load a game', async () => {
            mockGamePersistenceService.loadAndRestoreGame.mockResolvedValue({success: true, data: mockSaveData});

            const result = await gameEngine.loadGame(SAVE_ID);

            expect(gameEngine.stop).toHaveBeenCalled();
            expect(mockEntityManager.clearAll).toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).toHaveBeenCalled();

            // Corrected expectation for the first title.set call
            const shortSaveName = SAVE_ID.split(/[/\\]/).pop() || SAVE_ID;
            expect(mockDomUiFacade.title.set).toHaveBeenCalledWith(`Loading ${shortSaveName}...`);

            expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(false, `Loading ${shortSaveName}...`);
            expect(mockGamePersistenceService.loadAndRestoreGame).toHaveBeenCalledWith(SAVE_ID);

            expect(mockPlaytimeTracker.startSession).toHaveBeenCalled();
            // This will be the second call to title.set
            expect(mockDomUiFacade.title.set).toHaveBeenCalledWith(mockSaveData.metadata.gameTitle);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_LOADED_ID, {saveIdentifier: SAVE_ID});
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(LOADED_GAME_STARTED_ID, {
                saveIdentifier: SAVE_ID,
                worldName: mockSaveData.metadata.gameTitle
            });
            expect(mockTurnManager.start).toHaveBeenCalled();
            expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(true, 'Enter command...');

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(true);
            expect(status.isLoopRunning).toBe(true);
            expect(status.activeWorld).toBe(mockSaveData.metadata.gameTitle);
            expect(result).toEqual({success: true, data: mockSaveData});
            expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Game loaded from "${SAVE_ID}" (World: ${mockSaveData.metadata.gameTitle}) and resumed.`);
        });

        it('should use default world name if gameTitle is missing in loaded data', async () => {
            const saveDataNoTitle = {metadata: {}}; // No gameTitle
            mockGamePersistenceService.loadAndRestoreGame.mockResolvedValue({success: true, data: saveDataNoTitle});

            await gameEngine.loadGame(SAVE_ID);

            expect(gameEngine.getEngineStatus().activeWorld).toBe('Restored Game');
            expect(mockDomUiFacade.title.set).toHaveBeenCalledWith('Restored Game');
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(LOADED_GAME_STARTED_ID, {
                saveIdentifier: SAVE_ID,
                worldName: 'Restored Game'
            });
        });


        it('should return error if GamePersistenceService is unavailable', async () => {
            // This test is similar to the one in triggerManualSave.
            // We need to make GamePersistenceService null *after* constructor but *before* loadGame.
            mockContainer.resolve.mockImplementation(token => {
                if (token === tokens.ILogger) return mockLogger;
                if (token === tokens.GamePersistenceService) return null; // GPS fails to resolve
                return {}; // other mocks
            });
            gameEngine = new GameEngine({container: mockContainer}); // GamePersistenceService will be null

            const result = await gameEngine.loadGame(SAVE_ID);
            const expectedErrorMsg = 'GamePersistenceService is not available. Cannot load game.';

            expect(mockLogger.error).toHaveBeenCalledWith(`GameEngine.loadGame: ${expectedErrorMsg}`);
            expect(result).toEqual({success: false, error: expectedErrorMsg, data: null});
        });

        it('should handle failure from gamePersistenceService.loadAndRestoreGame', async () => {
            const loadErrorMsg = 'Failed to read save file.';
            mockGamePersistenceService.loadAndRestoreGame.mockResolvedValue({
                success: false,
                error: loadErrorMsg,
                data: null
            });

            const result = await gameEngine.loadGame(SAVE_ID);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`GameEngine: Failed to load and restore game from ${SAVE_ID}. Error: ${loadErrorMsg}`));
            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith(expect.stringContaining(loadErrorMsg), 'fatal');
            expect(mockDomUiFacade.input.setEnabled).toHaveBeenCalledWith(false, 'Failed to load game.');
            expect(mockDomUiFacade.title.set).toHaveBeenCalledWith('Load Failed');

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
            expect(result).toEqual({success: false, error: loadErrorMsg, data: null});
        });

        it('should handle failure if loadAndRestoreGame returns success true but no data', async () => {
            mockGamePersistenceService.loadAndRestoreGame.mockResolvedValue({success: true, data: null}); // Success but no data

            const result = await gameEngine.loadGame(SAVE_ID);
            const expectedError = "Restored data was missing or load operation failed.";

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`GameEngine: Failed to load and restore game from ${SAVE_ID}. Error: ${expectedError}`));
            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith(expect.stringContaining(expectedError), 'fatal');
            expect(result).toEqual({success: false, error: "Unknown error during load or missing data.", data: null}); // GameEngine creates a generic error if specific one is missing from GPS
        });

    });

    describe('showSaveGameUI', () => {
        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
        });

        it('should show SaveGameUI if saving is allowed', async () => {
            mockGamePersistenceService.isSavingAllowed.mockReturnValue(true);
            // Simulate initialized engine for isSavingAllowed check
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            gameEngine.showSaveGameUI();

            expect(mockGamePersistenceService.isSavingAllowed).toHaveBeenCalledWith(true); // isEngineInitialized
            expect(mockDomUiFacade.saveGame.show).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Showing Save Game UI.");
        });

        it('should show message if saving is not allowed', async () => {
            mockGamePersistenceService.isSavingAllowed.mockReturnValue(false);
            // Engine might be initialized or not, the service decides.
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);


            gameEngine.showSaveGameUI();

            expect(mockGamePersistenceService.isSavingAllowed).toHaveBeenCalledWith(true);
            expect(mockDomUiFacade.saveGame.show).not.toHaveBeenCalled();
            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith("Cannot save at this moment (e.g. game not fully initialized or in a critical state).", 'info');
            expect(mockLogger.warn).toHaveBeenCalledWith("GameEngine.showSaveGameUI: Saving is not currently allowed.");
        });

        it('should show message if SaveGameUI component is unavailable', () => {
            mockDomUiFacade.saveGame = null; // Make component unavailable
            gameEngine = new GameEngine({container: mockContainer}); // Re-init with broken facade

            gameEngine.showSaveGameUI();

            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith("Save Game UI is currently unavailable.", 'error');
            expect(mockLogger.warn).toHaveBeenCalledWith("GameEngine.showSaveGameUI: SaveGameUI component not available via facade.");
        });

        it('should show message if GamePersistenceService is unavailable', () => {
            mockContainer.resolve.mockImplementation(token => {
                if (token === tokens.ILogger) return mockLogger;
                if (token === tokens.DomUiFacade) return mockDomUiFacade; // Normal facade for messages
                if (token === tokens.GamePersistenceService) return null; // GPS unavailable
                return {};
            });
            gameEngine = new GameEngine({container: mockContainer}); // Re-init

            gameEngine.showSaveGameUI();
            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith("Cannot open save menu: persistence service error.", 'error');
            expect(mockLogger.error).toHaveBeenCalledWith("GameEngine.showSaveGameUI: GamePersistenceService not available. Cannot determine if saving is allowed.");
        });
    });

    describe('showLoadGameUI', () => {
        beforeEach(() => {
            gameEngine = new GameEngine({container: mockContainer});
        });

        it('should show LoadGameUI', () => {
            gameEngine.showLoadGameUI();
            expect(mockDomUiFacade.loadGame.show).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Showing Load Game UI.");
        });

        it('should show message if LoadGameUI component is unavailable', () => {
            mockDomUiFacade.loadGame = null; // Make component unavailable
            gameEngine = new GameEngine({container: mockContainer}); // Re-init

            gameEngine.showLoadGameUI();
            expect(mockDomUiFacade.messages.render).toHaveBeenCalledWith("Load Game UI is currently unavailable.", 'error');
            expect(mockLogger.warn).toHaveBeenCalledWith("GameEngine.showLoadGameUI: LoadGameUI component not available via facade.");
        });
    });

    describe('getEngineStatus', () => {
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

        it('should return correct status after starting a game', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            const status = gameEngine.getEngineStatus();
            expect(status).toEqual({
                isInitialized: true,
                isLoopRunning: true,
                activeWorld: MOCK_WORLD_NAME,
            });
        });

        it('should return correct status after stopping a game', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);
            await gameEngine.stop();

            const status = gameEngine.getEngineStatus();
            expect(status).toEqual({
                isInitialized: false,
                isLoopRunning: false,
                activeWorld: null,
            });
        });
    });
});