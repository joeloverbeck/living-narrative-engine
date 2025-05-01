// src/tests/core/gameEngine.start.failure.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // <<< IMPORTED

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
    /** @type {(key: any) => any} */ // <<< Changed key type to any to accept tokens
    let defaultResolveImplementation;

    // Helper function to access engine state via public getters
    let getIsInitialized;
    let getGameLoop;

    beforeEach(() => {
        jest.clearAllMocks();
        if (alertSpy) alertSpy.mockRestore();

        // --- Create Mocks ---
        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {start: jest.fn(), stop: jest.fn(), processSubmittedCommand: jest.fn(), isRunning: false};
        mockInitializationService = {runInitializationSequence: jest.fn()};
        mockShutdownService = {runShutdownSequence: jest.fn()};
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockInputHandler = {setCommandCallback: jest.fn(), enable: jest.fn(), disable: jest.fn(), clear: jest.fn()};
        mockInputElement = {disabled: false};
        mockTitleElement = {textContent: ''};

        mockAppContainer = {resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn()};

        // --- Define the DEFAULT resolve implementation using TOKENS ---
        defaultResolveImplementation = (key) => {
            // Use direct token comparison
            if (key === tokens.ILogger) {
                return mockLogger;
            }
            if (key === tokens.InitializationService) {
                return mockInitializationService;
            }
            if (key === tokens.ShutdownService) {
                return mockShutdownService;
            }
            if (key === tokens.IValidatedEventDispatcher) { // Use correct token
                return mockvalidatedEventDispatcher;
            }
            // Fallback related mocks (use string keys if they are simple DOM element IDs/selectors)
            if (key === 'InputHandler') { // Assuming InputHandler might still be string-based? Adjust if tokenized.
                return mockInputHandler;
            }
            if (key === 'inputElement') {
                return mockInputElement;
            }
            if (key === 'titleElement') {
                return mockTitleElement;
            }
            // Add other token checks as needed

            // Fallback if no match
            // console.warn(`Default mock resolve falling back for key:`, key); // Log the actual key
            return undefined;
        };

        // Set the initial mock implementation primarily for the constructor
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) { // <<< Use token for constructor
                return mockLogger;
            }
            // For other keys during initial setup (before specific test overrides),
            // delegate to the default implementation. This might be less common.
            return defaultResolveImplementation(key);
        });

        // Spy on global alert (if needed)
        alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {
        });

        getIsInitialized = () => undefined; // Placeholder
        getGameLoop = () => null; // Placeholder
    });

    afterEach(() => {
        if (alertSpy) alertSpy.mockRestore();
        jest.clearAllMocks();
    });

    // ========================================================================= //
    // === Argument Validation Tests (Unchanged)                             === //
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
    // === InitializationService Interaction Failures (Unchanged Structure)    === //
    // ========================================================================= //
    describe('Sub-Ticket 20.3 / TEST-ENG-015: InitializationService Interaction Failures', () => {
        const worldName = 'testWorld';

        it('should reject, log critical error, and maintain clean state if InitializationService fails to resolve', async () => {
            const resolutionError = new Error('Simulated Init Service Resolution Failure');
            // Override resolve using tokens
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.InitializationService) throw resolutionError; // <<< Failure Point (using token)
                return defaultResolveImplementation(key);
            });

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear();
            mockGameLoop.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(resolutionError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization service setup or invocation for world '${worldName}'`),
                resolutionError
            );
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            expect(getGameLoop()).toBeNull();
        });

        it('should reject, log critical error, and maintain clean state if runInitializationSequence rejects', async () => {
            const initError = new Error('Init Service Rejected');
            // Use default resolver which should correctly provide mockInitializationService via token now
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            mockInitializationService.runInitializationSequence.mockRejectedValue(initError);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear();
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization service setup or invocation for world '${worldName}'`),
                initError
            );
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            expect(getGameLoop()).toBeNull();
        });

        it('should reject, log sequence failure error, and maintain clean state if runInitializationSequence returns { success: false }', async () => {
            const initError = new Error('Init Service Reported Failure');
            const initResultFailure = {success: false, error: initError, gameLoop: null};
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation); // Use default resolver
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear();
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Initialization sequence failed for world '${worldName}'. Reason: ${initError.message}`),
                initError
            );
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            expect(getGameLoop()).toBeNull();
        });
    });

    // ========================================================================= //
    // === Tests for Failures Reported *by* InitializationService (Unchanged) === //
    // ========================================================================= //
    describe('[TEST-ENG-016 / 017 / 019 etc.] GameEngine Handling of InitializationService Reported Failures', () => {
        const worldName = 'testWorld';

        const testHandlingOfReportedFailure = async (reportedError) => {
            const initResultFailure = {success: false, error: reportedError, gameLoop: null};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure);
            // Use default resolver which should correctly provide mockInitializationService via token
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear();
            mockGameLoop.start.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(reportedError);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Initialization sequence failed for world '${worldName}'. Reason: ${reportedError.message}`),
                reportedError
            );
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            expect(getGameLoop()).toBeNull();
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


    // ========================================================================= //
    // === Fallback UI Disable Test (Unchanged / Likely Obsolete)            === //
    // ========================================================================= //
    describe('[TEST-ENG-022 - Check Obsoletion] GameEngine Initialization (Failure) - Fallback UI Disable Attempt', () => {
        it('should NOT attempt to disable UI via InputHandler/inputElement if resolving InitializationService fails', async () => {
            const worldName = 'testWorld';
            const initServiceResolveError = new Error('Init Service Gone');
            // Specific resolve mock using tokens
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.InitializationService) throw initServiceResolveError; // Fail using token
                return undefined; // Don't resolve anything else in this path
            });
            mockInputElement.disabled = false;
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initServiceResolveError);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization service setup or invocation`),
                initServiceResolveError
            );

            // Check if resolve was called for InputHandler/inputElement *after* the initial setup
            // Use the correct tokens if these are tokenized, otherwise keep strings if they are IDs/selectors
            const resolveCalls = mockAppContainer.resolve.mock.calls;
            const calledInputHandler = resolveCalls.some(call => call[0] === 'InputHandler'); // Assuming string key for this one
            const calledInputElement = resolveCalls.some(call => call[0] === 'inputElement'); // Assuming string key for this one
            expect(calledInputHandler).toBe(false);
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(calledInputElement).toBe(false);
            expect(mockInputElement.disabled).toBe(false);

            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            expect(getGameLoop()).toBeNull();
        });
    });

    // ========================================================================= //
    // === Restart / Ignore If Started Tests (Unchanged Structure)          === //
    // ========================================================================= //
    describe('[TEST-ENG-030] GameEngine Start - State Handling (After Failure / Already Initialized)', () => {
        it('should allow restarting after a failed initialization attempt', async () => {
            const worldName = 'testWorld';
            const initFailError = new Error('Simulated Init Failure reported by Service');
            const initResultFail = {success: false, error: initFailError, gameLoop: null};
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};

            mockInitializationService.runInitializationSequence
                .mockResolvedValueOnce(initResultFail)
                .mockResolvedValueOnce(initResultSuccess);

            // Use default resolver which should resolve InitService via token
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
            mockGameLoop.start.mockClear();

            // Act 1: Fail
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initFailError);

            // Assert 1: State after failure
            expect(getIsInitialized()).toBe(false);
            expect(getGameLoop()).toBeNull();
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            mockLogger.warn.mockClear();

            // Act 2: Succeed
            await expect(gameEngineInstance.start(worldName)).resolves.toBeUndefined();

            // Assert 2: State after success
            expect(getIsInitialized()).toBe(true);
            expect(getGameLoop()).toBe(mockGameLoop);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(2);
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('already initialized. Ignoring.'));
        });

        it('should warn and ignore if start() is called when already successfully initialized', async () => {
            const worldName = 'testWorld';
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);
            // Use default resolver which should resolve InitService via token
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            mockGameLoop.start.mockClear();
            mockLogger.warn.mockClear();

            // Act 1: Successful start
            await gameEngineInstance.start(worldName);

            // Assert 1: State after success
            expect(getIsInitialized()).toBe(true);
            expect(getGameLoop()).toBe(mockGameLoop);
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1);
            mockLogger.warn.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockGameLoop.start.mockClear();

            // Act 2: Call start again
            await gameEngineInstance.start(worldName);

            // Assert 2: Verify it ignored the second call
            expect(getIsInitialized()).toBe(true);
            expect(getGameLoop()).toBe(mockGameLoop);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`start('${worldName}') called, but engine is already initialized. Ignoring.`));
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockGameLoop.start).not.toHaveBeenCalled();
        });
    });

    // ========================================================================= //
    // === Inconsistent State Test (Unchanged Structure)                      === //
    // ========================================================================= //
    describe('[TEST-ENG-031] GameEngine Start (Failure) - Inconsistent State Post-Successful Initialization Report', () => {
        it('should throw, log error, and prevent loop start if gameLoop is null after SUCCESSFUL init report', async () => {
            const worldName = 'testWorld';
            const initResultSuccessButNoLoop = {success: true, error: null, gameLoop: null};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccessButNoLoop);
            // Use default resolver which should resolve InitService via token
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;
            const expectedThrownErrorMsg = 'GameEngine: Inconsistent state - Initialization reported success but provided no GameLoop.';
            mockLogger.error.mockClear();
            mockGameLoop.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedThrownErrorMsg);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedThrownErrorMsg);
            expect(mockGameLoop.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            expect(getGameLoop()).toBeNull();
        });
    });

    // ========================================================================= //
    // === Dispatcher Failure Post-Init Test (CORRECTED)                     === //
    // ========================================================================= //
    describe('[TEST-ENG-032] GameEngine Start - ValidatedEventDispatcher Resolution Failure Post-Init', () => {
        it('should log error but not fail overall initialization if dispatcher fails to resolve for final message', async () => {
            const worldName = 'testWorld';
            // This is the error we WANT to be thrown and caught
            const dispatcherResolveError = new Error('Dispatcher Gone Post-Init');
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);

            // *** CORRECTED MOCK IMPLEMENTATION for this specific test ***
            // Ensure it uses TOKENS and throws the correct error for the dispatcher token
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) {
                    return mockLogger; // Needed by constructor and start()
                }
                if (key === tokens.InitializationService) {
                    return mockInitializationService; // Needed by start()
                }
                if (key === tokens.IValidatedEventDispatcher) { // <<< USE TOKEN
                    // This is the specific point we want to fail in this test
                    throw dispatcherResolveError; // <<< THROW THE INTENDED ERROR
                }
                // Log unexpected calls during this specific test scenario for debugging
                console.warn(`[TEST-ENG-032] Unexpected resolve key:`, key);
                // Fallback using the default defined in beforeEach (which also uses tokens now)
                return defaultResolveImplementation(key);
            });
            // *** END CORRECTION ***

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            getIsInitialized = () => gameEngineInstance.isInitialized;
            getGameLoop = () => gameEngineInstance.gameLoop;

            mockLogger.error.mockClear();
            mockGameLoop.start.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();
            mockInitializationService.runInitializationSequence.mockClear(); // Clear before action

            // Act: Start should still resolve successfully overall
            await expect(gameEngineInstance.start(worldName)).resolves.toBeUndefined();

            // Assert:
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName); // Init ran
            expect(mockGameLoop.start).toHaveBeenCalledTimes(1); // Loop started
            expect(getIsInitialized()).toBe(true); // State is initialized
            expect(getGameLoop()).toBe(mockGameLoop); // Loop is stored

            // Verify the attempt to resolve the dispatcher using the TOKEN
            const resolveCalls = mockAppContainer.resolve.mock.calls;
            // Find the call where the argument was the dispatcher token
            const dispatcherCall = resolveCalls.find(call => call[0] === tokens.IValidatedEventDispatcher);
            expect(dispatcherCall).toBeDefined(); // Verify resolution was ATTEMPTED

            // Verify the CORRECT error was logged
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Ensure error was logged exactly once

            // *** CORRECTED ASSERTION for logged error ***
            expect(mockLogger.error).toHaveBeenCalledWith(
                // Check for the string logged by the actual code
                expect.stringContaining(`Failed to resolve or use ${tokens.IValidatedEventDispatcher} to send post-start message.`),
                // Check that the error caught and logged was the one we intended to throw
                dispatcherResolveError
            );
            // *** END CORRECTION ***

            // Dispatcher mock itself shouldn't have been called because resolution failed
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });
    });

}); // End describe block for gameEngine.start.failure.test.js