// tests/engine/gameEngine.test.js

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import GameEngine from '../../src/engine/gameEngine.js'; // Corrected path to core
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
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/config/appContainer.js').default} AppContainer */
/** @typedef {import('../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */ // Corrected to IEntityManager
/** @typedef {import('../../src/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../src/interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */ // Corrected to IGamePersistenceService
/** @typedef {import('../../src/interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */ // Corrected to IPlaytimeTracker
/** @typedef {import('../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../src/interfaces/IInitializationService.js').IInitializationService} IInitializationService */ // Corrected to IInitializationService
/** @typedef {import('../../src/interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */


describe('GameEngine', () => {
    let mockContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<IEntityManager>} */
    let mockEntityManager;
    /** @type {jest.Mocked<ITurnManager>} */
    let mockTurnManager;
    /** @type {jest.Mocked<IGamePersistenceService>} */
    let mockGamePersistenceService;
    /** @type {jest.Mocked<IPlaytimeTracker>} */
    let mockPlaytimeTracker;
    /** @type {jest.Mocked<ISafeEventDispatcher>} */
    let mockSafeEventDispatcher;
    /** @type {jest.Mocked<IInitializationService>} */
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
        // Ensure IEntityManager methods are mocked if GameEngine uses them directly
        mockEntityManager = {
            clearAll: jest.fn(),
            getActiveEntities: jest.fn().mockReturnValue([]),
            // Add other methods if GameEngine calls them and they are part of IEntityManager
        };
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
        mockSafeEventDispatcher = {dispatchSafely: jest.fn().mockResolvedValue(undefined)};
        mockInitializationService = {runInitializationSequence: jest.fn()};

        mockContainer = {
            resolve: jest.fn(token => {
                switch (token) {
                    case tokens.ILogger:
                        return mockLogger;
                    case tokens.IEntityManager:
                        return mockEntityManager;
                    case tokens.ITurnManager:
                        return mockTurnManager;
                    case tokens.GamePersistenceService: // Assuming this token resolves IGamePersistenceService
                        return mockGamePersistenceService;
                    case tokens.PlaytimeTracker: // Assuming this token resolves IPlaytimeTracker
                        return mockPlaytimeTracker;
                    case tokens.ISafeEventDispatcher:
                        return mockSafeEventDispatcher;
                    case tokens.IInitializationService:
                        return mockInitializationService;
                    default:
                        // Ensure a descriptive error message for easier debugging of unmocked tokens
                        const tokenName = Object.keys(tokens).find(key => tokens[key] === token) || token?.toString();
                        throw new Error(`GameEngine.test.js: Unmocked token: ${tokenName || 'unknown token'}`);
                }
            })
        };
    };

    beforeEach(() => {
        setupMockContainer();
        jest.spyOn(console, 'error').mockImplementation(() => {
        }); // Suppress console.error for cleaner test output
        gameEngine = new GameEngine({container: mockContainer}); // Initialize gameEngine here for all tests
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should instantiate and resolve all core services successfully', () => {
            // GameEngine is already instantiated in beforeEach
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Constructor called.');
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IEntityManager);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.GamePersistenceService);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.PlaytimeTracker);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ISafeEventDispatcher);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Core services resolved.');
        });

        it('should throw an error if ILogger cannot be resolved', () => {
            jest.spyOn(mockContainer, 'resolve').mockImplementation(token => {
                if (token === tokens.ILogger) throw new Error("Logger failed to resolve");
                // Fallback for other tokens to avoid breaking unrelated resolution paths if needed for this specific test setup,
                // or make it stricter if only ILogger resolution is expected here.
                throw new Error(`Unexpected token resolution attempt in ILogger failure test: ${token?.toString()}`);
            });

            expect(() => new GameEngine({container: mockContainer})).toThrow("GameEngine requires a logger.");
            expect(console.error).toHaveBeenCalledWith("GameEngine: CRITICAL - Logger not resolved.", expect.any(Error));
        });

        it('should throw an error and log if any other core service fails to resolve', () => {
            const resolutionError = new Error("EntityManager failed to resolve");
            // Ensure ILogger resolves, but IEntityManager fails.
            jest.spyOn(mockContainer, 'resolve').mockImplementation(token => {
                if (token === tokens.ILogger) return mockLogger;
                if (token === tokens.IEntityManager) throw resolutionError;
                // Provide mocks for other services if constructor tries to resolve them after the failing one.
                if (token === tokens.ITurnManager) return mockTurnManager;
                if (token === tokens.GamePersistenceService) return mockGamePersistenceService;
                if (token === tokens.PlaytimeTracker) return mockPlaytimeTracker;
                if (token === tokens.ISafeEventDispatcher) return mockSafeEventDispatcher;
                throw new Error(`GameEngine.test.js - Constructor Core Service: Unmocked token during specific failure test: ${token?.toString()}`);
            });

            expect(() => new GameEngine({container: mockContainer}))
                .toThrow(`GameEngine: Failed to resolve core services. ${resolutionError.message}`);

            // Logger is resolved, so it should be used for error logging.
            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${resolutionError.message}`,
                resolutionError
            );
        });
    });

    describe('startNewGame', () => {
        beforeEach(() => {
            // gameEngine is already set up in the outer beforeEach
            // Default success for initialization sequence unless overridden by a specific test
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
        });

        it('should successfully start a new game', async () => {
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(
                ENGINE_INITIALIZING_UI,
                {worldName: MOCK_WORLD_NAME},
                {allowSchemaNotFound: true}
            );
            expect(mockEntityManager.clearAll).toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).toHaveBeenCalled();
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IInitializationService);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(MOCK_WORLD_NAME);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(NEW_GAME_STARTED_ID, {worldName: MOCK_WORLD_NAME});
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_READY_UI, { // Typo here, should be dispatchSafely
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
            // First, successfully start a game
            mockInitializationService.runInitializationSequence.mockResolvedValueOnce({success: true});
            await gameEngine.startNewGame("InitialWorld");

            // Clear mocks for specific checks related to the stop() call during the second startNewGame
            mockPlaytimeTracker.endSessionAndAccumulate.mockClear();
            mockTurnManager.stop.mockClear();
            // mockSafeEventDispatcher.dispatchSafely.mockClear(); // Careful with clearing this if other dispatches are expected

            // Setup for the second game start
            mockInitializationService.runInitializationSequence.mockResolvedValueOnce({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            expect(mockLogger.warn).toHaveBeenCalledWith('GameEngine._prepareForNewGameSession: Engine already initialized. Stopping existing game before starting new.');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1); // From stop()
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1); // From stop()

            // Verify events dispatched by stop()
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_STOPPED_ID, {});
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_STOPPED_UI, {inputDisabledMessage: 'Game stopped.'});

            // Verify events for the new game starting successfully
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_READY_UI, {
                activeWorld: MOCK_WORLD_NAME,
                message: 'Enter command...'
            });
            const status = gameEngine.getEngineStatus();
            expect(status.activeWorld).toBe(MOCK_WORLD_NAME); // Check new world is active
        });

        it('should handle InitializationService failure', async () => {
            const initError = new Error('Initialization failed via service');
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: false, error: initError});

            await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(initError);

            // Verify that _handleNewGameFailure dispatched the correct event
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_OPERATION_FAILED_UI, {
                errorMessage: `Failed to start new game: ${initError.message}`,
                errorTitle: "Initialization Error"
            });
            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
            expect(status.activeWorld).toBeNull();
        });

        it('should handle general errors during start-up and dispatch failure event', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});

            const startupError = new Error('TurnManager failed to start');
            mockTurnManager.start.mockRejectedValue(startupError);

            await expect(gameEngine.startNewGame(MOCK_WORLD_NAME)).rejects.toThrow(startupError);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_OPERATION_FAILED_UI, {
                errorMessage: `Failed to start new game: ${startupError.message}`,
                errorTitle: "Initialization Error"
            });
            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
            expect(status.activeWorld).toBeNull();
        });
    });

    describe('stop', () => {
        it('should successfully stop a running game', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);

            mockPlaytimeTracker.endSessionAndAccumulate.mockClear();
            mockTurnManager.stop.mockClear();
            mockSafeEventDispatcher.dispatchSafely.mockClear();
            mockLogger.info.mockClear();

            await gameEngine.stop();

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stopping...');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_STOPPED_UI, {inputDisabledMessage: 'Game stopped.'});
            expect(mockTurnManager.stop).toHaveBeenCalledTimes(1);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(GAME_STOPPED_ID, {});
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Stopped.');

            const status = gameEngine.getEngineStatus();
            expect(status.isInitialized).toBe(false);
            expect(status.isLoopRunning).toBe(false);
            expect(status.activeWorld).toBeNull();
        });

        it('should do nothing if engine is already stopped', async () => {
            const initialStatus = gameEngine.getEngineStatus();
            expect(initialStatus.isInitialized).toBe(false);
            expect(initialStatus.isLoopRunning).toBe(false);

            mockLogger.info.mockClear();
            mockPlaytimeTracker.endSessionAndAccumulate.mockClear();
            mockTurnManager.stop.mockClear();
            mockSafeEventDispatcher.dispatchSafely.mockClear();

            await gameEngine.stop();

            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.stop: Engine not running or already stopped.');
            expect(mockPlaytimeTracker.endSessionAndAccumulate).not.toHaveBeenCalled();
            expect(mockTurnManager.stop).not.toHaveBeenCalled();
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(ENGINE_STOPPED_UI, expect.anything());
            expect(mockSafeEventDispatcher.dispatchSafely).not.toHaveBeenCalledWith(GAME_STOPPED_ID, expect.anything());
        });
    });

    describe('triggerManualSave', () => {
        const SAVE_NAME = 'MySaveFile';

        it('should successfully trigger a manual save and dispatch messages if engine is initialized', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);
            mockSafeEventDispatcher.dispatchSafely.mockClear();

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
            expect(mockGamePersistenceService.saveGame).not.toHaveBeenCalled();
        });

        it('should dispatch error if gamePersistenceService.saveGame fails', async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);
            mockSafeEventDispatcher.dispatchSafely.mockClear();


            const saveError = {success: false, error: 'Disk full'};
            mockGamePersistenceService.saveGame.mockResolvedValue(saveError);

            const result = await gameEngine.triggerManualSave(SAVE_NAME);

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: `Manual save failed for "${SAVE_NAME}". Error: ${saveError.error}`,
                type: 'error'
            });
            expect(result).toEqual(saveError);
        });

        it('should dispatch error if GamePersistenceService is not available', async () => {
            const originalResolve = mockContainer.resolve;
            mockContainer.resolve = jest.fn(token => {
                if (token === tokens.GamePersistenceService) return null;
                return originalResolve(token);
            });
            gameEngine = new GameEngine({container: mockContainer});
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);
            mockSafeEventDispatcher.dispatchSafely.mockClear();


            const result = await gameEngine.triggerManualSave(SAVE_NAME);
            const expectedErrorMsg = 'GamePersistenceService is not available. Cannot save game.';

            expect(mockLogger.error).toHaveBeenCalledWith(`GameEngine.triggerManualSave: ${expectedErrorMsg}`);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: expectedErrorMsg,
                type: 'error'
            });
            expect(result).toEqual({success: false, error: expectedErrorMsg});
        });
    });

    describe('loadGame', () => {
        const SAVE_ID = 'savegame-001.sav';
        const mockSaveData = {
            metadata: {gameTitle: 'My Loaded Game Adventure'},
        };

        /** @type {SaveGameStructure} */
        const typedMockSaveData = /** @type {SaveGameStructure} */ (mockSaveData);

        // Spies for helper methods on the gameEngine instance
        let prepareSpy, executeSpy, finalizeSpy, handleFailureSpy;

        beforeEach(() => {
            // Reset and re-mock/spy on helpers for each test to ensure clean state
            // These methods are part of GameEngine's prototype, so we spy on the instance.
            prepareSpy = jest.spyOn(gameEngine, '_prepareForLoadGameSession').mockResolvedValue(undefined);
            executeSpy = jest.spyOn(gameEngine, '_executeLoadAndRestore').mockResolvedValue({
                success: true,
                data: typedMockSaveData
            });
            finalizeSpy = jest.spyOn(gameEngine, '_finalizeLoadSuccess').mockResolvedValue({
                success: true,
                data: typedMockSaveData
            });
            handleFailureSpy = jest.spyOn(gameEngine, '_handleLoadFailure').mockImplementation(async (error, saveId) => {
                const errorMsg = error instanceof Error ? error.message : String(error);
                return {success: false, error: `Processed: ${errorMsg}`, data: null};
            });
        });

        it('should successfully orchestrate loading a game and call helpers in order', async () => {
            mockLogger.info.mockClear(); // Clear log mock for specific check

            const result = await gameEngine.loadGame(SAVE_ID);

            expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: loadGame called for identifier: ${SAVE_ID}`);
            expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(finalizeSpy).toHaveBeenCalledWith(typedMockSaveData, SAVE_ID);
            expect(handleFailureSpy).not.toHaveBeenCalled();
            expect(result).toEqual({success: true, data: typedMockSaveData});
        });

        it('should use _handleLoadFailure if _executeLoadAndRestore returns success: false', async () => {
            const restoreErrorMsg = 'Restore operation failed';
            executeSpy.mockResolvedValue({success: false, error: restoreErrorMsg, data: null});

            // For this test, we want to see the exact error passed to _handleLoadFailure
            handleFailureSpy.mockImplementation(async (error, saveId) => {
                const errorMsg = error instanceof Error ? error.message : String(error);
                return {success: false, error: errorMsg, data: null};
            });


            const result = await gameEngine.loadGame(SAVE_ID);

            expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(mockLogger.warn).toHaveBeenCalledWith(`GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`);
            expect(finalizeSpy).not.toHaveBeenCalled();
            expect(handleFailureSpy).toHaveBeenCalledWith(restoreErrorMsg, SAVE_ID);
            expect(result).toEqual({success: false, error: restoreErrorMsg, data: null});
        });

        it('should use _handleLoadFailure if _executeLoadAndRestore returns success: true but no data', async () => {
            executeSpy.mockResolvedValue({success: true, data: null}); // No data case
            // For this test, we want to see the exact error passed to _handleLoadFailure
            handleFailureSpy.mockImplementation(async (error, saveId) => {
                const errorMsg = error instanceof Error ? error.message : String(error);
                return {success: false, error: errorMsg, data: null};
            });

            const result = await gameEngine.loadGame(SAVE_ID);
            const expectedError = 'Restored data was missing or load operation failed.';


            expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(mockLogger.warn).toHaveBeenCalledWith(`GameEngine: Load/restore operation reported failure for "${SAVE_ID}".`);
            expect(finalizeSpy).not.toHaveBeenCalled();
            expect(handleFailureSpy).toHaveBeenCalledWith(expectedError, SAVE_ID);
            expect(result).toEqual({success: false, error: expectedError, data: null});
        });

        it('should handle GamePersistenceService unavailability (guard clause) and dispatch UI event directly', async () => {
            // For this test, we need to make gamePersistenceService null *after* initial GameEngine setup
            // but before loadGame is called. A more direct way is to re-initialize gameEngine
            // with a container that returns null for GamePersistenceService.
            const originalResolve = mockContainer.resolve;
            mockContainer.resolve = jest.fn(token => {
                if (token === tokens.GamePersistenceService) return null;
                // return originalResolve(token); // This can cause issues if other services are needed by constructor after this point
                // For this specific test, ensure logger and event dispatcher are resolved if constructor needs them.
                if (token === tokens.ILogger) return mockLogger;
                if (token === tokens.ISafeEventDispatcher) return mockSafeEventDispatcher;
                return originalResolve(token); // Fallback for other services
            });
            gameEngine = new GameEngine({container: mockContainer}); // Re-initialize with new mock setup

            // Re-spy on the helpers for the new gameEngine instance IF they were on the prototype.
            // However, since loadGame itself contains the guard clause logic before calling helpers,
            // we don't need to spy on helpers for *this specific guard clause test*.
            // We just need to ensure they are NOT called.
            // We can use fresh spies for the new instance if we were testing calls TO them.
            // For clarity, let's ensure they are not called by spying and checking not.toHaveBeenCalled()
            // or by simply not setting up spies if they are instance-bound in the actual class.
            // Given they are private instance methods using #, spyOn won't work directly for #methods.
            // The original spies (prepareSpy etc.) are on the *old* gameEngine instance.
            // So, we will check that the original spies were NOT called.

            // Ensure the original spies (bound to the first gameEngine instance) are not called
            // And we'll mock the helpers on the *new* instance to be safe, though they shouldn't be reached.
            const newPrepareSpy = jest.spyOn(gameEngine, '_prepareForLoadGameSession').mockResolvedValue(undefined);
            const newExecuteSpy = jest.spyOn(gameEngine, '_executeLoadAndRestore').mockResolvedValue({
                success: true,
                data: null
            });
            const newFinalizeSpy = jest.spyOn(gameEngine, '_finalizeLoadSuccess').mockResolvedValue({
                success: true,
                data: null
            });
            const newHandleFailureSpy = jest.spyOn(gameEngine, '_handleLoadFailure').mockResolvedValue({
                success: false,
                error: '',
                data: null
            });


            const rawErrorMsg = 'GamePersistenceService is not available. Cannot load game.';
            mockSafeEventDispatcher.dispatchSafely.mockClear(); // Clear for specific check

            const result = await gameEngine.loadGame(SAVE_ID);

            expect(mockLogger.error).toHaveBeenCalledWith(`GameEngine.loadGame: ${rawErrorMsg}`);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_OPERATION_FAILED_UI, {
                errorMessage: rawErrorMsg, // Expecting the raw error message as per ticket
                errorTitle: "Load Failed"
            });
            expect(result).toEqual({success: false, error: rawErrorMsg, data: null});

            // Verify helpers on the new instance were NOT called
            expect(newPrepareSpy).not.toHaveBeenCalled();
            expect(newExecuteSpy).not.toHaveBeenCalled();
            expect(newFinalizeSpy).not.toHaveBeenCalled();
            // _handleLoadFailure is NOT called by the guard clause path directly; it's a direct return.
            expect(newHandleFailureSpy).not.toHaveBeenCalled();


            // Restore original container resolve for subsequent tests if necessary, or ensure setupMockContainer handles it.
            mockContainer.resolve = originalResolve;
        });

        it('should use _handleLoadFailure when _prepareForLoadGameSession throws an error', async () => {
            const prepareError = new Error('Prepare failed');
            prepareSpy.mockRejectedValue(prepareError);

            const result = await gameEngine.loadGame(SAVE_ID);

            expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${prepareError.message || String(prepareError)}`,
                prepareError
            );
            expect(executeSpy).not.toHaveBeenCalled();
            expect(finalizeSpy).not.toHaveBeenCalled();
            expect(handleFailureSpy).toHaveBeenCalledWith(prepareError, SAVE_ID);
            expect(result).toEqual({success: false, error: `Processed: ${prepareError.message}`, data: null});
        });

        it('should use _handleLoadFailure when _executeLoadAndRestore throws an error', async () => {
            const executeError = new Error('Execute failed');
            executeSpy.mockRejectedValue(executeError);

            const result = await gameEngine.loadGame(SAVE_ID);

            expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${executeError.message || String(executeError)}`,
                executeError
            );
            expect(finalizeSpy).not.toHaveBeenCalled();
            expect(handleFailureSpy).toHaveBeenCalledWith(executeError, SAVE_ID);
            expect(result).toEqual({success: false, error: `Processed: ${executeError.message}`, data: null});
        });

        it('should use _handleLoadFailure when _finalizeLoadSuccess throws an error', async () => {
            const finalizeError = new Error('Finalize failed');
            finalizeSpy.mockRejectedValue(finalizeError);
            // _executeLoadAndRestore must return success:true and data for _finalizeLoadSuccess to be called
            executeSpy.mockResolvedValue({success: true, data: typedMockSaveData});


            const result = await gameEngine.loadGame(SAVE_ID);

            expect(prepareSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(executeSpy).toHaveBeenCalledWith(SAVE_ID);
            expect(finalizeSpy).toHaveBeenCalledWith(typedMockSaveData, SAVE_ID);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameEngine: Overall catch in loadGame for identifier "${SAVE_ID}". Error: ${finalizeError.message || String(finalizeError)}`,
                finalizeError
            );
            expect(handleFailureSpy).toHaveBeenCalledWith(finalizeError, SAVE_ID);
            expect(result).toEqual({success: false, error: `Processed: ${finalizeError.message}`, data: null});
        });
    });

    describe('showSaveGameUI', () => {
        beforeEach(async () => {
            mockInitializationService.runInitializationSequence.mockResolvedValue({success: true});
            await gameEngine.startNewGame(MOCK_WORLD_NAME);
            mockSafeEventDispatcher.dispatchSafely.mockClear();
        });


        it('should dispatch REQUEST_SHOW_SAVE_GAME_UI if saving is allowed', async () => {
            mockGamePersistenceService.isSavingAllowed.mockReturnValue(true);
            await gameEngine.showSaveGameUI();
            expect(mockGamePersistenceService.isSavingAllowed).toHaveBeenCalledWith(true);
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(REQUEST_SHOW_SAVE_GAME_UI);
        });

        it('should dispatch CANNOT_SAVE_GAME_INFO if saving is not allowed', async () => {
            mockGamePersistenceService.isSavingAllowed.mockReturnValue(false);
            await gameEngine.showSaveGameUI();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(CANNOT_SAVE_GAME_INFO);
        });

        it('should dispatch message if GamePersistenceService is unavailable', async () => {
            const originalResolve = mockContainer.resolve;
            mockContainer.resolve = jest.fn(token => {
                if (token === tokens.GamePersistenceService) return null;
                return originalResolve(token);
            });
            const localGameEngine = new GameEngine({container: mockContainer});
            mockSafeEventDispatcher.dispatchSafely.mockClear();


            await localGameEngine.showSaveGameUI();

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: "Cannot open save menu: persistence service error.",
                type: 'error'
            });
            expect(mockLogger.error).toHaveBeenCalledWith("GameEngine.showSaveGameUI: GamePersistenceService not available. Cannot determine if saving is allowed or show UI.");
        });
    });

    describe('showLoadGameUI', () => {
        it('should dispatch REQUEST_SHOW_LOAD_GAME_UI if persistence service is available', async () => {
            mockSafeEventDispatcher.dispatchSafely.mockClear();
            await gameEngine.showLoadGameUI();
            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(REQUEST_SHOW_LOAD_GAME_UI);
        });

        it('should dispatch message if GamePersistenceService is unavailable', async () => {
            const originalResolve = mockContainer.resolve;
            mockContainer.resolve = jest.fn(token => {
                if (token === tokens.GamePersistenceService) return null;
                return originalResolve(token);
            });
            const localGameEngine = new GameEngine({container: mockContainer});
            mockSafeEventDispatcher.dispatchSafely.mockClear();


            await localGameEngine.showLoadGameUI();

            expect(mockSafeEventDispatcher.dispatchSafely).toHaveBeenCalledWith(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: "Cannot open load menu: persistence service error.",
                type: 'error'
            });
            expect(mockLogger.error).toHaveBeenCalledWith("GameEngine.showLoadGameUI: GamePersistenceService not available. Load Game UI might not function correctly.");
        });
    });

    describe('getEngineStatus', () => {
        it('should return initial status correctly after construction', () => {
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