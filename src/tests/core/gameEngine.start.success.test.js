// src/tests/core/gameEngine.start.success.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // Import tokens

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */ // Still needed for InitializationResult type
/** @typedef {import('../../core/interfaces/ITurnManager.js').ITurnManager} ITurnManager */

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
    /** @type {jest.Mocked<ITurnManager>} */
    let mockTurnManager;

    const testWorldName = 'testWorld';

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock ILogger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // Mock GameLoop
        mockGameLoop = {};

        // Mock InitializationService
        mockInitializationService = {
            runInitializationSequence: jest.fn(),
        };

        // Mock ValidatedEventDispatcher
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(true),
        };

        // Mock TurnManager
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
        };

        // Mock AppContainer
        mockAppContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };

        // Configure default AppContainer resolve behavior
        mockAppContainer.resolve.mockImplementation((key) => {
            switch (key) {
                case tokens.ILogger:
                    return mockLogger;
                case tokens.InitializationService:
                    return mockInitializationService;
                case tokens.IValidatedEventDispatcher:
                    return mockValidatedEventDispatcher;
                case tokens.ITurnManager:
                    return mockTurnManager;
                case tokens.GameLoop:
                    return mockGameLoop;
                default:
                    console.warn(`MockAppContainer (beforeEach): Unexpected resolution attempt for key "${String(key)}".`);
                    throw new Error(`MockAppContainer (beforeEach): Unexpected resolution attempt for key "${String(key)}".`);
            }
        });

        // Configure default InitializationService success
        mockInitializationService.runInitializationSequence.mockResolvedValue({
            success: true,
            gameLoop: mockGameLoop,
            error: null
        });
    });

    // Test Case: Successful Initialization
    it('should correctly delegate to InitializationService, set state, start TurnManager, log messages, and dispatch event on success', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        mockAppContainer.resolve.mockClear(); // Clear constructor resolve call
        mockLogger.info.mockClear(); // Clear constructor log call

        await gameEngineInstance.start(testWorldName);

        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.InitializationService);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
        expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(testWorldName);
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.ITurnManager);
        expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
        expect(gameEngineInstance.isInitialized).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Starting initialization sequence for world: ${testWorldName}`));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Initialization sequence reported success'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Resolving TurnManager...'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Starting TurnManager...'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('TurnManager started successfully.'));
        expect(mockAppContainer.resolve).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'textUI:display_message',
            expect.objectContaining({text: 'Game ready. Turn processing started.', type: 'info'})
        );
    });

    // Test Case: Already Initialized
    it('should log a warning and return if start() is called when already initialized', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});

        // Initial successful start
        await gameEngineInstance.start(testWorldName);
        expect(gameEngineInstance.isInitialized).toBe(true);

        // Clear mocks from the first run
        jest.clearAllMocks();

        // Restore mocks needed for assertions (warn is the only one called)
        mockLogger.warn = jest.fn();
        // Note: We don't need to re-configure mockAppContainer.resolve for the second call,
        // because it should NOT be called at all.

        // Act: Call start again
        await gameEngineInstance.start('anotherWorld');

        // Assert: Verify warning log
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith("GameEngine: start('anotherWorld') called, but engine is already initialized. Ignoring.");

        // --- FIXED Assertions ---
        // Verify no services were resolved during the second call because it exited early
        expect(mockAppContainer.resolve).not.toHaveBeenCalled();

        // Verify no further initialization/startup attempt occurred
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
        expect(mockTurnManager.start).not.toHaveBeenCalled();
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });

    // Test Case: Invalid worldName
    it('should throw an error and log if start() is called without a valid worldName', async () => {
        const gameEngineInstance = new GameEngine({container: mockAppContainer});
        const expectedError = new Error('GameEngine.start requires a valid non-empty worldName argument.');

        jest.clearAllMocks(); // Clear constructor calls

        // Re-configure resolve strictly for this test - only Logger should be resolved (implicitly by constructor)
        // For the start call itself, only the error logger is needed before throwing.
        // We don't expect any *new* resolve calls during the failing start().
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) {
                mockLogger = mockLogger || {error: jest.fn()}; // Ensure mock exists
                mockLogger.error = mockLogger.error || jest.fn(); // Ensure error fn exists
                return mockLogger;
            }
            // This path shouldn't be hit if only logger error is called before throw
            console.warn(`MockAppContainer (Invalid Arg Test): Unexpected resolution attempt for key "${String(key)}".`);
            throw new Error(`MockAppContainer (Invalid Arg Test): Unexpected resolution attempt for key "${String(key)}".`);
        });
        // Ensure logger.error is a mock fn
        if (!mockLogger?.error || !jest.isMockFunction(mockLogger.error)) {
            mockLogger = {...mockLogger, error: jest.fn()};
        }
        mockAppContainer.resolve.mockClear(); // Clear potential mock re-creation resolve

        // Test null
        await expect(gameEngineInstance.start(null)).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        // Test empty string
        await expect(gameEngineInstance.start('')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        // Test whitespace string
        await expect(gameEngineInstance.start('   ')).rejects.toThrow(expectedError);
        expect(mockLogger.error).toHaveBeenCalledWith('GameEngine: Fatal Error - start() called without a valid worldName.');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        mockLogger.error.mockClear();

        // Verify no initialization/startup attempt occurred
        expect(mockAppContainer.resolve).not.toHaveBeenCalled(); // No *new* resolves during start calls
        expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
        expect(mockTurnManager.start).not.toHaveBeenCalled();
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
    });

}); // End describe block