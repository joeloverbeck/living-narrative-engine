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

// Additional types for constructor mocks
/** @typedef {import('../../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
// Updated to use IEntityManager for the type hint of the mock
/** @typedef {import('../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */


// --- Test Suite ---
describe('GameEngine startNewGame() - Success Path (Initialization Delegated)', () => {

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockValidatedEventDispatcher;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
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
    let mockDataRegistry; // Though not directly used by constructor, kept for potential test evolution
    /** @type {jest.Mocked<IEntityManager>} */ // Updated mock type
    let mockEntityManager;
    /** @type {jest.Mocked<ShutdownService>} */
    let mockShutdownService; // Though not directly used by constructor, kept for potential test evolution


    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockValidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), processSubmittedCommand: jest.fn(), isRunning: false};

        const successfulInitResult = {success: true, error: null, gameLoop: mockGameLoop};
        mockInitializationService = {runInitializationSequence: jest.fn().mockResolvedValue(successfulInitResult)};
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
                case tokens.PlaytimeTracker:
                    return mockPlaytimeTracker;
                case tokens.GamePersistenceService:
                    return mockGamePersistenceService;
                // VVVVVV MODIFIED VVVVVV
                case tokens.IEntityManager: // GameEngine constructor now asks for IEntityManager
                    return mockEntityManager;
                // ^^^^^^ MODIFIED ^^^^^^
                // Dependencies for GameEngine.startNewGame() (if not covered above)
                case tokens.InitializationService:
                    return mockInitializationService;
                case tokens.ITurnManager:
                    return mockTurnManager;
                // Optional dependencies, or those not strictly needed for every test path
                case tokens.IDataRegistry: // Kept for completeness if other tests evolve
                    return mockDataRegistry;
                case tokens.ShutdownService: // Kept for completeness
                    return mockShutdownService;
                case tokens.IValidatedEventDispatcher: // May not be used in all success paths
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

        // Clear mocks that might have been called by the constructor
        mockAppContainer.resolve.mockClear();
        mockInitializationService.runInitializationSequence.mockClear();
        mockTurnManager.start.mockClear();
        if (mockValidatedEventDispatcher && mockValidatedEventDispatcher.dispatchValidated) {
            mockValidatedEventDispatcher.dispatchValidated.mockClear();
        }
        mockEntityManager.clearAll.mockClear(); // Called by startNewGame
        mockPlaytimeTracker.reset.mockClear(); // Called by startNewGame
        mockPlaytimeTracker.startSession.mockClear(); // Called by startNewGame

        await gameEngineInstance.startNewGame(worldName);

        expect(mockEntityManager.clearAll).toHaveBeenCalledTimes(1);
        expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
        expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

        if (mockValidatedEventDispatcher && mockValidatedEventDispatcher.dispatchValidated) {
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        }
        expect(mockGameLoop.start).not.toHaveBeenCalled(); // GameLoop is not started directly by GameEngine

        const resolveOrderDuringStart = mockAppContainer.resolve.mock.calls.map(call => call[0]);
        // Check for specific resolutions during startNewGame, not constructor
        expect(resolveOrderDuringStart).toEqual(expect.arrayContaining([
            tokens.InitializationService, // First in startNewGame try block
            tokens.ITurnManager         // In #onGameReady
        ]));
    });

    it('[TEST-ENG-012 Revised] should rely on TurnManager to handle GameLoop, not use GameLoop from InitializationService result directly', async () => {
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        // Clear mocks from constructor
        mockAppContainer.resolve.mockClear();
        mockTurnManager.start.mockClear();
        mockPlaytimeTracker.reset.mockClear();
        mockPlaytimeTracker.startSession.mockClear();


        await gameEngineInstance.startNewGame(worldName);

        const resolvedKeysDuringStartNewGame = mockAppContainer.resolve.mock.calls.map(callArgs => callArgs[0]);

        expect(resolvedKeysDuringStartNewGame).not.toContain(tokens.GameLoop);
        expect(resolvedKeysDuringStartNewGame).not.toContain('GameLoop'); // String literal check just in case
        expect(mockGameLoop.start).not.toHaveBeenCalled();
        expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
        expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
    });

    it('[TEST-ENG-013 Updated] should log key orchestration messages during successful delegated initialization', async () => {
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        // Clear all logger mocks from constructor
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        // Clear other relevant mocks
        mockEntityManager.clearAll.mockClear();
        mockPlaytimeTracker.reset.mockClear();
        mockPlaytimeTracker.startSession.mockClear();


        await gameEngineInstance.startNewGame(worldName);

        expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
        expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);

        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting NEW GAME initialization sequence for world: ${worldName}...`);
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Clearing EntityManager before new game initialization.');
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Resetting PlaytimeTracker for new game session.');
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: InitializationService resolved for new game.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: New game initialization sequence reported success.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Game data processed. Engine is now initialized.');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: Starting TurnManager...');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: TurnManager started successfully.');
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: New game '${worldName}' started successfully and is ready.`);


        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Resolving TurnManager for new game...');
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting TurnManager for new game...');
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting GameLoop...');
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: GameLoop started successfully.');
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameDataRepository resolved'));
    });

});