// src/tests/core/gameEngine.start.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // Import tokens

// --- Type Imports for Mocks ---
// Core Services
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../core/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
// Refactoring Specific Imports
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
// /** @typedef {import('../../core/initializers/services/initializationService.js').InitializationResult} InitializationResult */ // Not directly used in this file's assertions

// Additional types for constructor mocks
/** @typedef {import('../../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */


// --- Test Suite ---
describe('GameEngine startNewGame() - Success Path (Initialization Delegated)', () => { // <<< UPDATED describe title

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockValidatedEventDispatcher;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop; // Provided by InitializationService, not resolved by GameEngine directly
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;
    /** @type {jest.Mocked<ITurnManager>} */
    let mockTurnManager;

    // Mocks for constructor dependencies
    /** @type {jest.Mocked<PlaytimeTracker>} */
    let mockPlaytimeTracker;
    /** @type {jest.Mocked<GamePersistenceService>} */
    let mockGamePersistenceService;
    /** @type {jest.Mocked<IDataRegistry>} */
    let mockDataRegistry;
    /** @type {jest.Mocked<EntityManager>} */
    let mockEntityManager;
    /** @type {jest.Mocked<ShutdownService>} */
    let mockShutdownService;


    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockValidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), processSubmittedCommand: jest.fn(), isRunning: false}; // Basic mock

        const successfulInitResult = {success: true, error: null, gameLoop: mockGameLoop};
        mockInitializationService = {runInitializationSequence: jest.fn().mockResolvedValue(successfulInitResult)};
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
        mockShutdownService = {runShutdownSequence: jest.fn().mockResolvedValue(undefined)};


        mockAppContainer = {resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn()};

        // Comprehensive mock for AppContainer.resolve to handle both constructor and startNewGame needs
        mockAppContainer.resolve.mockImplementation((key) => {
            switch (key) {
                // Dependencies for GameEngine Constructor
                case tokens.ILogger:
                    return mockLogger;
                case tokens.PlaytimeTracker:
                    return mockPlaytimeTracker;
                case tokens.GamePersistenceService:
                    return mockGamePersistenceService;
                case tokens.IDataRegistry:
                    return mockDataRegistry;
                case tokens.EntityManager:
                    return mockEntityManager;
                case tokens.ShutdownService:
                    return mockShutdownService;

                // Dependencies for GameEngine.startNewGame()
                case tokens.InitializationService:
                    return mockInitializationService;
                case tokens.ITurnManager:
                    return mockTurnManager;
                case tokens.IValidatedEventDispatcher: // Though not used for events in current startNewGame success path
                    return mockValidatedEventDispatcher;

                default:
                    console.warn(`MockAppContainer (start.test.js): Unexpected resolution for key:`, key);
                    throw new Error(`MockAppContainer (start.test.js): Unexpected resolution for key: ${String(key)}`);
            }
        });
    });

    it('[TEST-ENG-004 Updated] should resolve services, call InitializationService, and start TurnManager', async () => {
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        // Clear mocks that might have been called during constructor
        mockAppContainer.resolve.mockClear(); // Clear after constructor
        mockInitializationService.runInitializationSequence.mockClear();
        mockTurnManager.start.mockClear();
        mockValidatedEventDispatcher.dispatchValidated.mockClear();
        mockEntityManager.clearAll.mockClear(); // Also called in startNewGame

        await gameEngineInstance.startNewGame(worldName);

        expect(mockEntityManager.clearAll).toHaveBeenCalledTimes(1);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

        // GameEngine.startNewGame does not dispatch this event itself.
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();

        // GameLoop.start is not called directly by GameEngine anymore
        expect(mockGameLoop.start).not.toHaveBeenCalled();

        const resolveOrder = mockAppContainer.resolve.mock.calls.map(call => call[0]);
        // Order of resolution within startNewGame and #onGameReady
        expect(resolveOrder).toEqual(expect.arrayContaining([
            tokens.InitializationService, // From startNewGame
            tokens.ITurnManager         // From #onGameReady
        ]));
        // Check specific order if necessary, but arrayContaining is safer if other resolves happen for other reasons.
        // For more strictness:
        // expect(resolveOrder[0]).toBe(tokens.InitializationService);
        // expect(resolveOrder[1]).toBe(tokens.ITurnManager);
    });

    it('[TEST-ENG-012 Revised] should rely on TurnManager to handle GameLoop, not use GameLoop from InitializationService result directly', async () => {
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        // Clear constructor resolve calls and other relevant mocks
        mockAppContainer.resolve.mockClear();
        mockTurnManager.start.mockClear();

        await gameEngineInstance.startNewGame(worldName);

        const resolvedKeysDuringStartNewGame = mockAppContainer.resolve.mock.calls.map(callArgs => callArgs[0]);

        expect(resolvedKeysDuringStartNewGame).not.toContain(tokens.GameLoop); // GameEngine doesn't resolve GameLoop
        expect(resolvedKeysDuringStartNewGame).not.toContain('GameLoop'); // String check just in case
        expect(mockGameLoop.start).not.toHaveBeenCalled(); // GameEngine doesn't start it directly
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1); // TurnManager is started
    });

    it('[TEST-ENG-013 Updated] should log key orchestration messages during successful delegated initialization', async () => {
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        // Clear logs from constructor and other setup calls
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockEntityManager.clearAll.mockClear(); // Called in startNewGame

        await gameEngineInstance.startNewGame(worldName);

        // Log assertions for startNewGame()
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting NEW GAME initialization sequence for world: ${worldName}...`);
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Clearing EntityManager before new game initialization.');
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: InitializationService resolved for new game.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: New game initialization sequence reported success.');

        // Log assertions for #onGameReady()
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Game data processed. Engine is now initialized.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: Starting TurnManager...');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: TurnManager started successfully.');

        // Ensure old/other specific log messages are GONE
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Resolving TurnManager for new game...');
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting TurnManager for new game...'); // This exact message is gone
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting GameLoop...');
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: GameLoop started successfully.');
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameDataRepository resolved'));
    });

}); // End describe block