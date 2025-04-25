// src/tests/core/initializers/systemInitializer.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
// Adjust path as needed
import SystemInitializer from '../../../core/initializers/systemInitializer.js';

// --- Type Imports for Mocks ---
/** @typedef {import('../../core/appContainer.js').default} AppContainer */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../systems/interfaces/ISystem.js').ISystem} ISystem */

// --- Constant for the tag ---
const INITIALIZATION_TAG = 'initializableSystem';

// --- Test Suite ---
describe('SystemInitializer (Tag-Based)', () => {

    /** @type {jest.Mocked<AppContainer>} */
    let mockContainer;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {SystemInitializer} */
    let systemInitializer;

    // --- Mocks for systems to be returned by resolveByTag ---
    /** @type {jest.Mocked<ISystem & { initialize?: () => Promise<void> }> & { name?: string }} */
    let mockSystemGood1;
    /** @type {jest.Mocked<ISystem & { initialize?: () => Promise<void> }> & { name?: string }} */
    let mockSystemGood2;
    /** @type {jest.Mocked<ISystem & { someOtherMethod?: () => void }> & { name?: string }} */
    let mockSystemNoInit;
    /** @type {jest.Mocked<ISystem & { initialize?: () => Promise<void> }> & { name?: string }} */
    let mockSystemFailInit;
    /** @type {jest.Mocked<ISystem & { initialize?: string }> & { name?: string }} */ // Initialize is not a function
    let mockSystemBadInitType;
    /** @type {null} */ // Simulate container returning null/undefined
    let mockSystemNull;

    // Errors used in tests
    const initError = new Error(`Mock initialization error`);
    const resolveTagError = new Error(`Mock container resolveByTag error`);

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock ILogger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // Mock AppContainer with resolveByTag
        mockContainer = {
            resolve: jest.fn(), // Keep resolve mock for potential other uses or future tests
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
            // AC4: Mock the container's tag resolution mechanism
            resolveByTag: jest.fn(),
        };

        // Create Mock System Instances with identifiable names
        mockSystemGood1 = {
            name: 'SystemGood1',
            initialize: jest.fn().mockResolvedValue(undefined),
            constructor: {name: 'SystemGood1'}
        };
        mockSystemGood2 = {
            name: 'SystemGood2',
            initialize: jest.fn().mockResolvedValue(undefined),
            constructor: {name: 'SystemGood2'}
        };
        mockSystemNoInit = {name: 'SystemNoInit', someOtherMethod: jest.fn(), constructor: {name: 'SystemNoInit'}}; // No initialize method intentionally
        mockSystemFailInit = {
            name: 'SystemFailInit',
            initialize: jest.fn().mockRejectedValue(initError),
            constructor: {name: 'SystemFailInit'}
        };
        mockSystemBadInitType = {
            name: 'SystemBadInitType',
            initialize: 'not a function',
            constructor: {name: 'SystemBadInitType'}
        };
        mockSystemNull = null;


        // Default setup for resolveByTag (can be overridden in tests)
        mockContainer.resolveByTag.mockReturnValue([
            mockSystemGood1,
            mockSystemNoInit,
            mockSystemFailInit,
            mockSystemGood2,
            mockSystemBadInitType,
            mockSystemNull
        ]);

        // Instantiate SystemInitializer
        systemInitializer = new SystemInitializer(mockContainer, mockLogger);
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should throw an error if AppContainer is not provided', () => {
            expect(() => new SystemInitializer(null, mockLogger))
                .toThrow('SystemInitializer requires an AppContainer instance.');
        });

        it('should throw an error if ILogger is not provided', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            // Pass a container *with* resolveByTag for this specific test
            const tempContainer = {resolveByTag: jest.fn()};
            expect(() => new SystemInitializer(tempContainer, null))
                .toThrow('SystemInitializer requires an ILogger instance.');
            expect(consoleErrorSpy).toHaveBeenCalledWith("SystemInitializer requires an ILogger instance.");
            consoleErrorSpy.mockRestore();
        });

        // AC3a Test: Ensure constructor checks for resolveByTag
        it('should throw an error if AppContainer does not support resolveByTag', () => {
            const invalidContainer = {resolve: jest.fn()}; // Missing resolveByTag
            expect(() => new SystemInitializer(invalidContainer, mockLogger))
                .toThrow("SystemInitializer requires an AppContainer instance that supports 'resolveByTag'.");
            // Check logger was called if provided (even though it throws)
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("supports 'resolveByTag'"));
        });


        it('should create an instance and log debug message when valid dependencies are provided', () => {
            expect(systemInitializer).toBeInstanceOf(SystemInitializer);
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith("SystemInitializer instance created.");
        });
    });


    // --- initializeAll Method Tests ---
    describe('initializeAll', () => { // Method name updated

        it('[AC4: Happy Path] should resolve by tag, call initialize() only on valid systems, and log correctly', async () => {
            // --- Act ---
            await systemInitializer.initializeAll();

            // --- Assert ---
            // Log start and end
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${INITIALIZATION_TAG}'...`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Querying container for tag '${INITIALIZATION_TAG}'...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Found 6 systems tagged with '${INITIALIZATION_TAG}'.`); // Based on default mock return
            expect(mockLogger.info).toHaveBeenCalledWith("SystemInitializer: Initialization loop for tagged systems completed.");

            // Verify resolveByTag was called correctly
            expect(mockContainer.resolveByTag).toHaveBeenCalledTimes(1);
            expect(mockContainer.resolveByTag).toHaveBeenCalledWith(INITIALIZATION_TAG);

            // Verify initialize calls for the systems that *should* be called
            expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1); // Called, but expected to fail

            // Verify initialize was NOT called for invalid/missing ones
            expect(mockSystemNoInit.someOtherMethod).not.toHaveBeenCalled(); // Ensure no other method was called accidentally
            // No initialize to check on mockSystemNoInit
            // No initialize to check on mockSystemBadInitType (it's a string)
            // No initialize to check on mockSystemNull

            // Logging for successful initializations
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemGood1.constructor.name}...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood1.constructor.name} initialized successfully.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemGood2.constructor.name}...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood2.constructor.name} initialized successfully.`);

            // Logging for the failing initialization
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemFailInit.constructor.name}...`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemInitializer: Error during initialization of system '${mockSystemFailInit.constructor.name}'. Continuing with others. Error: ${initError.message}`,
                initError
            );

            // Logging for skipped systems
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Resolved system '${mockSystemNoInit.constructor.name}' has no initialize() method or is not a function, skipping call.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Resolved system '${mockSystemBadInitType.constructor.name}' has no initialize() method or is not a function, skipping call.`);
            expect(mockLogger.warn).toHaveBeenCalledWith(`SystemInitializer: Encountered a null or undefined entry in resolved systems for tag '${INITIALIZATION_TAG}', skipping.`);


            // Check total errors (only the init fail in this setup)
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // For the null entry
        });

        it('[AC4: Empty Result] should handle container returning an empty array for the tag gracefully', async () => {
            mockContainer.resolveByTag.mockReturnValue([]); // Override default

            await systemInitializer.initializeAll();

            expect(mockContainer.resolveByTag).toHaveBeenCalledWith(INITIALIZATION_TAG);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${INITIALIZATION_TAG}'...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Found 0 systems tagged with '${INITIALIZATION_TAG}'.`);
            expect(mockLogger.info).toHaveBeenCalledWith("SystemInitializer: Initialization loop for tagged systems completed.");

            // Ensure no initialize methods were called
            expect(mockSystemGood1.initialize).not.toHaveBeenCalled();
            expect(mockSystemFailInit.initialize).not.toHaveBeenCalled();

            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });


        it('[AC4: Error during resolveByTag] should log the error and re-throw', async () => {
            mockContainer.resolveByTag.mockRejectedValue(resolveTagError); // Simulate container error

            await expect(systemInitializer.initializeAll())
                .rejects
                .toThrow(`Failed to resolve initializable systems: ${resolveTagError.message}`);

            expect(mockContainer.resolveByTag).toHaveBeenCalledWith(INITIALIZATION_TAG);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemInitializer: Failed to resolve systems by tag '${INITIALIZATION_TAG}'. Initialization cannot proceed. Error: ${resolveTagError.message}`,
                resolveTagError
            );

            // Ensure the loop completion message is NOT logged
            expect(mockLogger.info).not.toHaveBeenCalledWith("SystemInitializer: Initialization loop for tagged systems completed.");
            // Ensure no initialization attempts were made
            expect(mockSystemGood1.initialize).not.toHaveBeenCalled();
        });

        it('[AC4: Error during System Initialization] should log specific init error and continue with others', async () => {
            // Setup: Ensure resolveByTag returns the mock that throws on init
            mockContainer.resolveByTag.mockReturnValue([mockSystemGood1, mockSystemFailInit, mockSystemGood2]);

            let didThrow = false;
            try {
                await systemInitializer.initializeAll();
            } catch (e) {
                didThrow = true;
            }

            // Assert: Should not throw, should continue
            expect(didThrow).toBe(false);

            // Verify resolve was called
            expect(mockContainer.resolveByTag).toHaveBeenCalledWith(INITIALIZATION_TAG);

            // Verify all initialize methods were *attempted*
            expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1); // Attempted
            expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1);

            // Logging for the specific failure
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemFailInit.constructor.name}...`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemInitializer: Error during initialization of system '${mockSystemFailInit.constructor.name}'. Continuing with others. Error: ${initError.message}`,
                initError
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemFailInit.constructor.name} initialized successfully.`);

            // Logging for successful ones (verify continuation)
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood1.constructor.name} initialized successfully.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood2.constructor.name} initialized successfully.`);

            // Check total errors
            expect(mockLogger.error).toHaveBeenCalledTimes(1);

            // Check loop completion log
            expect(mockLogger.info).toHaveBeenCalledWith("SystemInitializer: Initialization loop for tagged systems completed.");
        });
    });
});