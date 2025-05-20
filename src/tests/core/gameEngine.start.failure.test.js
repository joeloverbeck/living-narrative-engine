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
describe('GameEngine startNewGame() - Failure Scenarios', () => { // <<< UPDATED describe title

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
            stop: jest.fn().mockResolvedValue(undefined),
            setCurrentTurn: jest.fn() // Added setCurrentTurn mock for completeness
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
            if (key === tokens.GameLoop) return undefined; // GameEngine doesn't resolve GameLoop itself
            if (key === 'InputHandler') return mockInputHandler;
            if (key === 'inputElement') return mockInputElement;
            if (key === 'titleElement') return mockTitleElement;

            // Mocks for services resolved in GameEngine constructor
            if (key === tokens.PlaytimeTracker) return {
                getTotalPlaytime: jest.fn().mockReturnValue(0),
                setAccumulatedPlaytime: jest.fn()
            };
            if (key === tokens.GamePersistenceService) return {saveGame: jest.fn()};
            if (key === tokens.IDataRegistry) return {
                getLoadedModManifests: jest.fn().mockReturnValue([]),
                getModDefinition: jest.fn()
            };
            if (key === tokens.EntityManager) return {
                clearAll: jest.fn(),
                activeEntities: new Map(),
                addComponent: jest.fn(),
                getEntityDefinition: jest.fn()
            };
            if (key === tokens.WorldLoader) return {getActiveWorldName: jest.fn().mockReturnValue('TestWorld')};


            console.warn(`MockAppContainer (Failure Tests): Unexpected resolution attempt for key "${String(key)}". Returning undefined.`);
            return undefined;
        };

        // Initial mock for constructor calls
        mockAppContainer.resolve.mockImplementation((key) => {
            // All services resolved by constructor should use the defaultResolveImplementation
            return defaultResolveImplementation(key);
        });

        alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {
        });

        getIsInitialized = () => currentEngineInstance ? currentEngineInstance.isInitialized : false;

        const setCurrentEngineInstance = (instance) => {
            currentEngineInstance = instance;
        };

        // Ensure the spy is properly set up and restored if it was defined globally in your setup
        if (typeof global.setCurrentEngineInstance_TEST_HELPER === 'function') {
            jest.spyOn(global, 'setCurrentEngineInstance_TEST_HELPER').mockImplementation(setCurrentEngineInstance);
        } else {
            global.setCurrentEngineInstance_TEST_HELPER = setCurrentEngineInstance;
            jest.spyOn(global, 'setCurrentEngineInstance_TEST_HELPER');
        }
    });


    afterEach(() => {
        if (alertSpy) alertSpy.mockRestore();
        jest.clearAllMocks();
        // Ensure the spy is restored if it was created on the global object
        if (global.setCurrentEngineInstance_TEST_HELPER && global.setCurrentEngineInstance_TEST_HELPER.mockRestore) {
            global.setCurrentEngineInstance_TEST_HELPER.mockRestore();
        }
        currentEngineInstance = null;
    });

    // ========================================================================= //
    // === Argument Validation Tests                                        === //
    // ========================================================================= //
    describe('[TEST-ENG-014] GameEngine.startNewGame() Failure - Invalid worldName Argument', () => { // <<< UPDATED describe title
        const expectedErrorMsg = 'GameEngine.startNewGame requires a valid non-empty worldName argument.'; // <<< UPDATED error message
        const expectedLogMsg = 'GameEngine: Fatal Error - startNewGame() called without a valid worldName.'; // <<< UPDATED log message

        it('should reject, log error, and NOT call InitializationService or TurnManager when startNewGame() is called with empty string worldName', async () => { // <<< UPDATED test title
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            const worldName = '';
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(expectedErrorMsg); // <<< CORRECTED METHOD CALL
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when startNewGame() is called with undefined worldName', async () => { // <<< UPDATED test title
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            const worldName = undefined;
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(expectedErrorMsg); // <<< CORRECTED METHOD CALL
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when startNewGame() is called with null worldName', async () => { // <<< UPDATED test title
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            const worldName = null;
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(expectedErrorMsg); // <<< CORRECTED METHOD CALL
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when startNewGame() is called with whitespace-only worldName', async () => { // <<< UPDATED test title
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            const worldName = '   \t\n ';
            mockLogger.error.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(expectedErrorMsg); // <<< CORRECTED METHOD CALL
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(alertSpy).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });
    });

    // ========================================================================= //
    // === InitializationService Interaction Failures                        === //
    // ========================================================================= //
    describe('Sub-Ticket 20.3 / TEST-ENG-015: InitializationService Interaction Failures', () => {
        const worldName = 'testWorld';
        // Updated log message based on startNewGame's error handling
        const expectedCriticalLogSubstring = `GameEngine: CRITICAL ERROR during new game initialization or TurnManager startup for world '${worldName}'.`;

        it('should reject, log critical error, and maintain clean state if InitializationService fails to resolve', async () => {
            const resolutionError = new Error('Simulated Init Service Resolution Failure');
            // Configure mockAppContainer to throw error when InitializationService is resolved
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.PlaytimeTracker) return {
                    getTotalPlaytime: jest.fn().mockReturnValue(0),
                    setAccumulatedPlaytime: jest.fn()
                };
                if (key === tokens.GamePersistenceService) return {saveGame: jest.fn()};
                if (key === tokens.IDataRegistry) return {getLoadedModManifests: jest.fn().mockReturnValue([])};
                if (key === tokens.EntityManager) return {clearAll: jest.fn()}; // Needs clearAll for startNewGame
                if (key === tokens.InitializationService) throw resolutionError; // This is the one that should throw
                return defaultResolveImplementation(key); // Fallback for any other unexpected resolutions
            });

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear(); // Clear logs from constructor
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(resolutionError); // <<< CORRECTED METHOD CALL
            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedCriticalLogSubstring, // Corrected expected log message
                resolutionError
            );
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log critical error, and maintain clean state if runInitializationSequence rejects', async () => {
            const initError = new Error('Init Service Rejected');
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation); // Use default for successful resolutions
            mockInitializationService.runInitializationSequence.mockRejectedValue(initError);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(initError); // <<< CORRECTED METHOD CALL
            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedCriticalLogSubstring, // Corrected expected log message
                initError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log sequence failure error, and maintain clean state if runInitializationSequence returns { success: false }', async () => {
            const initError = new Error('Init Service Reported Failure');
            const initResultFailure = {success: false, error: initError, gameLoop: null};
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(initError); // <<< CORRECTED METHOD CALL
            // Updated expected log to match startNewGame's specific message for this case
            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${initError.message}`,
                initError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });
    });

    // ========================================================================= //
    // === Tests for Failures Reported *by* InitializationService             === //
    // ========================================================================= //
    describe('[TEST-ENG-016 / 017 / 019 etc.] GameEngine Handling of InitializationService Reported Failures', () => {
        const worldName = 'testWorld';

        const testHandlingOfReportedFailure = async (reportedError) => {
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            const initResultFailure = {success: false, error: reportedError, gameLoop: null};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();
            mockvalidatedEventDispatcher.dispatchValidated.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(reportedError); // <<< CORRECTED METHOD CALL
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            // Updated expected log for startNewGame
            expect(mockLogger.error).toHaveBeenCalledWith(
                `GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${reportedError.message}`,
                reportedError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
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
    // === Fallback UI Disable Test                                         === //
    // ========================================================================= //
    describe('[TEST-ENG-022 - Check Obsoletion] GameEngine Initialization (Failure) - Fallback UI Disable Attempt', () => {
        it('should NOT attempt to disable UI via InputHandler/inputElement if resolving InitializationService fails', async () => {
            const worldName = 'testWorld';
            const initServiceResolveError = new Error('Init Service Gone');
            const expectedCriticalLogSubstring = `GameEngine: CRITICAL ERROR during new game initialization or TurnManager startup for world '${worldName}'.`;


            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.PlaytimeTracker) return {
                    getTotalPlaytime: jest.fn().mockReturnValue(0),
                    setAccumulatedPlaytime: jest.fn()
                };
                if (key === tokens.GamePersistenceService) return {saveGame: jest.fn()};
                if (key === tokens.IDataRegistry) return {getLoadedModManifests: jest.fn().mockReturnValue([])};
                if (key === tokens.EntityManager) return {clearAll: jest.fn()}; // Needs clearAll for startNewGame
                if (key === tokens.InitializationService) throw initServiceResolveError; // Fail here during startNewGame
                // Fallback for any other constructor resolutions or unexpected resolutions
                return defaultResolveImplementation(key);
            });


            mockInputElement.disabled = false;
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            mockLogger.error.mockClear(); // Clear constructor logs
            mockInputHandler.disable.mockClear();
            // No need to clear and re-mock AppContainer.resolve if the initial setup is correct for the test case

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(initServiceResolveError); // <<< CORRECTED METHOD CALL

            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedCriticalLogSubstring,
                initServiceResolveError
            );

            // Check that specific services (like InputHandler) were not resolved *during* the failed startNewGame call
            // by examining the mockAppContainer.resolve calls.
            // The key is to differentiate calls from constructor vs. calls from startNewGame.
            // Since InitializationService fails early, others like InputHandler (if resolved by startNewGame) shouldn't be.
            // This assertion is a bit tricky if InputHandler is not directly resolved by startNewGame.
            // The important part is mockInputHandler.disable was not called.
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockInputElement.disabled).toBe(false);

            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled(); // Because InitService resolution failed
            expect(getIsInitialized()).toBe(false);
        });
    });

    // ========================================================================= //
    // === Restart / Ignore If Started Tests                                === //
    // ========================================================================= //
    describe('[TEST-ENG-030] GameEngine startNewGame() - State Handling (After Failure / Already Initialized)', () => { // <<< UPDATED describe title
        it('should allow restarting after a failed initialization attempt', async () => {
            const worldName = 'testWorld';
            const initFailError = new Error('Simulated Init Failure reported by Service');
            const initResultFail = {success: false, error: initFailError, gameLoop: null};
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};

            mockInitializationService.runInitializationSequence
                .mockResolvedValueOnce(initResultFail)
                .mockResolvedValueOnce(initResultSuccess);

            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(initFailError); // <<< CORRECTED METHOD CALL

            expect(getIsInitialized()).toBe(false);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(mockLogger.error).toHaveBeenCalledWith( // Updated expected log
                `GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${initFailError.message}`,
                initFailError
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();

            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).resolves.toBeUndefined(); // <<< CORRECTED METHOD CALL

            expect(getIsInitialized()).toBe(true);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(2);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenNthCalledWith(2, worldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
            // Updated log message check for startNewGame
            expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('already initialized. Please stop the engine first.'));
            expect(mockLogger.error).not.toHaveBeenCalled();
        });


        it('should warn and ignore if startNewGame() is called when already successfully initialized', async () => { // <<< UPDATED test title
            const worldName = 'testWorld';
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            mockTurnManager.start.mockClear();
            mockLogger.warn.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).resolves.toBeUndefined(); // <<< CORRECTED METHOD CALL

            expect(getIsInitialized()).toBe(true);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);

            mockLogger.warn.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();
            mockTurnManager.start.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).resolves.toBeUndefined(); // <<< CORRECTED METHOD CALL

            expect(getIsInitialized()).toBe(true);
            // Updated expected log message for startNewGame
            expect(mockLogger.warn).toHaveBeenCalledWith(`GameEngine: startNewGame('${worldName}') called, but engine is already initialized. Please stop the engine first.`);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
        });
    });

    // ========================================================================= //
    // === Inconsistent State Test                                           === //
    // ========================================================================= //
    describe('[TEST-ENG-031] GameEngine startNewGame() (Failure) - Inconsistent State Post-Successful Initialization Report', () => { // <<< UPDATED describe title
        const expectedCriticalLogSubstring = (worldName) => `GameEngine: CRITICAL ERROR during new game initialization or TurnManager startup for world '${worldName}'.`;
        const newErrorMsgFromOnGameReady = 'Failed to resolve ITurnManager in #onGameReady.';

        it('should reject, log error, and prevent turn start if TurnManager fails to resolve after SUCCESSFUL init report', async () => {
            const worldName = 'testWorld';
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            const turnManagerResolveError = new Error("Simulated TurnManager Resolution Failure"); // This is the original error

            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);

            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.PlaytimeTracker) return {
                    getTotalPlaytime: jest.fn().mockReturnValue(0),
                    setAccumulatedPlaytime: jest.fn()
                };
                if (key === tokens.GamePersistenceService) return {saveGame: jest.fn()};
                if (key === tokens.IDataRegistry) return {getLoadedModManifests: jest.fn().mockReturnValue([])};
                if (key === tokens.EntityManager) return {clearAll: jest.fn()};
                if (key === tokens.InitializationService) return mockInitializationService;
                if (key === tokens.ITurnManager) throw turnManagerResolveError; // Simulate original failure
                return defaultResolveImplementation(key);
            });

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear(); // Clear constructor logs
            mockTurnManager.start.mockClear();
            mockInitializationService.runInitializationSequence.mockClear();

            // Expect the new error message thrown by #onGameReady
            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(newErrorMsgFromOnGameReady);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(getIsInitialized()).toBe(false);

            // Check the log from #onGameReady (which logs the original error)
            expect(mockLogger.error).toHaveBeenCalledWith(
                "GameEngine.#onGameReady: Failed to resolve ITurnManager. Cannot start turns.",
                turnManagerResolveError // Original error
            );

            // Check the log from startNewGame's catch block (which logs the new error)
            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedCriticalLogSubstring(worldName),
                expect.objectContaining({message: newErrorMsgFromOnGameReady}) // New error
            );

            expect(mockTurnManager.start).not.toHaveBeenCalled();
        });

        it('should reject, log error, and prevent turn start if TurnManager.start() rejects after SUCCESSFUL init report', async () => {
            const worldName = 'testWorld';
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            const turnManagerStartError = new Error("Simulated TurnManager Start Failure");

            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);
            // mockTurnManager.start is configured in defaultResolveImplementation, reset and re-mock for this specific test.
            mockTurnManager.start = jest.fn().mockRejectedValue(turnManagerStartError);


            // Ensure AppContainer returns the re-mocked mockTurnManager
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ITurnManager) return mockTurnManager;
                return defaultResolveImplementation(key);
            });


            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            mockLogger.error.mockClear(); // Clear constructor logs
            // mockTurnManager.start.mockClear(); // Already cleared and re-assigned above
            mockInitializationService.runInitializationSequence.mockClear();


            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(turnManagerStartError);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
            expect(getIsInitialized()).toBe(false);

            // Check the log from #onGameReady (which logs the original error from turnManager.start())
            expect(mockLogger.error).toHaveBeenCalledWith(
                "GameEngine.#onGameReady: CRITICAL ERROR starting TurnManager.",
                turnManagerStartError
            );
            // Check the log from startNewGame's catch block (which also logs the original error because #onGameReady re-throws it)
            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedCriticalLogSubstring(worldName),
                turnManagerStartError
            );
        });
    });

}); // End describe block for gameEngine.start.failure.test.js