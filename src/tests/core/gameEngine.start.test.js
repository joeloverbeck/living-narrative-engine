// src/tests/core/gameEngine.start.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // <<< ADDED: Import tokens

// --- Type Imports for Mocks ---
// Core Services
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
// --- Refactoring Specific Imports ---
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/initializers/services/initializationService.js').InitializationResult} InitializationResult */
// --- Type Imports for MOCKS previously needed but no longer asserted directly ---
// /** @typedef {import('../../core/loaders/worldLoader.js').default} WorldLoader */
// /** @typedef {import('../../core/initializers/gameStateInitializer.js').default} GameStateInitializer */
// /** @typedef {import('../../core/initializers/worldInitializer.js').default} WorldInitializer */
// /** @typedef {import('../../core/initializers/systemInitializer.js').default} SystemInitializer */
// /** @typedef {import('../../core/setup/inputSetupService.js').default} InputSetupService */


// --- Test Suite ---
describe('GameEngine start() - Success Path (Initialization Delegated)', () => { // Updated description

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockvalidatedEventDispatcher;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {jest.Mocked<InitializationService>} */ // THE key mock
    let mockInitializationService;

    // --- MOCKS NO LONGER NEEDED for direct assertion in *these* tests ---
    // /** @type {jest.Mocked<WorldLoader>} */ let mockWorldLoader;
    // /** @type {jest.Mocked<GameStateInitializer>} */ let mockGameStateInitializer;
    // /** @type {jest.Mocked<WorldInitializer>} */ let mockWorldInitializer;
    // /** @type {jest.Mocked<SystemInitializer>} */ let mockSystemInitializer;
    // /** @type {jest.Mocked<InputSetupService>} */ let mockInputSetupService;
    // /** @type {jest.Mocked<GameStateManager>} */ let mockGameStateManager; // Only needed if start() directly used it post-init


    beforeEach(() => {
        jest.clearAllMocks();

        // --- Create Mock Logger ---
        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

        // --- Create Mocks for Services GameEngine Directly Interacts With ---
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        const gameLoopState = {isRunning: false};
        mockGameLoop = { // Instance needs to be returned by InitializationService mock
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
        const successfulInitResult = {success: true, error: null, gameLoop: mockGameLoop};
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue(successfulInitResult),
        };

        // --- MOCKS NO LONGER INSTANTIATED HERE ---
        // mockWorldLoader = { loadWorld: jest.fn().mockResolvedValue(undefined) };
        // mockGameStateInitializer = { setupInitialState: jest.fn().mockResolvedValue(true) };
        // mockWorldInitializer = { initializeWorldEntities: jest.fn().mockReturnValue(true) };
        // mockSystemInitializer = { initializeAll: jest.fn().mockResolvedValue(undefined) };
        // mockInputSetupService = { configureInputHandler: jest.fn() };
        // mockGameStateManager = { getPlayer: jest.fn(), getCurrentLocation: jest.fn(), ... };


        // --- Create Mock AppContainer ---
        mockAppContainer = {
            resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn(),
        };

        // --- Configure Mock AppContainer.resolve ---
        // Only specify mocks for services DIRECTLY resolved by GameEngine.start()
        mockAppContainer.resolve.mockImplementation((key) => {
            // <<< FIXED: Use tokens for keys >>>
            switch (key) {
                case tokens.ILogger:
                    return mockLogger; // Constructor
                case tokens.InitializationService:
                    return mockInitializationService; // Resolved by start()
                case tokens.IValidatedEventDispatcher:
                    return mockvalidatedEventDispatcher; // Resolved by start() post-init

                // GameLoop is obtained from initResult, not resolved again here
                // Other initializers/loaders are resolved *within* InitializationService

                default:
                    // Keep track of unexpected resolutions for easier debugging
                    console.warn(`MockAppContainer: Success Path Tests - Unexpected resolution attempt for key:`, key);
                    throw new Error(`MockAppContainer: Success Path Tests - Unexpected resolution attempt for key.`);
            }
        });
    });

    // --- Test Case: TEST-ENG-004 (Updated) ---
    // Focus on GameEngine resolving its direct needs and calling InitializationService
    it('[TEST-ENG-004 Updated] should resolve required services, call InitializationService, start loop, and dispatch final message', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        // Resolve logger during construction BEFORE clearing mocks
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        mockAppContainer.resolve.mockClear(); // Clear constructor resolve
        mockInitializationService.runInitializationSequence.mockClear();
        mockGameLoop.start.mockClear();
        mockvalidatedEventDispatcher.dispatchValidated.mockClear();

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        // 1. Verify InitializationService was resolved
        // <<< FIXED: Use token in assertion >>>
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);

        // 2. Verify InitializationService.runInitializationSequence was called correctly
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);

        // 3. Verify GameLoop.start was called (using the loop instance provided by the service result)
        expect(mockGameLoop.start).toHaveBeenCalledTimes(1);

        // 4. Verify ValidatedEventDispatcher was resolved for the final message
        // <<< FIXED: Use token in assertion >>>
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);

        // 5. Verify the final "Game loop started" message was dispatched
        expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            {text: 'Game loop started.', type: 'info'} // Adjusted message based on GameEngine code
        );

        // --- REMOVED Assertions for internal initializer/loader resolution/calls ---
        // <<< FIXED: Check for *string* names, not tokens, as these shouldn't be resolved directly >>>
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('WorldLoader');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('GameStateInitializer');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('WorldInitializer');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('SystemInitializer');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('InputSetupService');
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('GameLoop'); // Added check for GameLoop string name
        // expect(mockWorldLoader.loadWorld).not.toHaveBeenCalled(); // No longer asserted here
        // expect(mockGameStateInitializer.setupInitialState).not.toHaveBeenCalled(); // No longer asserted here
        // etc.
    });

    // --- Test Case: TEST-ENG-005 (Removed) ---
    // REASON: Specific detailed progress events are no longer dispatched directly by GameEngine.start().
    // InitializationService and its components are responsible. Only the final message remains.

    // --- Test Case: TEST-ENG-006 (Removed) ---
    // REASON: WorldLoader.loadWorld call is internal to InitializationService.

    // --- Test Case: TEST-ENG-008 (Removed) ---
    // REASON: GameStateInitializer.setupInitialState call is internal to InitializationService.

    // --- Test Case: TEST-ENG-009 (Removed) ---
    // REASON: WorldInitializer.initializeWorldEntities call is internal to InitializationService.

    // --- Test Case: TEST-ENG-012 (Revised) ---
    // Focus: GameEngine gets GameLoop instance from InitializationService result, doesn't resolve it again.
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
        // <<< FIXED: Check against token AND string literal for robustness >>>
        expect(resolvedKeysAfterConstructor).not.toContain(tokens.GameLoop); // Check token
        expect(resolvedKeysAfterConstructor).not.toContain('GameLoop'); // Check string

        // Verify the provided mockGameLoop's start method was called
        expect(mockGameLoop.start).toHaveBeenCalledTimes(1);
    });


    // --- Test Case: TEST-ENG-013 (Updated) ---
    // Focus on logs generated *directly* by GameEngine.start() during its orchestration role.
    it('[TEST-ENG-013 Updated] should log key orchestration messages during successful delegated initialization', async () => {
        // --- Arrange ---
        const worldName = 'testWorld';
        // Resolve logger during construction BEFORE clearing mocks
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        mockLogger.info.mockClear(); // Clear constructor log
        mockLogger.debug.mockClear(); // Also clear debug logs if checking them

        // --- Act ---
        await gameEngineInstance.start(worldName);

        // --- Assert ---
        // Check logs from start() related to orchestration
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting initialization sequence for world: ${worldName}...`);
        expect(mockLogger.debug).toHaveBeenCalledWith('GameEngine: InitializationService resolved.'); // Added debug log check

        // Log after InitializationService returns successfully
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Initialization sequence reported success.'); // Changed from 'completed successfully'

        // Logs related to starting the loop
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Starting GameLoop...');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: GameLoop started successfully.');


        // --- Ensure logs related to the *internal steps* of initialization are GONE ---
        // (These assertions remain the same)
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameDataRepository resolved'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('WorldLoader resolved'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Initial game state setup completed'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Initial world entities instantiated'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Delegating input handler setup'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('InputHandler resolved'));
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameLoop resolved.')); // Resolved internally now
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Dispatching core:engine_initialized event'));
        // This specific wording check might need adjustment if the logging within InitializationService changes significantly.
        // For now, focusing on GameEngine's direct logs.
        // expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`Initialization sequence for world '${worldName}' completed successfully.`));

    });

}); // End describe block for gameEngine.start.test.js