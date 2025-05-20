// src/tests/core/gameEngine.start.postInit.test.js

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

// --- Refactoring Specific Imports ---
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/initializers/services/initializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('../../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
// Updated to use IEntityManager for the type hint of the mock
/** @typedef {import('../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */


// --- Test Suite ---
describe('GameEngine startNewGame() - Post-Initialization Success Logic', () => {

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockvalidatedEventDispatcher;
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;
    /** @type {jest.Mocked<ITurnManager>} */
    let mockTurnManager;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
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


    // --- Shared Test Variables ---
    const inputWorldName = 'testInputWorld';


    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), isRunning: false};
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            setCurrentTurn: jest.fn()
        };
        const successfulInitResult = {success: true, error: null, gameLoop: mockGameLoop};
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue(successfulInitResult),
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

        mockAppContainer = {
            resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn(),
        };

        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.IValidatedEventDispatcher) return mockvalidatedEventDispatcher;
            if (key === tokens.ITurnManager) return mockTurnManager;
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            // VVVVVV MODIFIED VVVVVV
            if (key === tokens.IEntityManager) return mockEntityManager; // GameEngine constructor now asks for IEntityManager
            // ^^^^^^ MODIFIED ^^^^^^
            if (key === tokens.ShutdownService) return mockShutdownService;

            console.warn(`MockAppContainer (Post-Init Tests): Unexpected resolution attempt for key "${String(key)}". Returning undefined.`);
            return undefined;
        });
    });

    // --- Test Case: TEST-ENG-023 (Revised) ---
    describe('[TEST-ENG-023 Revised] Logging Post-Successful Initialization', () => {
        it('should log successful completion of initialization and intent to start TurnManager', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();

            await gameEngine.startNewGame(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);

            expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting NEW GAME initialization sequence for world: ${inputWorldName}...`);
            expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Clearing EntityManager before new game initialization.');
            expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Resetting PlaytimeTracker for new game session.');
            expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: InitializationService resolved for new game.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: New game initialization sequence reported success.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Game data processed. Engine is now initialized.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: Starting TurnManager...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: TurnManager started successfully.');
            expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: New game '${inputWorldName}' started successfully and is ready.`);


            expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Resolving TurnManager for new game...');
            expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting TurnManager for new game...');
            expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting GameLoop...');
            expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: GameLoop started successfully.');
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameDataRepository resolved'));
        });
    });

    // --- Test Case: TEST-ENG-026 (Revised & Simplified) ---
    describe('[TEST-ENG-026 Revised] Internal State Check Pre-Loop Start', () => {
        it('should verify internal state reflects successful initialization and resolve necessary services', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            expect(gameEngine.isInitialized).toBe(false);

            // Clear mocks called by constructor before calling startNewGame
            mockTurnManager.start.mockClear();
            mockPlaytimeTracker.reset.mockClear();
            mockPlaytimeTracker.startSession.mockClear();
            mockAppContainer.resolve.mockClear(); // Clear constructor calls

            await gameEngine.startNewGame(inputWorldName);

            expect(gameEngine.isInitialized).toBe(true);
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

            // Services resolved by startNewGame and #onGameReady
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);

            let gameLoopResolved = false;
            for (const call of mockAppContainer.resolve.mock.calls) {
                if (call[0] === tokens.GameLoop) {
                    gameLoopResolved = true;
                    break;
                }
            }
            expect(gameLoopResolved).toBe(false); // GameLoop is not directly resolved by GameEngine anymore
        });
    });


    // --- Test Case: TEST-ENG-028 (Revised for TurnManager) ---
    describe('[TEST-ENG-028] TurnManager.start Call', () => {
        it('should call mockTurnManager.start exactly once after successful initialization', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            // Clear mocks from constructor and previous test states
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockPlaytimeTracker.reset.mockClear();
            mockPlaytimeTracker.startSession.mockClear();

            await gameEngine.startNewGame(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
        });
    });

    // --- Test Case: TEST-ENG-029 (Updated Message Text) ---
    describe('[TEST-ENG-029] Final Message Dispatch Post-Loop Start', () => {
        it('should correctly initialize and start TurnManager without dispatching a specific final message via ValidatedEventDispatcher', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            // Clear mocks from constructor and previous test states
            if (mockvalidatedEventDispatcher && mockvalidatedEventDispatcher.dispatchValidated) {
                mockvalidatedEventDispatcher.dispatchValidated.mockClear();
            }
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockPlaytimeTracker.reset.mockClear();
            mockPlaytimeTracker.startSession.mockClear();

            await gameEngine.startNewGame(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

            if (mockvalidatedEventDispatcher && mockvalidatedEventDispatcher.dispatchValidated) {
                expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                    'game.engine.ready',
                    expect.objectContaining({text: 'Game ready. Turn processing started.'})
                );
            }
        });
    });

});