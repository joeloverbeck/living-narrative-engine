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
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */


// --- Test Suite ---
describe('GameEngine startNewGame() - Successful Initialization via InitializationService', () => {

    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop; // Returned by InitializationService, not directly resolved by GameEngine
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockValidatedEventDispatcher; // Though not directly used in startNewGame success path for events
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


    const testWorldName = 'testWorld';

    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {}; // Simple mock, as its properties aren't directly used by GameEngine post-init
        mockInitializationService = {runInitializationSequence: jest.fn()};
        mockValidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            setCurrentTurn: jest.fn()
        };

        // Mocks for services resolved in GameEngine constructor
        mockPlaytimeTracker = {
            getTotalPlaytime: jest.fn().mockReturnValue(0),
            reset: jest.fn(),
            start: jest.fn(),
            stop: jest.fn(),
            setAccumulatedPlaytime: jest.fn()
        };
        mockGamePersistenceService = {saveGame: jest.fn()};
        mockDataRegistry = {getLoadedModManifests: jest.fn().mockReturnValue([]), getModDefinition: jest.fn()};
        mockEntityManager = {
            clearAll: jest.fn(),
            activeEntities: new Map(),
            addComponent: jest.fn(),
            getEntityDefinition: jest.fn()
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
                // tokens.GameLoop is not resolved by GameEngine directly.
                // It's provided by InitializationService.

                // Add cases for constructor dependencies
                case tokens.PlaytimeTracker:
                    return mockPlaytimeTracker;
                case tokens.GamePersistenceService:
                    return mockGamePersistenceService;
                case tokens.IDataRegistry:
                    return mockDataRegistry;
                case tokens.EntityManager:
                    return mockEntityManager;
                case tokens.ShutdownService: // Added for completeness, though not directly used in this success test's path
                    return {runShutdownSequence: jest.fn().mockResolvedValue(undefined)};
                default:
                    // This case should ideally not be hit if all dependencies are mocked.
                    // If it is, the test setup might be missing a mock for a new/unexpected dependency.
                    console.warn(`MockAppContainer (beforeEach SUCCESS tests): Unexpected resolution attempt for key "${String(key)}".`);
                    // Throwing an error here can help catch missing mocks early.
                    throw new Error(`MockAppContainer (beforeEach SUCCESS tests): Unexpected resolution attempt for key "${String(key)}".`);
            }
        });

        // Configure default InitializationService success
        mockInitializationService.runInitializationSequence.mockResolvedValue({
            success: true, gameLoop: mockGameLoop, error: null
        });
    });

    // Test Case: Successful Initialization
    it('should correctly delegate to InitializationService, set state, start TurnManager, and log messages on success', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        // Clear mocks that might have been called during the constructor
        // Note: mockAppContainer.resolve is called in constructor, so clearing it after instance creation
        // means we are only checking calls during startNewGame itself.
        mockAppContainer.resolve.mockClear();
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockEntityManager.clearAll.mockClear();


        await gameEngineInstance.startNewGame(testWorldName);

        // Assertions for calls made *during* startNewGame and #onGameReady
        expect(mockEntityManager.clearAll).toHaveBeenCalledTimes(1);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService); // Called in startNewGame
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(testWorldName);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager); // Called in #onGameReady
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

        expect(gameEngineInstance.isInitialized).toBe(true);

        // Log assertions
        // Logs from startNewGame()
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting NEW GAME initialization sequence for world: ${testWorldName}...`);
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Clearing EntityManager before new game initialization.');
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: InitializationService resolved for new game.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: New game initialization sequence reported success.');

        // Logs from #onGameReady()
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Game data processed. Engine is now initialized.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: Starting TurnManager...');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: TurnManager started successfully.');


        // ValidatedEventDispatcher is not used for a "game ready" message in startNewGame
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });

    // Test Case: Already Initialized
    it('should log a warning and return if startNewGame() is called when already initialized', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        // Initial successful start
        await gameEngineInstance.startNewGame(testWorldName);
        expect(gameEngineInstance.isInitialized).toBe(true);

        // Clear mocks from the first run
        mockLogger.warn.mockClear();
        // mockAppContainer.resolve is called in constructor, and then again in startNewGame/#onGameReady.
        // For this test, we care that new resolves don't happen in the *second* startNewGame call.
        mockAppContainer.resolve.mockClear();
        mockInitializationService.runInitializationSequence.mockClear();
        mockTurnManager.start.mockClear();
        mockValidatedEventDispatcher.dispatchValidated.mockClear();
        mockEntityManager.clearAll.mockClear();


        // Act: Call startNewGame again
        await gameEngineInstance.startNewGame('anotherWorld');

        // Assert: Verify warning log (updated for startNewGame message)
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(`GameEngine: startNewGame('anotherWorld') called, but engine is already initialized. Please stop the engine first.`);

        // Verify no services were resolved or main methods called during the second attempt
        expect(mockEntityManager.clearAll).not.toHaveBeenCalled();
        // We expect no *new* resolve calls for InitializationService or TurnManager for the *second* game start attempt.
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.InitializationService);
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
        expect(mockTurnManager.start).not.toHaveBeenCalled();
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });

    // Test Case: Invalid worldName
    it('should throw an error and log if startNewGame() is called without a valid worldName', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        const expectedError = new Error('GameEngine.startNewGame requires a valid non-empty worldName argument.');
        const expectedLogMessage = 'GameEngine: Fatal Error - startNewGame() called without a valid worldName.';

        // Clear mocks from constructor
        mockLogger.error.mockClear();
        mockAppContainer.resolve.mockClear(); // Clear constructor resolve calls
        mockInitializationService.runInitializationSequence.mockClear();
        mockTurnManager.start.mockClear();
        mockValidatedEventDispatcher.dispatchValidated.mockClear();
        mockEntityManager.clearAll.mockClear();

        // Test null
        await expect(gameEngineInstance.startNewGame(null)).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        // Test empty string
        await expect(gameEngineInstance.startNewGame('')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        // Test whitespace string
        await expect(gameEngineInstance.startNewGame('   ')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        // Verify no main initialization/startup attempt occurred after the argument check
        expect(mockEntityManager.clearAll).not.toHaveBeenCalled();
        // No *new* resolves should have happened for these critical services during the invalid calls
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.InitializationService);
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
        expect(mockTurnManager.start).not.toHaveBeenCalled();
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });

}); // End describe block