// src/tests/core/gameEngine.stop.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import GameEngine from '../../core/gameEngine.js'; // Class under test
import AppContainer from '../../core/appContainer.js'; // Needed for mock structure reference

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/gameLoop.js').default} GameLoop */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// Define a basic mock structure for systems with a shutdown method
/** @typedef {{ shutdown: jest.Mock<() => void> }} MockShutdownableSystem */
/** @typedef {import('../../systems/worldPresenceSystem.js').default} WorldPresenceSystem */ // Example system

// --- Test Suite ---
describe('GameEngine stop()', () => {

    // --- Mocks ---
    /** @type {jest.Mocked<AppContainer> & { disposeSingletons?: jest.Mock<() => void> }} */ // Make disposeSingletons optional
    let mockAppContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<GameLoop>} */
    let mockGameLoop;
    /** @type {jest.Mocked<MockShutdownableSystem>} */ // Using the generic type
    let mockWorldPresenceSystem;
    /** @type {GameEngine} */
    let gameEngineInstance;
    /** @type {jest.Mocked<EventBus>} */
    let mockEventBus;
    /** @type {jest.Mocked<GameDataRepository>} */
    let mockGameDataRepository;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockValidatedDispatcher;
    /** @type {jest.SpyInstance} */
    let consoleLogSpy;

    // REMOVED the spy helper - will modify getter directly in tests

    beforeEach(() => {
        // Clear mocks and spies before each test for isolation
        jest.clearAllMocks();
        if (consoleLogSpy) consoleLogSpy.mockRestore(); // Restore console spy

        // 1. Mock ILogger
        mockLogger = {
            info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
        };

        // 2. Mock GameLoop with an 'isRunning' getter
        mockGameLoop = {
            start: jest.fn(),
            stop: jest.fn(),
            processSubmittedCommand: jest.fn(),
            // Define the getter property on the mock object
            // Default to false, tests can override this directly
            get isRunning() { return false; },
        };
        // No spy setup needed here anymore

        // 3. Mock WorldPresenceSystem (as an example shutdownable system)
        mockWorldPresenceSystem = { shutdown: jest.fn() };

        // --- Mocks needed for internal state reset test (TEST-ENG-040) ---
        mockEventBus = { /* Basic mock, methods not called by stop() */ };
        mockGameDataRepository = { /* Basic mock, methods not called by stop() */ };
        mockValidatedDispatcher = { /* Basic mock, methods not called by stop() */ };

        // 4. Mock AppContainer (Default setup includes disposeSingletons for TEST-ENG-038)
        mockAppContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(), // Default includes the method
            reset: jest.fn(),
        };

        // 5. Configure Mock AppContainer.resolve (DEFAULT implementation)
        // This will be used unless overridden *before* instance creation in specific tests
        mockAppContainer.resolve.mockImplementation((key) => {
            if (key === 'ILogger') return mockLogger;
            // if (key === 'GameLoop') return mockGameLoop; // GameLoop is set manually
            if (key === 'WorldPresenceSystem') return mockWorldPresenceSystem; // Default returns the non-throwing mock
            return undefined;
        });

        // 6. Instantiate GameEngine (Using the DEFAULT mockAppContainer setup)
        gameEngineInstance = new GameEngine({ container: mockAppContainer });

        // 7. Manually set internal fields to simulate a "started" state before stop() is called
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Accessing private field for test setup
        gameEngineInstance['#gameLoop'] = mockGameLoop; // Set reference to mock loop
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Accessing private field for test setup
        gameEngineInstance['#isInitialized'] = true; // Simulate initialized state
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Accessing private field for test setup
        gameEngineInstance['#eventBus'] = mockEventBus;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Accessing private field for test setup
        gameEngineInstance['#gameDataRepository'] = mockGameDataRepository;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Accessing private field for test setup
        gameEngineInstance['#validatedDispatcher'] = mockValidatedDispatcher;


        // 8. Spy on console.log for TEST-ENG-040
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // --- Clear constructor/setup related calls ---
        // Must clear AFTER instance creation and manual field setting
        mockLogger.info.mockClear();
        mockAppContainer.resolve.mockClear(); // Clear resolve calls from constructor
    });

    afterEach(() => {
        // Restore spies
        if (consoleLogSpy) consoleLogSpy.mockRestore();
        // Restore original property descriptor for isRunning if modified
        Object.defineProperty(mockGameLoop, 'isRunning', {
            get: () => false, // Restore default behavior if needed
            configurable: true
        });
        jest.clearAllMocks();
    });

    // =========================================== //
    // === Test Cases === //
    // =========================================== //
    describe('GameLoop Handling', () => {

        it('[TEST-ENG-035] should NOT call GameLoop.stop() and log info when the loop is not running', () => {
            // --- Arrange ---
            // Ensure mock loop is not running (uses default getter returning false)
            // No need to redefine the getter here

            // --- Act ---
            gameEngineInstance.stop();

            // --- Assert ---
            expect(mockGameLoop.stop).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Stop requested.");
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: GameLoop already stopped or not initialized.");
            expect(mockLogger.info).not.toHaveBeenCalledWith("GameEngine: GameLoop stopped.");
        });

        it('[TEST-ENG-035 Alt] should NOT call GameLoop.stop() and log info when #gameLoop is null', () => {
            // --- Arrange ---
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - Accessing private field for test setup
            gameEngineInstance['#gameLoop'] = null; // Explicitly null the internal ref

            // --- Act ---
            gameEngineInstance.stop();

            // --- Assert ---
            expect(mockGameLoop.stop).not.toHaveBeenCalled(); // Original mock wasn't called
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Stop requested.");
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: GameLoop already stopped or not initialized.");
            expect(mockLogger.info).not.toHaveBeenCalledWith("GameEngine: GameLoop stopped.");
        });
    });

    describe('System Shutdown', () => {
        it('[TEST-ENG-036] should resolve and call shutdown() on specified systems (WorldPresenceSystem)', () => {
            // Arrange - Default setup uses the non-throwing mockWPS

            // Act
            gameEngineInstance.stop();

            // Assert
            expect(mockAppContainer.resolve).toHaveBeenCalledWith('WorldPresenceSystem');
            expect(mockWorldPresenceSystem.shutdown).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Shutting down system: WorldPresenceSystem...");
        });

        it('[TEST-ENG-037] should log warning and continue if a system fails to resolve during shutdown', () => {
            // --- Arrange ---
            const resolutionError = new Error("Cannot resolve WPS");
            // *** FIX START: Configure container THEN create instance ***
            const specificContainer = { // Create a container specific to this test
                resolve: jest.fn((key) => {
                    if (key === 'ILogger') return mockLogger;
                    if (key === 'WorldPresenceSystem') throw resolutionError; // Fail resolution
                    return undefined;
                }),
                register: jest.fn(),
                disposeSingletons: jest.fn(),
                reset: jest.fn(),
            };
            // Re-create instance with the failing resolver *for this test*
            gameEngineInstance = new GameEngine({ container: specificContainer });
            // Manually set fields again for the new instance
            // @ts-ignore
            gameEngineInstance['#gameLoop'] = mockGameLoop;
            // @ts-ignore
            gameEngineInstance['#isInitialized'] = true;
            // @ts-ignore
            gameEngineInstance['#eventBus'] = mockEventBus;
            // @ts-ignore
            gameEngineInstance['#gameDataRepository'] = mockGameDataRepository;
            // @ts-ignore
            gameEngineInstance['#validatedDispatcher'] = mockValidatedDispatcher;
            mockLogger.info.mockClear(); // Clear constructor log
            mockLogger.warn.mockClear();
            // *** FIX END ***

            // --- Act ---
            let stopError = null;
            try {
                gameEngineInstance.stop();
            } catch (error) {
                stopError = error;
            }

            // --- Assert ---
            expect(stopError).toBeNull(); // stop() should not throw the resolution error
            expect(specificContainer.resolve).toHaveBeenCalledWith('WorldPresenceSystem'); // Check the specific container's resolve
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "GameEngine: Could not resolve system 'WorldPresenceSystem' during shutdown.",
                resolutionError
            );
            expect(mockWorldPresenceSystem.shutdown).not.toHaveBeenCalled(); // Shutdown not called
            expect(mockLogger.info).not.toHaveBeenCalledWith("GameEngine: Shutting down system: WorldPresenceSystem...");
        });
    });


    // =========================================== //
    // === NEW TEST CASES FROM TICKETS === //
    // =========================================== //

    // --- Test Case: TEST-ENG-038 ---
    describe('[TEST-ENG-038] Container Singleton Disposal (Method Exists)', () => {
        it('should call disposeSingletons on the container and log info if the method exists', () => {
            // Arrange (Default beforeEach uses container with the method)
            expect(typeof mockAppContainer.disposeSingletons).toBe('function');

            // Act
            gameEngineInstance.stop();

            // Assert
            expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Disposing container singletons...");
        });

        it('should log error and continue if container.disposeSingletons() throws', () => {
            // Arrange
            const disposalError = new Error("Singleton disposal failed");
            // Configure the *default* container mock used by the instance
            mockAppContainer.disposeSingletons.mockImplementation(() => {
                throw disposalError;
            });
            mockLogger.error.mockClear();

            // Act
            let stopError = null;
            try {
                gameEngineInstance.stop(); // Uses instance from beforeEach
            } catch (error) {
                stopError = error;
            }

            // Assert
            expect(stopError).toBeNull(); // stop() should catch the error
            expect(mockAppContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith("GameEngine: Disposing container singletons...");
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith("GameEngine: Error during container singleton disposal:", disposalError);
        });
    });

    // --- Test Case: TEST-ENG-039 ---
    describe('[TEST-ENG-039] Container Singleton Disposal (Method Missing)', () => {
        // No instance recreation needed here - this beforeEach modifies the instance for the nested tests
        beforeEach(() => {
            // Arrange (Given)
            // Override the container mock specifically for this nested describe block
            mockAppContainer = {
                resolve: jest.fn((key) => key === 'ILogger' ? mockLogger : undefined),
                register: jest.fn(),
                reset: jest.fn(),
                // disposeSingletons is intentionally omitted
            };
            // Re-instantiate the engine with the container *lacking* the method
            gameEngineInstance = new GameEngine({ container: mockAppContainer });
            // Manually set internal fields again for the new instance
            // @ts-ignore
            gameEngineInstance['#gameLoop'] = mockGameLoop;
            // @ts-ignore
            gameEngineInstance['#isInitialized'] = true;
            // @ts-ignore
            gameEngineInstance['#eventBus'] = mockEventBus;
            // @ts-ignore
            gameEngineInstance['#gameDataRepository'] = mockGameDataRepository;
            // @ts-ignore
            gameEngineInstance['#validatedDispatcher'] = mockValidatedDispatcher;
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
        });

        it('should log a warning and complete without error if disposeSingletons is missing', () => {
            // Act
            let stopError = null;
            try {
                gameEngineInstance.stop();
            } catch (error) {
                stopError = error;
            }

            // Assert
            expect(stopError).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith("GameEngine: Container does not have a disposeSingletons method.");
            expect(mockAppContainer.disposeSingletons).toBeUndefined();
            expect(mockLogger.info).not.toHaveBeenCalledWith("GameEngine: Disposing container singletons...");
        });
    });

}); // End describe block