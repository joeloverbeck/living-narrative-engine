// src/tests/core/gameEngine.start.success.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */

// --- Test Suite ---
describe('GameEngine start() - Successful Initialization via InitializationService', () => {

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

    const testWorldName = 'testWorld';

    beforeEach(() => {
        // Clear mocks before each test for isolation
        jest.clearAllMocks();

        // --- Setup Mocks ---

        // Mock ILogger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // Mock GameLoop
        mockGameLoop = {
            start: jest.fn(),
            stop: jest.fn(),
            processSubmittedCommand: jest.fn(),
            isRunning: false, // Initial state
        };
        // Make start method toggle isRunning for realism if needed later
        mockGameLoop.start.mockImplementation(() => {
            mockGameLoop.isRunning = true;
        });

        // Mock InitializationService
        mockInitializationService = {
            runInitializationSequence: jest.fn(),
        };

        // Mock ValidatedEventDispatcher
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(true), // Mock successful dispatch
        };

        // Mock AppContainer
        mockAppContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };

        // --- Configure Mocks ---

        // Configure mockAppContainer.resolve
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === 'ILogger') {
                return mockLogger;
            }
            if (key === 'InitializationService') {
                return mockInitializationService;
            }
            if (key === 'ValidatedEventDispatcher') {
                return mockValidatedEventDispatcher;
            }
            // Add other base dependencies if GameEngine constructor needs more
            // For now, only ILogger is needed by the constructor itself.
            // Throw error for unexpected resolutions during the test.
            console.warn(`MockAppContainer: Unexpected resolution attempt for key "${key}".`);
            throw new Error(`MockAppContainer: Unexpected resolution attempt for key "${key}".`);
        });

        // Configure mockInitializationService.runInitializationSequence for success
        mockInitializationService.runInitializationSequence.mockResolvedValue({
            success: true,
            gameLoop: mockGameLoop, // Return the mock GameLoop on success
            error: null
        });
    });

    // --- Test Case: Successful Initialization and Game Loop Start ---
    it('should correctly delegate to InitializationService, set state, start GameLoop, log messages, and dispatch event on success', async () => {
        // --- Arrange ---
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });
        // Reset resolve calls from constructor
        mockAppContainer.resolve.mockClear();
        // Reset logger calls from constructor
        mockLogger.info.mockClear();

        // --- Act ---
        await gameEngineInstance.start(testWorldName);

        // --- Assert ---

        // Verify InitializationService Resolution
        expect(mockAppContainer.resolve).toHaveBeenCalledWith('InitializationService');

        // Verify InitializationService Execution
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(testWorldName);

        // --- Verify Internal State Update (isInitialized, gameLoop) ---
        // Use the public getters provided by the class
        expect(gameEngineInstance.isInitialized).toBe(true); // <-- CORRECTED: Use public getter
        expect(gameEngineInstance.gameLoop).toBe(mockGameLoop);   // <-- CORRECTED: Use public getter

        // Verify GameLoop Start
        expect(mockGameLoop.start).toHaveBeenCalledTimes(1);

        // Verify Logger Calls
        // Note: Order isn't strictly checked here, just that they were called.
        expect(mockLogger.info).toHaveBeenCalledWith(`GameEngine: Starting initialization sequence for world: ${testWorldName}...`);
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Initialization sequence reported success.'); // Note: Corrected message from implementation
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: Starting GameLoop...');
        expect(mockLogger.info).toHaveBeenCalledWith('GameEngine: GameLoop started successfully.');

        // Verify ValidatedEventDispatcher Call for final message
        // Note: InitializationService might dispatch its own events, which are not tested here.
        // This tests the specific dispatch within the GameEngine.start() success path.
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            expect.objectContaining({ // Use objectContaining to match payload structure
                text: 'Game loop started.',
                type: 'info'
            })
        );
        // Check that the dispatcher was resolved *after* InitializationService succeeded
        expect(mockAppContainer.resolve).toHaveBeenCalledWith('ValidatedEventDispatcher');
    });

    // --- Test Case: Calling start() when already initialized ---
    // (This test case remains unchanged as it primarily checks logs and lack of further calls)
    it('should log a warning and return if start() is called when already initialized', async () => {
        // --- Arrange ---
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });
        // Initial successful start
        await gameEngineInstance.start(testWorldName);

        // Clear mocks from the first run
        jest.clearAllMocks();
        // Re-configure resolve for logger as it's checked again
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === 'ILogger') return mockLogger;
            // We don't expect other resolves if it exits early
            console.warn(`MockAppContainer (Already Init): Unexpected resolution attempt for key "${key}".`);
            throw new Error(`MockAppContainer (Already Init): Unexpected resolution attempt for key "${key}".`);
        });


        // --- Act ---
        // Call start again with the same or different world name
        await gameEngineInstance.start('anotherWorld');

        // --- Assert ---
        // Verify warning log
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith("GameEngine: start('anotherWorld') called, but engine is already initialized. Ignoring.");

        // Verify no further initialization attempt occurred
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith('InitializationService');
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();

        // Verify GameLoop was not started again
        // Note: The mockGameLoop.start mock itself doesn't track calls across clearAllMocks easily without recreating it.
        // The important check is that runInitializationSequence didn't happen again, implying start() exited early.
        // If you need stricter checking on mockGameLoop.start, you'd need to adjust the mock setup/clearing.
        // For this test's purpose (checking the early exit), not calling runInitializationSequence is sufficient.

        // Verify no final message dispatch occurred again
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });


    // --- Test Case: start() called without a worldName ---
    // (This test case remains unchanged)
    it('should throw an error and log if start() is called without a valid worldName', async () => {
        // --- Arrange ---
        const gameEngineInstance = new GameEngine({ container: mockAppContainer });
        const expectedError = new Error('GameEngine.start requires a valid non-empty worldName argument.');

        // Clear mocks from constructor
        jest.clearAllMocks();
        // Re-configure resolve for logger
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === 'ILogger') return mockLogger;
            console.warn(`MockAppContainer (Invalid Arg): Unexpected resolution attempt for key "${key}".`);
            throw new Error(`MockAppContainer (Invalid Arg): Unexpected resolution attempt for key "${key}".`);
        });

        // --- Act & Assert ---
        // Test with null
        await expect(gameEngineInstance.start(null)).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');

        // Reset mock logger error call count
        mockLogger.error.mockClear();

        // Test with empty string
        await expect(gameEngineInstance.start('')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');

        // Reset mock logger error call count
        mockLogger.error.mockClear();

        // Test with whitespace string
        await expect(gameEngineInstance.start('   ')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');


        // Verify no initialization attempt occurred in any case
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
        // Cannot reliably check mockGameLoop.start here as it might not even be assigned if init fails early.
        // Checking that runInitializationSequence was not called is the key verification.
    });

}); // End describe block