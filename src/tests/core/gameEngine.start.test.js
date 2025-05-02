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
/** @typedef {import('../../core/interfaces/ITurnManager.js').ITurnManager} ITurnManager */ // <<< ADDED: Type import for ITurnManager
// --- Refactoring Specific Imports ---
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/initializers/services/initializationService.js').InitializationResult} InitializationResult */

// --- Test Suite ---
describe('GameEngine start() - Success Path (Initialization Delegated)', () => {

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockvalidatedEventDispatcher;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;
    /** @type {jest.Mocked<ITurnManager>} */ // <<< ADDED: Mock variable for ITurnManager
    let mockTurnManager;


    beforeEach(() => {
        jest.clearAllMocks();

        // --- Create Mock Logger ---
        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

        // --- Create Mocks for Services GameEngine Directly Interacts With ---
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        const gameLoopState = {isRunning: false};
        // Note: GameLoop is provided by InitializationService, not resolved directly by start()
        mockGameLoop = {
            start: jest.fn(() => {
                gameLoopState.isRunning = true;
            }),
            stop: jest.fn(() => {
                gameLoopState.isRunning = false;
            }),
            processSubmittedCommand: jest.fn(),
            get isRunning() {
                return gameLoopState.isRunning;
            },
        };
        // Configure InitializationService mock to report SUCCESS and provide the GameLoop mock
        const successfulInitResult = {success: true, error: null, gameLoop: mockGameLoop}; // GameLoop is included here but not directly used by GameEngine.start post-refactor
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue(successfulInitResult),
        };

        // <<< ADDED: Instantiate Mock Turn Manager >>>
        // GameEngine.start needs to resolve ITurnManager and call its start method
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined), // Assume start() is async
            stop: jest.fn().mockResolvedValue(undefined)   // Add stop for completeness/other tests
        };


        // --- Create Mock AppContainer ---
        mockAppContainer = {
            resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn(),
        };

        // --- Configure Mock AppContainer.resolve ---
        // Only specify mocks for services DIRECTLY resolved by GameEngine.start() itself
        mockAppContainer.resolve.mockImplementation((key) => {
            switch (key) {
                case tokens.ILogger:
                    return mockLogger; // Resolved by Constructor
                case tokens.InitializationService:
                    return mockInitializationService; // Resolved by start() before calling run...
                case tokens.ITurnManager: // <<< ADDED: Handle ITurnManager resolution
                    return mockTurnManager;   // <<< RETURN: The new mock
                case tokens.IValidatedEventDispatcher:
                    return mockvalidatedEventDispatcher; // Resolved by start() post-init for final message

                // GameLoop is obtained from initResult, not resolved again here
                // Other initializers/loaders are resolved *within* InitializationService

                default:
                    // Keep track of unexpected resolutions for easier debugging
                    console.warn(`MockAppContainer: Success Path Tests - Unexpected resolution attempt for key:`, key);
                    throw new Error(`MockAppContainer: Success Path Tests - Unexpected resolution attempt for key: ${String(key)}`); // Added key to error message
            }
        });
    });

    // --- Test Case: TEST-ENG-004 (Updated) ---
    // Focus on GameEngine resolving its direct needs, calling InitializationService, resolving TurnManager, starting it, and dispatching message
    it('[TEST-ENG-004 Updated] should resolve required services, call InitializationService, start TurnManager, and dispatch final message', async () => { // <<< Updated description slightly
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({container: mockAppContainer}); // Resolves ILogger here
        // Clear mocks called during construction or setup before the main action
        mockAppContainer.resolve.mockClear();
        mockInitializationService.runInitializationSequence.mockClear();
        mockTurnManager.start.mockClear(); // <<< ADDED: Clear TurnManager start mock
        mockvalidatedEventDispatcher.dispatchValidated.mockClear();

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        // 1. Verify InitializationService was resolved FIRST
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);

        // 2. Verify InitializationService.runInitializationSequence was called correctly
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);

        // 3. Verify TurnManager was resolved AFTER InitializationService call (assuming success)
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager); // <<< ADDED Assertion

        // 4. Verify TurnManager.start was called
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1); // <<< ADDED Assertion

        // 5. Verify ValidatedEventDispatcher was resolved for the final message
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);

        // 6. Verify the final "Game ready..." message was dispatched
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            {text: 'Game ready. Turn processing started.', type: 'info'} // Adjusted message based on GameEngine code
        );

        // --- Assert NO LONGER USED MOCKS ---
        // Verify GameLoop.start was NOT called directly by GameEngine (TurnManager handles this now)
        expect(mockGameLoop.start).not.toHaveBeenCalled(); // <<< UPDATED Assertion

        // --- Check against unexpected resolutions ---
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('WorldLoader');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('WorldInitializer');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('SystemInitializer');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('InputSetupService');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.GameLoop); // Check token
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('GameLoop'); // Check string

        // Check call order if necessary (InitializationService resolve -> TurnManager resolve -> EventDispatcher resolve)
        const resolveOrder = mockAppContainer.resolve.mock.calls.map(call => call[0]);
        expect(resolveOrder).toEqual([
            tokens.InitializationService,
            tokens.ITurnManager,
            tokens.IValidatedEventDispatcher
        ]);
    });

    // --- Test Case: TEST-ENG-012 (Revised) ---
    // Focus: GameEngine does NOT resolve GameLoop directly post-constructor.
    it('[TEST-ENG-012 Revised] should use the GameLoop instance provided by InitializationService result', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        mockAppContainer.resolve.mockClear(); // Clear constructor resolve

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        // Verify GameLoop was NOT resolved directly by GameEngine.start() post-constructor
        const resolveCallsAfterConstructor = mockAppContainer.resolve.mock.calls;
        const resolvedKeysAfterConstructor = resolveCallsAfterConstructor.map(callArgs => callArgs[0]);

        expect(resolvedKeysAfterConstructor).not.toContain(tokens.GameLoop); // Check token
        expect(resolvedKeysAfterConstructor).not.toContain('GameLoop'); // Check string

        // Verify the provided mockGameLoop's start method was NOT called directly by GameEngine
        expect(mockGameLoop.start).not.toHaveBeenCalled(); // <<< UPDATED Assertion: GameEngine doesn't call gameLoop.start anymore

        // Verify TurnManager.start WAS called (as this is the new mechanism)
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1); // <<< ADDED Assertion
    });


    // --- Test Case: TEST-ENG-013 (Updated) ---
    // Focus on logs generated *directly* by GameEngine.start() during its orchestration role.
    it('[TEST-ENG-013 Updated] should log key orchestration messages during successful delegated initialization', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        const gameEngineInstance = new GameEngine({container: mockAppContainer}); // Resolves ILogger here
        mockLogger.info.mockClear(); // Clear constructor log
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();


        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        // Check logs from start() related to orchestration
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting initialization sequence for world: ${worldName}...`);
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: InitializationService resolved.');

        // Log after InitializationService returns successfully
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Initialization sequence reported success.');

        // Logs related to resolving and starting TurnManager
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Resolving TurnManager...'); // <<< ADDED Assertion
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Starting TurnManager...'); // <<< ADDED Assertion
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: TurnManager started successfully.'); // <<< ADDED Assertion

        // Ensure logs related to starting the *GameLoop directly* are GONE
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: Starting GameLoop...'); // <<< UPDATED Assertion
        expect(mockLogger.info).not.toHaveBeenCalledWith('GameEngine: GameLoop started successfully.'); // <<< UPDATED Assertion


        // --- Ensure logs related to the *internal steps* of initialization are GONE ---
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameDataRepository resolved'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('WorldLoader resolved'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Initial game state setup completed'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Initial world entities instantiated'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Delegating input handler setup'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('InputHandler resolved'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameLoop resolved.'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Dispatching core:engine_initialized event'));

    });

}); // End describe block for gameEngine.start.test.js