// src/tests/core/gameEngine.start.success.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // <<< ADD: Import tokens

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
// --- MODIFIED: Use correct type name (matches class name) ---
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
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */ // <<< RENAMED Type for clarity
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
            start: jest.fn().mockResolvedValue(undefined), // Ensure start returns a promise if awaited
            stop: jest.fn(),
            processSubmittedCommand: jest.fn(),
            isRunning: false, // Initial state
        };
        // Make start method toggle isRunning for realism if needed later
        mockGameLoop.start.mockImplementation(() => {
            mockGameLoop.isRunning = true;
            return Promise.resolve(); // Ensure it returns a resolved promise
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

        // Configure mockAppContainer.resolve using TOKENS
        mockAppContainer.resolve.mockImplementation((key) => {
            // --- FIXED: Use tokens for matching ---
            if (key === tokens.ILogger) {
                return mockLogger;
            }
            if (key === tokens.InitializationService) {
                return mockInitializationService;
            }
            // --- FIXED: Use correct token ---
            if (key === tokens.IValidatedEventDispatcher) {
                return mockValidatedEventDispatcher;
            }
            // Add other base dependencies if GameEngine constructor needs more
            // For now, only ILogger is needed by the constructor itself.
            // Throw error for unexpected resolutions during the test.
            console.warn(`MockAppContainer: Unexpected resolution attempt for key "${String(key)}".`); // Use String(key) for symbols
            throw new Error(`MockAppContainer: Unexpected resolution attempt for key "${String(key)}".`);
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
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        // Reset resolve calls from constructor (ILogger)
        mockAppContainer.resolve.mockClear();
        // Reset logger calls from constructor
        mockLogger.info.mockClear();

        // Re-configure resolve specifically for this test's Act phase
        // This overrides the beforeEach setup but ensures we only allow expected resolutions
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.InitializationService) {
                return mockInitializationService;
            }
            if (key === tokens.ILogger) { // Logger might be resolved again inside start
                return mockLogger;
            }
            if (key === tokens.IValidatedEventDispatcher) { // Expect dispatcher resolution
                return mockValidatedEventDispatcher;
            }
            console.warn(`MockAppContainer (Success Test): Unexpected resolution attempt for key "${String(key)}".`);
            throw new Error(`MockAppContainer (Success Test): Unexpected resolution attempt for key "${String(key)}".`);
        });


        // --- Act ---
        await gameEngineInstance.start(testWorldName);

        // --- Assert ---

        // Verify InitializationService Resolution
        // --- FIXED: Check with token ---
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);

        // Verify InitializationService Execution
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(testWorldName);

        // --- Verify Internal State Update (isInitialized, gameLoop) ---
        expect(gameEngineInstance.isInitialized).toBe(true);
        expect(gameEngineInstance.gameLoop).toBe(mockGameLoop);

        // Verify GameLoop Start
        expect(mockGameLoop.start).toHaveBeenCalledTimes(1);

        // Verify Logger Calls (Using objectContaining to be less brittle about exact call order)
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting initialization sequence for world: ${testWorldName}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Initialization sequence reported success'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Starting GameLoop...'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('GameLoop started successfully.'));
        // Check specific calls if order matters and constructor call is cleared
        // Example:
        // expect(mockLogger.info.mock.calls).toEqual([
        //     [`GameEngine: Starting initialization sequence for world: ${testWorldName}...`],
        //     ['GameEngine: Initialization sequence reported success.'],
        //     ['GameEngine: Starting GameLoop...'],
        //     ['GameEngine: GameLoop started successfully.']
        // ]);


        // Verify ValidatedEventDispatcher Resolution (happens after init success)
        // --- FIXED: Check with token ---
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);

        // Verify ValidatedEventDispatcher Call for final message
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Ensure it was called exactly once
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            expect.objectContaining({ // Use objectContaining to match payload structure
                text: 'Game loop started.',
                type: 'info'
            })
        );
    });

    // --- Test Case: Calling start() when already initialized ---
    it('should log a warning and return if start() is called when already initialized', async () => {
        // --- Arrange ---
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        // --- Initial successful start ---
        // Temporarily allow all expected resolutions for the first start
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.IValidatedEventDispatcher) return mockValidatedEventDispatcher;
            // Allow others if needed during the *first* setup
            return undefined; // Or throw if setup should be strict
        });
        await gameEngineInstance.start(testWorldName);
        expect(gameEngineInstance.isInitialized).toBe(true); // Verify first start worked


        // --- Clear mocks from the first run ---
        jest.clearAllMocks(); // Clears calls AND implementations if they were jest.fn()

        // --- Re-configure resolve for the SECOND call (should only resolve logger) ---
        mockAppContainer.resolve.mockImplementation((key) => {
            // --- FIXED: Use token ---
            if (key === tokens.ILogger) {
                return mockLogger;
            }
            // We don't expect other resolves if it exits early
            console.warn(`MockAppContainer (Already Init Test): Unexpected resolution attempt for key "${String(key)}".`);
            throw new Error(`MockAppContainer (Already Init Test): Unexpected resolution attempt for key "${String(key)}".`);
        });
        // Restore mock function implementations cleared by jest.clearAllMocks() if needed
        // (Example: if mockLogger methods were jest.fn() defined outside beforeEach)
        mockLogger.warn = jest.fn(); // Ensure warn is a fresh mock

        // --- Act ---
        // Call start again with the same or different world name
        await gameEngineInstance.start('anotherWorld');

        // --- Assert ---
        // Verify warning log
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith("GameEngine: start('anotherWorld') called, but engine is already initialized. Ignoring.");

        // Verify no further initialization attempt occurred
        // --- FIXED: Check with token ---
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.InitializationService);
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();

        // Verify GameLoop was not started again (start mock was cleared, so 0 calls expected)
        expect(mockGameLoop.start).not.toHaveBeenCalled();

        // Verify no final message dispatch occurred again
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });


    // --- Test Case: start() called without a worldName ---
    it('should throw an error and log if start() is called without a valid worldName', async () => {
        // --- Arrange ---
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        const expectedError = new Error('GameEngine.start requires a valid non-empty worldName argument.');

        // Clear mocks from constructor call
        jest.clearAllMocks();

        // Re-configure resolve - only Logger should be resolved before the argument check fails
        mockAppContainer.resolve.mockImplementation((key) => {
            // --- FIXED: Use token ---
            if (key === tokens.ILogger) {
                // Re-assign the mock logger instance if clearAllMocks removed it
                mockLogger = mockLogger || {error: jest.fn()}; // Ensure mockLogger exists
                mockLogger.error = mockLogger.error || jest.fn(); // Ensure error is mock fn
                return mockLogger;
            }
            console.warn(`MockAppContainer (Invalid Arg Test): Unexpected resolution attempt for key "${String(key)}".`);
            throw new Error(`MockAppContainer (Invalid Arg Test): Unexpected resolution attempt for key "${String(key)}".`);
        });
        // Ensure mockLogger.error is a mock function after clearAllMocks
        mockLogger.error = jest.fn();


        // --- Act & Assert ---
        // Test with null
        await expect(gameEngineInstance.start(null)).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);

        // Reset mock logger error call count
        mockLogger.error.mockClear();

        // Test with empty string
        await expect(gameEngineInstance.start('')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);

        // Reset mock logger error call count
        mockLogger.error.mockClear();

        // Test with whitespace string
        await expect(gameEngineInstance.start('   ')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);


        // Verify no initialization attempt occurred in any case
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
        expect(mockGameLoop.start).not.toHaveBeenCalled(); // Game loop shouldn't be started
        // Verify that dispatcher wasn't resolved or called
        // --- FIXED: Check token ---
        expect(mockAppContainer.resolve).not.toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });

}); // End describe block