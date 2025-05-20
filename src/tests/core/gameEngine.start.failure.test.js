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
/** @typedef {import('../../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
// Updated to use IEntityManager for the type hint of the mock, aligning with resolution
/** @typedef {import('../../core/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../core/services/worldLoader.js').default} WorldLoader */


// --- Test Suite ---
describe('GameEngine startNewGame() - Failure Scenarios', () => {

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
    /** @type {jest.Mocked<PlaytimeTracker>} */
    let mockPlaytimeTracker;
    /** @type {jest.Mocked<IEntityManager>} */ // Updated mock type
    let mockEntityManager;


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
            setCurrentTurn: jest.fn()
        };
        mockInitializationService = {runInitializationSequence: jest.fn()};
        mockShutdownService = {runShutdownSequence: jest.fn()};
        mockvalidatedEventDispatcher = {dispatchValidated: jest.fn().mockResolvedValue(true)};
        mockInputHandler = {setCommandCallback: jest.fn(), enable: jest.fn(), disable: jest.fn(), clear: jest.fn()};
        mockInputElement = {disabled: false};
        mockTitleElement = {textContent: ''};

        mockPlaytimeTracker = {
            getTotalPlaytime: jest.fn().mockReturnValue(0),
            setAccumulatedPlaytime: jest.fn(),
            reset: jest.fn(),
            startSession: jest.fn(),
            endSessionAndAccumulate: jest.fn()
        };

        // Define the mock EntityManager separately for clarity
        mockEntityManager = {
            clearAll: jest.fn(),
            // Add other methods your GameEngine's constructor or tested methods might call on #entityManager
            // For example, if any of the tested failure paths somehow *successfully* resolve EntityManager
            // and then try to use it before failing for another reason.
            // Based on the current GameEngine constructor, only its existence is checked.
            // However, startNewGame does call clearAll().
        };

        mockAppContainer = {resolve: jest.fn(), register: jest.fn(), disposeSingletons: jest.fn(), reset: jest.fn()};

        defaultResolveImplementation = (key) => {
            if (key === tokens.ILogger) return mockLogger;
            if (key === tokens.InitializationService) return mockInitializationService;
            if (key === tokens.ShutdownService) return mockShutdownService;
            if (key === tokens.IValidatedEventDispatcher) return mockvalidatedEventDispatcher;
            if (key === tokens.ITurnManager) return mockTurnManager;
            if (key === tokens.GameLoop) return undefined;
            if (key === 'InputHandler') return mockInputHandler; // Assuming string key
            if (key === 'inputElement') return mockInputElement; // Assuming string key
            if (key === 'titleElement') return mockTitleElement; // Assuming string key
            if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
            if (key === tokens.GamePersistenceService) return {
                saveGame: jest.fn(),
                loadAndRestoreGame: jest.fn()
            };
            if (key === tokens.IDataRegistry) return {
                getLoadedModManifests: jest.fn().mockReturnValue([]),
                getModDefinition: jest.fn(),
                getEntityDefinition: jest.fn()
            };
            // VVVVVV MODIFIED VVVVVV
            // GameEngine now resolves IEntityManager. Ensure tests provide it.
            if (key === tokens.IEntityManager) return mockEntityManager;
            // ^^^^^^ MODIFIED ^^^^^^
            if (key === tokens.WorldLoader) return {
                getActiveWorldName: jest.fn().mockReturnValue('TestWorld')
            };

            // Fallback for any other unexpected resolutions in these failure tests.
            // This warning is helpful for debugging tests.
            console.warn(`MockAppContainer (Failure Tests): Unexpected resolution attempt for key "${String(key)}". Returning undefined by default for this test.`);
            return undefined;
        };

        mockAppContainer.resolve.mockImplementation((key) => {
            return defaultResolveImplementation(key);
        });

        alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {
        });

        getIsInitialized = () => currentEngineInstance ? currentEngineInstance.isInitialized : false;

        const setCurrentEngineInstance = (instance) => {
            currentEngineInstance = instance;
        };

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
        if (global.setCurrentEngineInstance_TEST_HELPER && global.setCurrentEngineInstance_TEST_HELPER.mockRestore) {
            global.setCurrentEngineInstance_TEST_HELPER.mockRestore();
        }
        currentEngineInstance = null;
    });

    describe('[TEST-ENG-014] GameEngine.startNewGame() Failure - Invalid worldName Argument', () => {
        const expectedErrorMsg = 'GameEngine.startNewGame requires a valid non-empty worldName argument.';
        const expectedLogMsg = 'GameEngine: Fatal Error - startNewGame() called without a valid worldName.';

        it('should reject, log error, and NOT call InitializationService or TurnManager when startNewGame() is called with empty string worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            const worldName = '';
            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when startNewGame() is called with undefined worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            const worldName = undefined;
            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when startNewGame() is called with null worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            const worldName = null;
            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log error, and NOT call InitializationService or TurnManager when startNewGame() is called with whitespace-only worldName', async () => {
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);
            const worldName = '   \t\n ';
            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(mockPlaytimeTracker.reset).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });
    });

    describe('Sub-Ticket 20.3 / TEST-ENG-015: InitializationService Interaction Failures', () => {
        const worldName = 'testWorld';
        const expectedCriticalLog = (worldNameProvided) => `GameEngine: CRITICAL ERROR during new game initialization or startup for world '${worldNameProvided}'.`;

        it('should reject, log critical error, and maintain clean state if InitializationService fails to resolve', async () => {
            const resolutionError = new Error('Simulated Init Service Resolution Failure');
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
                if (key === tokens.GamePersistenceService) return defaultResolveImplementation(key);
                if (key === tokens.IDataRegistry) return defaultResolveImplementation(key);
                if (key === tokens.IEntityManager) return mockEntityManager; // Ensure EntityManager is resolved for constructor
                if (key === tokens.InitializationService) throw resolutionError;
                return defaultResolveImplementation(key);
            });

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(resolutionError);

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedCriticalLog(worldName),
                resolutionError
            );
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log critical error, and maintain clean state if runInitializationSequence rejects', async () => {
            const initError = new Error('Init Service Rejected');
            mockInitializationService.runInitializationSequence.mockRejectedValue(initError);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(initError);

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedCriticalLog(worldName),
                initError
            );
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });

        it('should reject, log sequence failure error, and maintain clean state if runInitializationSequence returns { success: false }', async () => {
            const initError = new Error('Init Service Reported Failure');
            const initResultFailure = {success: false, error: initError, gameLoop: null};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(initError);

            expect(mockLogger.error).toHaveBeenCalledTimes(2);
            expect(mockLogger.error).toHaveBeenNthCalledWith(1,
                `GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${initError.message}`,
                initError
            );
            expect(mockLogger.error).toHaveBeenNthCalledWith(2,
                expectedCriticalLog(worldName),
                initError
            );
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(2);
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });
    });

    describe('[TEST-ENG-016 / 017 / 019 etc.] GameEngine Handling of InitializationService Reported Failures', () => {
        const worldName = 'testWorld';
        const expectedCriticalLog = (worldNameProvided) => `GameEngine: CRITICAL ERROR during new game initialization or startup for world '${worldNameProvided}'.`;

        const testHandlingOfReportedFailure = async (reportedError) => {
            const initResultFailure = {success: false, error: reportedError, gameLoop: null};
            // Ensure defaultResolveImplementation is used for basic setup
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultFailure);


            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            // Clear mocks that accumulate across testHandlingOfReportedFailure calls if not careful
            mockLogger.error.mockClear();
            mockPlaytimeTracker.reset.mockClear();
            mockTurnManager.start.mockClear();
            // mockInitializationService.runInitializationSequence is set per call, so no need to clear here

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(reportedError);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);

            expect(mockLogger.error).toHaveBeenCalledTimes(2);
            expect(mockLogger.error).toHaveBeenNthCalledWith(1,
                `GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${reportedError.message}`,
                reportedError
            );
            expect(mockLogger.error).toHaveBeenNthCalledWith(2,
                expectedCriticalLog(worldName),
                reportedError
            );
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(2);
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

    describe('[TEST-ENG-022 - Check Obsoletion] GameEngine Initialization (Failure) - Fallback UI Disable Attempt', () => {
        it('should NOT attempt to disable UI via InputHandler/inputElement if resolving InitializationService fails', async () => {
            const worldName = 'testWorld';
            const initServiceResolveError = new Error('Init Service Gone');
            const expectedCriticalLogMsg = `GameEngine: CRITICAL ERROR during new game initialization or startup for world '${worldName}'.`;

            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ILogger) return mockLogger;
                if (key === tokens.PlaytimeTracker) return mockPlaytimeTracker;
                if (key === tokens.GamePersistenceService) return defaultResolveImplementation(key); // Uses the outer default
                if (key === tokens.IDataRegistry) return defaultResolveImplementation(key);  // Uses the outer default
                if (key === tokens.IEntityManager) return mockEntityManager; // Ensure EntityManager is resolved
                if (key === tokens.InitializationService) throw initServiceResolveError;
                return defaultResolveImplementation(key); // Fallback using the outer default
            });

            mockInputElement.disabled = false;
            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(initServiceResolveError);

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedCriticalLogMsg,
                initServiceResolveError
            );
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockInputElement.disabled).toBe(false);
            expect(mockTurnManager.start).not.toHaveBeenCalled();
            expect(mockInitializationService.runInitializationSequence).not.toHaveBeenCalled();
            expect(getIsInitialized()).toBe(false);
        });
    });

    describe('[TEST-ENG-030] GameEngine startNewGame() - State Handling (After Failure / Already Initialized)', () => {
        const worldName = 'testWorld';
        const expectedCriticalLog = (worldNameProvided) => `GameEngine: CRITICAL ERROR during new game initialization or startup for world '${worldNameProvided}'.`;

        it('should allow restarting after a failed initialization attempt', async () => {
            const initFailError = new Error('Simulated Init Failure reported by Service');
            const initResultFail = {success: false, error: initFailError, gameLoop: null};
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};

            // Ensure standard mocks, including IEntityManager
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            mockInitializationService.runInitializationSequence
                .mockResolvedValueOnce(initResultFail)
                .mockResolvedValueOnce(initResultSuccess);


            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            // --- First attempt (failure) ---
            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(initFailError);

            expect(getIsInitialized()).toBe(false);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(1);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);

            expect(mockLogger.error).toHaveBeenCalledTimes(2);
            expect(mockLogger.error).toHaveBeenNthCalledWith(1,
                `GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${initFailError.message}`,
                initFailError
            );
            expect(mockLogger.error).toHaveBeenNthCalledWith(2,
                expectedCriticalLog(worldName),
                initFailError
            );
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(2);
            expect(mockTurnManager.start).not.toHaveBeenCalled();

            mockLogger.error.mockClear();
            mockLogger.warn.mockClear();
            mockPlaytimeTracker.reset.mockClear();
            mockPlaytimeTracker.startSession.mockClear();
            mockTurnManager.start.mockClear();

            // --- Second attempt (success) ---
            await expect(gameEngineInstance.startNewGame(worldName)).resolves.toBeUndefined();

            expect(getIsInitialized()).toBe(true);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(2);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenNthCalledWith(2, worldName);
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(1);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });


        it('should warn and ignore if startNewGame() is called when already successfully initialized', async () => {
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);
            // Ensure standard mocks, including IEntityManager
            mockAppContainer.resolve.mockImplementation(defaultResolveImplementation);

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            await expect(gameEngineInstance.startNewGame(worldName)).resolves.toBeUndefined();
            expect(getIsInitialized()).toBe(true);
            const initialRunSeqCalls = mockInitializationService.runInitializationSequence.mock.calls.length;
            const initialResetCalls = mockPlaytimeTracker.reset.mock.calls.length;
            const initialSessionCalls = mockPlaytimeTracker.startSession.mock.calls.length;
            const initialTurnStartCalls = mockTurnManager.start.mock.calls.length;


            mockLogger.warn.mockClear();

            await expect(gameEngineInstance.startNewGame(worldName)).resolves.toBeUndefined();

            expect(getIsInitialized()).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(`GameEngine: startNewGame('${worldName}') called, but engine is already initialized. Please stop the engine first.`);
            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledTimes(initialRunSeqCalls);
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(initialResetCalls);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(initialSessionCalls);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(initialTurnStartCalls);
        });
    });

    describe('[TEST-ENG-031] GameEngine startNewGame() (Failure) - Inconsistent State Post-Successful Initialization Report', () => {
        const worldName = 'testWorld';
        const expectedCriticalLog = (worldNameProvided) => `GameEngine: CRITICAL ERROR during new game initialization or startup for world '${worldNameProvided}'.`;
        const newErrorMsgFromOnGameReady = 'Failed to resolve ITurnManager in #onGameReady.';

        it('should reject, log error, and prevent turn start if TurnManager fails to resolve after SUCCESSFUL init report', async () => {
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            const turnManagerResolveError = new Error("Simulated TurnManager Resolution Failure");

            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);

            const originalResolve = defaultResolveImplementation; // Use the one from beforeEach
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ITurnManager) throw turnManagerResolveError;
                if (key === tokens.IEntityManager) return mockEntityManager; // Ensure EntityManager itself is fine
                return originalResolve(key);
            });

            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(newErrorMsgFromOnGameReady);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(getIsInitialized()).toBe(false);
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(2);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);

            expect(mockLogger.error).toHaveBeenCalledTimes(2);
            expect(mockLogger.error).toHaveBeenNthCalledWith(1,
                "GameEngine.#onGameReady: Failed to resolve ITurnManager. Cannot start turns.",
                turnManagerResolveError
            );
            expect(mockLogger.error).toHaveBeenNthCalledWith(2,
                expectedCriticalLog(worldName),
                expect.objectContaining({message: newErrorMsgFromOnGameReady})
            );
            expect(mockTurnManager.start).not.toHaveBeenCalled();

            mockAppContainer.resolve.mockImplementation(originalResolve);
        });

        it('should reject, log error, and prevent turn start if TurnManager.start() rejects after SUCCESSFUL init report', async () => {
            const initResultSuccess = {success: true, error: null, gameLoop: mockGameLoop};
            const turnManagerStartError = new Error("Simulated TurnManager Start Failure");

            mockInitializationService.runInitializationSequence.mockResolvedValue(initResultSuccess);
            mockTurnManager.start.mockRejectedValue(turnManagerStartError);

            const originalResolve = defaultResolveImplementation; // Use the one from beforeEach
            mockAppContainer.resolve.mockImplementation((key) => {
                if (key === tokens.ITurnManager) return mockTurnManager; // Ensure ITurnManager resolves
                if (key === tokens.IEntityManager) return mockEntityManager; // Ensure EntityManager itself is fine
                return originalResolve(key);
            });


            const gameEngineInstance = new GameEngine({container: mockAppContainer});
            global.setCurrentEngineInstance_TEST_HELPER(gameEngineInstance);

            await expect(gameEngineInstance.startNewGame(worldName)).rejects.toThrow(turnManagerStartError);

            expect(mockInitializationService.runInitializationSequence).toHaveBeenCalledWith(worldName);
            expect(mockTurnManager.start).toHaveBeenCalledTimes(1);
            expect(getIsInitialized()).toBe(false);
            expect(mockPlaytimeTracker.reset).toHaveBeenCalledTimes(2);
            expect(mockPlaytimeTracker.startSession).toHaveBeenCalledTimes(1);

            expect(mockLogger.error).toHaveBeenCalledTimes(2);
            expect(mockLogger.error).toHaveBeenNthCalledWith(1,
                "GameEngine.#onGameReady: CRITICAL ERROR starting TurnManager.",
                turnManagerStartError
            );
            expect(mockLogger.error).toHaveBeenNthCalledWith(2,
                expectedCriticalLog(worldName),
                turnManagerStartError
            );

            mockAppContainer.resolve.mockImplementation(originalResolve);
        });
    });
});