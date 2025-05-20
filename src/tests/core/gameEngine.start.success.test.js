// src/tests/core/gameEngine.start.success.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // Import tokens

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../core/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
// Updated to use IEntityManager for the type hint of the mock
/** @typedef {import('../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */


// --- Test Suite ---
describe('GameEngine startNewGame() - Successful Initialization via InitializationService', () => {

    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
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
    /** @type {jest.Mocked<ShutdownService>} */
    let mockShutdownService;


    const testWorldName = 'testWorld';

    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {};
        mockInitializationService = {runInitializationSequence: jest.fn()};
        mockValidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
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
            getEntityDefinition: jest.fn()
        };
        mockShutdownService = {
            runShutdownSequence: jest.fn().mockResolvedValue(undefined)
        };


        mockAppContainer = {resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn()};

        mockAppContainer.resolve.mockImplementation((key) => {
            switch (key) {
                case tokens.ILogger:
                    return mockLogger;
                case tokens.InitializationService:
                    return mockInitializationService;
                case tokens.IValidatedEventDispatcher:
                    return mockValidatedEventDispatcher;
                case tokens.ITurnManager:
                    return mockTurnManager;
                case tokens.PlaytimeTracker:
                    return mockPlaytimeTracker;
                case tokens.GamePersistenceService:
                    return mockGamePersistenceService;
                case tokens.IDataRegistry:
                    return mockDataRegistry;
                // VVVVVV MODIFIED VVVVVV
                case tokens.IEntityManager: // GameEngine constructor now asks for IEntityManager
                    return mockEntityManager;
                // ^^^^^^ MODIFIED ^^^^^^
                case tokens.ShutdownService:
                    return mockShutdownService;
                default:
                    // It's often better for success tests to throw on unmocked dependencies
                    // to catch missing mocks early.
                    console.warn(`MockAppContainer (beforeEach SUCCESS tests): Unexpected resolution attempt for key "${String(key)}". This might indicate a missing mock.`);
                    throw new Error(`MockAppContainer (beforeEach SUCCESS tests): Unexpected resolution attempt for key "${String(key)}".`);
            }
        });

        mockInitializationService.runInitializationSequence.mockResolvedValue({
            success: true, gameLoop: mockGameLoop, error: null
        });
    });

    it('should correctly delegate to InitializationService, set state, start TurnManager, and log messages on success', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        // Clear mocks that might have been called during constructor
        mockAppContainer.resolve.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        // mockEntityManager.clearAll() is called by startNewGame, not constructor
        // mockPlaytimeTracker.reset() is called by startNewGame, not constructor

        await gameEngineInstance.startNewGame(testWorldName);

        expect(mockEntityManager.clearAll).toHaveBeenCalledTimes(1);
        expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(testWorldName);
        expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

        expect(gameEngineInstance.isInitialized).toBe(true);

        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting NEW GAME initialization sequence for world: ${testWorldName}...`);
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Clearing EntityManager before new game initialization.');
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Resetting PlaytimeTracker for new game session.');
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: InitializationService resolved for new game.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: New game initialization sequence reported success.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Game data processed. Engine is now initialized.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: Starting TurnManager...');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: TurnManager started successfully.');
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: New game '${testWorldName}' started successfully and is ready.`);


        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });

    it('should log a warning and return if startNewGame() is called when already initialized', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        await gameEngineInstance.startNewGame(testWorldName);
        expect(gameEngineInstance.isInitialized).toBe(true);

        mockLogger.warn.mockClear();
        mockAppContainer.resolve.mockClear(); // Clear after initial setup and start
        mockInitializationService.runInitializationSequence.mockClear();
        mockTurnManager.start.mockClear();
        if (mockValidatedEventDispatcher && mockValidatedEventDispatcher.dispatchValidated) {
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
        }
        mockEntityManager.clearAll.mockClear();
        mockPlaytimeTracker.reset.mockClear();
        mockPlaytimeTracker.startSession.mockClear();


        await gameEngineInstance.startNewGame('anotherWorld');

        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(`GameEngine: startNewGame('anotherWorld') called, but engine is already initialized. Please stop the engine first.`);
        expect(mockEntityManager.clearAll).not.toHaveBeenCalled();
        expect(mockPlaytimeTracker.reset).not.toHaveBeenCalled();
        expect(mockPlaytimeTracker.startSession).not.toHaveBeenCalled();
        // Check that no NEW calls to resolve these services happened
        const initServiceCall = mockAppContainer.resolve.mock.calls.find(call => call[0] === tokens.InitializationService);
        expect(initServiceCall).toBeUndefined();
        const turnManagerCall = mockAppContainer.resolve.mock.calls.find(call => call[0] === tokens.ITurnManager);
        expect(turnManagerCall).toBeUndefined();

        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
        expect(mockTurnManager.start).not.toHaveBeenCalled();
        if (mockValidatedEventDispatcher && mockValidatedEventDispatcher.dispatchValidated) {
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        }
    });

    it('should throw an error and log if startNewGame() is called without a valid worldName', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        const expectedError = new Error('GameEngine.startNewGame requires a valid non-empty worldName argument.');
        const expectedLogMessage = 'GameEngine: Fatal Error - startNewGame() called without a valid worldName.';

        // Clear mocks from constructor, if any for these specific ones
        mockLogger.error.mockClear();
        mockAppContainer.resolve.mockClear();
        mockInitializationService.runInitializationSequence.mockClear();
        mockTurnManager.start.mockClear();
        if (mockValidatedEventDispatcher && mockValidatedEventDispatcher.dispatchValidated) {
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
        }
        mockEntityManager.clearAll.mockClear();
        mockPlaytimeTracker.reset.mockClear();

        await expect(gameEngineInstance.startNewGame(null)).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        await expect(gameEngineInstance.startNewGame('')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        await expect(gameEngineInstance.startNewGame('   ')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        expect(mockEntityManager.clearAll).not.toHaveBeenCalled();
        expect(mockPlaytimeTracker.reset).not.toHaveBeenCalled();
        const initServiceCall = mockAppContainer.resolve.mock.calls.find(call => call[0] === tokens.InitializationService);
        expect(initServiceCall).toBeUndefined();
        const turnManagerCall = mockAppContainer.resolve.mock.calls.find(call => call[0] === tokens.ITurnManager);
        expect(turnManagerCall).toBeUndefined();
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
        expect(mockTurnManager.start).not.toHaveBeenCalled();
        if (mockValidatedEventDispatcher && mockValidatedEventDispatcher.dispatchValidated) {
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        }
    });
});