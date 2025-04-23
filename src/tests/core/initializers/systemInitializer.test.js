// src/core/initializers/systemInitializer.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
// Assuming tests are in src/tests/** adjust path as needed
import SystemInitializer from '../../../core/initializers/systemInitializer.js';

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/appContainer.js').default} AppContainer */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../systems/interfaces/ISystem.js').ISystem} ISystem */

// --- Constant: Expected number of systems based on the REAL static list ---
const EXPECTED_SYSTEM_COUNT = 21; // Based on SystemInitializer.#systemsToInitialize

// --- Keys from the ACTUAL #systemsToInitialize list for targeted testing ---
const HAPPY_KEY_1 = 'GameRuleSystem';
const HAPPY_KEY_2 = 'MovementSystem';
const NO_INIT_KEY = 'InventorySystem'; // *Assumption*: This system doesn't have/need initialize
const FAIL_RESOLVE_KEY = 'CombatSystem';
const FAIL_INIT_KEY = 'HealthSystem';

// --- Test Suite ---
describe('SystemInitializer', () => {

    /** @type {jest.Mocked<AppContainer>} */
    let mockContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {SystemInitializer} */
    let systemInitializer;

    // --- Mocks for systems returned for SPECIFIC keys ---
    /** @type {jest.Mocked<ISystem & { initialize?: () => Promise<void> }>} */
    let mockSystemHappy1;
    /** @type {jest.Mocked<ISystem & { initialize?: () => Promise<void> }>} */
    let mockSystemHappy2;
    /** @type {jest.Mocked<ISystem & { someProperty?: string }>} */
    let mockSystemNoInit;
    /** @type {jest.Mocked<ISystem & { initialize?: () => Promise<void> }>} */
    let mockSystemFailInit;
    /** @type {jest.Mocked<ISystem & { initialize?: () => Promise<void> }>} */
    let mockSystemGeneric;


    // Errors used in tests
    const resolveError = new Error(`Mock resolve error for ${FAIL_RESOLVE_KEY}`);
    const initError = new Error(`Mock initialization error for ${FAIL_INIT_KEY}`);

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock ILogger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // Mock AppContainer
        mockContainer = {
            resolve: jest.fn(),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };

        // Create Mock System Instances
        mockSystemHappy1 = { initialize: jest.fn().mockResolvedValue(undefined) };
        mockSystemHappy2 = { initialize: jest.fn().mockResolvedValue(undefined) };
        mockSystemNoInit = { someProperty: 'value' }; // No initialize method intentionally
        mockSystemFailInit = { initialize: jest.fn().mockRejectedValue(initError) };
        mockSystemGeneric = { initialize: jest.fn().mockResolvedValue(undefined) };


        // Configure the main mockContainer.resolve using ACTUAL keys
        // This setup remains the same - it always includes the error conditions
        mockContainer.resolve.mockImplementation((key) => {
            switch (key) {
                case HAPPY_KEY_1:
                    return mockSystemHappy1;
                case HAPPY_KEY_2:
                    return mockSystemHappy2;
                case NO_INIT_KEY:
                    return mockSystemNoInit;
                case FAIL_RESOLVE_KEY:
                    throw resolveError;
                case FAIL_INIT_KEY:
                    return mockSystemFailInit;
                default:
                    return { initialize: jest.fn().mockResolvedValue(undefined), name: `Generic_${key}` };
            }
        });

        // Instantiate SystemInitializer
        systemInitializer = new SystemInitializer(mockContainer, mockLogger);
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        // ... (constructor tests remain the same) ...
        it('should throw an error if AppContainer is not provided', () => {
            expect(() => new SystemInitializer(null, mockLogger))
                .toThrow('SystemInitializer requires an AppContainer instance.');
            expect(() => new SystemInitializer(undefined, mockLogger))
                .toThrow('SystemInitializer requires an AppContainer instance.');
        });

        it('should throw an error if ILogger is not provided', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            expect(() => new SystemInitializer(mockContainer, null))
                .toThrow('SystemInitializer requires an ILogger instance.');
            expect(() => new SystemInitializer(mockContainer, undefined))
                .toThrow('SystemInitializer requires an ILogger instance.');
            expect(consoleErrorSpy).toHaveBeenCalledWith("SystemInitializer requires an ILogger instance.");
            consoleErrorSpy.mockRestore();
        });

        it('should create an instance and log debug message when valid dependencies are provided', () => {
            expect(systemInitializer).toBeInstanceOf(SystemInitializer);
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith("SystemInitializer instance created.");
        });
    });


    // --- initializeSystems Method Tests ---
    describe('initializeSystems', () => {

        it('[AC: Happy Path] should resolve, initialize systems, and log correctly despite background errors', async () => {
            // --- Act ---
            await systemInitializer.initializeSystems();

            // --- Assert ---
            // Log start and end
            expect(mockLogger.info).toHaveBeenCalledWith("SystemInitializer: Starting system initialization loop...");
            expect(mockLogger.info).toHaveBeenCalledWith("SystemInitializer: System initialization loop completed.");

            // Resolve calls
            expect(mockContainer.resolve).toHaveBeenCalledTimes(EXPECTED_SYSTEM_COUNT);
            expect(mockContainer.resolve).toHaveBeenCalledWith(HAPPY_KEY_1);
            expect(mockContainer.resolve).toHaveBeenCalledWith(HAPPY_KEY_2);

            // Initialize calls for happy path systems
            expect(mockSystemHappy1.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemHappy2.initialize).toHaveBeenCalledTimes(1);
            // Verify the failing init system *was* also called, because the loop continues
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1);

            // Logging for the specific happy path systems
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Attempting to resolve system: ${HAPPY_KEY_1}...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${HAPPY_KEY_1}...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${HAPPY_KEY_1} initialized successfully.`);
            // ... (logs for HAPPY_KEY_2) ...
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Attempting to resolve system: ${HAPPY_KEY_2}...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${HAPPY_KEY_2}...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${HAPPY_KEY_2} initialized successfully.`);

            // Expect background errors TO HAVE OCCURRED due to the full loop run
            expect(mockLogger.error).toHaveBeenCalledTimes(2); // 1 for resolve fail, 1 for init fail
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('[AC: System without initialize] should skip initialize and log debug, despite background errors', async () => {
            // --- Act ---
            await systemInitializer.initializeSystems();

            // --- Assert ---
            // Resolve calls
            expect(mockContainer.resolve).toHaveBeenCalledTimes(EXPECTED_SYSTEM_COUNT);
            expect(mockContainer.resolve).toHaveBeenCalledWith(NO_INIT_KEY);

            // Initialize calls - check others were called
            expect(mockSystemHappy1.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1); // This was called too

            // Logging for the specific NO_INIT_KEY system
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Attempting to resolve system: ${NO_INIT_KEY}...`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Resolved system '${NO_INIT_KEY}' has no initialize() method, skipping call.`);
            expect(mockLogger.info).not.toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${NO_INIT_KEY}...`);

            // Expect background errors TO HAVE OCCURRED
            expect(mockLogger.error).toHaveBeenCalledTimes(2); // 1 for resolve fail, 1 for init fail
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('[AC: Error during System Resolution] should log specific resolve error and continue', async () => {
            // --- Act ---
            let didThrow = false;
            try {
                await systemInitializer.initializeSystems();
            } catch (e) { didThrow = true; }

            // --- Assert ---
            expect(didThrow).toBe(false);

            // Resolve calls
            expect(mockContainer.resolve).toHaveBeenCalledTimes(EXPECTED_SYSTEM_COUNT);
            expect(mockContainer.resolve).toHaveBeenCalledWith(FAIL_RESOLVE_KEY);
            expect(mockContainer.resolve).toHaveBeenCalledWith(HAPPY_KEY_1); // Verify continuation

            // Initialize calls
            expect(mockSystemHappy1.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemHappy2.initialize).toHaveBeenCalledTimes(1);
            // **Correction**: Check that the init for the *other* failing system WAS called
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1);

            // Logging for the specific failure
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Attempting to resolve system: ${FAIL_RESOLVE_KEY}...`);
            // Check specific error message for RESOLVE failure
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemInitializer: Failed to resolve system '${FAIL_RESOLVE_KEY}'. Skipping initialization. Error: ${resolveError.message}`,
                resolveError
            );
            // Check total errors (resolve fail + init fail)
            expect(mockLogger.error).toHaveBeenCalledTimes(2);

            // Check completion log
            expect(mockLogger.info).toHaveBeenCalledWith("SystemInitializer: System initialization loop completed.");
        });

        it('[AC: Error during System Initialization] should log specific init error and continue', async () => {
            // --- Act ---
            let didThrow = false;
            try {
                await systemInitializer.initializeSystems();
            } catch (e) { didThrow = true; }

            // --- Assert ---
            expect(didThrow).toBe(false);

            // Resolve calls
            expect(mockContainer.resolve).toHaveBeenCalledTimes(EXPECTED_SYSTEM_COUNT);
            expect(mockContainer.resolve).toHaveBeenCalledWith(FAIL_INIT_KEY);
            expect(mockContainer.resolve).toHaveBeenCalledWith(HAPPY_KEY_1); // Verify continuation

            // Initialize calls
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1); // It WAS called
            expect(mockSystemHappy1.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemHappy2.initialize).toHaveBeenCalledTimes(1);


            // Logging for the specific failure
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${FAIL_INIT_KEY}...`);
            // Check specific error message for INIT failure
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemInitializer: Error during initialization of system '${FAIL_INIT_KEY}'. Continuing with others. Error: ${initError.message}`,
                initError
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith(`SystemInitializer: System ${FAIL_INIT_KEY} initialized successfully.`);
            // Check total errors (resolve fail + init fail)
            expect(mockLogger.error).toHaveBeenCalledTimes(2);

            // Check completion log
            expect(mockLogger.info).toHaveBeenCalledWith("SystemInitializer: System initialization loop completed.");
        });
    });
});