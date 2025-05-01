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
/** @typedef {import('../../core/interfaces/ITurnManager.js').ITurnManager} ITurnManager */

// --- Refactoring Specific Imports ---
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/initializers/services/initializationService.js').InitializationResult} InitializationResult */


// --- Test Suite ---
describe('GameEngine start() - Post-Initialization Success Logic', () => {

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


    // --- Shared Test Variables ---
    const inputWorldName = 'testInputWorld';


    beforeEach(() => {
        jest.clearAllMocks();

        // --- Create Mock Logger ---
        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

        // --- Create Mock Core Services Relevant to Post-Init ---
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), isRunning: false}; // Keep for init result object
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockTurnManager = {start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined)};

        // --- Mock Initialization Service ---
        const successfulInitResult = {success: true, error: null, gameLoop: mockGameLoop}; // Simulates return value
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue(successfulInitResult),
        };

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

            // <<< MODIFIED: Remove the specific handling for tokens.GameLoop >>>
            // Let it fall through to the default behavior for unhandled keys,
            // which is more accurate for the state *before* initialization completes.
            // if (key === tokens.GameLoop) {
            //     return mockGameLoop;
            // }

            // Default behavior for unhandled keys in this test setup
            console.warn(`MockAppContainer (Post-Init Tests): Unexpected resolution attempt for key "${String(key)}". Returning undefined.`);
            return undefined;
        });
    });

    // --- Test Case: TEST-ENG-023 (Revised) ---
    describe('[TEST-ENG-023 Revised] Logging Post-Successful Initialization', () => {
        it('should log successful completion of initialization and intent to start TurnManager', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            mockLogger.info.mockClear(); // Clear constructor logs

            await gameEngine.start(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Initialization sequence reported success.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Resolving TurnManager...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Starting TurnManager...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: TurnManager started successfully.');
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

            // <<< UPDATED Assertion: Expect undefined because mock container returns undefined for GameLoop now >>>
            expect(gameEngine.gameLoop).toBeUndefined();


            // Arrange: Clear mocks right before the action we want to analyze
            mockAppContainer.resolve.mockClear(); // Clear constructor resolve calls
            mockTurnManager.start.mockClear();

            // Act: Call start() exactly ONCE
            await gameEngine.start(inputWorldName);

            // Assert: Check final state
            expect(gameEngine.isInitialized).toBe(true);

            // Assert: Verify TurnManager was started exactly once during this call
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

            // Assert: Check that unrelated services were NOT resolved *during this specific start call*
            expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.GameStateManager);
            expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.GameLoop); // GameLoop shouldn't be resolved by start() itself

            // Optional: Verify other expected resolutions during this start call
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
            // Count should be 3 (InitService + TurnManager + EventDispatcher)
            expect(mockAppContainer.resolve).toHaveBeenCalledTimes(3);
        });
    });


    // --- Test Case: TEST-ENG-028 (Revised for TurnManager) ---
    describe('[TEST-ENG-028] TurnManager.start Call', () => {
        it('should call mockTurnManager.start exactly once after successful initialization', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await gameEngine.start(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
        });
    });

    // --- Test Case: TEST-ENG-029 (Updated Message Text) ---
    describe('[TEST-ENG-029] Final Message Dispatch Post-Loop Start', () => {
        it('should resolve ValidatedEventDispatcher and dispatch the final "Game ready. Turn processing started." message', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            const expectedPayload = {
                text: 'Game ready. Turn processing started.',
                type: 'info'
            };

            mockvalidatedEventDispatcher.dispatchValidated.mockClear();
            mockAppContainer.resolve.mockClear();
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await gameEngine.start(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'textUI:display_message',
                expectedPayload
            );
            expect(mockAppContainer.resolve).toHaveBeenCalledTimes(3);
        });
    });

}); // End describe block for gameEngine.start.postInit.test.js