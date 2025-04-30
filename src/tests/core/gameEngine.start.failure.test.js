// src/tests/core/gameEngine.start.failure.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
// --- Refactoring Specific Imports ---
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/initializers/services/initializationService.js').InitializationResult} InitializationResult */ // Added for clarity
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// InputHandler, InputElement, TitleElement potentially needed if fallback logic exists
/** @typedef {import('../../core/inputHandler.js').default} InputHandler */
/** @typedef {HTMLInputElement} MockInputElement */
/** @typedef {HTMLElement} MockTitleElement */

// --- Test Suite ---
describe('GameEngine start() - Failure Scenarios', () => {

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer>} */
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;
    /** @type {jest.Mocked<ShutdownService>} */
    let mockShutdownService;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockvalidatedEventDispatcher;
    /** @type {jest.Mocked<InputHandler>} */
    let mockInputHandler; // Kept for potential fallback tests
    /** @type {jest.Mocked<HTMLInputElement>} */
    let mockInputElement; // Kept for potential fallback tests
    /** @type {jest.Mocked<HTMLElement>} */
    let mockTitleElement; // Kept for potential fallback tests

    // Spy for global alert (if used in other tests)
    /** @type {jest.SpyInstance} */
    let alertSpy;

    // Variable to store the default resolve implementation
    /** @type {(key: string) => any} */
    let defaultResolveImplementation;

    // Helper function to access engine state via public getters
    // ** CORRECTION 1: Use public getters **
    let getIsInitialized;
    let getGameLoop;

    beforeEach(() => {
        jest.clearAllMocks();
        if (alertSpy) alertSpy.mockRestore();

        // --- Create Mocks ---
        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), processSubmittedCommand: jest.fn(), isRunning: false};
        // InitializationService mock is crucial for these tests
        mockInitializationService = { runInitializationSequence: jest.fn() };
        mockShutdownService = { runShutdownSequence: jest.fn() };
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockInputHandler = {setCommandCallback: jest.fn(), enable: jest.fn(), disable: jest.fn(), clear: jest.fn()};
        mockInputElement = {disabled: false};
        mockTitleElement = {textContent: ''};

        mockAppContainer = {resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn()};

        // --- Define the DEFAULT resolve implementation ---
        // This is used as a fallback by specific test setups
        defaultResolveImplementation = (key) => {
            switch (key) {
                case 'ILogger':
                    return mockLogger;
                // GameLoop is NOT resolved directly by start() anymore, but by InitializationService
                // case 'GameLoop': return mockGameLoop;
                case 'InitializationService': // Resolved by start()
                    return mockInitializationService;
                case 'ShutdownService':
                    return mockShutdownService;
                case 'ValidatedEventDispatcher': // Resolved by start() post-init and potentially by InitializationService internally
                    return mockvalidatedEventDispatcher;
                // Fallback related mocks - only resolved if specific error paths are taken
                case 'InputHandler':
                    return mockInputHandler;
                case 'inputElement':
                    return mockInputElement;
                case 'titleElement':
                    return mockTitleElement;

                // Other services previously resolved directly by GameEngine.#initialize are NO LONGER resolved here.
                // Mocks for WorldLoader, GameStateInitializer etc. are not needed for testing start() itself,
                // only for testing InitializationService or integration tests.

                default:
                    // console.warn(`Default mock resolve falling back for: ${key}`);
                    return undefined;
            }
        };

        // Set the initial mock implementation (for constructor and early checks)
        // Most tests will override this with more specific behavior
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === 'ILogger') {
                return mockLogger;
            }
            // Delegate to the more comprehensive default for other keys
            return defaultResolveImplementation(key);
        });

        // Spy on global alert (if needed)
        alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

        // ** CORRECTION 1: Define helpers after instance is potentially created **
        // Note: These will be redefined within tests where the instance is created to capture the correct instance.
        getIsInitialized = () => undefined; // Placeholder
        getGameLoop = () => null; // Placeholder

    });

    afterEach(() => {
        if (alertSpy) alertSpy.mockRestore();
        jest.clearAllMocks();
    });

    // ========================================================================= //
    // === Argument Validation Tests (Remain Unchanged)                      === //
    // ========================================================================= //
    describe('[TEST-ENG-014] GameEngine.start() Failure - Invalid worldName Argument', () => {
        const expectedErrorMsg = 'GameEngine.start requires a valid non-empty worldName argument.';
        const expectedLogMsg = 'GameEngine: Fatal Error - start() called without a valid worldName.';

        it('should reject, log error, and NOT call InitializationService or GameLoop when start() is called with empty string worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            const worldName = '';
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
        });

        it('should reject, log error, and NOT call InitializationService or GameLoop when start() is called with undefined worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            const worldName = undefined;
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
        });

        it('should reject, log error, and NOT call InitializationService or GameLoop when start() is called with null worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            const worldName = null;
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
        });

        it('should reject, log error, and NOT call InitializationService or GameLoop when start() is called with whitespace-only worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            const worldName = '   \t\n ';
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
        });
    });

    // ========================================================================= //
    // === InitializationService Interaction Failures (Revised State Checks) === //
    // ========================================================================= //
    describe('Sub-Ticket 20.3 / TEST-ENG-015: InitializationService Interaction Failures', () => {
        const worldName = 'testWorld';

        it('should reject, log critical error, and maintain clean state if InitializationService fails to resolve', async () => {
            const resolutionError = new Error('Simulated Init Service Resolution Failure');
            // Override resolve specifically for this test
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === 'ILogger') return mockLogger;
                if (key === 'InitializationService') throw resolutionError; // <<< Failure Point
                return defaultResolveImplementation(key); // Fallback for others (though none expected here)
            });

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear(); // Clear before action
            mockGameLoop.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(resolutionError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization service setup or invocation for world '${worldName}'`),
                resolutionError
            );
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // Should be false after failure
            expect(getGameLoop()).toBeNull();      // Should be null after failure
        });

        it('should reject, log critical error, and maintain clean state if runInitializationSequence rejects', async () => {
            const initError = new Error('Init Service Rejected');
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation); // Use default resolver
            mockInitializationService.runInitializationSequence.mockRejectedValue(initError); // Service call rejects

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear(); // Clear before action
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initError);
            // Error is logged from the *outer* catch block handling the service invocation itself
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization service setup or invocation for world '${worldName}'`),
                initError
            );
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // Should be false after failure
            expect(getGameLoop()).toBeNull();      // Should be null after failure
        });

        it('should reject, log sequence failure error, and maintain clean state if runInitializationSequence returns { success: false }', async () => {
            const initError = new Error('Init Service Reported Failure');
            const initResultFailure = { success: false, error: initError, gameLoop: null };
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation); // Use default resolver
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure); // Service reports failure

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear(); // Clear before action
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initError);
            // Error is logged from the 'else' block handling the failed initResult
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Initialization sequence failed for world '${worldName}'. Reason: ${initError.message}`),
                initError
            );
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // Should be false after failure
            expect(getGameLoop()).toBeNull();      // Should be null after failure
        });
    });

    // ========================================================================= //
    // === Tests for Failures Reported *by* InitializationService (Refactored w/ State Checks) === //
    // ========================================================================= //
    // These tests now verify GameEngine handles the failure *result*, not the internal cause.

    describe('[TEST-ENG-016 / 017 / 019 etc.] GameEngine Handling of InitializationService Reported Failures', () => {
        const worldName = 'testWorld';

        /**
         * Helper function to test GameEngine's reaction to a failed InitializationResult.
         * @param {Error} reportedError - The error the InitializationService mock should report.
         */
        const testHandlingOfReportedFailure = async (reportedError) => {
            // --- Arrange ---
            const initResultFailure = { success: false, error: reportedError, gameLoop: null };
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure); // Configure service to report failure
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation); // Ensure service is resolved successfully

            const gameEngineInstance = new GameEngine({ container: mockAppContainer });
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear(); // Clear before action
            mockGameLoop.start.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();

            // --- Act & Assert ---
            // 1. Verify GameEngine rejects with the error reported by the service
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(reportedError);

            // 2. Verify InitializationService was called
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);

            // 3. Verify GameEngine logs the failure reported by the service
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Initialization sequence failed for world '${worldName}'. Reason: ${reportedError.message}`),
                reportedError
            );

            // 4. Verify GameLoop was NOT started
            expect(mockGameLoop.start).not.toHaveBeenCalled();

            // 5. Verify internal state reflects failure
            expect(getIsInitialized()).toBe(false); // Should be false after failure
            expect(getGameLoop()).toBeNull();      // Should be null after failure

            // 6. Verify GameEngine itself doesn't dispatch detailed failure events
            // (Responsibility of InitializationService or its components)
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        };

        it('[TEST-ENG-016 Adaptation] should reject and log when InitializationService reports failure due to World Loading', async () => {
            await testHandlingOfReportedFailure(new Error('Simulated World Load Failed in Service'));
        });

        it('[TEST-ENG-017 Adaptation] should reject and log when InitializationService reports failure due to Game State Setup', async () => {
            await testHandlingOfReportedFailure(new Error('Simulated Game State Setup Failed in Service'));
        });

        it('[TEST-ENG-019 Adaptation] should reject and log when InitializationService reports failure due to World Entity Init', async () => {
            await testHandlingOfReportedFailure(new Error('Simulated World Entity Init Failed in Service'));
        });

        it('[NEW Adaptation] should reject and log when InitializationService reports failure due to System Init', async () => {
            await testHandlingOfReportedFailure(new Error('Simulated System Init Failed in Service'));
        });

        it('[NEW Adaptation] should reject and log when InitializationService reports failure due to Input Setup', async () => {
            await testHandlingOfReportedFailure(new Error('Simulated Input Setup Failed in Service'));
        });

        it('[TEST-ENG-033 Adaptation] should reject and log when InitializationService reports failure due to missing Player/Location', async () => {
            await testHandlingOfReportedFailure(new Error('Simulated missing Player/Location in Service'));
        });

        it('[NEW Adaptation] should reject and log when InitializationService reports failure resolving/providing GameLoop', async () => {
            await testHandlingOfReportedFailure(new Error('Simulated GameLoop Resolution Failed in Service'));
        });
    });


    // --- Test Case: TEST-ENG-022 (Fallback UI Disable) ---
    // This test is likely OBSOLETE for start(), as the catch block handling
    // InitializationService *resolution/invocation* errors doesn't contain UI disable logic.
    // This logic might exist elsewhere (e.g., stop()). Keeping structure but expecting non-calls.
    describe('[TEST-ENG-022 - Check Obsoletion] GameEngine Initialization (Failure) - Fallback UI Disable Attempt', () => {
        it('should NOT attempt to disable UI via InputHandler/inputElement if resolving InitializationService fails', async () => {
            // --- Arrange ---
            const worldName = 'testWorld';
            const initServiceResolveError = new Error('Init Service Gone');
            // Specific resolve mock for this test
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === 'ILogger') return mockLogger;
                if (key === 'InitializationService') throw initServiceResolveError;
                // Only mock things the error path *might* try to resolve (e.g., for logging)
                // Don't provide InputHandler/inputElement unless the code *actually* tries to resolve them here
                return undefined;
            });
            mockInputElement.disabled = false; // Start enabled
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear(); // Clear before action

            // --- Act ---
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initServiceResolveError);

            // --- Assert ---
            // Check logs for the critical resolution/invocation error (this should still happen)
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization service setup or invocation`),
                initServiceResolveError
            );

            // **** Verify fallback UI disable attempts are NOT made in this specific catch block ****
            // Check if resolve was called for InputHandler/inputElement *after* the initial setup
            const resolveCalls = mockAppContainer.resolve.mock.calls;
            const calledInputHandler = resolveCalls.some(call => call[0] === 'InputHandler');
            const calledInputElement = resolveCalls.some(call => call[0] === 'inputElement');
            expect(calledInputHandler).toBe(false); // Should not have tried to resolve InputHandler
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(calledInputElement).toBe(false); // Should not have tried to resolve inputElement
            expect(mockInputElement.disabled).toBe(false); // Should remain unchanged

            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // Check state consistency
            expect(getGameLoop()).toBeNull();
        });
    });

    // --- Test Case: TEST-ENG-030 (Restart After Failure / Ignore If Already Started) ---
    // Remains valid as it tests GameEngine's state management (isInitialized).
    describe('[TEST-ENG-030] GameEngine Start - State Handling (After Failure / Already Initialized)', () => {
        it('should allow restarting after a failed initialization attempt', async () => {
            const worldName = 'testWorld';
            const initFailError = new Error('Simulated Init Failure reported by Service');
            const initResultFail = { success: false, error: initFailError, gameLoop: null };
            const initResultSuccess = { success: true, error: null, gameLoop: mockGameLoop };

            // Configure service to fail first, then succeed
            mockInitializationService.runInitializationSequence
                .mockResolvedValueOnce(initResultFail)
                .mockResolvedValueOnce(initResultSuccess);

            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation); // Use default resolver
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear(); // Clear before action
            mockLogger.warn.mockClear(); // Clear warnings too
            mockGameLoop.start.mockClear();

            // Act 1: Fail
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initFailError);

            // Assert 1: State after failure
            expect(getIsInitialized()).toBe(false);
            expect(getGameLoop()).toBeNull();
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Logged the failure
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            mockLogger.warn.mockClear(); // Clear for next step

            // Act 2: Succeed
            await expect(gameEngineInstance.start(worldName)).resolves.toBeUndefined();

            // Assert 2: State after success
            expect(getIsInitialized()).toBe(true);
            expect(getGameLoop()).toBe(mockGameLoop);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(2);
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1); // Loop should start now
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('already initialized. Ignoring.'));
        });

        it('should warn and ignore if start() is called when already successfully initialized', async () => {
            const worldName = 'testWorld';
            const initResultSuccess = { success: true, error: null, gameLoop: mockGameLoop };
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation); // Use default resolver
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockGameLoop.start.mockClear(); // Clear before first action
            mockLogger.warn.mockClear();

            // Act 1: Successful start
            await gameEngineInstance.start(worldName);

            // Assert 1: State after success
            expect(getIsInitialized()).toBe(true);
            expect(getGameLoop()).toBe(mockGameLoop); // Check loop is also set
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1);
            mockLogger.warn.mockClear(); // Clear before second action
            mockInitializationService.runInitializationSequence.mockClear(); // Clear before second action
            mockGameLoop.start.mockClear(); // Clear before second action

            // Act 2: Call start again
            await gameEngineInstance.start(worldName);

            // Assert 2: Verify it ignored the second call
            expect(getIsInitialized()).toBe(true); // State remains true
            expect(getGameLoop()).toBe(mockGameLoop); // Loop remains the same
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`start('${worldName}') called, but engine is already initialized. Ignoring.`));
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
        });
    });

    // --- Test Case: TEST-ENG-031 (Inconsistent State) ---
    // Remains valid as it tests GameEngine's handling of the InitializationResult contract.
    describe('[TEST-ENG-031] GameEngine Start (Failure) - Inconsistent State Post-Successful Initialization Report', () => {
        it('should throw, log error, and prevent loop start if gameLoop is null after SUCCESSFUL init report', async () => {
            const worldName = 'testWorld';
            const initResultSuccessButNoLoop = { success: true, error: null, gameLoop: null }; // <<< Inconsistency
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccessButNoLoop);
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation); // Use default resolver

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            // ** CORRECTION 2: Update expected error message **
            const expectedThrownErrorMsg = 'GameEngine: Inconsistent state - Initialization reported success but provided no GameLoop.';
            mockLogger.error.mockClear(); // Clear before action
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedThrownErrorMsg);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            // Check if the correct error message is logged
            expect(mockLogger.error).toHaveBeenCalledWith(expectedThrownErrorMsg);
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // State reset
            expect(getGameLoop()).toBeNull();      // State reset
        });
    });

    // --- Test Case: TEST-ENG-032 (Dispatcher Failure Post-Init) ---
    // Remains valid as GameEngine itself resolves dispatcher for the final message.
    describe('[TEST-ENG-032] GameEngine Start - ValidatedEventDispatcher Resolution Failure Post-Init', () => {
        it('should log error but not fail overall initialization if dispatcher fails to resolve for final message', async () => {
            const worldName = 'testWorld';
            const dispatcherResolveError = new Error('Dispatcher Gone Post-Init');
            const initResultSuccess = { success: true, error: null, gameLoop: mockGameLoop }; // Successful init result
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess); // Mock service success

            // *** CORRECTED MOCK IMPLEMENTATION ***
            // Configure the resolver specifically for this test's scenario:
            // - Allow Logger and InitializationService to resolve.
            // - Throw an error when ValidatedEventDispatcher is requested (simulating failure during the post-start message dispatch).
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === 'ILogger') {
                    // console.log("TEST: Resolving ILogger"); // Debugging log
                    return mockLogger; // Needed by constructor
                }
                if (key === 'InitializationService') {
                    // console.log("TEST: Resolving InitializationService"); // Debugging log
                    return mockInitializationService; // Needed by start()
                }
                if (key === 'ValidatedEventDispatcher') {
                    // console.log("TEST: Resolving ValidatedEventDispatcher - THROWING"); // Debugging log
                    // This is the specific point we want to fail in this test
                    throw dispatcherResolveError;
                }
                // console.warn(`TEST: Unexpected resolve key: ${key}`); // Debugging log
                // Fallback to default just in case, though not expected here
                return defaultResolveImplementation(key);
            });
            // *** END CORRECTION ***

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            // ** CORRECTION 1: Use public getters for the specific instance **
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;

            // Clear mocks before the action
            mockLogger.error.mockClear();
            mockGameLoop.start.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();
            // It's generally good practice to clear interaction mocks before the action under test
            mockInitializationService.runInitializationSequence.mockClear();


            // Act: Start should still resolve successfully overall because the catch block logs but doesn't re-throw
            await expect(gameEngineInstance.start(worldName)).resolves.toBeUndefined();

            // Assert:
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName); // Init ran
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1); // Loop started
            expect(getIsInitialized()).toBe(true); // State is initialized
            expect(getGameLoop()).toBe(mockGameLoop); // Loop is stored

            // Verify resolve was attempted for the dispatcher (and failed, triggering the catch)
            // Need to check calls *after* the constructor call to ILogger
            const resolveCalls = mockAppContainer.resolve.mock.calls;
            const dispatcherCall = resolveCalls.find(call => call[0] === 'ValidatedEventDispatcher');
            expect(dispatcherCall).toBeDefined(); // Verify it was attempted

            // The attempt to resolve failed and should have logged the error
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Ensure error was logged exactly once
            expect(mockLogger.error).toHaveBeenCalledWith( // Check the logged error content
                expect.stringContaining('Failed to resolve or use ValidatedEventDispatcher to send post-start message'),
                dispatcherResolveError // Check that the correct error object was logged
            );

            // Dispatcher mock itself shouldn't have been called because resolution failed *before* dispatch
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });
    });


}); // End describe block for gameEngine.start.failure.test.js