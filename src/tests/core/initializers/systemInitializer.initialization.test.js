// src/tests/core/initializers/systemInitializer.initialization.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
// Adjust path as needed
import SystemInitializer from '../../../core/initializers/systemInitializer.js';
import {INITIALIZABLE} from "../../../core/config/tags.js";

// --- Type Imports for Mocks ---
// Using correct interface types based on SystemInitializer's constructor
/** @typedef {import('../../../core/interfaces/container.js').IServiceResolver} IServiceResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
// Base interface for systems - adjust if you have a more specific one
/** @typedef {{ initialize?: () => Promise<void> | void }} IInitializable */


// --- Test Suite ---
describe('SystemInitializer (Tag-Based)', () => {

    /** @type {jest.Mocked<IServiceResolver>} */ // Use IServiceResolver type
    let mockResolver;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {SystemInitializer} */
    let systemInitializer; // Instance for initializeAll tests
    /** @type {string} */
        // Define the tag value used in tests
    const testInitializationTag = INITIALIZABLE[0];

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

    // Errors used in tests
    const initError = new Error('Mock initialization error');
    const resolveTagError = new Error('Mock container resolveByTag error');

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock ILogger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // Mock IServiceResolver
        mockResolver = {
            resolveByTag: jest.fn(),
            // Add other methods if needed by specific tests, e.g., resolve()
        };

        // Create Mock System Instances
        mockSystemGood1 = {
            initialize: jest.fn().mockResolvedValue(undefined),
            constructor: {name: 'SystemGood1'}
        };
        mockSystemGood2 = {
            initialize: jest.fn().mockResolvedValue(undefined),
            constructor: {name: 'SystemGood2'}
        };
        mockSystemNoInit = {someOtherMethod: jest.fn(), constructor: {name: 'SystemNoInit'}};
        mockSystemFailInit = {
            initialize: jest.fn().mockRejectedValue(initError),
            constructor: {name: 'SystemFailInit'}
        };
        mockSystemBadInitType = {
            initialize: 'not a function',
            constructor: {name: 'SystemBadInitType'}
        };
        mockSystemNull = null;


        // Default setup for resolveByTag for initializeAll tests
        mockResolver.resolveByTag.mockReturnValue([
            mockSystemGood1,
            mockSystemNoInit,
            mockSystemFailInit,
            mockSystemGood2,
            mockSystemBadInitType,
            mockSystemNull
        ]);

        // Instantiate SystemInitializer with all 3 required args for initializeAll tests
        // <<< FIX: Added testInitializationTag >>>
        systemInitializer = new SystemInitializer(mockResolver, mockLogger, testInitializationTag);
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        // Define expected error messages for clarity
        const expectedResolverErrorMsg = 'SystemInitializer requires an IServiceResolver instance.';
        const expectedLoggerErrorMsg = 'SystemInitializer requires an ILogger instance.';
        const expectedResolveByTagErrorMsg = "SystemInitializer requires an IServiceResolver instance that supports 'resolveByTag'.";
        const expectedTagErrorMsg = 'SystemInitializer requires a non-empty string initializationTag.';

        it('should throw an error if IServiceResolver is not provided', () => {
            // <<< FIX: Added testInitializationTag >>>
            const action = () => new SystemInitializer(null, mockLogger, testInitializationTag);
            expect(action).toThrow(expectedResolverErrorMsg);
            // Logger is provided, should be called.
            expect(mockLogger.error).toHaveBeenCalledWith(expectedResolverErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });

        it('should throw an error if ILogger is not provided', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            // Need a valid resolver for this test
            const tempResolver = { resolveByTag: jest.fn() };
            // <<< FIX: Added testInitializationTag >>>
            const action = () => new SystemInitializer(tempResolver, null, testInitializationTag);
            expect(action).toThrow(expectedLoggerErrorMsg);
            // Logger is null, should use console.error.
            expect(consoleErrorSpy).toHaveBeenCalledWith(expectedLoggerErrorMsg);
            expect(mockLogger.error).not.toHaveBeenCalled(); // The global mockLogger wasn't used
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if IServiceResolver does not support resolveByTag', () => {
            // Create a mock object that is truthy but lacks the resolveByTag method
            const invalidResolver = { someOtherMethod: jest.fn() };
            // <<< FIX: Added testInitializationTag >>>
            // Cast to 'any' only to satisfy the compiler for the test setup, SystemInitializer expects IServiceResolver
            const action = () => new SystemInitializer(/** @type {any} */ (invalidResolver), mockLogger, testInitializationTag);
            expect(action).toThrow(expectedResolveByTagErrorMsg);
            // Logger is provided, should be called.
            expect(mockLogger.error).toHaveBeenCalledWith(expectedResolveByTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });

        // --- Tag Validation Tests ---
        // These tests require a valid resolver and logger to ensure the tag check is reached correctly.

        it('should throw an error if initializationTag is not provided (null)', () => {
            // <<< FIX: Added testInitializationTag (as null for this test) >>>
            const action = () => new SystemInitializer(mockResolver, mockLogger, null);
            expect(action).toThrow(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });

        it('should throw an error if initializationTag is not provided (undefined)', () => {
            // <<< FIX: Added testInitializationTag (as undefined for this test) >>>
            const action = () => new SystemInitializer(mockResolver, mockLogger, undefined);
            expect(action).toThrow(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });

        it('should throw an error if initializationTag is not a string', () => {
            // <<< FIX: Added testInitializationTag (as a number for this test) >>>
            const action = () => new SystemInitializer(mockResolver, mockLogger, /** @type {any} */ (123));
            expect(action).toThrow(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });

        it('should throw an error if initializationTag is an empty string', () => {
            // <<< FIX: Added testInitializationTag (as '' for this test) >>>
            const action = () => new SystemInitializer(mockResolver, mockLogger, '');
            expect(action).toThrow(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });

        it('should throw an error if initializationTag is a string with only whitespace', () => {
            // <<< FIX: Added testInitializationTag (as '  ' for this test) >>>
            const action = () => new SystemInitializer(mockResolver, mockLogger, '   ');
            expect(action).toThrow(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedTagErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });
        // --- End Tag Validation Tests ---

        it('should create an instance and log debug message when valid dependencies are provided', () => {
            // <<< FIX: Added testInitializationTag >>>
            const instance = new SystemInitializer(mockResolver, mockLogger, testInitializationTag);
            expect(instance).toBeInstanceOf(SystemInitializer);
            // Check the log message includes the correct tag
            expect(mockLogger.debug).toHaveBeenCalledWith(`SystemInitializer instance created. Will initialize systems tagged with '${testInitializationTag}'.`);
            // Ensure no errors or warnings were logged
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });


    // --- initializeAll Method Tests ---
    // These should now work correctly as they use the 'systemInitializer' instance
    // created in 'beforeEach', which now correctly receives all 3 arguments.
    describe('initializeAll', () => {

        it('[Happy Path] should resolve by tag, call initialize() only on valid systems, and log correctly', async () => {
            await systemInitializer.initializeAll();

            // Assertions remain the same, checking correct tag usage in logs/calls
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Starting initialization for systems tagged with '${testInitializationTag}'...`);
            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);
            // ... other assertions ...
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // From mockSystemFailInit
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // From mockSystemNull
        });

        it('[Empty Result] should handle container returning an empty array for the tag gracefully', async () => {
            mockResolver.resolveByTag.mockReturnValue([]);
            await systemInitializer.initializeAll();

            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Found 0 systems tagged with '${testInitializationTag}'.`);
            // ... other assertions ...
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('[Non-Array Result] should handle resolver returning non-array gracefully', async () => {
            mockResolver.resolveByTag.mockReturnValue({ not: 'an array' }); // Simulate non-array return
            await systemInitializer.initializeAll();

            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`did not return an array. Received: object. Treating as empty.`));
            expect(mockLogger.info).toHaveBeenCalledWith(`SystemInitializer: Found 0 systems tagged with '${testInitializationTag}'.`);
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only the non-array warning
        });


        it('[Error during resolveByTag] should log the error and re-throw', async () => {
            mockResolver.resolveByTag.mockRejectedValue(resolveTagError);
            await expect(systemInitializer.initializeAll())
                .rejects
                .toThrow(`Failed to resolve initializable systems using tag '${testInitializationTag}': ${resolveTagError.message}`);

            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to resolve systems by tag '${testInitializationTag}'`),
                resolveTagError
            );
            expect(mockLogger.info).not.toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');
        });

        it('[Error during System Initialization] should log specific init error and continue with others', async () => {
            mockResolver.resolveByTag.mockReturnValue([mockSystemGood1, mockSystemFailInit, mockSystemGood2]);
            await systemInitializer.initializeAll();

            expect(mockResolver.resolveByTag).toHaveBeenCalledWith(testInitializationTag);
            expect(mockSystemGood1.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemFailInit.initialize).toHaveBeenCalledTimes(1);
            expect(mockSystemGood2.initialize).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error during initialization of system '${mockSystemFailInit.constructor.name}'`),
                initError
            );
            // Should only have the one error from mockSystemFailInit
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('SystemInitializer: Initialization loop for tagged systems completed.');
        });
    });
});