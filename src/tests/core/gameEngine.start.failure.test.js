// src/tests/core/gameEngine.start.failure.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/config/appContainer.js'; // Needed for type checking and mock structure reference
import {tokens} from '../../core/config/tokens.js'; // <<< IMPORTED

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../core/turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../core/initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('../../core/initializers/services/initializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('../../core/shutdown/services/shutdownService.js').default} ShutdownService */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
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
    /** @type {jest.Mocked<ITurnManager>} */
    let mockTurnManager;
    /** @type {jest.Mocked<InitializationService>} */
    let mockInitializationService;
    /** @type {jest.Mocked<ShutdownService>} */
    let mockShutdownService;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockvalidatedEventDispatcher;
    /** @type {jest.Mocked<InputHandler>} */
    let mockInputHandler;
    /** @type {jest.Mocked<HTMLInputElement>} */
    let mockInputElement;
    /** @type {jest.Mocked<HTMLElement>} */
    let mockTitleElement;

    /** @type {jest.SpyInstance} */
    let alertSpy;

    /** @type {(key: any) => any} */
    let defaultResolveImplementation;

    let getIsInitialized;
    let currentEngineInstance = null;

    beforeEach(() => {
        jest.clearAllMocks();
        if (alertSpy) alertSpy.mockRestore();
        currentEngineInstance = null;

        mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
        mockGameLoop = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn(),
            processSubmittedCommand: jest.fn(),
            isRunning: false
        };
        mockTurnManager = {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined)
        };
        mockInitializationService = {runInitializationSequence: jest.fn()};
        mockShutdownService = {runShutdownSequence: jest.fn()};
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockInputHandler = {setCommandCallback: jest.fn(), enable: jest.fn(), disable: jest.fn(), clear: jest.fn()};
        mockInputElement = {disabled: false};
        mockTitleElement = {textContent: ''};

        mockAppContainer = {resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn()};

        defaultResolveImplementation = (key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.ShutdownService) return mockShutdownService;
            if (key === tokens.IValidatedEventDispatcher) return mockvalidatedEventDispatcher;
            if (key === tokens.ITurnManager) return mockTurnManager;
            if (key === tokens.GameLoop) return undefined;
            if (key === 'InputHandler') return mockInputHandler;
            if (key === 'inputElement') return mockInputElement;
            if (key === 'titleElement') return mockTitleElement;
            // For new services added to GameEngine constructor, ensure they can be resolved if needed by other tests using default.
            // For this specific failing test, they might not be directly used by the SUT's path after InitializationService fails to resolve.
            if (key === tokens.ISaveLoadService) return undefined; // Or a mock if its methods were called
            if (key === tokens.IDataRegistry) return undefined;    // Or a mock
            if (key === tokens.EntityManager) return undefined;      // Or a mock
            if (key === tokens.WorldLoader) return undefined; // Or a mock for WorldLoader

            return undefined;
        };

        // Initial mock for constructor calls
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === tokens.ILogger) return mockLogger;
            // ISaveLoadService, IDataRegistry, EntityManager will be resolved here by constructor using defaultResolveImplementation
            return defaultResolveImplementation(key);
        });

        alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {
        });

        getIsInitialized = () => currentEngineInstance ? currentEngineInstance.isInitialized : false;

        const setCurrentEngineInstance = (instance) => {
            currentEngineInstance = instance;
        };
        jest.spyOn(global, 'setCurrentEngineInstance_TEST_HELPER').mockImplementation(setCurrentEngineInstance);
    });

    global.setCurrentEngineInstance_TEST_HELPER = (instance) => {
    };

    afterEach(() => {
        if (alertSpy) alertSpy.mockRestore();
        jest.clearAllMocks();
        global.setCurrentEngineInstance_TEST_HELPER.mockRestore();
        currentEngineInstance = null;
    });

    // ========================================================================= //
    // === Argument Validation Tests (Unchanged)                             === //
    // ========================================================================= //
    describe('[TEST-ENG-014] GameEngine.start() Failure - Invalid worldName Argument', () => {
        const expectedErrorMsg = 'GameEngine.start requires a valid non-empty worldName argument.';
        const expectedLogMsg = 'GameEngine: Fatal Error - start() called without a valid worldName.';

        it('should reject, log error, and NOT call InitializationService or TurnManager when start() is called with empty string worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance); // Set instance for helpers
            const worldName = '';
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // State check
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when start() is called with undefined worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance); // Set instance for helpers
            const worldName = undefined;
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // State check
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when start() is called with null worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance); // Set instance for helpers
            const worldName = null;
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // State check
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when start() is called with whitespace-only worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance); // Set instance for helpers
            const worldName = '   \t\n ';
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false); // State check
        });
    });

    // ========================================================================= //
    // === InitializationService Interaction Failures (Corrected Expectations) === //
    // ========================================================================= //
    describe('Sub-Ticket 20.3 / TEST-ENG-015: InitializationService Interaction Failures', () => {
        const worldName = 'testWorld';
        const expectedCriticalLogSubstring = `CRITICAL ERROR during initialization or TurnManager startup for world '${worldName}'`;

        it('should reject, log critical error, and maintain clean state if InitializationService fails to resolve', async () => {
            const resolutionError = new Error('Simulated Init Service Resolution Failure');
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.InitializationService) throw resolutionError;
                return undefined;
            });

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(resolutionError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(expectedCriticalLogSubstring),
                resolutionError
            );
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            // No GameLoop check needed
        });

        it('should reject, log critical error, and maintain clean state if runInitializationSequence rejects', async () => {
            const initError = new Error('Init Service Rejected');
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            mockInitializationService.runInitializationSequence.mockRejectedValue(initError);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(expectedCriticalLogSubstring),
                initError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            // No GameLoop check needed
        });

        it('should reject, log sequence failure error, and maintain clean state if runInitializationSequence returns { success: false }', async () => {
            const initError = new Error('Init Service Reported Failure');
            const initResultFailure = {success: false, error: initError, gameLoop: null}; // gameLoop property in result is okay
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Initialization sequence failed for world '${worldName}'. Reason: ${initError.message}`),
                initError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            // No GameLoop check needed
        });
    });

    // ========================================================================= //
    // === Tests for Failures Reported *by* InitializationService (Corrected) === //
    // ========================================================================= //
    describe('[TEST-ENG-016 / 017 / 019 etc.] GameEngine Handling of InitializationService Reported Failures', () => {
        const worldName = 'testWorld';

        const testHandlingOfReportedFailure = async (reportedError) => {
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            // Init service *can* return a gameLoop reference in its result, even if GameEngine doesn't store it.
            const initResultFailure = {success: false, error: reportedError, gameLoop: null};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();
            mockInitializationService.runInitializationSequence.mockClear(); // Clear before call

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(reportedError);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Initialization sequence failed for world '${worldName}'. Reason: ${reportedError.message}`),
                reportedError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
            // No GameLoop check needed
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        };

        // --- No changes needed inside these 'it' blocks, testHandlingOfReportedFailure is corrected above ---
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
            // This tests if InitService *internally* fails to get GameLoop and reports failure
            await testHandlingOfReportedFailure(new Error('Simulated GameLoop Resolution Failed in Service'));
        });
    });


    // ========================================================================= //
    // === Fallback UI Disable Test (Corrected Expectation)                  === //
    // ========================================================================= //
    describe('[TEST-ENG-022 - Check Obsoletion] GameEngine Initialization (Failure) - Fallback UI Disable Attempt', () => {
        it('should NOT attempt to disable UI via InputHandler/inputElement if resolving InitializationService fails', async () => {
            const worldName = 'testWorld';
            const initServiceResolveError = new Error('Init Service Gone');

            // This initial mockAppContainer.resolve setup will be used by the GameEngine constructor
            // It allows ILogger, ISaveLoadService, IDataRegistry, EntityManager to be "resolved" (to undefined or mocks via default)
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                return defaultResolveImplementation(key);
            });

            mockInputElement.disabled = false;

            const gameEngineInstance = new GameEngine({container: mockAppContainer}); // Constructor calls resolve
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            mockLogger.error.mockClear();
            mockInputHandler.disable.mockClear();

            // Clear resolve calls made by the constructor and set up the specific behavior for the start() method call
            mockAppContainer.resolve.mockClear();
            mockAppContainer.resolve.mockImplementation((key) => {
                // This implementation is active *during* the gameEngineInstance.start() call
                if (key === tokens.ILogger) { // Logger might be called within start's try/catch
                    return mockLogger;
                }
                if (key === tokens.InitializationService) {
                    // This is the critical call within start() that we want to fail
                    throw initServiceResolveError;
                }
                // Any other unexpected resolve during start() can be handled or logged here
                // console.warn(`Unexpected resolve during start() for key: ${String(key)}`);
                return undefined;
            });

            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initServiceResolveError);

            const expectedCriticalLogSubstring = `CRITICAL ERROR during initialization or TurnManager startup for world '${worldName}'`;
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(expectedCriticalLogSubstring),
                initServiceResolveError
            );

            // Now, resolveCallsMadeDuringStart contains *only* calls made during gameEngineInstance.start()
            const resolveCallsMadeDuringStart = mockAppContainer.resolve.mock.calls;

            // Filter out any ILogger calls that might have occurred within the start method's error handling.
            const callsOfInterest = resolveCallsMadeDuringStart.filter(call => call[0] !== tokens.ILogger);

            expect(callsOfInterest).toHaveLength(1); // Should now be 1 (only InitializationService)
            expect(callsOfInterest[0][0]).toBe(tokens.InitializationService);

            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockInputElement.disabled).toBe(false);

            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });
    });

    // ========================================================================= //
    // === Restart / Ignore If Started Tests (Corrected)                   === //
    // ========================================================================= //
    describe('[TEST-ENG-030] GameEngine Start - State Handling (After Failure / Already Initialized)', () => {
        it('should allow restarting after a failed initialization attempt', async () => {
            const worldName = 'testWorld';
            const initFailError = new Error('Simulated Init Failure reported by Service');
            const initResultFail = {success: false, error: initFailError, gameLoop: null};
            // On success, InitService *does* provide the gameLoop instance in its result object
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};

            mockInitializationService.runInitializationSequence
                .mockResolvedValueOnce(initResultFail)    // First call fails
                .mockResolvedValueOnce(initResultSuccess); // Second call succeeds

            // Use default resolver - provides Logger, InitService, TurnManager etc.
            // No need for special GameLoop handling here in resolver, as GameEngine doesn't resolve it directly.
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance); // Set instance for getIsInitialized

            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear(); // Clear before calls

            // --- Act 1: Fail ---
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(initFailError);

            // --- Assert 1: State after failure ---
            expect(getIsInitialized()).toBe(false);
            // NO GameLoop check on engine instance needed
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            // Expect error log for the reported failure
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Initialization sequence failed for world '${worldName}'. Reason: ${initFailError.message}`),
                initFailError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();

            // Clear mocks before next action
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();
            // DO NOT clear runInitializationSequence mock calls yet

            // --- Act 2: Succeed ---
            await expect(gameEngineInstance.start(worldName)).resolves.toBeUndefined();

            // --- Assert 2: State after success ---
            expect(getIsInitialized()).toBe(true);
            // NO GameLoop check on engine instance needed
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(2);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenNthCalledWith(2, worldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1); // TurnManager started on success
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('already initialized. Ignoring.'));
            expect(mockLogger.error).not.toHaveBeenCalled(); // No new errors
        });


        it('should warn and ignore if start() is called when already successfully initialized', async () => {
            const worldName = 'testWorld';
            // InitService returns the mockGameLoop on success
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);

            // Use default resolver
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            mockTurnManager.start.mockClear();
            mockLogger.warn.mockClear();
            mockInitializationService.runInitializationSequence.mockClear(); // Clear before acting

            // --- Act 1: Successful start ---
            await expect(gameEngineInstance.start(worldName)).resolves.toBeUndefined(); // Ensure first start resolves

            // --- Assert 1: State after success ---
            expect(getIsInitialized()).toBe(true);
            // NO GameLoop check on engine instance needed
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1); // TurnManager was started

            // Clear mocks before next action
            mockLogger.warn.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            // --- Act 2: Call start again ---
            await expect(gameEngineInstance.start(worldName)).resolves.toBeUndefined(); // Second call should resolve immediately

            // --- Assert 2: Verify it ignored the second call ---
            expect(getIsInitialized()).toBe(true); // Still initialized
            // NO GameLoop check on engine instance needed
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`start('${worldName}') called, but engine is already initialized. Ignoring.`));
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled(); // Init service not called again
            expect(mockTurnManager.start).not.toHaveBeenCalled(); // Turn manager not started again
        });
    });

    // ========================================================================= //
    // === Inconsistent State Test (REVISED LOGIC)                          === //
    // ========================================================================= //
    describe('[TEST-ENG-031] GameEngine Start (Failure) - Inconsistent State Post-Successful Initialization Report', () => {
        it('should reject, log error, and prevent turn start if TurnManager fails to resolve after SUCCESSFUL init report', async () => {
            const worldName = 'testWorld';
            // Init service reports success and provides GameLoop object
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            const turnManagerResolveError = new Error("Simulated TurnManager Resolution Failure");
            const expectedCriticalLogSubstring = `CRITICAL ERROR during initialization or TurnManager startup for world '${worldName}'`;

            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);

            // Custom resolver: Return needed services, but fail for TurnManager
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.InitializationService) return mockInitializationService;
                if (key === tokens.ITurnManager) throw turnManagerResolveError; // <<< Fail here
                // Allow resolving dispatcher if needed for post-message (though it won't be reached)
                if (key === tokens.IValidatedEventDispatcher) return mockvalidatedEventDispatcher;
                return undefined; // Default undefined for others (including GameLoop)
            });

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            // --- Act ---
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(turnManagerResolveError);

            // --- Assert ---
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(getIsInitialized()).toBe(false); // Should reset state on critical error after init success report
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(expectedCriticalLogSubstring),
                turnManagerResolveError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled(); // TurnManager couldn't be resolved or started
            // No GameLoop check needed
        });

        it('should reject, log error, and prevent turn start if TurnManager.start() rejects after SUCCESSFUL init report', async () => {
            const worldName = 'testWorld';
            // Init service reports success
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            const turnManagerStartError = new Error("Simulated TurnManager Start Failure");
            const expectedCriticalLogSubstring = `CRITICAL ERROR during initialization or TurnManager startup for world '${worldName}'`;

            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);
            mockTurnManager.start.mockRejectedValue(turnManagerStartError); // Setup TurnManager mock to reject on start()

            // Default resolver should work here, provides mockTurnManager instance
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            // Ensure the rejection is set on the mock we'll use
            mockTurnManager.start.mockClear();
            mockTurnManager.start.mockRejectedValue(turnManagerStartError);
            mockInitializationService.runInitializationSequence.mockClear();

            // --- Act ---
            await expect(gameEngineInstance.start(worldName)).rejects.toThrow(turnManagerStartError);

            // --- Assert ---
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1); // Attempted to start
            expect(getIsInitialized()).toBe(false); // Reset state on critical error
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(expectedCriticalLogSubstring),
                turnManagerStartError
            );
            // No GameLoop check needed
        });
    });


}); // End describe block for gameEngine.start.failure.test.js