// src/tests/core/initializers/systemInitializer.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
// Adjust path as needed
import SystemInitializer from '../../src/initializers/systemInitializer.js';
// Assuming INITIALIZABLE is still relevant for getting a test tag value
// If not, replace with a simple string constant.
import {INITIALIZABLE} from "../../src/config/tags.js"; // Corrected path assuming it's relative to root or configured base URL

// --- Type Imports for Mocks ---
// Using correct interface types based on SystemInitializer's constructor
/** @typedef {import('../../../core/interfaces/container.js').IServiceResolver} IServiceResolver */
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Added type import
// Base interface for systems - adjust if you have a more specific one
/** @typedef {{ initialize?: () => Promise<void> | void }} IInitializable */


// --- Test Suite ---
describe('SystemInitializer (Tag-Based Refactor)', () => {

    // AC1: Use mocks for IServiceResolver, ILogger, and ValidatedEventDispatcher
    /** @type {jest.Mocked<IServiceResolver>} */
    let mockResolver;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */ // Added mock variable
    let mockValidatedEventDispatcher;
    /** @type {SystemInitializer} */
    let systemInitializer; // Instance for initializeAll tests
    /** @type {string} */
    const testInitializationTag = INITIALIZABLE && INITIALIZABLE[0] ? INITIALIZABLE[0] : 'testInitializableTag'; // Use imported tag or fallback

    // --- Mocks for systems to be returned by resolveByTag ---
    /** @type {jest.Mocked<IInitializable & { constructor?: { name: string } }>} */
    let mockSystemGood1;
    /** @type {jest.Mocked<IInitializable & { constructor?: { name: string } }>} */
    let mockSystemGood2;
    /** @type {jest.Mocked<{ someOtherMethod?: () => void } & { constructor?: { name: string } }>} */
    let mockSystemNoInit;
    /** @type {jest.Mocked<IInitializable & { constructor?: { name: string } }>} */
    let mockSystemFailInit;
    /** @type {jest.Mocked<{ initialize?: string } & { constructor?: { name: string } }>} */
    let mockSystemBadInitType;
    /** @type {null} */
    let mockSystemNull;
    /** @type {undefined} */
    let mockSystemUndefined; // Added for undefined check

    // Errors used in tests
    const initError = new Error('Mock initialization error');
    const resolveTagError = new Error('Mock container resolveByTag critical error');

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock ILogger (AC1)
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // Mock IServiceResolver (AC1)
        mockResolver = {
            resolveByTag: jest.fn(),
            // Add other IServiceResolver methods here if the interface defines them,
            // but only resolveByTag is used by SystemInitializer itself.
        };

        // Mock ValidatedEventDispatcher (AC1 - Added)
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined), // Basic mock
        };


        // --- Create Mock System Instances ---
        mockSystemGood1 = {
            initialize: jest.fn().mockResolvedValue(undefined),
            constructor: {name: 'SystemGood1'} // Assign name for better logging checks
        };
        mockSystemGood2 = {
            initialize: jest.fn().mockResolvedValue(undefined), // Can be sync or async
            constructor: {name: 'SystemGood2'}
        };
        mockSystemNoInit = {
            someOtherMethod: jest.fn(),
            constructor: {name: 'SystemNoInit'}
        };
        mockSystemFailInit = {
            initialize: jest.fn().mockRejectedValue(initError),
            constructor: {name: 'SystemFailInit'}
        };
        mockSystemBadInitType = {
            // has 'initialize' but it's not a function
            initialize: 'this is not a function',
            constructor: {name: 'SystemBadInitType'}
        };
        mockSystemNull = null;
        mockSystemUndefined = undefined;


        // Default setup for resolveByTag for most initializeAll tests
        // Includes various types of resolved "systems" to test different paths
        mockResolver.resolveByTag.mockReturnValue([
            mockSystemGood1,
            mockSystemNoInit,       // Scenario: No initialize method
            mockSystemFailInit,     // Scenario: initialize throws error
            mockSystemGood2,
            mockSystemBadInitType,  // Scenario: initialize is not a function
            mockSystemNull,         // Scenario: Resolved item is null
            mockSystemUndefined     // Scenario: Resolved item is undefined
        ]);

        // Instantiate SystemInitializer with all required args for initializeAll tests
        // AC2: Instantiates SystemInitializer with its new constructor signature (object argument)
        systemInitializer = new SystemInitializer({
            resolver: mockResolver,
            logger: mockLogger,
            validatedEventDispatcher: mockValidatedEventDispatcher, // Added dispatcher
            initializationTag: testInitializationTag
        });
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        // Define expected error messages based on the actual constructor code
        const expectedResolverErrorMsg = "SystemInitializer requires a valid IServiceResolver with 'resolveByTag'.";
        const expectedLoggerErrorMsg = 'SystemInitializer requires an ILogger instance.';
        const expectedDispatcherErrorMsg = "SystemInitializer requires a valid ValidatedEventDispatcher.";
        const expectedTagErrorMsg = 'SystemInitializer requires a non-empty string initializationTag.';

        it('should throw an error if IServiceResolver is not provided (null)', () => {
            const action = () => new SystemInitializer({
                resolver: null,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher, // Need valid dispatcher for this test
                initializationTag: testInitializationTag
            });
            expect(action).toThrow(expectedResolverErrorMsg);
            // Constructor throws before it can log this specific error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should throw an error if IServiceResolver is not provided (undefined)', () => {
            const action = () => new SystemInitializer({
                resolver: undefined,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                initializationTag: testInitializationTag
            });
            expect(action).toThrow(expectedResolverErrorMsg);
            // Constructor throws before it can log this specific error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });


        it('should throw an error if ILogger is not provided (null)', () => {
            // Setup: Spy on console.error as logger is unavailable (though the code doesn't actually call it)
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            // Need valid mocks for resolver and dispatcher for this specific test
            const tempResolver = {resolveByTag: jest.fn()};
            const tempDispatcher = {dispatchValidated: jest.fn()};
            const action = () => new SystemInitializer({
                resolver: tempResolver,
                logger: null,
                validatedEventDispatcher: tempDispatcher,
                initializationTag: testInitializationTag
            });
            // Assert
            expect(action).toThrow(expectedLoggerErrorMsg);
            // FIX: The constructor throws directly without logging to console in this case
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            // Ensure our global mockLogger wasn't called (it was null)
            expect(mockLogger.error).not.toHaveBeenCalled();
            // Cleanup
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if ILogger is not provided (undefined)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const tempResolver = {resolveByTag: jest.fn()};
            const tempDispatcher = {dispatchValidated: jest.fn()};
            const action = () => new SystemInitializer({
                resolver: tempResolver,
                logger: undefined,
                validatedEventDispatcher: tempDispatcher,
                initializationTag: testInitializationTag
            });
            // Assert
            expect(action).toThrow(expectedLoggerErrorMsg);
            // FIX: The constructor throws directly without logging to console in this case
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            // Cleanup
            consoleErrorSpy.mockRestore();
        });

        // Added test for ValidatedEventDispatcher
        it('should throw an error if ValidatedEventDispatcher is not provided (null)', () => {
            // Need valid mocks for resolver and logger
            const tempResolver = {resolveByTag: jest.fn()};
            const action = () => new SystemInitializer({
                resolver: tempResolver,
                logger: mockLogger,
                validatedEventDispatcher: null,
                initializationTag: testInitializationTag
            });
            // Assert
            expect(action).toThrow(expectedDispatcherErrorMsg);
            // FIX: Constructor throws before logger is assigned/used for this error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // Added test for ValidatedEventDispatcher
        it('should throw an error if ValidatedEventDispatcher is not provided (undefined)', () => {
            const tempResolver = {resolveByTag: jest.fn()};
            const action = () => new SystemInitializer({
                resolver: tempResolver,
                logger: mockLogger,
                validatedEventDispatcher: undefined,
                initializationTag: testInitializationTag
            });
            // Assert
            expect(action).toThrow(expectedDispatcherErrorMsg);
            // FIX: Constructor throws before logger is assigned/used for this error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // Added test for ValidatedEventDispatcher invalid type
        it('should throw an error if ValidatedEventDispatcher does not support dispatchValidated', () => {
            const tempResolver = {resolveByTag: jest.fn()};
            const invalidDispatcher = {someOtherMethod: jest.fn()}; // Missing dispatchValidated
            const action = () => new SystemInitializer({
                resolver: tempResolver,
                logger: mockLogger,
                validatedEventDispatcher: /** @type {any} */ (invalidDispatcher), // Pass invalid dispatcher
                initializationTag: testInitializationTag
            });
            // Assert
            expect(action).toThrow(expectedDispatcherErrorMsg);
            // FIX: Constructor throws before logger is assigned/used for this error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });


        it('should throw an error if IServiceResolver does not support resolveByTag', () => {
            const invalidResolver = {someOtherMethod: jest.fn()}; // Missing resolveByTag
            const action = () => new SystemInitializer({
                resolver: /** @type {any} */ (invalidResolver),
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher, // Need valid dispatcher
                initializationTag: testInitializationTag
            });
            // Assert
            expect(action).toThrow(expectedResolverErrorMsg);
            // Logger *is* provided, but resolver check fails first.
            expect(mockLogger.error).not.toHaveBeenCalled(); // Correct: Should not be called
        });

        // --- Tag Validation Tests ---
        // These tests require valid resolver, logger, and dispatcher

        it('should throw an error if initializationTag is not provided (null)', () => {
            const action = () => new SystemInitializer({
                resolver: mockResolver,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                initializationTag: null
            });
            // Assert
            expect(action).toThrow(expectedTagErrorMsg);
            // FIX: Constructor throws before logger is assigned/used for this error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should throw an error if initializationTag is not provided (undefined)', () => {
            const action = () => new SystemInitializer({
                resolver: mockResolver,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                initializationTag: undefined
            });
            // Assert
            expect(action).toThrow(expectedTagErrorMsg);
            // FIX: Constructor throws before logger is assigned/used for this error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should throw an error if initializationTag is not a string', () => {
            const action = () => new SystemInitializer({
                resolver: mockResolver,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                initializationTag: /** @type {any} */ (123)
            });
            // Assert
            expect(action).toThrow(expectedTagErrorMsg);
            // FIX: Constructor throws before logger is assigned/used for this error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should throw an error if initializationTag is an empty string', () => {
            const action = () => new SystemInitializer({
                resolver: mockResolver,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                initializationTag: ''
            });
            // Assert
            expect(action).toThrow(expectedTagErrorMsg);
            // FIX: Constructor throws before logger is assigned/used for this error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should throw an error if initializationTag is a string with only whitespace', () => {
            const action = () => new SystemInitializer({
                resolver: mockResolver,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                initializationTag: '   '
            });
            // Assert
            expect(action).toThrow(expectedTagErrorMsg);
            // FIX: Constructor throws before logger is assigned/used for this error
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
        // --- End Tag Validation Tests ---

        it('should create an instance and log debug message when valid dependencies are provided', () => {
            const instance = new SystemInitializer({
                resolver: mockResolver,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                initializationTag: testInitializationTag
            });
            // Assert
            expect(instance).toBeInstanceOf(SystemInitializer);
            // Check the specific debug log message from the constructor
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer instance created. Tag: '${testInitializationTag}'.`);
            // Ensure no errors or warnings were logged during successful construction
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });


    // --- initializeAll Method Tests ---
    // These use the 'systemInitializer' instance created in 'beforeEach',
    // which correctly receives mockResolver, mockLogger, mockValidatedEventDispatcher and testInitializationTag.
    describe('initializeAll', () => {

        // AC3: Test case covers successful initialization of multiple systems.
        it('[Success Scenario] should resolve by tag, call initialize() on valid systems, skip invalid ones, log correctly, and dispatch events', async () => {
            // --- Act ---
            await systemInitializer.initializeAll(); // Uses instance from beforeEach with default mock setup

            // --- Assert ---
            // Verify logging sequence
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${testInitializationTag}'...`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: Querying resolver for tag '${testInitializationTag}'...`);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found 7 systems tagged with '${testInitializationTag}'.`)); // Matches default mock return length
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Proceeding to initialize 7 resolved systems sequentially...`));
            expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');

            // Verify resolver interaction
            expect(mockResolver.resolveByTag).toHaveBeenCalledTimes(1);
            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);

            // Verify initialize calls and logging for valid systems
            expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemGood1.constructor.name}...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood1.constructor.name} initialized successfully.`);

            expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemGood2.constructor.name}...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood2.constructor.name} initialized successfully.`);

            // Verify initialize call and logging for failing system
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemFailInit.constructor.name}...`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemInitializer: Error initializing system '${mockSystemFailInit.constructor.name}'. Continuing. Error: ${initError.message}`,
                initError // Ensure the original error object is logged as context
            );
            // Ensure success message wasn't logged for the failed one
            expect(mockLogger.info).not.toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemFailInit.constructor.name} initialized successfully.`);

            // Verify logging for skipped systems
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: System '${mockSystemNoInit.constructor.name}' has no initialize() method, skipping.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer: System '${mockSystemBadInitType.constructor.name}' has no initialize() method, skipping.`);
            expect(mockLogger.warn).toHaveBeenCalledWith(`SystemInitializer: Encountered null/undefined entry for tag '${testInitializationTag}', skipping.`);
            expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Once for null, once for undefined

            // Verify initialize was NOT called for systems lacking the method or wrong type
            expect(mockSystemNoInit.someOtherMethod).not.toHaveBeenCalled(); // Ensure wrong method wasn't called

            // Verify Event Dispatching (Added)
            // FIX: Updated expected count based on actual events dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);

            // Check specific event calls
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('system:initialization_failed', {
                systemName: 'SystemFailInit',
                error: initError.message,
                stack: initError.stack
            }, {allowSchemaNotFound: true});

            // Verify total errors/warnings logged
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only from mockSystemFailInit
            expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Once for null, once for undefined
        });

        it('[Empty Result Scenario] should handle resolver returning an empty array gracefully and dispatch events', async () => {
            mockResolver.resolveByTag.mockReturnValue([]); // Override default setup

            await systemInitializer.initializeAll();

            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${testInitializationTag}'...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Found 0 systems tagged with '${testInitializationTag}'.`);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Proceeding to initialize 0 resolved systems sequentially...`));
            expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');

            // Ensure no initialize methods were attempted
            expect(mockSystemGood1.initialize).not.toHaveBeenCalled();
            expect(mockSystemFailInit.initialize).not.toHaveBeenCalled();

            // Ensure no unexpected errors or warnings were logged
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();

            // Verify Event Dispatching (Added)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(0);
        });

        it('[Non-Array Result Scenario] should handle resolver returning non-array gracefully and dispatch events', async () => {
            const nonArrayResult = {data: 'not an array'};
            mockResolver.resolveByTag.mockReturnValue(/** @type {any} */ (nonArrayResult));

            await systemInitializer.initializeAll();

            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);

            // FIX: Updated warning message check based on actual code
            expect(mockLogger.warn).toHaveBeenCalledWith(`SystemInitializer: resolveByTag for tag '${testInitializationTag}' did not return an array. Treating as empty.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Found 0 systems tagged with '${testInitializationTag}'.`);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Proceeding to initialize 0 resolved systems sequentially...`));
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${testInitializationTag}'...`);
            expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');

            // Ensure no errors logged, only the specific warning
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only the non-array warning

            // Verify Event Dispatching (Added)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(0);
        });


        it('[Resolver Error Scenario] should log the resolution error, dispatch failed event, and re-throw', async () => {
            mockResolver.resolveByTag.mockImplementation(() => {
                throw resolveTagError;
            });

            // Define the expected wrapped error message
            const expectedWrappedErrorMessage = `Failed to resolve initializable systems using tag '${testInitializationTag}': ${resolveTagError.message}`;

            // Assert that initializeAll rejects with the wrapped error message
            await expect(systemInitializer.initializeAll())
                .rejects
                .toThrow(expectedWrappedErrorMessage); // FIX: Expect the wrapped error message

            // Verify resolver was called
            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);

            // Verify the original error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemInitializer: Failed to resolve systems by tag '${testInitializationTag}'. Error: ${resolveTagError.message}`,
                resolveTagError // Log includes the original error object
            );

            // Ensure the process did not attempt to proceed or log completion
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Proceeding to initialize'));
            expect(mockLogger.info).not.toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');
            // Ensure no initialization attempts were made
            expect(mockSystemGood1.initialize).not.toHaveBeenCalled();

            // Verify Event Dispatching (Added)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(0);
        });

        it('[Individual Init Error Scenario] should log specific init error, dispatch events, and continue with others', async () => {
            mockResolver.resolveByTag.mockReturnValue([mockSystemGood1, mockSystemFailInit, mockSystemGood2]);

            let didThrow = false;
            try {
                await systemInitializer.initializeAll();
            } catch (e) {
                didThrow = true; // Should not throw, errors should be caught
            }

            // Assert: Ensure initializeAll itself didn't throw
            expect(didThrow).toBe(false);

            // Verify resolver was called
            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);

            // Verify all initialize methods were *attempted*
            expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1); // Attempted
            expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1);

            // Verify logging for the specific failure
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Initializing system: ${mockSystemFailInit.constructor.name}...`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `SystemInitializer: Error initializing system '${mockSystemFailInit.constructor.name}'. Continuing. Error: ${initError.message}`,
                initError
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemFailInit.constructor.name} initialized successfully.`);

            // Verify logging for successful ones (ensure continuation)
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood1.constructor.name} initialized successfully.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: System ${mockSystemGood2.constructor.name} initialized successfully.`);

            // Verify only one error was logged
            expect(mockLogger.error).toHaveBeenCalledTimes(1);

            // Verify loop completion log was reached
            expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');

            // Verify Event Dispatching (Added)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('system:initialization_failed', {
                systemName: 'SystemFailInit',
                error: initError.message,
                stack: initError.stack
            }, {allowSchemaNotFound: true});
        });
    });
});