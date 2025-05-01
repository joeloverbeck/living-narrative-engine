// src/tests/core/gameEngine.start.postInit.test.js

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


// --- Test Suite ---
describe('GameEngine start() - Post-Initialization Success Logic', () => {

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockvalidatedEventDispatcher; // Declaration remains
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {jest.Mocked<InitializationService>} */ // Mock for the delegated service
    let mockInitializationService;

    // --- Shared Test Variables ---
    const inputWorldName = 'testInputWorld';


    beforeEach(() => {
        jest.clearAllMocks();

        // --- Create Mock Logger ---
        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

        // --- Create Mock Core Services Relevant to Post-Init ---
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), isRunning: false};
        // *** FIXED: Restore the assignment of the mock object ***
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};

        // --- Mock Initialization Service ---
        const successfulInitResult = {success: true, error: null, gameLoop: mockGameLoop};
        mockInitializationService = {
            runInitializationSequence: jest.fn().mockResolvedValue(successfulInitResult),
        };

        // --- Create Mock AppContainer ---
        mockAppContainer = {
            resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn(),
        };

        // --- Configure Mock AppContainer.resolve ---
        // Now mockvalidatedEventDispatcher will be defined when this function is called later
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.IValidatedEventDispatcher) return mockvalidatedEventDispatcher;

            console.warn(`MockAppContainer (Post-Init Tests): Unexpected resolution attempt for key "${String(key)}". Returning undefined.`);
            return undefined;
        });
    });

    // --- Test Case: TEST-ENG-023 (Revised) ---
    describe('[TEST-ENG-023 Revised] Logging Post-Successful Initialization', () => {
        it('should log successful completion of initialization and intent to start GameLoop', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            mockLogger.info.mockClear(); // Clear constructor logs

            await gameEngine.start(inputWorldName);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Initialization sequence reported success.');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Starting GameLoop...');
            expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: GameLoop started successfully.');
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('GameDataRepository resolved'));
            // ... other not.toHaveBeenCalledWith checks ...
        });
    });

    // --- Test Case: TEST-ENG-026 (Revised & Simplified) ---
    describe('[TEST-ENG-026 Revised] Internal State Check Pre-Loop Start', () => {
        it('should verify internal state reflects successful initialization and not resolve unnecessary services', async () => {
            // Arrange: Create instance and check initial state
            const gameEngine = new GameEngine({container: mockAppContainer});
            expect(gameEngine.isInitialized).toBe(false);
            expect(gameEngine.gameLoop).toBeNull();

            // Arrange: Clear mocks right before the action we want to analyze
            mockAppContainer.resolve.mockClear(); // Clear constructor resolve calls
            mockGameLoop.start.mockClear();       // Clear any potential previous start calls (belt-and-suspenders)

            // Act: Call start() exactly ONCE
            await gameEngine.start(inputWorldName);

            // Assert: Check final state
            expect(gameEngine.isInitialized).toBe(true);
            expect(gameEngine.gameLoop).toBe(mockGameLoop);

            // Assert: Verify loop was started exactly once during this call
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1);

            // Assert: Check that GameStateManager was NOT resolved *during this specific start call*
            expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.GameStateManager);

            // Optional: Verify other expected resolutions during this start call
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
            // Count should be 2 (InitService + EventDispatcher), as Logger was resolved in constructor (before clear)
            expect(mockAppContainer.resolve).toHaveBeenCalledTimes(2);
        });
    });


    // --- Test Case: TEST-ENG-028 (Remains Valid) ---
    describe('[TEST-ENG-028] GameLoop.start Call', () => {
        it('should call mockGameLoop.start exactly once after successful initialization', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer});
            // Clear mocks just before the action
            mockGameLoop.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear(); // Also clear this if needed

            await gameEngine.start(inputWorldName);

            // Verify InitializationService was called (pre-condition)
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            // Assert GameLoop.start was called by GameEngine.start() exactly once
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1);
        });
    });

    // --- Test Case: TEST-ENG-029 (Remains Valid) ---
    describe('[TEST-ENG-029] Final Message Dispatch Post-Loop Start', () => {
        it('should resolve ValidatedEventDispatcher and dispatch the final "Game loop started." message', async () => {
            const gameEngine = new GameEngine({container: mockAppContainer}); // Instance for this test
            const expectedPayload = {
                text: 'Game loop started.',
                type: 'info'
            };

            // Clear mocks specifically for the actions within this test's scope AFTER constructor
            // Now this line should work because mockvalidatedEventDispatcher is defined from beforeEach
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();
            mockAppContainer.resolve.mockClear(); // Clear constructor resolve calls
            mockGameLoop.start.mockClear(); // Ensure start call count is clean for this test too
            mockInitializationService.runInitializationSequence.mockClear();

            // --- Execute the core action ---
            await gameEngine.start(inputWorldName);

            // --- Assertions about actions *during* the start() call ---
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(inputWorldName);
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
            expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'textUI:display_message',
                expectedPayload
            );
            expect(mockAppContainer.resolve).toHaveBeenCalledTimes(2); // InitService + Dispatcher
        });
    });

}); // End describe block for gameEngine.start.postInit.test.js
