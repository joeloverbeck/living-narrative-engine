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
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */ // Still needed for InitializationResult type hint
/** @typedef {import('../../core/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */

// --- Refactoring Specific Imports ---
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/initializers/services/initializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('../../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */


// --- Test Suite ---
describe('GameEngine startNewGame() - Post-Initialization Success Logic', () => { // <<< UPDATED describe block

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
    let mockGameLoop; // Keep for InitializationResult simulation
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


    // --- Shared Test Variables ---
    const inputWorldName = 'testInputWorld';


    beforeEach(() => {
        jest.clearAllMocks();

        // --- Create Mock Logger ---
        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

        // --- Create Mock Core Services Relevant to Post-Init ---
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), isRunning: false}; // Keep for init result object
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            setCurrentTurn: jest.fn()
        };

        // --- Mock Initialization Service ---
        const successfulInitResult = {success: true, error: null, gameLoop: mockGameLoop}; // Simulates return value
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue(successfulInitResult),
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


        // --- Create Mock AppContainer ---
        mockAppContainer = {
            resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn(),
        };

        // --- Configure Mock AppContainer.resolve ---
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.IValidatedEventDispatcher) return mockvalidatedEventDispatcher;
            if (key === tokens.ITurnManager) return mockTurnManager;
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return mockGamePersistenceService;
            if (key === tokens.IDataRegistry) return mockDataRegistry;
            if (key === tokens.EntityManager) return mockEntityManager;
            if (key === tokens.ShutdownService) return mockShutdownService;


            // Default behavior for unhandled keys in this test setup
            console.warn(`MockAppContainer (Post-Init Tests): Unexpected resolution attempt for key "${String(key)}". Returning undefined.`);
            return undefined;
        });
    });

    // --- Test Case: TEST-ENG-023 (Revised) ---
    describe('[TEST-ENG-023 Revised] Logging Post-Successful Initialization', () => {
        it('should log successful completion of initialization and intent to start TurnManager', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            // Clear info logs from constructor if any, to focus on startNewGame logs
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();


            await gameEngine.startNewGame(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);

            // Logs from startNewGame() itself
            expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting NEW GAME initialization sequence for world: ${inputWorldName}...`);
            // Debug logs from startNewGame()
            expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: Clearing EntityManager before new game initialization.');
            expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: InitializationService resolved for new game.');
            // Info log from startNewGame()
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: New game initialization sequence reported success.');

            // Logs from #onGameReady()
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Game data processed. Engine is now initialized.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: Starting TurnManager...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine.#onGameReady: TurnManager started successfully.');

            // Ensure old/other logs are not present
            expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Resolving TurnManager for new game...');
            expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting TurnManager for new game...'); // This specific message is replaced
            expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting GameLoop...');
            expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: GameLoop started successfully.');
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameDataRepository resolved'));
        });
    });

    // --- Test Case: TEST-ENG-026 (Revised & Simplified) ---
    describe('[TEST-ENG-026 Revised] Internal State Check Pre-Loop Start', () => {
        it('should verify internal state reflects successful initialization and resolve necessary services', async () => {
            // Arrange: Create instance and check initial state
            const gameEngine = new GameEngine({container: mockAppContainer});
            expect(gameEngine.isInitialized).toBe(false);

            // GameLoop is not a direct property of GameEngine anymore
            // expect(gameEngine.gameLoop).toBeUndefined();


            // Arrange: Clear mocks right before the action we want to analyze
            // mockAppContainer.resolve calls from constructor are fine. We're interested in calls during startNewGame.
            const resolveCallsBefore = mockAppContainer.resolve.mock.calls.length;
            mockTurnManager.start.mockClear();

            // Act: Call startNewGame() exactly ONCE
            await gameEngine.startNewGame(inputWorldName);

            // Assert: Check final state
            expect(gameEngine.isInitialized).toBe(true);

            // Assert: Verify TurnManager was started exactly once during this call
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

            // Assert: Check that specific services were resolved *during this specific startNewGame call* (or by #onGameReady)
            // This means we check for calls beyond those made by the constructor.
            // We expect InitializationService and ITurnManager to be resolved.
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);

            // Assert: Check that unrelated services like GameLoop were NOT resolved by GameEngine directly
            let gameLoopResolved = false;
            for (const call of mockAppContainer.resolve.mock.calls) {
                if (call[0] === tokens.GameLoop) {
                    gameLoopResolved = true;
                    break;
                }
            }
            expect(gameLoopResolved).toBe(false);
        });
    });


    // --- Test Case: TEST-ENG-028 (Revised for TurnManager) ---
    describe('[TEST-ENG-028] TurnManager.start Call', () => {
        it('should call mockTurnManager.start exactly once after successful initialization', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await gameEngine.startNewGame(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
        });
    });

    // --- Test Case: TEST-ENG-029 (Updated Message Text) ---
    describe('[TEST-ENG-029] Final Message Dispatch Post-Loop Start', () => {
        it('should correctly initialize and start TurnManager without dispatching a specific final message via ValidatedEventDispatcher', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});

            mockvalidatedEventDispatcher.dispatchValidated.mockClear();
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await gameEngine.startNewGame(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

            // Verify that ValidatedEventDispatcher was NOT called with the old message
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'game.engine.ready', // Assuming some event name
                expect.objectContaining({text: 'Game ready. Turn processing started.'})
            );
        });
    });

}); // End describe block for gameEngine.start.postInit.test.js